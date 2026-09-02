-- Keep order facts authoritative even when a browser or an import supplies stale values.

create or replace function private.validate_order_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent_order public.orders%rowtype;
  target_product public.products%rowtype;
  base_amount numeric;
begin
  select * into parent_order from public.orders where id = coalesce(new.order_id, old.order_id);
  if parent_order.id is null then raise exception 'Order unavailable' using errcode = '23503'; end if;
  if tg_op in ('UPDATE','DELETE') and parent_order.order_status in ('invoiced','partially_delivered','delivered') and coalesce(current_setting('app.order_admin_correction', true), 'false') <> 'true' then raise exception 'Items of an invoiced order are immutable' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if parent_order.order_status not in ('draft','pending') and coalesce(current_setting('app.order_admin_correction', true), 'false') <> 'true' then raise exception 'Items can only be edited on draft or pending orders' using errcode = '42501'; end if;
  select * into target_product from public.products where id = new.product_id and brand_id = parent_order.brand_id and is_active and discontinued_at is null;
  if target_product.id is null then raise exception 'Order item product is unavailable for this brand' using errcode = '23514'; end if;
  new.brand_id := parent_order.brand_id;
  new.organization_id := parent_order.organization_id;
  new.tax_rate := coalesce(target_product.tax_rate, new.tax_rate, 0);
  if tg_op = 'INSERT' then new.sku_snapshot := target_product.sku; new.product_name_snapshot := target_product.name; else new.sku_snapshot := old.sku_snapshot; new.product_name_snapshot := old.product_name_snapshot; end if;
  if parent_order.order_type in ('return','credit_note') and new.unit_price_ht > 0 then new.unit_price_ht := -new.unit_price_ht; end if;
  if parent_order.order_type not in ('return','credit_note') and new.unit_price_ht < 0 then raise exception 'Negative prices are reserved for returns and credit notes' using errcode = '23514'; end if;
  base_amount := round(new.quantity * new.unit_price_ht, 2);
  new.discount_amount_ht := case when new.discount_rate is not null then round(base_amount * new.discount_rate / 100, 2) else coalesce(new.discount_amount_ht, 0) end;
  if abs(new.discount_amount_ht) > abs(base_amount) then raise exception 'Discount exceeds line amount' using errcode = '23514'; end if;
  new.line_total_ht := round(base_amount - new.discount_amount_ht, 2);
  new.net_unit_price_ht := round(new.line_total_ht / new.quantity, 4);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.create_order(target_brand_pharmacy_id uuid, order_payload jsonb, item_payload jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  relation_record record; new_order_id uuid := gen_random_uuid(); requested_status public.order_status := coalesce((order_payload ->> 'order_status')::public.order_status, 'draft'); requested_source public.order_source := coalesce((order_payload ->> 'source')::public.order_source, 'manual'); item_record jsonb; actor uuid := (select auth.uid()); elevated boolean;
begin
  select bp.*, b.organization_id into relation_record from public.brand_pharmacies bp join public.brands b on b.id = bp.brand_id where bp.id = target_brand_pharmacy_id and bp.archived_at is null;
  if relation_record.id is null or not private.can_access_brand_pharmacy(relation_record.id) then raise exception 'Brand pharmacy unavailable' using errcode = '42501'; end if;
  elevated := private.has_elevated_brand_access(relation_record.brand_id);
  if not (elevated or private.user_is_assigned_to_relation(actor, relation_record.id)) then raise exception 'Order creation forbidden' using errcode = '42501'; end if;
  if not elevated and requested_status not in ('draft','pending','confirmed') then raise exception 'Agents cannot declare invoiced, delivered or refunded revenue' using errcode = '42501'; end if;
  if jsonb_typeof(item_payload) <> 'array' or jsonb_array_length(item_payload) = 0 then raise exception 'At least one order item is required' using errcode = '23514'; end if;
  insert into public.orders (id,organization_id,brand_id,brand_pharmacy_id,pharmacy_id,external_order_id,order_number,order_type,order_status,order_date,source,source_user_id,source_agent_user_id,shipping_amount_ht,currency_code,payment_status,payment_due_at,notes,imported_at,import_batch_id,created_by)
  values (new_order_id,relation_record.organization_id,relation_record.brand_id,relation_record.id,relation_record.pharmacy_id,nullif(order_payload ->> 'external_order_id',''),nullif(order_payload ->> 'order_number',''),coalesce((order_payload ->> 'order_type')::public.order_type,'other'),'draft',coalesce((order_payload ->> 'order_date')::timestamptz,now()),requested_source,actor,case when requested_source in ('agent','import') and not elevated then actor else nullif(order_payload ->> 'source_agent_user_id','')::uuid end,coalesce((order_payload ->> 'shipping_amount_ht')::numeric,0),coalesce(nullif(order_payload ->> 'currency_code',''),'EUR'),coalesce((order_payload ->> 'payment_status')::public.order_payment_status,'pending'),nullif(order_payload ->> 'payment_due_at','')::timestamptz,nullif(order_payload ->> 'notes',''),case when requested_source = 'import' then now() else null end,nullif(order_payload ->> 'import_batch_id','')::uuid,actor);
  for item_record in select value from jsonb_array_elements(item_payload) loop
    insert into public.order_items (organization_id,brand_id,order_id,product_id,product_reference_id,quantity,free_quantity,unit_price_ht,discount_rate,discount_amount_ht,tax_rate)
    values (relation_record.organization_id,relation_record.brand_id,new_order_id,(item_record ->> 'product_id')::uuid,nullif(item_record ->> 'product_reference_id','')::uuid,(item_record ->> 'quantity')::integer,coalesce((item_record ->> 'free_quantity')::integer,0),(item_record ->> 'unit_price_ht')::numeric,nullif(item_record ->> 'discount_rate','')::numeric,coalesce((item_record ->> 'discount_amount_ht')::numeric,0),nullif(item_record ->> 'tax_rate','')::numeric);
  end loop;
  if requested_status <> 'draft' then update public.orders set order_status = requested_status, cancellation_reason = nullif(order_payload ->> 'cancellation_reason','') where id = new_order_id; end if;
  return new_order_id;
end;
$$;

create or replace function public.change_order_status(target_order_id uuid, target_status public.order_status, reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.orders%rowtype; elevated boolean;
begin
  select * into target from public.orders where id = target_order_id;
  if target.id is null then raise exception 'Order unavailable' using errcode = '42501'; end if;
  elevated := private.has_elevated_brand_access(target.brand_id);
  if not (elevated or target.created_by = (select auth.uid())) then raise exception 'Order status change forbidden' using errcode = '42501'; end if;
  if not elevated then
    if target_status = 'cancelled' and coalesce(nullif(btrim(reason), ''), '') = '' then raise exception 'A cancellation reason is required' using errcode = '23514'; end if;
    if target_status not in ('draft','pending','confirmed','cancelled') then raise exception 'Agents cannot declare invoiced, delivered or refunded revenue' using errcode = '42501'; end if;
  end if;
  if target.order_status in ('invoiced','partially_delivered','delivered') and target_status not in ('cancelled','refunded',target.order_status) then raise exception 'Historical invoiced order status is immutable' using errcode = '42501'; end if;
  update public.orders set order_status = target_status, cancellation_reason = case when target_status = 'cancelled' then reason else cancellation_reason end where id = target_order_id;
end;
$$;

revoke all on function private.validate_order_item() from public, anon, authenticated;
revoke all on function public.create_order(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.change_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, text) to authenticated;
