begin;
select set_config('x.res', '', true);
create function pg_temp.ok(name text, cond boolean, detail text default '') returns void language sql as $$
  select set_config('x.res', current_setting('x.res', true) || name || ': ' || case when cond then 'PASS' else 'FAIL ' || detail end || E'\n', true)
$$;
create function pg_temp.err(q text) returns text language plpgsql as $$
declare d text;
begin
  execute q;
  return 'no error';
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return sqlstate || '|' || sqlerrm || '|' || d;
end $$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;
set local role authenticated;
do $$
declare
  a constant uuid := '4994c329-c006-424a-b13b-fde093532420';
  b constant uuid := 'c1f7ad70-bbef-4217-bf27-159158654331';
  a_plant uuid; a_pot uuid; a_sup text; a_events int; a_task bigint; e_good bigint; e_water bigint; e_photo bigint;
  b_plant uuid; b_pot uuid; b_sup text; b_sub text; b_event bigint; b_events int; b_task bigint;
  n int; s text; r record;
begin
  perform pg_temp.as_user(b);
  b_pot := (public.create_pot('b pot', 'glazed_ceramic', 11, 12, true)).id;
  select id into b_plant from public.create_plant(name => 'B plant', pot => 'b pot', location => 'balcony', condition => 'good');
  b_sup := (public.create_supplement('b tonic', 'biostimulant', 'liquid', '{micro}', 'foliar')).id;
  b_sub := (public.create_substrate('b mix', '[{"component": "potting_mix", "percent": 70}, {"component": "grit", "percent": 30}]')).id;
  select event_id into b_event from public.photo(b::text || '/x.jpg', jsonb_build_array('B plant'), 'full');
  perform public.diagnose('B plant', pests => '[{"pest": "scale", "status": "suspected"}]');
  select id into b_task from public.create_task('B task', 'inspect', 'B plant');
  select count(*) into b_events from public.events;
  perform pg_temp.ok('setup_b_events', b_events = 5, b_events::text);

  perform pg_temp.as_user(a);
  a_pot := (public.create_pot('a pot', 'plastic', 22, 18, true, true)).id;
  perform pg_temp.ok('smoke_volume', (select volume_l from public.pots_view where pot_id = a_pot) = 5.1);
  select id into a_plant from public.create_plant(name => 'A plant', pot => 'a pot', location => 'balcony', light => 'full_sun', condition => 'good', height_cm => 30, at => now() - interval '10 days');
  perform pg_temp.ok('smoke_create_plant_events', (select count(*) from public.events where plant_id = a_plant) = 4);
  perform pg_temp.ok('smoke_projection', (select condition = 'good' and location = 'balcony' and light = 'full_sun' and pot_id = a_pot and height_cm = 30 from public.plants where id = a_plant));
  a_sup := (public.create_supplement('a feed', 'feed', 'liquid', '{n,k}', 'drench')).id;
  select id into a_task from public.create_task('A task', 'shop');

  perform pg_temp.ok('c3_plants', (select count(*) from public.plants where id = b_plant) = 0);
  perform pg_temp.ok('c3_pots', (select count(*) from public.pots where id = b_pot) = 0);
  perform pg_temp.ok('c3_events', (select count(*) from public.events where id = b_event) = 0);
  perform pg_temp.ok('c3_tasks', (select count(*) from public.tasks where id = b_task) = 0);
  perform pg_temp.ok('c3_pest_case', (select count(*) from public.pest_case where plant_id = b_plant) = 0);
  perform pg_temp.ok('c3_feed_override', (select count(*) from public.feed_override where plant_id = b_plant) = 0);
  s := pg_temp.err(format('insert into public.events (owner_id, plant_id, type, source) values (%L, %L, ''note'', ''x'')', b, b_plant));
  perform pg_temp.ok('c4_insert_denied', s like '42501%', s);
  s := pg_temp.err(format('update public.plants set name = ''x'' where id = %L', b_plant));
  perform pg_temp.ok('c5_update_denied', s like '42501%', s);
  s := pg_temp.err(format('update public.plants set owner_id = %L where id = %L', a, b_plant));
  perform pg_temp.ok('c6_hijack_denied', s like '42501%', s);
  perform pg_temp.ok('c8_garden', (select count(*) from public.garden where plant_id = b_plant) = 0);
  perform pg_temp.ok('c8_plant_feed', (select count(*) from public.plant_feed where plant_id = b_plant) = 0);
  perform pg_temp.ok('c8_pots_view', (select count(*) from public.pots_view where pot_id = b_pot) = 0);
  perform pg_temp.ok('c8_due', (select count(*) from public.due where plant_id = b_plant or task_id = b_task) = 0);
  s := pg_temp.err(format('select public.update_plant(%L, %L)', jsonb_build_array(b_plant), jsonb_build_object('cover_event_id', b_event)));
  perform pg_temp.ok('c9_cover_foreign', s like 'P0002|not_found|%', s);
  s := pg_temp.err(format('select public.photo(%L, %L)', a::text || '/x.jpg', jsonb_build_array(b_plant)));
  perform pg_temp.ok('c10_photo_foreign_plant', s like 'P0002|not_found|%', s);
  s := pg_temp.err(format('select public.photo(%L, %L)', b::text || '/x.jpg', jsonb_build_array(a_plant)));
  perform pg_temp.ok('c10_photo_foreign_path', s like '22023|invalid_value|%', s);
  s := pg_temp.err(format('select public.water(%L)', jsonb_build_array(b_plant)));
  perform pg_temp.ok('c11_water_foreign', s like 'P0002|not_found|%', s);
  select count(*) into a_events from public.events;
  select count(*) into n from public.water();
  perform pg_temp.ok('c12_water_all_own', n = 1 and (select count(*) from public.events) = a_events + 1, n::text);
  s := pg_temp.err(format('select public.feed(%L, %L)', a_sup, jsonb_build_array(b_plant)));
  perform pg_temp.ok('c13_feed_foreign_plant', s like 'P0002|not_found|%', s);
  s := pg_temp.err(format('select public.repot(''A plant'', ''a pot'', %L)', b_sub));
  perform pg_temp.ok('new_repot_foreign_substrate', s like 'P0002|not_found|%', s);
  s := pg_temp.err(format('select public.feed(%L, %L)', b_sup, jsonb_build_array(a_plant)));
  perform pg_temp.ok('new_feed_foreign_supplement', s like 'P0002|not_found|%', s);
  perform pg_temp.ok('new_catalog_isolation', (select count(*) from public.substrate where id = b_sub) = 0 and (select count(*) from public.substrate_part where substrate_id = b_sub) = 0 and (select count(*) from public.supplement where id = b_sup) = 0);

  perform public.diagnose('A plant', condition => 'stressed', at => now() - interval '2 days');
  e_good := public.diagnose('A plant', condition => 'good');
  perform pg_temp.ok('replay_latest_wins', (select condition from public.plants where id = a_plant) = 'good');
  perform public.diagnose('A plant', condition => 'poor', at => now() - interval '1 day');
  perform pg_temp.ok('replay_backdated_by_ts', (select condition from public.plants where id = a_plant) = 'good');
  perform public.void_event(e_good, 'wrong plant');
  perform pg_temp.ok('replay_void_disappears', (select condition from public.plants where id = a_plant) = 'poor');
  s := pg_temp.err(format('select public.void_event(%s, ''again'')', e_good));
  perform pg_temp.ok('void_twice_invalid_transition', s like '55000|invalid_transition|{"current": "voided"}', s);
  perform public.diagnose('A plant', pests => '[{"pest": "spider_mites", "status": "suspected"}]');
  perform public.treat(jsonb_build_array('A plant'), 'spider_mites', 'soap');
  perform public.treat(jsonb_build_array('A plant'), 'spider_mites', 'soap', at => now() - interval '3 days');
  select * into r from public.pest_case where plant_id = a_plant and closed_at is null;
  perform pg_temp.ok('replay_treatment_rounds', r.status = 'treating' and r.rounds = 2 and r.last_treated > now() - interval '1 hour', r::text);
  perform pg_temp.ok('garden_pests', (select pests->0->>'rounds' from public.garden where plant_id = a_plant) = '2');
  perform public.diagnose('A plant', pests => '[]');
  perform pg_temp.ok('replay_clear_cases', (select count(*) from public.pest_case where plant_id = a_plant and closed_at is null) = 0 and (select status from public.pest_case where plant_id = a_plant) = 'cleared');
  select event_id into e_water from public.water(jsonb_build_array('A plant'), at => now() - interval '5 days') limit 1;
  perform pg_temp.ok('garden_water_max_ts', (select last_watered_at > now() - interval '1 hour' from public.garden where plant_id = a_plant));
  s := pg_temp.err(format('select public.void_event(%s, null)', e_water));
  perform pg_temp.ok('void_needs_reason', s like '22023|invalid_value|{"field": "reason"}', s);
  select event_id into e_photo from public.photo(a::text || '/x.jpg', jsonb_build_array('A plant'));
  perform public.update_plant(jsonb_build_array('A plant'), jsonb_build_object('cover_event_id', e_photo));
  perform public.void_event(e_photo, 'wrong photo');
  perform pg_temp.ok('void_unpins_cover', (select cover_event_id is null from public.plants where id = a_plant));
  s := pg_temp.err('select public.water(''["A plant"]'', at => now() + interval ''1 day'')');
  perform pg_temp.ok('future_at_invalid', s like '22023|invalid_value|{"field": "at"}', s);
  s := pg_temp.err('select public.diagnose(''A plant'', pests => ''[{"pest": "cochonilha", "status": "confirmed"}]'')');
  perform pg_temp.ok('enum_error_lists_values', s like '22023|invalid_value|{"field": "pests.pest", "allowed": ["spider_mites",%', s);
  s := pg_temp.err('select public.water(''["Nobody"]'')');
  perform pg_temp.ok('unknown_name_not_found', s like 'P0002|not_found|{"plant": "Nobody"}', s);
  s := pg_temp.err('select public.retire_pot(''a pot'')');
  perform pg_temp.ok('retire_occupied_invalid_transition', s like '55000|invalid_transition|{"current": "in_use"}', s);
  perform public.update_pot('a pot', '{"drainage": true}');
  s := pg_temp.err('select public.update_pot(''a pot'', ''{"drainage": false}'')');
  perform pg_temp.ok('drainage_back_invalid_transition', s like '55000|invalid_transition|{"current": "true"}', s);
  perform public.note('garden note');
  perform pg_temp.ok('garden_level_note', (select count(*) from public.events where plant_id is null and type = 'note' and owner_id = a) = 1);
  perform public.complete_task(to_jsonb(a_task), 'skipped');
  perform pg_temp.ok('complete_task', (select status = 'skipped' and completed_at is not null from public.tasks where id = a_task));
  select id into a_task from public.create_task('A plant task', 'inspect', 'A plant');
  perform public.archive_plant('A plant', 'given_away');
  perform pg_temp.ok('archive_leaves_views', (select count(*) from public.garden where plant_id = a_plant) = 0 and (select status from public.pots_view where pot_id = a_pot) = 'empty');
  perform pg_temp.ok('archive_skips_tasks', (select status = 'skipped' from public.tasks where id = a_task) and (select count(*) from public.due where task_id = a_task) = 0);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'client_id', 'x')::text, true);
  s := pg_temp.err('select public.wipe_garden()');
  perform pg_temp.ok('wipe_denied_to_oauth_client', s like '42501%', s);
  perform pg_temp.as_user(a);
  perform set_config('x.a_plant', a_plant::text, true);
  perform set_config('x.b_plant', b_plant::text, true);

  perform pg_temp.as_user(b);
  perform pg_temp.ok('c12_b_untouched', (select count(*) from public.events) = b_events);
  perform pg_temp.ok('b_reads_own_catalog', (select count(*) from public.substrate where id = b_sub) = 1 and (select count(*) from public.substrate_part where substrate_id = b_sub) = 2);
end $$;
reset role;
do $$
declare a_plant uuid := current_setting('x.a_plant')::uuid; b_plant uuid := current_setting('x.b_plant')::uuid; before_p jsonb; after_p jsonb; before_k jsonb; after_k jsonb; s text;
begin
  s := pg_temp.err(format('insert into public.events (owner_id, plant_id, type, source) values (''4994c329-c006-424a-b13b-fde093532420'', %L, ''note'', ''x'')', b_plant));
  perform pg_temp.ok('c7_composite_fk', s like '23503%', s);
  select to_jsonb(p) into before_p from public.plants p where id = a_plant;
  select jsonb_agg(to_jsonb(k) - 'id' order by k.pest, k.opened_at) into before_k from public.pest_case k where plant_id = a_plant;
  perform public.project_plant(a_plant);
  perform public.project_plant(a_plant);
  select to_jsonb(p) into after_p from public.plants p where id = a_plant;
  select jsonb_agg(to_jsonb(k) - 'id' order by k.pest, k.opened_at) into after_k from public.pest_case k where plant_id = a_plant;
  perform pg_temp.ok('replay_idempotent', before_p = after_p and before_k = after_k, before_p::text || ' vs ' || after_p::text);
  perform pg_temp.ok('no_anon_or_public_execute', (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and (has_function_privilege('anon', p.oid, 'execute') or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x where x.grantee = 0 and x.privilege_type = 'EXECUTE'))) = 0);
  raise exception E'RESULTS\n%', current_setting('x.res', true);
end $$;
rollback;
