begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);

select is(
  (select count(*) from public.get_animation_request_pharmacies('00000000-0000-0000-0000-000000000101')),
  1::bigint,
  'agent animation catalog contains only the active primary portfolio'
);

select is(
  (select brand_pharmacy_id from public.get_animation_request_pharmacies('00000000-0000-0000-0000-000000000101')),
  '00000000-0000-0000-0000-000000000411'::uuid,
  'agent animation catalog exposes the assigned pharmacy'
);

select lives_ok(
  $$select public.request_animation(
    '00000000-0000-0000-0000-000000000411',
    null,
    '{
      "title":"Animation demandée par agent",
      "objective":"Développer le sell-out",
      "scheduled_start_at":"2026-12-16T09:00:00Z",
      "scheduled_end_at":"2026-12-16T17:00:00Z",
      "provider_cost_ht":250,
      "travel_cost_ht":35,
      "execution_requirements":{
        "merch_plan_required":true,
        "merch_result_required":true,
        "cash_register_required":true,
        "sales_by_product_required":true
      }
    }',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","target_quantity":18}]'
  )$$,
  'agent creates a governed animation request on an assigned pharmacy'
);

select is(
  (select status from public.missions where title='Animation demandée par agent'),
  'requested'::public.mission_status,
  'unassigned agent animation starts as requested'
);

select is(
  (select requested_by from public.missions where title='Animation demandée par agent'),
  '00000000-0000-0000-0000-0000000000a3'::uuid,
  'commercial requester is retained on the mission'
);

select is(
  (select execution_requirements->>'cash_register_required' from public.missions where title='Animation demandée par agent'),
  'true',
  'requested closeout requirements are persisted'
);

select throws_ok(
  $$select public.request_animation(
    '00000000-0000-0000-0000-000000000412',
    null,
    '{"title":"Animation hors portefeuille","objective":"Interdit","scheduled_start_at":"2026-12-17T09:00:00Z","scheduled_end_at":"2026-12-17T17:00:00Z"}',
    '[]'
  )$$,
  '42501',
  'Animation pharmacy unavailable',
  'agent cannot request an animation outside the active primary portfolio'
);

select * from finish();
rollback;
