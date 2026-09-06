begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

select plan(8);

select ok(
  not has_function_privilege('anon','public.assign_mission(uuid,uuid,timestamp with time zone,timestamp with time zone)','EXECUTE'),
  'anonymous users cannot execute mission assignment'
);
select ok(
  has_function_privilege('authenticated','public.assign_mission(uuid,uuid,timestamp with time zone,timestamp with time zone)','EXECUTE'),
  'authenticated users retain the mission assignment entry point'
);

select ok(
  not has_function_privilege('anon','public.schedule_mission(uuid,timestamp with time zone,timestamp with time zone)','EXECUTE'),
  'anonymous users cannot execute mission scheduling'
);
select ok(
  has_function_privilege('authenticated','public.schedule_mission(uuid,timestamp with time zone,timestamp with time zone)','EXECUTE'),
  'authenticated users retain the mission scheduling entry point'
);

select ok(
  not has_function_privilege('anon','public.revise_order(uuid,jsonb,jsonb,boolean)','EXECUTE'),
  'anonymous users cannot execute atomic order revisions'
);
select ok(
  has_function_privilege('authenticated','public.revise_order(uuid,jsonb,jsonb,boolean)','EXECUTE'),
  'authenticated users retain the order revision entry point'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ),
  0::bigint,
  'no public SECURITY DEFINER function is executable anonymously'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and not ('search_path=""' = any(coalesce(p.proconfig,'{}'::text[])))
  ),
  0::bigint,
  'every public SECURITY DEFINER function pins an empty search_path'
);

select * from finish();
rollback;
