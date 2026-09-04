begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create temp table _tr1_order_workflow_helper_anchor(id integer);

create or replace function pg_temp.tr1_advance_order_to(
  target_order_id uuid,
  desired_status public.order_status,
  transition_reason text default null
)
returns void
language plpgsql
as $$
declare
  current_status public.order_status;
  clean_reason text := coalesce(nullif(btrim(transition_reason), ''), 'Test workflow transition');
begin
  loop
    select order_status
    into current_status
    from public.orders
    where id = target_order_id;

    if current_status is null then
      raise exception 'Test order unavailable';
    end if;

    exit when current_status = desired_status;

    if desired_status = 'cancelled' then
      perform public.change_order_status(target_order_id, 'cancelled', clean_reason);
    elsif current_status = 'draft' then
      if desired_status in ('pending','needs_correction','rejected') then
        perform public.change_order_status(target_order_id, 'pending', null);
      else
        perform public.change_order_status(target_order_id, 'confirmed', null);
      end if;
    elsif current_status = 'pending' then
      if desired_status = 'needs_correction' then
        perform public.change_order_status(target_order_id, 'needs_correction', clean_reason);
      elsif desired_status = 'rejected' then
        perform public.change_order_status(target_order_id, 'rejected', clean_reason);
      else
        perform public.change_order_status(target_order_id, 'confirmed', null);
      end if;
    elsif current_status = 'needs_correction' then
      perform public.change_order_status(target_order_id, 'pending', null);
    elsif current_status = 'confirmed' then
      perform public.change_order_status(target_order_id, 'invoiced', null);
    elsif current_status = 'invoiced' then
      if desired_status = 'partially_delivered' then
        perform public.change_order_status(target_order_id, 'partially_delivered', null);
      elsif desired_status = 'delivered' then
        perform public.change_order_status(target_order_id, 'delivered', null);
      elsif desired_status = 'refunded' then
        perform public.change_order_status(target_order_id, 'refunded', null);
      else
        raise exception 'Unsupported test transition from invoiced to %', desired_status;
      end if;
    elsif current_status = 'partially_delivered' then
      if desired_status = 'delivered' then
        perform public.change_order_status(target_order_id, 'delivered', null);
      elsif desired_status = 'refunded' then
        perform public.change_order_status(target_order_id, 'refunded', null);
      else
        raise exception 'Unsupported test transition from partially_delivered to %', desired_status;
      end if;
    else
      raise exception 'Unsupported test transition from % to %', current_status, desired_status;
    end if;
  end loop;
end;
$$;

create or replace function pg_temp.tr1_create_order_at_status(
  target_brand_pharmacy_id uuid,
  order_payload jsonb,
  item_payload jsonb
)
returns uuid
language plpgsql
as $$
declare
  desired_status public.order_status :=
    coalesce((order_payload ->> 'order_status')::public.order_status, 'draft');
  entry_status public.order_status;
  entry_payload jsonb;
  created_order_id uuid;
begin
  entry_status := case
    when desired_status in ('invoiced','partially_delivered','delivered','refunded')
      then 'confirmed'::public.order_status
    when desired_status in ('pending','needs_correction','rejected','cancelled')
      then 'draft'::public.order_status
    else desired_status
  end;

  entry_payload := jsonb_set(
    order_payload,
    '{order_status}',
    to_jsonb(entry_status::text),
    true
  );

  created_order_id := public.create_order(
    target_brand_pharmacy_id,
    entry_payload,
    item_payload
  );

  if desired_status <> entry_status then
    perform pg_temp.tr1_advance_order_to(
      created_order_id,
      desired_status,
      order_payload ->> 'cancellation_reason'
    );
  end if;

  return created_order_id;
end;
$$;


insert into public.products (id, brand_id, name, sku, wholesale_price_ht, tax_rate)
values ('00000000-0000-0000-0000-00000000d611', '00000000-0000-0000-0000-000000000101', 'Produit correction historique', 'D611-HIST', 15, 20);

create or replace function pg_temp.tr1_update_order_item_quantity_count(
  target_order_id uuid,
  target_quantity integer
)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  update public.order_items
  set quantity = target_quantity
  where order_id = target_order_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function pg_temp.tr1_update_order_item_fields_count(
  target_order_id uuid,
  target_product_id uuid,
  target_unit_price_ht numeric,
  target_tax_rate numeric
)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  update public.order_items
  set product_id = target_product_id,
      unit_price_ht = target_unit_price_ht,
      tax_rate = target_tax_rate
  where order_id = target_order_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

select plan(17);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select lives_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-CONFIRMED","order_status":"confirmed"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10,"discount_rate":10}]'
)$$, 'manager creates a confirmed order');
select is(
  pg_temp.tr1_update_order_item_quantity_count(
    (select id from public.orders where external_order_id = 'PDF-HARD-CONFIRMED'),
    3
  ),
  0::bigint,
  'confirmed order items cannot be directly corrected after review'
);
select is((select line_total_ht from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-CONFIRMED')), 9.00::numeric, 'confirmed item remains unchanged after the blocked correction');

select lives_ok($$select pg_temp.tr1_create_order_at_status(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-INVOICED","order_status":"invoiced"}',
  '[{"product_id":"00000000-0000-0000-0000-00000000d611","quantity":2,"unit_price_ht":15,"tax_rate":5.5}]'
)$$, 'manager creates an invoiced order for a historical correction');
select is(
  pg_temp.tr1_update_order_item_fields_count(
    (select id from public.orders where external_order_id = 'PDF-HARD-INVOICED'),
    '00000000-0000-0000-0000-000000000601',
    12,
    99
  ),
  0::bigint,
  'invoiced order items remain immutable even for a direct manager update'
);
select is((select tax_rate from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-INVOICED')), 20.00::numeric, 'catalog VAT remains authoritative and unchanged on the immutable historical line');
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

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select lives_ok($$select public.create_order(
  '00000000-0000-0000-0000-000000000411',
  '{"external_order_id":"PDF-HARD-AGENT","source":"agent","order_status":"pending"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":18.5}]'
)$$, 'agent submits an allowed pending order for brand review');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select lives_ok($$select pg_temp.tr1_advance_order_to((select id from public.orders where external_order_id = 'PDF-HARD-AGENT'), 'delivered', null)$$, 'manager can review, invoice and record delivery for the agent order');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select lives_ok($$update public.order_items set quantity = 9 where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-AGENT')$$, 'agent update attempt cannot bypass row-level access on a delivered item');
select is((select quantity from public.order_items where order_id = (select id from public.orders where external_order_id = 'PDF-HARD-AGENT')), 1, 'delivered historical item remains unchanged after the agent attempt');

select * from finish();
rollback;
