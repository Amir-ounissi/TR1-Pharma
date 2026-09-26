begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.create_order(
    '00000000-0000-0000-0000-000000000412',
    '{"external_order_id":"P2-HUBSPOT-FINALIZE-001","order_status":"draft","source":"import"}',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":0}]'
  )$$,
  'HubSpot-style draft order fixture is created'
);

update public.orders
set line_items_complete = false
where external_order_id = 'P2-HUBSPOT-FINALIZE-001';

delete from public.order_items
where order_id = (
  select id from public.orders where external_order_id = 'P2-HUBSPOT-FINALIZE-001'
);

insert into public.order_items (
  order_id,
  product_id,
  quantity,
  free_quantity,
  unit_price_ht,
  discount_rate,
  tax_rate
)
select
  id,
  '00000000-0000-0000-0000-000000000601',
  2,
  1,
  10,
  10,
  5.5
from public.orders
where external_order_id = 'P2-HUBSPOT-FINALIZE-001';

select is(
  (select net_amount_ht from public.orders where external_order_id = 'P2-HUBSPOT-FINALIZE-001'),
  0.00::numeric,
  'incomplete import stays financially inert while line items are assembled'
);

select is(
  (select line_items_complete from public.orders where external_order_id = 'P2-HUBSPOT-FINALIZE-001'),
  false,
  'line set remains explicitly incomplete before finalization'
);

update public.orders
set line_items_complete = true
where external_order_id = 'P2-HUBSPOT-FINALIZE-001';

select is(
  (select net_amount_ht from public.orders where external_order_id = 'P2-HUBSPOT-FINALIZE-001'),
  18.00::numeric,
  'completing the line set recalculates server-controlled net amount'
);

select is(
  (select subtotal_ht from public.orders where external_order_id = 'P2-HUBSPOT-FINALIZE-001'),
  20.00::numeric,
  'completion recalculation persists subtotal'
);

select * from finish();
rollback;
