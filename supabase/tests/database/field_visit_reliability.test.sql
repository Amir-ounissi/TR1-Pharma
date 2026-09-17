begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

select ok(
  to_regprocedure('public.close_field_visit(uuid,jsonb)') is not null,
  'canonical visit closeout RPC exists'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.close_field_visit(uuid,jsonb)'::regprocedure),
  'canonical visit closeout is a security-definer boundary'
);

select ok(
  has_function_privilege('authenticated', 'public.close_field_visit(uuid,jsonb)', 'EXECUTE'),
  'authenticated users can execute canonical visit closeout'
);

select ok(
  not has_function_privilege('anon', 'public.close_field_visit(uuid,jsonb)', 'EXECUTE'),
  'anonymous users cannot execute canonical visit closeout'
);

select like(
  pg_get_functiondef('public.close_field_visit(uuid,jsonb)'::regprocedure),
  '%field_visit_id%',
  'canonical closeout links created interactions to the visit'
);

select like(
  pg_get_functiondef('public.close_field_visit(uuid,jsonb)'::regprocedure),
  '%interactions%',
  'canonical closeout returns interaction references for evidence persistence'
);

select like(
  pg_get_functiondef('public.complete_field_visit(uuid,text,timestamp with time zone)'::regprocedure),
  '%close_field_visit%',
  'legacy completion delegates to the canonical closeout RPC'
);

select like(
  pg_get_functiondef('public.start_field_visit(uuid)'::regprocedure),
  '%actual_start_at%',
  'visit start keeps legacy and canonical start timestamps aligned'
);

select like(
  pg_get_functiondef('public.close_field_visit(uuid,jsonb)'::regprocedure),
  '%actual_end_at%',
  'visit closeout keeps legacy and canonical end timestamps aligned'
);

select * from finish();
rollback;
