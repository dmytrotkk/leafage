drop view public.due, public.garden, public.plant_feed;
drop type public.due_source;
drop trigger plants_updated_at on public.plants;
alter table public.plants drop column updated_at;
drop function public.local_today(), public.check_enums(text, text[], regtype),
  public.diagnose(text, public.condition, public.phenophase, text[], text[], jsonb, text, timestamptz),
  public.create_supplement(text, public.supplement_role, public.supplement_form, text[], public.feed_method),
  public.create_task(text, public.task_kind, text, date, smallint, text);

create function public.local_date(ts timestamptz default now()) returns date language sql stable set search_path = '' as $$
  select (ts at time zone coalesce((select timezone from public.profiles where id = auth.uid()), 'UTC'))::date
$$;

create or replace function public.event_schema(t public.event_type) returns json language sql immutable set search_path = '' as $$
  select case t
    when 'watering' then '{"additionalProperties":false,"properties":{"method":{"enum":["top","basin","soak"],"type":"string"},"ml":{"anyOf":[{"maximum":9007199254740991,"minimum":0,"type":"integer"},{"type":"null"}]}},"required":["method","ml"],"type":"object"}'
    when 'feed' then '{"additionalProperties":false,"properties":{"dose_factor":{"type":"number"},"method":{"anyOf":[{"enum":["incorporate","drench","foliar"],"type":"string"},{"type":"null"}]},"supplement_id":{"type":"string"}},"required":["supplement_id","dose_factor","method"],"type":"object"}'
    when 'treatment' then '{"additionalProperties":false,"properties":{"agent":{"type":["string","null"]},"pest":{"enum":["spider_mites","mealybugs","scale","aphids","whitefly","thrips","ants","root_rot","fungal_leaf_spot"],"type":"string"}},"required":["pest","agent"],"type":"object"}'
    when 'repot' then '{"additionalProperties":false,"properties":{"root_pruned":{"type":"boolean"},"roots":{"enum":["healthy","rootbound","circling","dry","rotted","unknown"],"type":"string"},"substrate_id":{"type":["string","null"]},"to_pot_id":{"type":"string"}},"required":["to_pot_id","substrate_id","roots","root_pruned"],"type":"object"}'
    when 'prune' then '{"additionalProperties":false,"properties":{"part":{"enum":["canopy","roots","deadwood","flowers","suckers"],"type":"string"}},"required":["part"],"type":"object"}'
    when 'measure' then '{"additionalProperties":false,"properties":{"canopy_cm":{"type":["number","null"]},"height_cm":{"type":["number","null"]},"trunk_mm":{"type":["number","null"]}},"required":["height_cm","canopy_cm","trunk_mm"],"type":"object"}'
    when 'diagnosis' then '{"additionalProperties":false,"properties":{"condition":{"anyOf":[{"enum":["critical","poor","stressed","good","thriving"],"type":"string"},{"type":"null"}]},"disorders":{"anyOf":[{"items":{"enum":["underwatering","overwatering","waterlogging","salt_buildup","low_light","sunburn","wind_damage","cold_damage","rootbound","n_deficiency","mg_deficiency","fe_deficiency"],"type":"string"},"type":"array"},{"type":"null"}]},"pests":{"anyOf":[{"items":{"additionalProperties":false,"properties":{"pest":{"enum":["spider_mites","mealybugs","scale","aphids","whitefly","thrips","ants","root_rot","fungal_leaf_spot"],"type":"string"},"status":{"enum":["suspected","confirmed","cleared"],"type":"string"}},"required":["pest","status"],"type":"object"},"type":"array"},{"type":"null"}]},"phase":{"anyOf":[{"enum":["dormant","vegetative","flowering","fruiting"],"type":"string"},{"type":"null"}]},"symptoms":{"anyOf":[{"items":{"enum":["chlorosis","interveinal_chlorosis","necrosis","tip_dieback","leaf_drop","wilting","curling","scorch","etiolation","stippling","webbing","honeydew","sooty_mold","stunted","no_fruit"],"type":"string"},"type":"array"},{"type":"null"}]}},"required":["condition","phase","symptoms","disorders","pests"],"type":"object"}'
    when 'move' then '{"additionalProperties":false,"properties":{"light":{"anyOf":[{"enum":["bright_shade","part_sun","full_sun"],"type":"string"},{"type":"null"}]},"location":{"anyOf":[{"enum":["indoor","balcony","quarantine"],"type":"string"},{"type":"null"}]}},"required":["location","light"],"type":"object"}'
    when 'photo' then '{"additionalProperties":false,"properties":{"shot":{"anyOf":[{"enum":["full","closeup","leaves","underside","soil","roots","pot","group"],"type":"string"},{"type":"null"}]}},"required":["shot"],"type":"object"}'
    when 'note' then '{"type":"null"}'
  end::json
$$;

alter table public.events disable trigger events_immutable;
update public.events set data = data - 'round' where type = 'treatment';
update public.events set data = data - 'from_pot_id' where type = 'repot';
alter table public.events enable trigger events_immutable;

create or replace function public.select_plants(owner uuid, selector jsonb) returns setof uuid language plpgsql stable security definer set search_path = '' as $$
declare
  allowed text[] := array['location', 'pot', 'profile', 'taxon', 'attention', 'water_status', 'feed_status'];
  ids uuid[] := '{}';
  ref text; k text; pid uuid; pot uuid;
begin
  if selector is null then return; end if;
  if jsonb_typeof(selector) = 'array' then
    for ref in select jsonb_array_elements_text(selector) loop
      select p.id into pid from public.plants p where p.owner_id = owner and p.archived_at is null and (p.name = ref or p.id::text = ref);
      if pid is null then perform public.fail('not_found', jsonb_build_object('plant', ref), 'no active plant with this name or id'); end if;
      ids := ids || pid;
    end loop;
    return query select distinct x from unnest(ids) x;
    return;
  end if;
  if jsonb_typeof(selector) <> 'object' then
    perform public.fail('invalid_value', jsonb_build_object('field', 'plants'), 'a list of names or ids, or a filter object');
  end if;
  for k in select jsonb_object_keys(selector) loop
    if k <> all (allowed) then perform public.fail('invalid_value', jsonb_build_object('field', k, 'allowed', to_jsonb(allowed)), 'unknown filter key'); end if;
  end loop;
  perform public.check_enum('location', selector->>'location', 'public.location_zone');
  perform public.check_enum('water_status', selector->>'water_status', 'public.water_status');
  perform public.check_enum('feed_status', selector->>'feed_status', 'public.feed_status');
  perform public.jbool('attention', selector->'attention');
  if selector->>'pot' is not null then pot := public.resolve_pot(owner, selector->>'pot'); end if;
  if selector->>'profile' is not null and not exists (select 1 from public.care_profile c where c.id = selector->>'profile') then
    perform public.fail('not_found', jsonb_build_object('profile', selector->>'profile'), 'no care profile with this id');
  end if;
  if selector->>'taxon' is not null and not exists (select 1 from public.taxon t where t.id = selector->>'taxon') then
    perform public.fail('not_found', jsonb_build_object('taxon', selector->>'taxon'), 'no taxon with this id');
  end if;
  return query
    select p.id from public.plants p join public.garden g on g.plant_id = p.id
    where p.owner_id = owner and p.archived_at is null
      and (selector->>'location' is null or p.location = (selector->>'location')::public.location_zone)
      and (pot is null or p.pot_id = pot)
      and (selector->>'profile' is null or g.profile_id = selector->>'profile')
      and (selector->>'taxon' is null or p.taxon_id = selector->>'taxon')
      and (selector->>'attention' is null or g.attention = (selector->>'attention')::boolean)
      and (selector->>'water_status' is null or g.water_status = (selector->>'water_status')::public.water_status)
      and (selector->>'feed_status' is null or exists (select 1 from public.plant_feed f where f.plant_id = p.id and f.status = (selector->>'feed_status')::public.feed_status));
end $$;

create or replace function public.emit(owner uuid, ids uuid[], type public.event_type, ts timestamptz, data jsonb, note text, photo_url text default null)
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select q.id, q.name from public.plants q where q.id = any (ids) union all select null, null where ids is null order by 2 loop
    plant_id := r.id; name := r.name; event_id := public.insert_event(owner, r.id, type, ts, data, note, photo_url); skipped_reason := null;
    return next;
  end loop;
end $$;

create or replace function public.hold_feeds(owner uuid, plant uuid, ts timestamptz, days integer) returns void language sql security definer set search_path = '' as $$
  insert into public.feed_override as f (owner_id, plant_id, supplement_id, hold_until)
  select owner, plant, g.supplement_id, public.local_date(ts) + days
  from public.plants p join public.taxon t on t.id = p.taxon_id join public.programme g on g.profile_id = t.profile_id
  where p.id = plant
  on conflict (plant_id, supplement_id) do update set hold_until = greatest(f.hold_until, excluded.hold_until)
$$;

create or replace function public.project_pot(p uuid) returns void language sql security definer set search_path = '' as $$
  update public.pots o set (substrate_id, substrate_since) = (
    select e.data->>'substrate_id', public.local_date(e.ts)
    from public.events e
    where e.owner_id = o.owner_id and e.type = 'repot' and e.voided_at is null and e.data->>'to_pot_id' = o.id::text and e.data->>'substrate_id' is not null
    order by e.ts desc, e.id desc limit 1)
  where o.id = p
$$;

create or replace function public.events_project() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.plant_id is not null then perform public.project_plant(new.plant_id); end if;
  if new.type = 'repot' then perform public.project_pot((new.data->>'to_pot_id')::uuid); end if;
  return null;
end $$;

create or replace function public.feed(supplement text, plants jsonb default null, dose_factor numeric default null, method public.feed_method default null, note text default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); ts timestamptz := public.at_or_now(at); sid text := public.resolve_supplement(o, supplement); r record; smethod public.feed_method; ids uuid[];
begin
  if dose_factor <= 0 or dose_factor > 1 then perform public.fail('invalid_value', jsonb_build_object('field', 'dose_factor'), 'must be above 0 and at most 1'); end if;
  select s.method into smethod from public.supplement s where s.id = sid;
  if plants is not null then ids := public.targets(o, plants); end if;
  for r in select q.id as plant_id, q.name, f.status, f.dose_factor as plan_dose, f.method as plan_method
           from public.plants q left join public.plant_feed f on f.plant_id = q.id and f.supplement_id = sid
           where case when plants is null then q.owner_id = o and q.archived_at is null and f.plant_id is not null else q.id = any (ids) end
           order by q.name loop
    plant_id := r.plant_id; name := r.name;
    if plants is not null or r.status in ('overdue', 'due', 'recommended') then
      event_id := public.insert_event(o, r.plant_id, 'feed', ts, jsonb_build_object('supplement_id', sid, 'dose_factor', coalesce(dose_factor, r.plan_dose, 1.00), 'method', coalesce(method, r.plan_method, smethod)), note);
      skipped_reason := null;
    else
      event_id := null; skipped_reason := r.status::text;
    end if;
    return next;
  end loop;
end $$;

create or replace function public.treat(plants jsonb, pest public.pest, agent text default null, note text default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  return query select * from public.emit(o, public.targets(o, plants), 'treatment', public.at_or_now(at), jsonb_build_object('pest', pest, 'agent', agent), note);
end $$;

create or replace function public.repot(plant text, pot text, substrate text default null, roots public.root_condition default 'unknown', root_pruned boolean default false, hold_feed_days integer default 28, note text default null, at timestamptz default now())
returns table (event_id bigint, warning text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); ts timestamptz := public.at_or_now(at); pid uuid; potid uuid := public.resolve_pot(o, pot); subid text; cur record; d numeric;
begin
  pid := (public.targets(o, jsonb_build_array(plant)))[1];
  if exists (select 1 from public.pots x where x.id = potid and x.retired_at is not null) then
    perform public.fail('invalid_transition', jsonb_build_object('current', 'retired'), 'the pot is retired');
  end if;
  if hold_feed_days < 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'hold_feed_days'), 'must be zero or more'); end if;
  if substrate is not null then subid := public.resolve_substrate(o, substrate); end if;
  select q.phase, q.repot_target_cm into cur from public.plants q where q.id = pid;
  event_id := public.insert_event(o, pid, 'repot', ts,
    jsonb_build_object('to_pot_id', potid, 'substrate_id', subid, 'roots', coalesce(roots, 'unknown'), 'root_pruned', coalesce(root_pruned, false)), note);
  perform public.hold_feeds(o, pid, ts, coalesce(hold_feed_days, 28));
  select x.diameter_cm into d from public.pots x where x.id = potid;
  if cur.repot_target_cm is not null and d >= cur.repot_target_cm then
    update public.plants q set repot_target_cm = null, repot_after = null where q.id = pid;
  end if;
  warning := case when cur.phase = 'flowering' then 'phase is flowering' end;
  return next;
end $$;

create or replace function public.note(text text, plants jsonb default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  return query select * from public.emit(o, case when plants is not null then public.targets(o, plants) end, 'note', public.at_or_now(at), null, text);
end $$;

create or replace function public.photo(path text, plants jsonb default null, shot public.photo_shot default null, note text default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  if path !~ ('^' || o::text || '/') then perform public.fail('invalid_value', jsonb_build_object('field', 'path'), 'must start with your user id and a slash'); end if;
  return query select * from public.emit(o, case when plants is not null then public.targets(o, plants) end, 'photo', public.at_or_now(at), jsonb_build_object('shot', shot), note, path);
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
    perform public.insert_event(o, pid, 'repot', ts, jsonb_build_object('to_pot_id', potid, 'substrate_id', subid, 'roots', 'unknown', 'root_pruned', false), null);
    perform public.hold_feeds(o, pid, ts, 28);
  end if;
  return query select * from public.plants q where q.id = pid;
end $$;

create function public.diagnose(plant text, condition public.condition default null, phase public.phenophase default null, symptoms public.symptom[] default null, disorders public.disorder[] default null, pests jsonb default null, note text default null, at timestamptz default now())
returns bigint language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); ts timestamptz := public.at_or_now(at); pid uuid; item jsonb;
begin
  pid := (public.targets(o, jsonb_build_array(plant)))[1];
  if condition is null and phase is null and symptoms is null and disorders is null and pests is null and note is null then
    perform public.fail('invalid_value', jsonb_build_object('field', 'diagnosis'), 'give at least one of condition, phase, symptoms, disorders, pests, or a note');
  end if;
  if pests is not null then
    if jsonb_typeof(pests) <> 'array' then perform public.fail('invalid_value', jsonb_build_object('field', 'pests'), 'a list of {pest, status}'); end if;
    for item in select jsonb_array_elements(pests) loop
      perform public.check_enum('pests.pest', item->>'pest', 'public.pest');
      if item->>'pest' is null then perform public.fail('invalid_value', jsonb_build_object('field', 'pests.pest', 'allowed', to_jsonb(public.enum_values('public.pest'))), 'pest is required'); end if;
      if item->>'status' is null or item->>'status' not in ('suspected', 'confirmed', 'cleared') then
        perform public.fail('invalid_value', jsonb_build_object('field', 'pests.status', 'allowed', '["suspected", "confirmed", "cleared"]'::jsonb), 'treating is set by treat');
      end if;
    end loop;
  end if;
  return public.insert_event(o, pid, 'diagnosis', ts,
    jsonb_build_object('condition', condition, 'phase', phase, 'symptoms', to_jsonb(symptoms), 'disorders', to_jsonb(disorders),
      'pests', coalesce((select jsonb_agg(jsonb_build_object('pest', i->>'pest', 'status', i->>'status')) from jsonb_array_elements(coalesce(pests, '[]'::jsonb)) i),
        case when pests is null then 'null'::jsonb else '[]'::jsonb end)), note);
end $$;

create function public.create_supplement(label text, role public.supplement_role default 'feed', form public.supplement_form default null, supplies public.nutrient[] default '{}', method public.feed_method default null)
returns public.supplement language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); r public.supplement;
begin
  if label is null or exists (select 1 from public.supplement s where (s.owner_id is null or s.owner_id = o) and s.label = create_supplement.label) then
    perform public.fail('invalid_value', jsonb_build_object('field', 'label'), 'already used');
  end if;
  insert into public.supplement (id, owner_id, label, form, role, supplies, method)
  values (gen_random_uuid()::text, o, label, form, coalesce(role, 'feed'), coalesce(supplies, '{}'), method) returning * into r;
  return r;
end $$;

create function public.create_task(title text, kind public.task_kind default 'other', plant text default null, due_on date default null, priority smallint default 2, detail text default null)
returns setof public.tasks language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); pid uuid; tid bigint;
begin
  if title is null then perform public.fail('invalid_value', jsonb_build_object('field', 'title'), 'title is required'); end if;
  if coalesce(priority, 2) not between 1 and 3 then perform public.fail('invalid_value', jsonb_build_object('field', 'priority', 'allowed', '[1, 2, 3]'::jsonb), 'must be 1, 2 or 3'); end if;
  if plant is not null then pid := (public.targets(o, jsonb_build_array(plant)))[1]; end if;
  insert into public.tasks (owner_id, plant_id, title, kind, due_on, priority, detail)
  values (o, pid, title, coalesce(kind, 'other'), due_on, coalesce(priority, 2), detail) returning id into tid;
  return query select * from public.tasks t where t.id = tid;
end $$;

create view public.plant_feed with (security_invoker = on) as
with plan as (
  select p.id as plant_id, s.id as supplement_id, s.label, s.form, s.role, s.method,
         g.dose_factor as plan_factor, g.cadence_days, g.season_start, g.season_end, false as corrective
  from public.plants p
  join public.taxon t on t.id = p.taxon_id
  join public.programme g on g.profile_id = t.profile_id
  join public.supplement s on s.id = g.supplement_id
  where p.archived_at is null
  union all
  select p.id, s.id, s.label, s.form, s.role, s.method, null, null, null, null, true
  from public.plants p
  join public.supplement s on s.role = 'corrective' and (s.owner_id is null or s.owner_id = p.owner_id)
    and s.supplies && array(select case d when 'n_deficiency' then 'n' when 'mg_deficiency' then 'mg' when 'fe_deficiency' then 'fe' end::public.nutrient
                            from unnest(p.disorders) d where d in ('n_deficiency', 'mg_deficiency', 'fe_deficiency'))
  where p.archived_at is null
)
select r.plant_id, r.supplement_id, r.label, r.form, r.role, r.method,
  coalesce(o.dose_factor, r.plan_factor, 1.00)::numeric(3,2) as dose_factor,
  r.cadence_days, r.season_start, r.season_end,
  case when r.corrective then null else o.hold_until end as hold_until,
  lf.last_fed, nd.next_due,
  case
    when r.corrective then case when lf.fed_on is null or nd.next_due < nd.today then 'recommended' else 'scheduled' end
    when o.hold_until > nd.today then 'held'
    when not (case when r.season_start <= r.season_end then nd.month between r.season_start and r.season_end else nd.month >= r.season_start or nd.month <= r.season_end end) then 'off_season'
    when nd.next_due < nd.today then 'overdue'
    when nd.next_due <= nd.today + 7 then 'due'
    else 'scheduled'
  end::public.feed_status as status
from plan r
left join public.feed_override o on o.plant_id = r.plant_id and o.supplement_id = r.supplement_id
cross join lateral (
  select max(e.ts) as last_fed, public.local_date(max(e.ts)) as fed_on
  from public.events e
  where e.plant_id = r.plant_id and e.type = 'feed' and e.voided_at is null and e.data->>'supplement_id' = r.supplement_id
) lf
cross join lateral (
  select public.local_date() as today,
         extract(month from public.local_date())::smallint as month,
         case when r.corrective then lf.fed_on + 21
              else greatest(coalesce(lf.fed_on + r.cadence_days, o.hold_until, public.local_date()), o.hold_until) end as next_due
) nd;
comment on column public.plant_feed.plant_id is '@notNull';
comment on column public.plant_feed.supplement_id is '@notNull';
comment on column public.plant_feed.label is '@notNull';
comment on column public.plant_feed.role is '@notNull';
comment on column public.plant_feed.dose_factor is '@notNull';
comment on column public.plant_feed.status is '@notNull';

create view public.garden with (security_invoker = on) as
select
  p.id as plant_id, p.name, p.taxon_id, t.common, t.latin, t.emoji,
  c.id as profile_id, c.label as profile_label,
  p.origin, p.origin_date, p.origin_date_precision, p.individuals,
  p.location, p.light, c.light as light_need, p.light < c.light as light_below_need,
  c.water as water_regime, p.water_interval_days,
  w.last_watered_at, w.water_due_on, w.water_status,
  p.condition, p.phase, tr.trend, p.symptoms, p.disorders,
  pc.pests, c.pests as pests_watch,
  coalesce(p.condition <= 'poor' or pc.open or w.water_status in ('overdue', 'due') or fa.feed_alert is not null
   or pl.repot_due or po.pot_sealed or p.light < c.light, false) as attention,
  p.height_cm,
  p.pot_id, po.label as pot_label, po.diameter_cm as pot_diameter_cm, po.material as pot_material, po.pot_sealed, po.pot_shared_with,
  po.substrate_id, po.substrate_age_days, po.substrate_id = c.substrate_id as substrate_matches_profile,
  p.repot_target_cm, p.repot_after, pl.repot_due, pl.pot_fit,
  fa.feed_alert, fa.never_fed,
  cv.cover_url, p.cover_event_id is not null as cover_is_pinned,
  le.last_event_at, p.notes
from public.plants p
left join public.taxon t on t.id = p.taxon_id
left join public.care_profile c on c.id = t.profile_id
cross join lateral (
  select lw.last_watered_at, lw.due_on as water_due_on,
    case when p.water_interval_days is null then null
         when lw.last_watered_at is null then 'due'
         when lw.due_on < public.local_date() then 'overdue'
         when lw.due_on = public.local_date() then 'due'
         when lw.due_on <= public.local_date() + 2 then 'soon'
         else 'ok' end::public.water_status as water_status
  from (select max(e.ts) as last_watered_at, public.local_date(max(e.ts)) + p.water_interval_days as due_on
        from public.events e where e.plant_id = p.id and e.type = 'watering' and e.voided_at is null) lw
) w
left join lateral (
  select (e.data->>'condition')::public.condition as c
  from public.events e
  where e.plant_id = p.id and e.type = 'diagnosis' and e.voided_at is null and e.data->>'condition' is not null and e.ts <= now() - interval '7 days'
  order by abs(extract(epoch from e.ts - (now() - interval '30 days'))) limit 1
) rf on true
cross join lateral (
  select case when p.condition is null or rf.c is null then null
              when p.condition > rf.c then 'improving'
              when p.condition < rf.c then 'declining'
              else 'steady' end::public.trend as trend
) tr
cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_object('pest', k.pest, 'status', k.status, 'rounds', k.rounds, 'last_treated', k.last_treated) order by k.opened_at), '[]'::jsonb) as pests,
         count(*) > 0 as open
  from public.pest_case k where k.plant_id = p.id and k.closed_at is null
) pc
left join lateral (
  select o.label, o.diameter_cm, o.material, o.drainage is false as pot_sealed,
         (select count(*) from public.plants q where q.pot_id = o.id and q.id <> p.id and q.archived_at is null)::smallint as pot_shared_with,
         o.substrate_id, public.local_date() - o.substrate_since as substrate_age_days
  from public.pots o where o.id = p.pot_id
) po on true
cross join lateral (
  select coalesce(p.repot_after <= public.local_date(), false) as repot_due,
         case when p.repot_target_cm is null then 'unplanned'
              when po.diameter_cm < p.repot_target_cm - 5 then 'undersized'
              else 'step_up' end::public.pot_fit as pot_fit
) pl
cross join lateral (
  select (select f.status from public.plant_feed f where f.plant_id = p.id and f.status in ('overdue', 'due', 'recommended')
          order by case f.status when 'overdue' then 1 when 'due' then 2 else 3 end limit 1) as feed_alert,
         not exists (select 1 from public.events e where e.plant_id = p.id and e.type = 'feed' and e.voided_at is null) as never_fed
) fa
cross join lateral (
  select coalesce(
    (select e.photo_url from public.events e where e.id = p.cover_event_id and e.voided_at is null),
    (select e.photo_url from public.events e where e.plant_id = p.id and e.type = 'photo' and e.voided_at is null order by e.ts desc, e.id desc limit 1)) as cover_url
) cv
cross join lateral (select max(e.ts) as last_event_at from public.events e where e.plant_id = p.id and e.voided_at is null) le
where p.archived_at is null;
comment on column public.garden.plant_id is '@notNull';
comment on column public.garden.name is '@notNull';
comment on column public.garden.individuals is '@notNull';
comment on column public.garden.symptoms is '@notNull';
comment on column public.garden.disorders is '@notNull';
comment on column public.garden.attention is '@notNull';
comment on column public.garden.repot_due is '@notNull';
comment on column public.garden.pot_fit is '@notNull';
comment on column public.garden.never_fed is '@notNull';
comment on column public.garden.cover_is_pinned is '@notNull';

create view public.due with (security_invoker = on) as
with g as (select * from public.garden)
select g.plant_id, g.name, 'water'::public.task_kind as kind, 'Water'::text as item, g.water_due_on as due_on, null::bigint as task_id
from g where g.water_status in ('overdue', 'due')
union all
select f.plant_id, g.name, 'feed', f.label, case when f.status = 'recommended' then public.local_date() else f.next_due end, null
from public.plant_feed f join g on g.plant_id = f.plant_id where f.status in ('overdue', 'due', 'recommended')
union all
select k.plant_id, g.name, 'pest', 'Treat ' || replace(k.pest::text, '_', ' '), public.local_date(coalesce(k.last_treated, k.opened_at)) + 7, null
from public.pest_case k join g on g.plant_id = k.plant_id where k.closed_at is null and k.status in ('confirmed', 'treating')
union all
select g.plant_id, g.name, 'pot', 'Repot', g.repot_after, null from g where g.repot_due
union all
select g.plant_id, g.name, 'pot', 'Pot has no drainage', public.local_date(), null from g where g.pot_sealed
union all
select t.plant_id, p.name, t.kind, t.title, t.due_on, t.id
from public.tasks t left join public.plants p on p.id = t.plant_id where t.status = 'todo';
comment on column public.due.kind is '@notNull';
comment on column public.due.item is '@notNull';

revoke execute on all functions in schema public from public;
grant select on public.plant_feed, public.garden, public.due to authenticated;
grant execute on function
  public.local_date(timestamptz),
  public.diagnose(text, public.condition, public.phenophase, public.symptom[], public.disorder[], jsonb, text, timestamptz),
  public.create_supplement(text, public.supplement_role, public.supplement_form, public.nutrient[], public.feed_method),
  public.create_task(text, public.task_kind, text, date, smallint, text)
to authenticated;
