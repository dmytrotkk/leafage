select jsonb_build_object(
  'enums', (select jsonb_object_agg(typname, vals) from (
    select t.typname, jsonb_agg(e.enumlabel order by e.enumsortorder) as vals
    from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typnamespace = 'public'::regnamespace group by t.typname) x),
  'constraints', (select jsonb_object_agg(c.conrelid::regclass::text || '.' || c.conname, pg_get_constraintdef(c.oid))
    from pg_constraint c where c.connamespace = 'public'::regnamespace and c.contype in ('c', 'u', 'f', 'p')),
  'indexes', (select jsonb_object_agg(i.indexname, i.indexdef) from pg_indexes i
    where i.schemaname = 'public' and i.indexname not in (select conname from pg_constraint where connamespace = 'public'::regnamespace)),
  'rls', (select jsonb_object_agg(c.relname, jsonb_build_object('enabled', c.relrowsecurity, 'forced', c.relforcerowsecurity))
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'),
  'policies', (select jsonb_object_agg(p.polname || ' on ' || c.relname, jsonb_build_object('cmd', p.polcmd, 'roles', p.polroles::regrole[]::text[], 'using', pg_get_expr(p.polqual, p.polrelid)))
    from pg_policy p join pg_class c on c.oid = p.polrelid where c.relnamespace = 'public'::regnamespace),
  'write_grants', (select coalesce(jsonb_agg(jsonb_build_object('table', table_name, 'grantee', grantee, 'privilege', privilege_type) order by table_name, grantee, privilege_type), '[]'::jsonb)
    from information_schema.role_table_grants where table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') and grantee <> 'postgres'),
  'select_grants', (select jsonb_object_agg(table_name, grantees) from (
    select table_name, jsonb_agg(grantee order by grantee) as grantees from information_schema.role_table_grants
    where table_schema = 'public' and privilege_type = 'SELECT' and grantee <> 'postgres' group by table_name) x),
  'views', (select jsonb_object_agg(c.relname, coalesce(array_to_string(c.reloptions, ','), '')) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'),
  'view_notnull', (select coalesce(jsonb_object_agg(c.relname || '.' || a.attname, d.description), '{}'::jsonb)
    from pg_description d join pg_class c on c.oid = d.objoid and c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
    join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid where d.objsubid > 0),
  'functions', (select jsonb_object_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', jsonb_build_object(
      'definer', p.prosecdef, 'config', to_jsonb(p.proconfig), 'volatility', p.provolatile,
      'authenticated', has_function_privilege('authenticated', p.oid, 'execute'),
      'anon', has_function_privilege('anon', p.oid, 'execute'),
      'public', exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')))
    from pg_proc p where p.pronamespace = 'public'::regnamespace),
  'triggers', (select jsonb_object_agg(t.tgname || ' on ' || c.relname, pg_get_triggerdef(t.oid))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal),
  'default_acl', (select coalesce(jsonb_object_agg(d.defaclobjtype::text, array_to_string(d.defaclacl, ',')), '{}'::jsonb)
    from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace)
)::text as schema;
