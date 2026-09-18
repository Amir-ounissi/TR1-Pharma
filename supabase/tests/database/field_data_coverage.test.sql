begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_function(
  'public',
  'get_field_data_coverage',
  array['uuid','date','date'],
  'field data coverage RPC exists'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.get_field_data_coverage(uuid,date,date)'::regprocedure),
  'coverage RPC is security-definer'
);

select ok(
  has_function_privilege('authenticated', 'public.get_field_data_coverage(uuid,date,date)', 'EXECUTE'),
  'authenticated users can execute coverage RPC'
);

select ok(
  not has_function_privilege('anon', 'public.get_field_data_coverage(uuid,date,date)', 'EXECUTE'),
  'anonymous users cannot execute coverage RPC'
);

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
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'manual',
  'declared',
  'validated',
  '2099-01-01',
  '2099-01-31',
  '2099-01-31T12:00:00Z',
  'Coverage test',
  1,
  '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a2'
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
  '30000000-0000-0000-0000-000000000002',
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
  '2099-01-31T13:00:00Z',
  '00000000-0000-0000-0000-0000000000a2'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

create temp table _coverage as
select *
from public.get_field_data_coverage(
  '00000000-0000-0000-0000-000000000101',
  '2099-01-01',
  '2099-01-31'
);

select cmp_ok((select panel_pharmacies from _coverage), '>=', 1::bigint, 'commercial panel is non-empty');
select is((select sell_out_pharmacies from _coverage), 1::bigint, 'one pharmacy has recent sell-out');
select is((select price_pharmacies from _coverage), 1::bigint, 'one pharmacy has a recent observed price');
select is((select combined_pharmacies from _coverage), 1::bigint, 'one pharmacy has both field signals');
select cmp_ok((select sell_out_coverage_rate from _coverage), '>', 0::numeric, 'sell-out coverage rate is positive');
select cmp_ok((select price_coverage_rate from _coverage), '>', 0::numeric, 'price coverage rate is positive');
select cmp_ok((select combined_coverage_rate from _coverage), '>', 0::numeric, 'combined coverage rate is positive');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_field_data_coverage(
    '00000000-0000-0000-0000-000000000101',
    '2099-01-01',
    '2099-01-31'
  )$$,
  '42501',
  'Field data coverage access forbidden',
  'agent cannot read brand-wide field data coverage'
);

select * from finish();
rollback;
