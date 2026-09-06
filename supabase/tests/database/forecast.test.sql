begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select has_function(
  'public',
  'get_revenue_forecast',
  array['uuid','date','date','date'],
  'Revenue forecast RPC exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

create temp table _forecast as
select public.get_revenue_forecast(
  '00000000-0000-0000-0000-000000000101',
  '2026-01-01',
  '2026-12-31',
  '2026-09-06'
) as payload;

select is(
  jsonb_typeof((select payload from _forecast)),
  'object',
  'brand admin receives an object forecast'
);

select ok(
  (select payload ? 'projected_revenue_ht' from _forecast),
  'forecast exposes projected revenue'
);

select ok(
  (select payload ? 'expected_reorders' from _forecast),
  'forecast exposes explainable expected reorders'
);

select is(
  jsonb_typeof((select payload -> 'expected_reorders' from _forecast)),
  'array',
  'expected reorders are returned as an array'
);

select is(
  round(((select payload ->> 'projected_revenue_ht' from _forecast))::numeric, 2),
  round(
    ((select payload ->> 'realized_revenue_ht' from _forecast))::numeric
    + ((select payload ->> 'booked_pipeline_ht' from _forecast))::numeric
    + ((select payload ->> 'expected_reorder_revenue_ht' from _forecast))::numeric,
    2
  ),
  'projected revenue is the transparent sum of realized, booked and expected reorders'
);

select ok(
  (select payload -> 'methodology' ? 'exclusions' from _forecast),
  'forecast explains its exclusions'
);

select throws_ok(
  $$select public.get_revenue_forecast(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31',
    '2027-01-01'
  )$$,
  '22007',
  'Forecast reference date is outside the period',
  'reference date must stay inside the forecast period'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.get_revenue_forecast(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31',
    '2026-09-06'
  )$$,
  '42501',
  'Revenue forecast forbidden',
  'agent cannot read the brand-wide forecast'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.get_revenue_forecast(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31',
    '2026-09-06'
  )$$,
  '42501',
  'Revenue forecast forbidden',
  'another brand admin cannot read Dermavita forecast'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.get_revenue_forecast(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31',
    '2026-09-06'
  )$$,
  'brand admin can read its forecast repeatedly without side effects'
);

select * from finish();
rollback;
