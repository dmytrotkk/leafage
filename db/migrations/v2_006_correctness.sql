alter table public.profiles add check ((timestamptz '2000-01-01 00:00+00' at time zone timezone) is not null);
alter table public.plants add check ((repot_target_cm is null) = (repot_after is null));
alter table public.events
  drop constraint events_photo_only,
  add constraint events_photo_path check ((type = 'photo') = (photo_url is not null)),
  add constraint events_void_reason check ((voided_at is null) = (voided_reason is null));
alter table public.pest_case
  add check ((status = 'cleared') = (closed_at is not null)),
  add check ((rounds = 0) = (last_treated is null));

create or replace function public.event_schema(t public.event_type) returns json language sql immutable set search_path = '' as $$
  select case t
    when 'watering' then '{"additionalProperties":false,"properties":{"method":{"enum":["top","basin","soak"],"type":"string"},"ml":{"anyOf":[{"maximum":9007199254740991,"minimum":0,"type":"integer"},{"type":"null"}]}},"required":["method","ml"],"type":"object"}'
    when 'feed' then '{"additionalProperties":false,"properties":{"dose_factor":{"type":"number"},"method":{"anyOf":[{"enum":["incorporate","drench","foliar"],"type":"string"},{"type":"null"}]},"supplement_id":{"type":"string"}},"required":["supplement_id","dose_factor","method"],"type":"object"}'
    when 'treatment' then '{"additionalProperties":false,"properties":{"agent":{"type":["string","null"]},"pest":{"enum":["spider_mites","mealybugs","scale","aphids","whitefly","thrips","ants","root_rot","fungal_leaf_spot"],"type":"string"},"round":{"maximum":9007199254740991,"minimum":1,"type":"integer"}},"required":["pest","agent","round"],"type":"object"}'
    when 'repot' then '{"additionalProperties":false,"properties":{"from_pot_id":{"type":["string","null"]},"root_pruned":{"type":"boolean"},"roots":{"enum":["healthy","rootbound","circling","dry","rotted","unknown"],"type":"string"},"substrate_id":{"type":["string","null"]},"to_pot_id":{"type":"string"}},"required":["from_pot_id","to_pot_id","substrate_id","roots","root_pruned"],"type":"object"}'
    when 'prune' then '{"additionalProperties":false,"properties":{"part":{"enum":["canopy","roots","deadwood","flowers","suckers"],"type":"string"}},"required":["part"],"type":"object"}'
    when 'measure' then '{"additionalProperties":false,"properties":{"canopy_cm":{"type":["number","null"]},"height_cm":{"type":["number","null"]},"trunk_mm":{"type":["number","null"]}},"required":["height_cm","canopy_cm","trunk_mm"],"type":"object"}'
    when 'diagnosis' then '{"additionalProperties":false,"properties":{"condition":{"anyOf":[{"enum":["critical","poor","stressed","good","thriving"],"type":"string"},{"type":"null"}]},"disorders":{"anyOf":[{"items":{"enum":["underwatering","overwatering","waterlogging","salt_buildup","low_light","sunburn","wind_damage","cold_damage","rootbound","n_deficiency","mg_deficiency","fe_deficiency"],"type":"string"},"type":"array"},{"type":"null"}]},"pests":{"anyOf":[{"items":{"additionalProperties":false,"properties":{"pest":{"enum":["spider_mites","mealybugs","scale","aphids","whitefly","thrips","ants","root_rot","fungal_leaf_spot"],"type":"string"},"status":{"enum":["suspected","confirmed","cleared"],"type":"string"}},"required":["pest","status"],"type":"object"},"type":"array"},{"type":"null"}]},"phase":{"anyOf":[{"enum":["dormant","vegetative","flowering","fruiting"],"type":"string"},{"type":"null"}]},"symptoms":{"anyOf":[{"items":{"enum":["chlorosis","interveinal_chlorosis","necrosis","tip_dieback","leaf_drop","wilting","curling","scorch","etiolation","stippling","webbing","honeydew","sooty_mold","stunted","no_fruit"],"type":"string"},"type":"array"},{"type":"null"}]}},"required":["condition","phase","symptoms","disorders","pests"],"type":"object"}'
    when 'move' then '{"additionalProperties":false,"properties":{"light":{"anyOf":[{"enum":["bright_shade","part_sun","full_sun"],"type":"string"},{"type":"null"}]},"location":{"anyOf":[{"enum":["indoor","balcony","quarantine"],"type":"string"},{"type":"null"}]}},"required":["location","light"],"type":"object"}'
    when 'photo' then '{"additionalProperties":false,"properties":{"shot":{"anyOf":[{"enum":["full","closeup","leaves","underside","soil","roots","pot","group"],"type":"string"},{"type":"null"}]}},"required":["shot"],"type":"object"}'
    when 'note' then '{"type":"null"}'
  end::json
$$;

create or replace function public.hold_feeds(owner uuid, plant uuid, ts timestamptz, days integer) returns void language sql security definer set search_path = '' as $$
  insert into public.feed_override as f (owner_id, plant_id, supplement_id, hold_until)
  select owner, plant, g.supplement_id, (ts at time zone coalesce((select pr.timezone from public.profiles pr where pr.id = owner), 'UTC'))::date + days
  from public.plants p join public.taxon t on t.id = p.taxon_id join public.programme g on g.profile_id = t.profile_id
  where p.id = plant
  on conflict (plant_id, supplement_id) do update set hold_until = greatest(f.hold_until, excluded.hold_until)
$$;

create or replace function public.project_plant(p uuid) returns void language plpgsql security definer set search_path = '' as $$
declare
  o uuid; e record; x record;
  v_condition public.condition; v_phase public.phenophase;
  v_symptoms public.symptom[] := '{}'; v_disorders public.disorder[] := '{}';
  v_location public.location_zone; v_light public.light_level; v_pot uuid; v_height numeric(5,1);
begin
  select q.owner_id into o from public.plants q where q.id = p for no key update;
  if o is null then return; end if;
  delete from public.pest_case k where k.plant_id = p;
  for e in select * from public.events ev where ev.plant_id = p and ev.voided_at is null order by ev.ts, ev.id loop
    case e.type
    when 'diagnosis' then
      v_condition := coalesce((e.data->>'condition')::public.condition, v_condition);
      v_phase := coalesce((e.data->>'phase')::public.phenophase, v_phase);
      if jsonb_typeof(e.data->'symptoms') = 'array' then v_symptoms := array(select jsonb_array_elements_text(e.data->'symptoms'))::public.symptom[]; end if;
      if jsonb_typeof(e.data->'disorders') = 'array' then v_disorders := array(select jsonb_array_elements_text(e.data->'disorders'))::public.disorder[]; end if;
      if jsonb_typeof(e.data->'pests') = 'array' then
        if e.data->'pests' = '[]'::jsonb then
          update public.pest_case k set status = 'cleared', closed_at = e.ts where k.plant_id = p and k.closed_at is null;
        else
          for x in select (i->>'pest')::public.pest as pest, (i->>'status')::public.pest_status as status from jsonb_array_elements(e.data->'pests') i loop
            if x.status = 'cleared' then
              update public.pest_case k set status = 'cleared', closed_at = e.ts where k.plant_id = p and k.pest = x.pest and k.closed_at is null;
            else
              update public.pest_case k set status = case when k.status = 'treating' then k.status else x.status end where k.plant_id = p and k.pest = x.pest and k.closed_at is null;
              if not found then insert into public.pest_case (owner_id, plant_id, pest, status, opened_at) values (o, p, x.pest, x.status, e.ts); end if;
            end if;
          end loop;
        end if;
      end if;
    when 'treatment' then
      update public.pest_case k set status = 'treating', rounds = k.rounds + 1, last_treated = e.ts where k.plant_id = p and k.pest = (e.data->>'pest')::public.pest and k.closed_at is null;
      if not found then insert into public.pest_case (owner_id, plant_id, pest, status, opened_at, last_treated, rounds) values (o, p, (e.data->>'pest')::public.pest, 'treating', e.ts, e.ts, 1); end if;
    when 'repot' then v_pot := (e.data->>'to_pot_id')::uuid;
    when 'measure' then v_height := coalesce((e.data->>'height_cm')::numeric, v_height);
    when 'move' then
      v_location := coalesce((e.data->>'location')::public.location_zone, v_location);
      v_light := coalesce((e.data->>'light')::public.light_level, v_light);
    else null;
    end case;
  end loop;
  update public.plants q set condition = v_condition, phase = v_phase, symptoms = v_symptoms, disorders = v_disorders, location = v_location, light = v_light, pot_id = v_pot, height_cm = v_height where q.id = p;
end $$;

create or replace function public.measure(plant text, height_cm numeric default null, canopy_cm numeric default null, trunk_mm numeric default null, note text default null, at timestamptz default now())
returns bigint language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); pid uuid;
begin
  pid := (public.targets(o, jsonb_build_array(plant)))[1];
  if height_cm is null and canopy_cm is null and trunk_mm is null then
    perform public.fail('invalid_value', jsonb_build_object('field', 'height_cm'), 'give at least one of height_cm, canopy_cm, trunk_mm');
  end if;
  if height_cm <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'height_cm'), 'must be above 0'); end if;
  if canopy_cm <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'canopy_cm'), 'must be above 0'); end if;
  if trunk_mm <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'trunk_mm'), 'must be above 0'); end if;
  return public.insert_event(o, pid, 'measure', public.at_or_now(at), jsonb_build_object('height_cm', height_cm, 'canopy_cm', canopy_cm, 'trunk_mm', trunk_mm), note);
end $$;

create or replace function public.void_event(event bigint, reason text) returns bigint language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); v timestamptz;
begin
  select e.voided_at into v from public.events e where e.id = event and e.owner_id = o;
  if not found then perform public.fail('not_found', jsonb_build_object('event', event), 'no event with this id'); end if;
  if v is not null then perform public.fail('invalid_transition', jsonb_build_object('current', 'voided'), 'already voided'); end if;
  if reason is null then perform public.fail('invalid_value', jsonb_build_object('field', 'reason'), 'reason is required'); end if;
  update public.events e set voided_at = now(), voided_reason = reason where e.id = event;
  update public.plants q set cover_event_id = null where q.cover_event_id = event;
  return event;
end $$;

create or replace function public.create_plant(name text, taxon text default null, origin public.origin_type default null, origin_date date default null, origin_date_precision public.date_precision default null, individuals smallint default 1, water_interval_days smallint default null, location public.location_zone default null, light public.light_level default null, condition public.condition default null, phase public.phenophase default null, height_cm numeric default null, pot text default null, substrate text default null, notes text default null, at timestamptz default now())
returns setof public.plants language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); ts timestamptz := public.at_or_now(at); tid text; pid uuid; potid uuid; subid text; days smallint := water_interval_days;
begin
  if name is null or exists (select 1 from public.plants q where q.owner_id = o and q.name = create_plant.name) then
    perform public.fail('invalid_value', jsonb_build_object('field', 'name'), 'already used');
  end if;
  if taxon is not null then tid := public.resolve_taxon(taxon); end if;
  if (origin_date is null) <> (origin_date_precision is null) then
    perform public.fail('invalid_value', jsonb_build_object('field', 'origin_date_precision', 'allowed', to_jsonb(public.enum_values('public.date_precision'))), 'origin_date and origin_date_precision go together');
  end if;
  if coalesce(individuals, 1) < 1 then perform public.fail('invalid_value', jsonb_build_object('field', 'individuals'), 'must be at least 1'); end if;
  if days not between 1 and 60 then perform public.fail('invalid_value', jsonb_build_object('field', 'water_interval_days'), 'must be between 1 and 60'); end if;
  if days is null and tid is not null then
    select case c.water when 'drought_tolerant' then 7 when 'dry_top' then 4 when 'evenly_moist' then 2 end into days
    from public.taxon t join public.care_profile c on c.id = t.profile_id where t.id = tid;
  end if;
  if height_cm <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'height_cm'), 'must be above 0'); end if;
  if substrate is not null and pot is null then perform public.fail('invalid_value', jsonb_build_object('field', 'substrate'), 'needs a pot'); end if;
  if pot is not null then
    potid := public.resolve_pot(o, pot);
    if exists (select 1 from public.pots x where x.id = potid and x.retired_at is not null) then
      perform public.fail('invalid_transition', jsonb_build_object('current', 'retired'), 'the pot is retired');
    end if;
  end if;
  if substrate is not null then subid := public.resolve_substrate(o, substrate); end if;
  insert into public.plants (owner_id, name, taxon_id, origin, origin_date, origin_date_precision, individuals, water_interval_days, notes)
  values (o, name, tid, origin, origin_date, origin_date_precision, coalesce(individuals, 1), days, notes) returning id into pid;
  if location is not null or light is not null then
    perform public.insert_event(o, pid, 'move', ts, jsonb_build_object('location', location, 'light', light), null);
  end if;
  if condition is not null or phase is not null then
    perform public.insert_event(o, pid, 'diagnosis', ts, jsonb_build_object('condition', condition, 'phase', phase, 'symptoms', null, 'disorders', null, 'pests', null), null);
  end if;
  if height_cm is not null then
    perform public.insert_event(o, pid, 'measure', ts, jsonb_build_object('height_cm', height_cm, 'canopy_cm', null, 'trunk_mm', null), null);
  end if;
  if potid is not null then
    perform public.insert_event(o, pid, 'repot', ts, jsonb_build_object('from_pot_id', null, 'to_pot_id', potid, 'substrate_id', subid, 'roots', 'unknown', 'root_pruned', false), null);
    perform public.hold_feeds(o, pid, ts, 28);
  end if;
  perform public.project_plant(pid);
  return query select * from public.plants q where q.id = pid;
end $$;

create or replace function public.archive_plant(plant text, reason public.archive_reason) returns setof public.plants language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); r record;
begin
  select q.id, q.archived_at into r from public.plants q where q.owner_id = o and (q.name = plant or q.id::text = plant);
  if not found then perform public.fail('not_found', jsonb_build_object('plant', plant), 'no plant with this name or id'); end if;
  if r.archived_at is not null then perform public.fail('invalid_transition', jsonb_build_object('current', 'archived'), 'already archived'); end if;
  if reason is null then perform public.fail('invalid_value', jsonb_build_object('field', 'reason', 'allowed', to_jsonb(public.enum_values('public.archive_reason'))), 'reason is required'); end if;
  update public.plants q set archived_at = now(), archived_reason = reason where q.id = r.id;
  update public.tasks t set status = 'skipped', completed_at = now() where t.plant_id = r.id and t.status = 'todo';
  perform public.insert_event(o, r.id, 'note', now(), null, 'archived: ' || reason);
  return query select * from public.plants q where q.id = r.id;
end $$;

create or replace function public.wipe_garden() returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  if auth.jwt()->>'client_id' is not null then raise exception 'not available to OAuth clients' using errcode = '42501'; end if;
  delete from public.tasks t where t.owner_id = o;
  delete from public.feed_override f where f.owner_id = o;
  delete from public.pest_case k where k.owner_id = o;
  update public.plants q set cover_event_id = null where q.owner_id = o;
  delete from public.events e where e.owner_id = o;
  delete from public.plants q where q.owner_id = o;
  delete from public.pots x where x.owner_id = o;
  delete from public.substrate_part sp where sp.substrate_id in (select s.id from public.substrate s where s.owner_id = o);
  delete from public.substrate s where s.owner_id = o;
  delete from public.supplement s where s.owner_id = o;
end $$;
