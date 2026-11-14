create extension pg_jsonschema with schema extensions;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role, public;
alter table public.profiles add column timezone text not null default 'UTC' check ((timestamptz '2000-01-01 00:00+00' at time zone timezone) is not null);

create type public.light_level as enum ('bright_shade', 'part_sun', 'full_sun');
create type public.water_regime as enum ('drought_tolerant', 'dry_top', 'evenly_moist');
create type public.watering_method as enum ('top', 'basin', 'soak');
create type public.pot_material as enum ('plastic', 'glazed_ceramic', 'terracotta', 'glass');
create type public.substrate_component as enum ('potting_mix', 'perlite', 'grit', 'sand', 'bark', 'coir');
create type public.root_condition as enum ('healthy', 'rootbound', 'circling', 'dry', 'rotted', 'unknown');
create type public.supplement_form as enum ('controlled_release', 'liquid', 'soluble');
create type public.supplement_role as enum ('feed', 'corrective', 'biostimulant');
create type public.nutrient as enum ('n', 'p', 'k', 'mg', 'fe', 'micro');
create type public.feed_method as enum ('incorporate', 'drench', 'foliar');
create type public.condition as enum ('critical', 'poor', 'stressed', 'good', 'thriving');
create type public.phenophase as enum ('dormant', 'vegetative', 'flowering', 'fruiting');
create type public.symptom as enum ('chlorosis', 'interveinal_chlorosis', 'necrosis', 'tip_dieback', 'leaf_drop', 'wilting', 'curling', 'scorch', 'etiolation', 'stippling', 'webbing', 'honeydew', 'sooty_mold', 'stunted', 'no_fruit');
create type public.disorder as enum ('underwatering', 'overwatering', 'waterlogging', 'salt_buildup', 'low_light', 'sunburn', 'wind_damage', 'cold_damage', 'rootbound', 'n_deficiency', 'mg_deficiency', 'fe_deficiency');
create type public.pest as enum ('spider_mites', 'mealybugs', 'scale', 'aphids', 'whitefly', 'thrips', 'ants', 'root_rot', 'fungal_leaf_spot');
create type public.pest_status as enum ('suspected', 'confirmed', 'treating', 'cleared');
create type public.event_type as enum ('watering', 'feed', 'treatment', 'repot', 'prune', 'measure', 'diagnosis', 'move', 'photo', 'note');
create type public.photo_shot as enum ('full', 'closeup', 'leaves', 'underside', 'soil', 'roots', 'pot', 'group');
create type public.prune_part as enum ('canopy', 'roots', 'deadwood', 'flowers', 'suckers');
create type public.task_kind as enum ('water', 'feed', 'pest', 'pot', 'light', 'prune', 'inspect', 'photo', 'shop', 'other');
create type public.task_status as enum ('todo', 'done', 'skipped');
create type public.location_zone as enum ('indoor', 'balcony', 'quarantine');
create type public.origin_type as enum ('seed', 'cutting', 'graft', 'nursery');
create type public.date_precision as enum ('day', 'month', 'year');
create type public.archive_reason as enum ('dead', 'given_away', 'lost', 'mistake');
create type public.water_status as enum ('overdue', 'due', 'soon', 'ok');
create type public.feed_status as enum ('overdue', 'due', 'scheduled', 'held', 'off_season', 'recommended');
create type public.pot_fit as enum ('unplanned', 'step_up', 'undersized');
create type public.pot_status as enum ('in_use', 'empty', 'retired');
create type public.trend as enum ('improving', 'steady', 'declining');

create function public.event_schema(t public.event_type) returns json language sql immutable set search_path = '' as $$
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

create function public.local_date(ts timestamptz default now()) returns date language sql stable set search_path = '' as $$
  select (ts at time zone coalesce((select timezone from public.profiles where id = auth.uid()), 'UTC'))::date
$$;

create table public.substrate (
  id text primary key,
  label text not null,
  owner_id uuid references auth.users on delete cascade,
  unique nulls not distinct (owner_id, label)
);

create table public.substrate_part (
  substrate_id text not null references public.substrate,
  component public.substrate_component not null,
  percent smallint check (percent between 1 and 100),
  primary key (substrate_id, component)
);

create table public.care_profile (
  id text primary key,
  label text not null,
  light public.light_level not null,
  water public.water_regime not null,
  pests public.pest[] not null default '{}',
  substrate_id text not null references public.substrate,
  notes text
);

create table public.taxon (
  id text primary key,
  genus text not null,
  species text,
  common text not null,
  emoji text not null,
  profile_id text not null references public.care_profile,
  latin text generated always as (genus || ' ' || coalesce(species, 'sp.')) stored
);

create table public.supplement (
  id text primary key,
  owner_id uuid references auth.users on delete cascade,
  label text not null,
  form public.supplement_form,
  role public.supplement_role not null default 'feed',
  supplies public.nutrient[] not null default '{}',
  method public.feed_method,
  unique nulls not distinct (owner_id, label)
);

create table public.programme (
  profile_id text not null references public.care_profile,
  supplement_id text not null references public.supplement,
  dose_factor numeric(3,2) not null default 1.00 check (dose_factor > 0 and dose_factor <= 1),
  cadence_days smallint not null,
  season_start smallint not null check (season_start between 1 and 12),
  season_end smallint not null check (season_end between 1 and 12),
  primary key (profile_id, supplement_id)
);

create function public.catalog_global_only() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'care_profile' then
    if exists (select 1 from public.substrate s where s.id = new.substrate_id and s.owner_id is not null) then raise exception 'care profiles may reference global substrates only' using errcode = '23503'; end if;
  elsif exists (select 1 from public.supplement s where s.id = new.supplement_id and s.owner_id is not null) then
    raise exception 'programmes may reference global supplements only' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger care_profile_global_only before insert or update on public.care_profile for each row execute function public.catalog_global_only();
create trigger programme_global_only before insert or update on public.programme for each row execute function public.catalog_global_only();

create table public.pots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  label text not null,
  material public.pot_material,
  diameter_cm numeric(4,1) check (diameter_cm > 0),
  height_cm numeric(4,1) check (height_cm > 0),
  drainage boolean,
  saucer boolean not null default false,
  substrate_id text references public.substrate,
  substrate_since date,
  retired_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, label)
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null,
  taxon_id text references public.taxon,
  origin public.origin_type,
  origin_date date,
  origin_date_precision public.date_precision,
  individuals smallint not null default 1 check (individuals >= 1),
  location public.location_zone,
  light public.light_level,
  water_interval_days smallint check (water_interval_days between 1 and 60),
  condition public.condition,
  phase public.phenophase,
  symptoms public.symptom[] not null default '{}',
  disorders public.disorder[] not null default '{}',
  pot_id uuid,
  height_cm numeric(5,1),
  repot_target_cm smallint,
  repot_after date,
  cover_event_id bigint,
  archived_at timestamptz,
  archived_reason public.archive_reason,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, name),
  check ((origin_date is null) = (origin_date_precision is null)),
  check ((archived_at is null) = (archived_reason is null)),
  check ((repot_target_cm is null) = (repot_after is null)),
  foreign key (pot_id, owner_id) references public.pots (id, owner_id)
);

create table public.events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users on delete cascade,
  plant_id uuid,
  ts timestamptz not null default now(),
  type public.event_type not null,
  data jsonb,
  note text,
  photo_url text,
  source text not null,
  voided_at timestamptz,
  voided_reason text,
  unique (id, owner_id),
  foreign key (plant_id, owner_id) references public.plants (id, owner_id),
  constraint events_plant_required check (plant_id is not null or type in ('note', 'photo')),
  constraint events_photo_path check ((type = 'photo') = (photo_url is not null)),
  constraint events_void_reason check ((voided_at is null) = (voided_reason is null)),
  constraint events_data_shape check (extensions.jsonb_matches_schema(public.event_schema(type), coalesce(data, 'null'::jsonb)))
);
alter table public.plants add foreign key (cover_event_id, owner_id) references public.events (id, owner_id);

create table public.pest_case (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users on delete cascade,
  plant_id uuid not null,
  pest public.pest not null,
  status public.pest_status not null,
  opened_at timestamptz not null,
  last_treated timestamptz,
  rounds smallint not null default 0,
  closed_at timestamptz,
  check ((status = 'cleared') = (closed_at is not null)),
  check ((rounds = 0) = (last_treated is null)),
  foreign key (plant_id, owner_id) references public.plants (id, owner_id)
);
create unique index pest_case_open_key on public.pest_case (plant_id, pest) where closed_at is null;

create table public.feed_override (
  owner_id uuid not null references auth.users on delete cascade,
  plant_id uuid not null,
  supplement_id text not null references public.supplement,
  dose_factor numeric(3,2) check (dose_factor > 0 and dose_factor <= 1),
  hold_until date,
  primary key (plant_id, supplement_id),
  foreign key (plant_id, owner_id) references public.plants (id, owner_id)
);

create table public.tasks (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users on delete cascade,
  plant_id uuid,
  title text not null,
  kind public.task_kind not null default 'other',
  status public.task_status not null default 'todo',
  due_on date,
  priority smallint not null default 2 check (priority between 1 and 3),
  detail text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (plant_id, owner_id) references public.plants (id, owner_id),
  check ((status = 'todo') = (completed_at is null))
);

create function public.fail(code text, detail jsonb default null, hint text default null) returns void language plpgsql as $$
begin
  raise exception using message = code,
    errcode = case code when 'not_found' then 'P0002' when 'invalid_transition' then '55000' else '22023' end,
    detail = coalesce(detail::text, ''), hint = coalesce(hint, '');
end $$;

create function public.me() returns uuid language plpgsql stable set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then perform public.fail('not_found', null, 'no signed-in user'); end if;
  return u;
end $$;

create function public.at_or_now(at timestamptz) returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  if at > now() then perform public.fail('invalid_value', jsonb_build_object('field', 'at'), 'must not be in the future'); end if;
  return coalesce(at, now());
end $$;

create function public.enum_values(t regtype) returns text[] language sql stable set search_path = '' as $$
  select array_agg(enumlabel::text order by enumsortorder) from pg_catalog.pg_enum where enumtypid = t
$$;

create function public.check_enum(field text, value text, t regtype) returns void language plpgsql stable set search_path = '' as $$
begin
  if value is not null and value <> all (public.enum_values(t)) then
    perform public.fail('invalid_value', jsonb_build_object('field', field, 'allowed', to_jsonb(public.enum_values(t))), 'not one of the allowed values');
  end if;
end $$;

create function public.jnum(field text, v jsonb) returns numeric language plpgsql immutable as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then return null; end if;
  if jsonb_typeof(v) <> 'number' then perform public.fail('invalid_value', jsonb_build_object('field', field), 'must be a number'); end if;
  return (v#>>'{}')::numeric;
end $$;

create function public.jdate(field text, v jsonb) returns date language plpgsql immutable as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then return null; end if;
  return (v#>>'{}')::date;
exception when others then
  perform public.fail('invalid_value', jsonb_build_object('field', field), 'must be a date, YYYY-MM-DD');
end $$;

create function public.jbool(field text, v jsonb) returns boolean language plpgsql immutable as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then return null; end if;
  if jsonb_typeof(v) <> 'boolean' then perform public.fail('invalid_value', jsonb_build_object('field', field, 'allowed', '[true, false]'::jsonb), 'must be a boolean'); end if;
  return (v#>>'{}')::boolean;
end $$;

create function public.resolve_pot(owner uuid, ref text) returns uuid language plpgsql stable security definer set search_path = '' as $$
declare r uuid;
begin
  select o.id into r from public.pots o where o.owner_id = owner and (o.label = ref or o.id::text = ref);
  if r is null then perform public.fail('not_found', jsonb_build_object('pot', ref), 'no pot with this label or id'); end if;
  return r;
end $$;

create function public.resolve_substrate(owner uuid, ref text) returns text language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  select s.id into r from public.substrate s where (s.owner_id is null or s.owner_id = owner) and (s.id = ref or s.label = ref) order by s.owner_id nulls last limit 1;
  if r is null then perform public.fail('not_found', jsonb_build_object('substrate', ref), 'no substrate with this label or id'); end if;
  return r;
end $$;

create function public.resolve_supplement(owner uuid, ref text) returns text language plpgsql stable security definer set search_path = '' as $$
declare r text;
begin
  select s.id into r from public.supplement s where (s.owner_id is null or s.owner_id = owner) and (s.id = ref or s.label = ref) order by s.owner_id nulls last limit 1;
  if r is null then perform public.fail('not_found', jsonb_build_object('supplement', ref), 'no supplement with this label or id'); end if;
  return r;
end $$;

create function public.resolve_taxon(ref text) returns text language plpgsql stable set search_path = '' as $$
declare r text;
begin
  select t.id into r from public.taxon t where t.id = ref or t.common = ref or t.latin = ref limit 1;
  if r is null then perform public.fail('not_found', jsonb_build_object('taxon', ref), 'no taxon with this id, common name or latin name'); end if;
  return r;
end $$;

create function public.select_plants(owner uuid, selector jsonb) returns setof uuid language plpgsql stable security definer set search_path = '' as $$
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

create function public.targets(owner uuid, selector jsonb) returns uuid[] language plpgsql stable security definer set search_path = '' as $$
declare ids uuid[];
begin
  if selector is null then perform public.fail('invalid_value', jsonb_build_object('field', 'plants'), 'plants is required'); end if;
  ids := array(select public.select_plants(owner, selector));
  if cardinality(ids) = 0 then perform public.fail('not_found', jsonb_build_object('plants', selector), 'no active plant matches'); end if;
  return ids;
end $$;

create function public.insert_event(owner uuid, plant uuid, type public.event_type, ts timestamptz, data jsonb, note text, photo_url text default null) returns bigint language plpgsql security definer set search_path = '' as $$
declare eid bigint;
begin
  insert into public.events (owner_id, plant_id, ts, type, data, note, photo_url, source)
  values (owner, plant, ts, type, data, note, photo_url, coalesce(auth.jwt()->>'client_id', 'app'))
  returning id into eid;
  return eid;
end $$;

create function public.emit(owner uuid, ids uuid[], type public.event_type, ts timestamptz, data jsonb, note text, photo_url text default null)
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select q.id, q.name from public.plants q where q.id = any (ids) union all select null, null where ids is null order by 2 loop
    plant_id := r.id; name := r.name; event_id := public.insert_event(owner, r.id, type, ts, data, note, photo_url); skipped_reason := null;
    return next;
  end loop;
end $$;

create function public.hold_feeds(owner uuid, plant uuid, ts timestamptz, days integer) returns void language sql security definer set search_path = '' as $$
  insert into public.feed_override as f (owner_id, plant_id, supplement_id, hold_until)
  select owner, plant, g.supplement_id, public.local_date(ts) + days
  from public.plants p join public.taxon t on t.id = p.taxon_id join public.programme g on g.profile_id = t.profile_id
  where p.id = plant
  on conflict (plant_id, supplement_id) do update set hold_until = greatest(f.hold_until, excluded.hold_until)
$$;

create function public.project_plant(p uuid) returns void language plpgsql security definer set search_path = '' as $$
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

create function public.project_pot(p uuid) returns void language sql security definer set search_path = '' as $$
  update public.pots o set (substrate_id, substrate_since) = (
    select e.data->>'substrate_id', public.local_date(e.ts)
    from public.events e
    where e.owner_id = o.owner_id and e.type = 'repot' and e.voided_at is null and e.data->>'to_pot_id' = o.id::text and e.data->>'substrate_id' is not null
    order by e.ts desc, e.id desc limit 1)
  where o.id = p
$$;

create function public.events_project() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.plant_id is not null then perform public.project_plant(new.plant_id); end if;
  if new.type = 'repot' then perform public.project_pot((new.data->>'to_pot_id')::uuid); end if;
  return null;
end $$;
create trigger events_project after insert or update of voided_at on public.events for each row execute function public.events_project();

create function public.events_immutable() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.plant_id is distinct from old.plant_id or new.type is distinct from old.type or new.ts is distinct from old.ts or new.data is distinct from old.data then
    raise exception 'events are immutable' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger events_immutable before update on public.events for each row execute function public.events_immutable();

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

create view public.pots_view with (security_invoker = on) as
select o.id as pot_id, o.label, o.material, o.material = 'terracotta' as porous, o.diameter_cm, o.height_cm,
  round((0.75 * pi() * (o.diameter_cm / 2) ^ 2 * o.height_cm / 1000)::numeric, 1) as volume_l,
  o.drainage, o.saucer, o.substrate_id, o.substrate_since,
  coalesce((select jsonb_agg(jsonb_build_object('plant_id', p.id, 'name', p.name) order by p.name) from public.plants p where p.pot_id = o.id and p.archived_at is null), '[]'::jsonb) as occupants,
  case when o.retired_at is not null then 'retired'
       when exists (select 1 from public.plants p where p.pot_id = o.id and p.archived_at is null) then 'in_use'
       else 'empty' end::public.pot_status as status,
  o.notes
from public.pots o;
comment on column public.pots_view.pot_id is '@notNull';
comment on column public.pots_view.label is '@notNull';
comment on column public.pots_view.saucer is '@notNull';
comment on column public.pots_view.status is '@notNull';

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

create function public.water(plants jsonb default null, method public.watering_method default 'top', ml integer default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); ts timestamptz := public.at_or_now(at); ids uuid[];
begin
  if ml < 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'ml'), 'must be zero or more'); end if;
  if plants is null then
    ids := array(select q.id from public.plants q where q.owner_id = o and q.archived_at is null
                 and not exists (select 1 from public.events e where e.plant_id = q.id and e.type = 'watering' and e.voided_at is null and e.ts > now() - interval '24 hours'));
  else
    ids := public.targets(o, plants);
  end if;
  return query
    select * from (
      select * from public.emit(o, ids, 'watering', ts, jsonb_build_object('method', coalesce(method, 'top'), 'ml', ml), null)
      union all
      select q.id, q.name, null::bigint, 'watered_recently'::text from public.plants q
      where plants is null and q.owner_id = o and q.archived_at is null and q.id <> all (ids)
    ) u order by u.name;
end $$;

create function public.feed(supplement text, plants jsonb default null, dose_factor numeric default null, method public.feed_method default null, note text default null, at timestamptz default now())
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

create function public.treat(plants jsonb, pest public.pest, agent text default null, note text default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  return query select * from public.emit(o, public.targets(o, plants), 'treatment', public.at_or_now(at), jsonb_build_object('pest', pest, 'agent', agent), note);
end $$;

create function public.repot(plant text, pot text, substrate text default null, roots public.root_condition default 'unknown', root_pruned boolean default false, hold_feed_days integer default 28, note text default null, at timestamptz default now())
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

create function public.measure(plant text, height_cm numeric default null, canopy_cm numeric default null, trunk_mm numeric default null, note text default null, at timestamptz default now())
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

create function public.prune(plant text, part public.prune_part, note text default null, at timestamptz default now())
returns bigint language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  return public.insert_event(o, (public.targets(o, jsonb_build_array(plant)))[1], 'prune', public.at_or_now(at), jsonb_build_object('part', part), note);
end $$;

create function public.move(plants jsonb, location public.location_zone default null, light public.light_level default null, note text default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  if location is null and light is null then perform public.fail('invalid_value', jsonb_build_object('field', 'location'), 'give location, light, or both'); end if;
  return query select * from public.emit(o, public.targets(o, plants), 'move', public.at_or_now(at), jsonb_build_object('location', location, 'light', light), note);
end $$;

create function public.note(text text, plants jsonb default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  return query select * from public.emit(o, case when plants is not null then public.targets(o, plants) end, 'note', public.at_or_now(at), null, text);
end $$;

create function public.photo(path text, plants jsonb default null, shot public.photo_shot default null, note text default null, at timestamptz default now())
returns table (plant_id uuid, name text, event_id bigint, skipped_reason text) language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me();
begin
  if path !~ ('^' || o::text || '/') then perform public.fail('invalid_value', jsonb_build_object('field', 'path'), 'must start with your user id and a slash'); end if;
  return query select * from public.emit(o, case when plants is not null then public.targets(o, plants) end, 'photo', public.at_or_now(at), jsonb_build_object('shot', shot), note, path);
end $$;

create function public.void_event(event bigint, reason text) returns bigint language plpgsql security definer set search_path = '' as $$
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

create function public.create_plant(name text, taxon text default null, origin public.origin_type default null, origin_date date default null, origin_date_precision public.date_precision default null, individuals smallint default 1, water_interval_days smallint default null, location public.location_zone default null, light public.light_level default null, condition public.condition default null, phase public.phenophase default null, height_cm numeric default null, pot text default null, substrate text default null, notes text default null, at timestamptz default now())
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

create function public.update_plant(plants jsonb, patch jsonb) returns setof public.plants language plpgsql security definer set search_path = '' as $$
declare
  o uuid := public.me(); ids uuid[] := public.targets(o, plants); k text; tid text; r record;
  allowed text[] := array['name', 'taxon', 'origin', 'origin_date', 'origin_date_precision', 'individuals', 'water_interval_days', 'repot_target_cm', 'repot_after', 'cover_event_id', 'notes'];
  single text[] := array['name', 'taxon', 'cover_event_id', 'notes'];
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then perform public.fail('invalid_value', jsonb_build_object('field', 'patch', 'allowed', to_jsonb(allowed)), 'an object of columns to change'); end if;
  for k in select jsonb_object_keys(patch) loop
    if k <> all (allowed) then perform public.fail('invalid_value', jsonb_build_object('field', k, 'allowed', to_jsonb(allowed)), 'unknown patch key'); end if;
    if k = any (single) and cardinality(ids) > 1 then perform public.fail('invalid_value', jsonb_build_object('field', k), 'needs exactly one plant'); end if;
  end loop;
  perform public.check_enum('origin', patch->>'origin', 'public.origin_type');
  perform public.check_enum('origin_date_precision', patch->>'origin_date_precision', 'public.date_precision');
  if patch ? 'name' and (patch->>'name' is null or exists (select 1 from public.plants q where q.owner_id = o and q.name = patch->>'name' and q.id <> ids[1])) then
    perform public.fail('invalid_value', jsonb_build_object('field', 'name'), 'already used');
  end if;
  if patch->>'taxon' is not null then tid := public.resolve_taxon(patch->>'taxon'); end if;
  for r in
    select q.id, q.name, po.diameter_cm,
      case when patch ? 'origin' then (patch->>'origin')::public.origin_type else q.origin end as origin,
      case when patch ? 'origin_date' then public.jdate('origin_date', patch->'origin_date') else q.origin_date end as origin_date,
      case when patch ? 'origin_date_precision' then (patch->>'origin_date_precision')::public.date_precision else q.origin_date_precision end as origin_date_precision,
      case when patch ? 'individuals' then public.jnum('individuals', patch->'individuals') else q.individuals end as individuals,
      case when patch ? 'water_interval_days' then public.jnum('water_interval_days', patch->'water_interval_days') else q.water_interval_days end as water_interval_days,
      case when patch ? 'repot_target_cm' then public.jnum('repot_target_cm', patch->'repot_target_cm') else q.repot_target_cm end as repot_target_cm,
      case when patch ? 'repot_after' then public.jdate('repot_after', patch->'repot_after') else q.repot_after end as repot_after,
      case when patch ? 'cover_event_id' then public.jnum('cover_event_id', patch->'cover_event_id') else q.cover_event_id end as cover_event_id
    from public.plants q left join public.pots po on po.id = q.pot_id where q.id = any (ids)
  loop
    if (r.origin_date is null) <> (r.origin_date_precision is null) then
      perform public.fail('invalid_value', jsonb_build_object('field', 'origin_date_precision', 'allowed', to_jsonb(public.enum_values('public.date_precision'))), 'origin_date and origin_date_precision go together');
    end if;
    if r.individuals is null or r.individuals < 1 then perform public.fail('invalid_value', jsonb_build_object('field', 'individuals'), 'must be at least 1'); end if;
    if r.water_interval_days not between 1 and 60 then perform public.fail('invalid_value', jsonb_build_object('field', 'water_interval_days'), 'must be between 1 and 60'); end if;
    if (r.repot_target_cm is null) <> (r.repot_after is null) then perform public.fail('invalid_value', jsonb_build_object('field', 'repot_after'), 'repot_target_cm and repot_after go together'); end if;
    if r.repot_target_cm is not null and r.diameter_cm is not null and r.repot_target_cm <= r.diameter_cm then
      perform public.fail('invalid_value', jsonb_build_object('field', 'repot_target_cm'), 'must exceed the current pot diameter');
    end if;
    if r.cover_event_id is not null then
      if not exists (select 1 from public.events e where e.id = r.cover_event_id and e.plant_id = r.id) then
        perform public.fail('not_found', jsonb_build_object('event', r.cover_event_id), 'no event with this id on this plant');
      end if;
      if not exists (select 1 from public.events e where e.id = r.cover_event_id and e.type = 'photo' and e.voided_at is null) then
        perform public.fail('invalid_value', jsonb_build_object('field', 'cover_event_id'), 'must be a photo event that is not voided');
      end if;
    end if;
    update public.plants q set
      name = case when patch ? 'name' then patch->>'name' else q.name end,
      taxon_id = case when patch ? 'taxon' then tid else q.taxon_id end,
      origin = r.origin, origin_date = r.origin_date, origin_date_precision = r.origin_date_precision,
      individuals = r.individuals, water_interval_days = r.water_interval_days,
      repot_target_cm = r.repot_target_cm, repot_after = r.repot_after, cover_event_id = r.cover_event_id,
      notes = case when patch ? 'notes' then patch->>'notes' else q.notes end
    where q.id = r.id;
  end loop;
  if patch ? 'taxon' then
    delete from public.feed_override f where f.plant_id = any (ids)
      and not exists (select 1 from public.plant_feed pf where pf.plant_id = f.plant_id and pf.supplement_id = f.supplement_id);
  end if;
  return query select * from public.plants q where q.id = any (ids) order by q.name;
end $$;

create function public.archive_plant(plant text, reason public.archive_reason) returns setof public.plants language plpgsql security definer set search_path = '' as $$
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

create function public.create_pot(label text, material public.pot_material default null, diameter_cm numeric default null, height_cm numeric default null, drainage boolean default null, saucer boolean default false, notes text default null)
returns public.pots language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); r public.pots;
begin
  if label is null or exists (select 1 from public.pots x where x.owner_id = o and x.label = create_pot.label) then
    perform public.fail('invalid_value', jsonb_build_object('field', 'label'), 'already used');
  end if;
  if diameter_cm <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'diameter_cm'), 'must be above 0'); end if;
  if height_cm <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'height_cm'), 'must be above 0'); end if;
  insert into public.pots (owner_id, label, material, diameter_cm, height_cm, drainage, saucer, notes)
  values (o, label, material, diameter_cm, height_cm, drainage, coalesce(saucer, false), notes) returning * into r;
  return r;
end $$;

create function public.update_pot(pot text, patch jsonb) returns public.pots language plpgsql security definer set search_path = '' as $$
declare
  o uuid := public.me(); potid uuid := public.resolve_pot(o, pot); k text; r public.pots; cur boolean; nxt boolean;
  allowed text[] := array['label', 'material', 'diameter_cm', 'height_cm', 'saucer', 'drainage', 'notes'];
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then perform public.fail('invalid_value', jsonb_build_object('field', 'patch', 'allowed', to_jsonb(allowed)), 'an object of columns to change'); end if;
  for k in select jsonb_object_keys(patch) loop
    if k <> all (allowed) then perform public.fail('invalid_value', jsonb_build_object('field', k, 'allowed', to_jsonb(allowed)), 'unknown patch key'); end if;
  end loop;
  perform public.check_enum('material', patch->>'material', 'public.pot_material');
  if patch ? 'label' and (patch->>'label' is null or exists (select 1 from public.pots x where x.owner_id = o and x.label = patch->>'label' and x.id <> potid)) then
    perform public.fail('invalid_value', jsonb_build_object('field', 'label'), 'already used');
  end if;
  if public.jnum('diameter_cm', patch->'diameter_cm') <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'diameter_cm'), 'must be above 0'); end if;
  if public.jnum('height_cm', patch->'height_cm') <= 0 then perform public.fail('invalid_value', jsonb_build_object('field', 'height_cm'), 'must be above 0'); end if;
  if patch ? 'saucer' and public.jbool('saucer', patch->'saucer') is null then perform public.fail('invalid_value', jsonb_build_object('field', 'saucer', 'allowed', '[true, false]'::jsonb), 'saucer cannot be cleared'); end if;
  if patch ? 'drainage' then
    select x.drainage into cur from public.pots x where x.id = potid;
    nxt := public.jbool('drainage', patch->'drainage');
    if nxt is distinct from cur and not (cur is null and nxt is not null or cur is false and nxt is true) then
      perform public.fail('invalid_transition', jsonb_build_object('current', coalesce(cur::text, 'unknown')), 'drainage can only go from unknown to true or false, or from false to true');
    end if;
  end if;
  update public.pots x set
    label = case when patch ? 'label' then patch->>'label' else x.label end,
    material = case when patch ? 'material' then (patch->>'material')::public.pot_material else x.material end,
    diameter_cm = case when patch ? 'diameter_cm' then public.jnum('diameter_cm', patch->'diameter_cm') else x.diameter_cm end,
    height_cm = case when patch ? 'height_cm' then public.jnum('height_cm', patch->'height_cm') else x.height_cm end,
    saucer = case when patch ? 'saucer' then public.jbool('saucer', patch->'saucer') else x.saucer end,
    drainage = case when patch ? 'drainage' then public.jbool('drainage', patch->'drainage') else x.drainage end,
    notes = case when patch ? 'notes' then patch->>'notes' else x.notes end
  where x.id = potid returning * into r;
  return r;
end $$;

create function public.retire_pot(pot text) returns public.pots language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); potid uuid := public.resolve_pot(o, pot); r public.pots;
begin
  if exists (select 1 from public.pots x where x.id = potid and x.retired_at is not null) then perform public.fail('invalid_transition', jsonb_build_object('current', 'retired'), 'already retired'); end if;
  if exists (select 1 from public.plants q where q.pot_id = potid and q.archived_at is null) then perform public.fail('invalid_transition', jsonb_build_object('current', 'in_use'), 'the pot still has active occupants'); end if;
  update public.pots x set retired_at = now() where x.id = potid returning * into r;
  return r;
end $$;

create function public.update_feed(plants jsonb, supplement text, patch jsonb) returns setof public.feed_override language plpgsql security definer set search_path = '' as $$
declare
  o uuid := public.me(); ids uuid[] := public.targets(o, plants); sid text := public.resolve_supplement(o, supplement); k text; pid uuid; dose numeric; hold date;
  allowed text[] := array['dose_factor', 'hold_until'];
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then perform public.fail('invalid_value', jsonb_build_object('field', 'patch', 'allowed', to_jsonb(allowed)), 'an object of columns to change'); end if;
  for k in select jsonb_object_keys(patch) loop
    if k <> all (allowed) then perform public.fail('invalid_value', jsonb_build_object('field', k, 'allowed', to_jsonb(allowed)), 'unknown patch key'); end if;
  end loop;
  dose := public.jnum('dose_factor', patch->'dose_factor');
  if dose <= 0 or dose > 1 then perform public.fail('invalid_value', jsonb_build_object('field', 'dose_factor'), 'must be above 0 and at most 1'); end if;
  hold := public.jdate('hold_until', patch->'hold_until');
  foreach pid in array ids loop
    if not exists (select 1 from public.plant_feed f where f.plant_id = pid and f.supplement_id = sid) then
      perform public.fail('invalid_value', jsonb_build_object('field', 'supplement', 'allowed', coalesce((select jsonb_agg(f.supplement_id) from public.plant_feed f where f.plant_id = pid), '[]'::jsonb)), 'not in this plant''s plan');
    end if;
    insert into public.feed_override (owner_id, plant_id, supplement_id, dose_factor, hold_until)
    values (o, pid, sid, case when patch ? 'dose_factor' then dose end, case when patch ? 'hold_until' then hold end)
    on conflict (plant_id, supplement_id) do update set
      dose_factor = case when patch ? 'dose_factor' then excluded.dose_factor else feed_override.dose_factor end,
      hold_until = case when patch ? 'hold_until' then excluded.hold_until else feed_override.hold_until end;
  end loop;
  delete from public.feed_override f where f.plant_id = any (ids) and f.supplement_id = sid and f.dose_factor is null and f.hold_until is null;
  return query select * from public.feed_override f where f.plant_id = any (ids) and f.supplement_id = sid;
end $$;

create function public.create_substrate(label text, parts jsonb default '[]') returns public.substrate language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); r public.substrate; i jsonb; pct numeric;
begin
  if label is null or exists (select 1 from public.substrate s where (s.owner_id is null or s.owner_id = o) and s.label = create_substrate.label) then
    perform public.fail('invalid_value', jsonb_build_object('field', 'label'), 'already used');
  end if;
  if jsonb_typeof(coalesce(parts, '[]'::jsonb)) <> 'array' then perform public.fail('invalid_value', jsonb_build_object('field', 'parts'), 'a list of {component, percent}'); end if;
  insert into public.substrate (id, label, owner_id) values (gen_random_uuid()::text, label, o) returning * into r;
  for i in select jsonb_array_elements(coalesce(parts, '[]'::jsonb)) loop
    perform public.check_enum('parts.component', i->>'component', 'public.substrate_component');
    if i->>'component' is null then perform public.fail('invalid_value', jsonb_build_object('field', 'parts.component', 'allowed', to_jsonb(public.enum_values('public.substrate_component'))), 'component is required'); end if;
    pct := public.jnum('parts.percent', i->'percent');
    if pct not between 1 and 100 then perform public.fail('invalid_value', jsonb_build_object('field', 'parts.percent'), 'must be between 1 and 100'); end if;
    if exists (select 1 from public.substrate_part sp where sp.substrate_id = r.id and sp.component = (i->>'component')::public.substrate_component) then
      perform public.fail('invalid_value', jsonb_build_object('field', 'parts.component'), 'listed twice');
    end if;
    insert into public.substrate_part (substrate_id, component, percent) values (r.id, (i->>'component')::public.substrate_component, pct);
  end loop;
  return r;
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

create function public.complete_task(tasks jsonb, status public.task_status default 'done') returns setof public.tasks language plpgsql security definer set search_path = '' as $$
declare o uuid := public.me(); ids bigint[]; tid bigint; cur public.task_status;
begin
  if coalesce(status, 'done') = 'todo' then perform public.fail('invalid_value', jsonb_build_object('field', 'status', 'allowed', '["done", "skipped"]'::jsonb), 'a task completes as done or skipped'); end if;
  if tasks is null then perform public.fail('invalid_value', jsonb_build_object('field', 'tasks'), 'one task id or a list'); end if;
  ids := case when jsonb_typeof(tasks) = 'array' then array(select (jsonb_array_elements_text(tasks))::bigint) else array[(tasks#>>'{}')::bigint] end;
  foreach tid in array ids loop
    select t.status into cur from public.tasks t where t.id = tid and t.owner_id = o;
    if not found then perform public.fail('not_found', jsonb_build_object('task', tid), 'no task with this id'); end if;
    if cur <> 'todo' then perform public.fail('invalid_transition', jsonb_build_object('current', cur), 'the task is already closed'); end if;
  end loop;
  update public.tasks t set status = coalesce(complete_task.status, 'done'), completed_at = now() where t.id = any (ids);
  return query select * from public.tasks t where t.id = any (ids) order by t.id;
end $$;

create function public.wipe_garden() returns void language plpgsql security definer set search_path = '' as $$
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

alter table public.substrate enable row level security;
alter table public.substrate force row level security;
create policy substrate_read on public.substrate for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
alter table public.substrate_part enable row level security;
alter table public.substrate_part force row level security;
create policy substrate_part_read on public.substrate_part for select to authenticated using (exists (select 1 from public.substrate s where s.id = substrate_id and (s.owner_id is null or s.owner_id = (select auth.uid()))));
alter table public.supplement enable row level security;
alter table public.supplement force row level security;
create policy supplement_read on public.supplement for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
alter table public.care_profile enable row level security;
alter table public.care_profile force row level security;
create policy care_profile_read on public.care_profile for select to authenticated using (true);
alter table public.taxon enable row level security;
alter table public.taxon force row level security;
create policy taxon_read on public.taxon for select to authenticated using (true);
alter table public.programme enable row level security;
alter table public.programme force row level security;
create policy programme_read on public.programme for select to authenticated using (true);
alter table public.plants enable row level security;
alter table public.plants force row level security;
create policy plants_owner_select on public.plants for select to authenticated using (owner_id = (select auth.uid()));
alter table public.pots enable row level security;
alter table public.pots force row level security;
create policy pots_owner_select on public.pots for select to authenticated using (owner_id = (select auth.uid()));
alter table public.events enable row level security;
alter table public.events force row level security;
create policy events_owner_select on public.events for select to authenticated using (owner_id = (select auth.uid()));
alter table public.pest_case enable row level security;
alter table public.pest_case force row level security;
create policy pest_case_owner_select on public.pest_case for select to authenticated using (owner_id = (select auth.uid()));
alter table public.feed_override enable row level security;
alter table public.feed_override force row level security;
create policy feed_override_owner_select on public.feed_override for select to authenticated using (owner_id = (select auth.uid()));
alter table public.tasks enable row level security;
alter table public.tasks force row level security;
create policy tasks_owner_select on public.tasks for select to authenticated using (owner_id = (select auth.uid()));

revoke execute on all functions in schema public from public, anon, authenticated, service_role;
grant select on public.substrate, public.substrate_part, public.supplement, public.care_profile, public.taxon, public.programme, public.plants, public.pots, public.events, public.pest_case, public.feed_override, public.tasks, public.garden, public.plant_feed, public.pots_view, public.due to authenticated;
grant execute on function
  public.local_date(timestamptz), public.event_schema(public.event_type), public.wipe_garden(),
  public.water(jsonb, public.watering_method, integer, timestamptz),
  public.feed(text, jsonb, numeric, public.feed_method, text, timestamptz),
  public.treat(jsonb, public.pest, text, text, timestamptz),
  public.repot(text, text, text, public.root_condition, boolean, integer, text, timestamptz),
  public.diagnose(text, public.condition, public.phenophase, public.symptom[], public.disorder[], jsonb, text, timestamptz),
  public.measure(text, numeric, numeric, numeric, text, timestamptz),
  public.prune(text, public.prune_part, text, timestamptz),
  public.move(jsonb, public.location_zone, public.light_level, text, timestamptz),
  public.note(text, jsonb, timestamptz),
  public.photo(text, jsonb, public.photo_shot, text, timestamptz),
  public.void_event(bigint, text),
  public.create_plant(text, text, public.origin_type, date, public.date_precision, smallint, smallint, public.location_zone, public.light_level, public.condition, public.phenophase, numeric, text, text, text, timestamptz),
  public.update_plant(jsonb, jsonb),
  public.archive_plant(text, public.archive_reason),
  public.create_pot(text, public.pot_material, numeric, numeric, boolean, boolean, text),
  public.update_pot(text, jsonb),
  public.retire_pot(text),
  public.update_feed(jsonb, text, jsonb),
  public.create_substrate(text, jsonb),
  public.create_supplement(text, public.supplement_role, public.supplement_form, public.nutrient[], public.feed_method),
  public.create_task(text, public.task_kind, text, date, smallint, text),
  public.complete_task(jsonb, public.task_status)
to authenticated;
