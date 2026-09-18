begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

select has_table('public', 'field_visit_audits', '4P+ visit audits table exists');
select has_table('public', 'field_visit_audit_attachments', '4P+ audit evidence table exists');
select has_function(
  'public',
  'save_field_visit_audit',
  array['uuid','uuid','jsonb'],
  '4P+ audit save RPC exists'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.save_field_visit_audit(uuid,uuid,jsonb)'::regprocedure),
  'audit save RPC is a security-definer boundary'
);
select ok(
  has_function_privilege('authenticated', 'public.save_field_visit_audit(uuid,uuid,jsonb)', 'EXECUTE'),
  'authenticated users can save a scoped audit'
);
select ok(
  not has_function_privilege('anon', 'public.save_field_visit_audit(uuid,uuid,jsonb)', 'EXECUTE'),
  'anonymous users cannot save an audit'
);

insert into public.field_visits(
  id, owner_user_id, pharmacy_id, visit_kind, status, title, objective,
  scheduled_start_at, scheduled_end_at, source, created_by
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-000000000401',
  'client_visit',
  'planned',
  'Audit 4P test 1',
  'Tester audit terrain',
  now() + interval '1 day',
  now() + interval '1 day 45 minutes',
  'manual',
  '00000000-0000-0000-0000-0000000000a3'
), (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-000000000401',
  'client_visit',
  'planned',
  'Audit 4P test 2',
  'Tester historique audit',
  now() + interval '2 days',
  now() + interval '2 days 45 minutes',
  'manual',
  '00000000-0000-0000-0000-0000000000a3'
);

insert into public.field_visit_brands(visit_id, brand_id, brand_pharmacy_id, objective, is_primary)
values
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'Audit 4P',
  true
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'Audit 4P historique',
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

create temp table _audit_one as
select public.save_field_visit_audit(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000411',
  jsonb_build_object(
    'price_displayed', false,
    'availability_status', 'stockout',
    'stock_quantity', 0,
    'stock_count_mode', 'counted',
    'facings', 0,
    'shelf_visibility', 'not_visible',
    'plv_present', false,
    'team_training_status', 'not_trained',
    'tester_samples_status', 'missing',
    'competition_visible', true,
    'competition_note', 'Concurrent très visible'
  )
) as result;

select is(
  (select count(*)::bigint from public.field_visit_audits where visit_id='10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'agent creates one brand-scoped snapshot for the visit'
);

select ok(
  (select recommendations @> array['reorder','price','plv','training','merchandising','animation','follow_up']::text[]
   from public.field_visit_audits
   where visit_id='10000000-0000-0000-0000-000000000001'),
  'audit derives actionable recommendations from observed gaps'
);

select is(
  (select availability_status from public.field_visit_audits where visit_id='10000000-0000-0000-0000-000000000001'),
  'stockout',
  'availability is persisted'
);

select is(
  (select stock_quantity from public.field_visit_audits where visit_id='10000000-0000-0000-0000-000000000001'),
  0,
  'counted stock is persisted'
);

create temp table _audit_two as
select public.save_field_visit_audit(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000411',
  jsonb_build_object(
    'price_displayed', true,
    'displayed_price_ttc', 19.90,
    'availability_status', 'available',
    'stock_quantity', 12,
    'stock_count_mode', 'counted',
    'facings', 3,
    'shelf_visibility', 'medium',
    'plv_present', true,
    'team_training_status', 'trained',
    'tester_samples_status', 'present',
    'competition_visible', false
  )
) as result;

select is(
  ((select result->>'previous_audit_id' from _audit_two))::uuid,
  (select id from public.field_visit_audits where visit_id='10000000-0000-0000-0000-000000000001'),
  'second visit returns the prior audit for N vs N-1 comparison'
);

select is(
  (select displayed_price_ttc from public.field_visit_audits where visit_id='10000000-0000-0000-0000-000000000002'),
  19.90::numeric,
  'displayed TTC price is persisted when observed'
);

select is(
  (select recommendations from public.field_visit_audits where visit_id='10000000-0000-0000-0000-000000000002'),
  array[]::text[],
  'healthy execution snapshot does not invent recommendations'
);

select lives_ok(
  $$select public.save_field_visit_audit(
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000411',
    '{"availability_status":"low_stock","stock_count_mode":"estimated","shelf_visibility":"medium","team_training_status":"trained","tester_samples_status":"unknown"}'::jsonb
  )$$,
  'same visit audit can be updated idempotently'
);

select is(
  (select count(*)::bigint from public.field_visit_audits where visit_id='10000000-0000-0000-0000-000000000002'),
  1::bigint,
  'updating the same visit does not duplicate the snapshot'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.save_field_visit_audit(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000411',
    '{"availability_status":"available"}'::jsonb
  )$$,
  '42501',
  'Visit unavailable',
  'another user cannot write an audit on the agent visit'
);

select * from finish();
rollback;
