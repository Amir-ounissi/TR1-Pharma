begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select has_function(
  'public',
  'get_pharmacy_field_data_freshness',
  array['uuid'],
  'pharmacy field-data freshness RPC exists'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.get_pharmacy_field_data_freshness(uuid)'::regprocedure),
  'freshness RPC is security-definer'
);

select ok(
  has_function_privilege('authenticated', 'public.get_pharmacy_field_data_freshness(uuid)', 'EXECUTE'),
  'authenticated users can execute freshness RPC'
);

select ok(
  not has_function_privilege('anon', 'public.get_pharmacy_field_data_freshness(uuid)', 'EXECUTE'),
  'anonymous users cannot execute freshness RPC'
);

select is(private.field_data_freshness_status(null), 'never', 'no data means never collected');
select is(private.field_data_freshness_status(30), 'fresh', '30 days is still fresh');
select is(private.field_data_freshness_status(31), 'refresh', '31 days needs refresh');
select is(private.field_data_freshness_status(60), 'refresh', '60 days still needs refresh');
select is(private.field_data_freshness_status(61), 'stale', '61 days is stale');

insert into public.sell_out_captures(
  id,
  organization_id,
  brand_id,
  brand_pharmacy_id,
  method,
  quality,
  status,
  period_start,
  period_end,
  observed_at,
  source_label,
  confidence,
  captured_by,
  updated_by
) values (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'manual',
  'declared',
  'validated',
  current_date - 27,
  current_date - 20,
  now() - interval '20 days',
  'Freshness test',
  1,
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-0000000000a3'
);

insert into public.pharmacy_price_observations(
  id,
  organization_id,
  brand_id,
  brand_pharmacy_id,
  pharmacy_id,
  product_id,
  observed_price_ttc,
  price_type,
  bundle_quantity,
  unit_price_ttc,
  capture_method,
  confidence,
  observed_at,
  created_by
) values (
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000601',
  31.90,
  'regular',
  null,
  31.90,
  'manual',
  1,
  now() - interval '45 days',
  '00000000-0000-0000-0000-0000000000a3'
);

insert into public.field_visits(
  id,
  owner_user_id,
  pharmacy_id,
  visit_kind,
  status,
  title,
  objective,
  scheduled_start_at,
  scheduled_end_at,
  source,
  created_by,
  completed_at
) values (
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-000000000401',
  'client_visit',
  'completed',
  'Audit fraîcheur test',
  'Tester la fraîcheur audit',
  now() - interval '80 days',
  now() - interval '80 days' + interval '45 minutes',
  'manual',
  '00000000-0000-0000-0000-0000000000a3',
  now() - interval '80 days'
);

insert into public.field_visit_brands(
  visit_id,
  brand_id,
  brand_pharmacy_id,
  objective,
  is_primary
) values (
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'Audit fraîcheur',
  true
);

insert into public.field_visit_audits(
  visit_id,
  brand_id,
  brand_pharmacy_id,
  created_by,
  audited_at
) values (
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  '00000000-0000-0000-0000-0000000000a3',
  now() - interval '80 days'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

create temp table _freshness as
select *
from public.get_pharmacy_field_data_freshness(
  '00000000-0000-0000-0000-000000000411'
);

select is((select sell_out_status from _freshness), 'fresh', '20-day sell-out is fresh');
select is((select sell_out_days from _freshness), 20, 'sell-out age is explicit');
select is((select sell_out_quality from _freshness), 'declared', 'sell-out quality remains visible');
select is((select price_status from _freshness), 'refresh', '45-day price needs refresh');
select is((select price_days from _freshness), 45, 'price age is explicit');
select is((select audit_status from _freshness), 'stale', '80-day audit is stale');
select is((select audit_days from _freshness), 80, 'audit age is explicit');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_pharmacy_field_data_freshness(
    '00000000-0000-0000-0000-000000000411'
  )$$,
  '42501',
  'Field data freshness access forbidden',
  'user outside the relation scope cannot read freshness'
);

select * from finish();
rollback;
