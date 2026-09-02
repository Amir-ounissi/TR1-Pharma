begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into public.products (id, brand_id, name, sku, wholesale_price_ht, tax_rate)
values ('00000000-0000-0000-0000-00000000d611', '00000000-0000-0000-0000-000000000101', 'Produit correction historique', 'D611-HIST', 15, 20);

select plan(17);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select lives_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-CONFIRMED","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10,"discount_rate":10}]'
)$$, 'manager creates a confirmed order');
select set_config('app.order_admin_correction', 'true', true);
select lives_ok($$update public.order_items set quantity = 3 where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-CONFIRMED')$$, 'manager can correct a confirmed order item through the historical correction path');
select is((select line_total_ht from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-CONFIRMED')), 27.00::numeric, 'confirmed correction recalculates the discounted total');

select lives_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-INVOICED","order_status":"invoiced"}',
  '[{"product_id":"00000000-0000-0000-0000-00000000d611","quantity":2,"unit_price_ht":15,"tax_rate":5.5}]'
)$$, 'manager creates an invoiced order for a historical correction');
select set_config('app.order_admin_correction', 'true', true);
select lives_ok($$update public.order_items set product_id = '00000000-0000-0000-0000-000000000601', unit_price_ht = 12, tax_rate = 99 where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-INVOICED')$$, 'manager can perform an authorized historical correction');
select is((select tax_rate from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-INVOICED')), 5.5::numeric, 'catalog VAT remains authoritative during a historical correction');
select is((select sku_snapshot from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-INVOICED')), 'D611-HIST', 'historical SKU snapshot remains immutable during a correction');
select is((select product_name_snapshot from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-INVOICED')), 'Produit correction historique', 'historical product name snapshot remains immutable during a correction');

select lives_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-RETURN","order_type":"return","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":8}]'
)$$, 'return continues to be created');
select is((select net_amount_ht from public.orders where external_order_id = 'PDF-HARD-RETURN'), -8.00::numeric, 'return remains a negative commercial correction');
select lives_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-CREDIT","order_type":"credit_note","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":6}]'
)$$, 'credit note continues to be created');
select is((select net_amount_ht from public.orders where external_order_id = 'PDF-HARD-CREDIT'), -6.00::numeric, 'credit note remains a negative commercial correction');

select throws_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-CROSS-BRAND"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000602","quantity":1,"unit_price_ht":10}]'
)$$, '23514', 'Order item product is unavailable for this brand', 'cross-brand product remains rejected by the trigger');

select set_config('app.order_admin_correction', 'false', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select lives_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-AGENT","source":"agent","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":18.5}]'
)$$, 'agent creates an allowed confirmed order');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select lives_ok($$select public.change_order_status((select id from public.orders where external_order_id = 'PDF-HARD-AGENT'), 'delivered', null)$$, 'manager can record delivery for the agent order');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select lives_ok($$update public.order_items set quantity = 9 where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-AGENT')$$, 'agent update attempt cannot bypass row-level access on a delivered item');
select is((select quantity from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-AGENT')), 1, 'delivered historical item remains unchanged after the agent attempt');

select * from finish();
rollback;
