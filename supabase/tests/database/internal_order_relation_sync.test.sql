begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

insert into public.pharmacy_assignments (
  brand_id,
  brand_pharmacy_id,
  user_id,
  assignment_type,
  is_primary,
  assignment_reason,
  assigned_by
) values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000412',
  '00000000-0000-0000-0000-0000000000a3',
  'commercial_agent',
  true,
  'Test internal order sync',
  '00000000-0000-0000-0000-0000000000a2'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.create_order(
      '00000000-0000-0000-0000-000000000412',
      '{
        "external_order_id":"INTERNAL-SYNC-TEST",
        "order_type":"other",
        "order_status":"pending",
        "order_date":"2026-09-04T12:00:00Z"
      }'::jsonb,
      '[
        {
          "product_id":"00000000-0000-0000-0000-000000000601",
          "quantity":1,
          "unit_price_ht":10
        }
      ]'::jsonb
    )
  $$,
  'agent pending order can run its internal relation synchronization'
);

select is(
  (select order_status
   from public.orders
   where external_order_id = 'INTERNAL-SYNC-TEST'),
  'pending'::public.order_status,
  'agent-created submitted order is actually pending, not silently left draft'
);

select is(
  (select commercial_status
   from public.brand_pharmacies
   where id = '00000000-0000-0000-0000-000000000412'),
  'pending_order'::public.commercial_status,
  'order workflow advances the relation to pending_order'
);

select is(
  (select activity_status
   from public.brand_pharmacies
   where id = '00000000-0000-0000-0000-000000000412'),
  'never_ordered'::public.activity_status,
  'pending order does not create false commercial activity'
);

select is(
  coalesce(current_setting('app.internal_brand_pharmacy_sync', true), ''),
  '',
  'internal synchronization context is restored after the workflow'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select public.change_activity_status(
  '00000000-0000-0000-0000-000000000411',
  'lost',
  'Test manual lost precedence'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{
    "external_order_id":"INTERNAL-SYNC-LOST",
    "source":"agent",
    "order_status":"pending",
    "order_date":"2026-09-04T13:00:00Z"
  }'::jsonb,
  '[
    {
      "product_id":"00000000-0000-0000-0000-000000000601",
      "quantity":1,
      "unit_price_ht":10
    }
  ]'::jsonb
);

select is(
  (select activity_status
   from public.brand_pharmacies
   where id = '00000000-0000-0000-0000-000000000411'),
  'lost'::public.activity_status,
  'manual lost status survives draft and pending order synchronization'
);

select * from finish();
rollback;
