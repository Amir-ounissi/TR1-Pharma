-- Allow FK cascade cleanup of order_items when an imported HubSpot order is
-- deliberately deleted before reconstruction. Normal direct line-item edits
-- remain protected by the existing parent/status checks.
create or replace function private.validate_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_order public.orders%rowtype;
  target_product public.products%rowtype;
  base_amount numeric;
  admin_correction boolean := coalesce(current_setting('app.order_admin_correction', true), 'false') = 'true';
begin
  select * into parent_order
  from public.orders
  where id = coalesce(new.order_id, old.order_id);

  if parent_order.id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'Order unavailable' using errcode = '23503';
  end if;

  if not admin_correction and parent_order.order_status not in ('draft','needs_correction') then
    raise exception 'Reviewed order items are immutable' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select * into target_product
  from public.products
  where id = new.product_id
    and brand_id = parent_order.brand_id
    and is_active
    and discontinued_at is null;

  if target_product.id is null then
    raise exception 'Order item product is unavailable for this brand' using errcode = '23514';
  end if;

  new.brand_id := parent_order.brand_id;
  new.organization_id := parent_order.organization_id;
  new.tax_rate := coalesce(target_product.tax_rate, new.tax_rate, 0);

  if tg_op = 'INSERT' then
    new.sku_snapshot := target_product.sku;
    new.product_name_snapshot := target_product.name;
  else
    if new.product_id is distinct from old.product_id then
      new.sku_snapshot := target_product.sku;
      new.product_name_snapshot := target_product.name;
    else
      new.sku_snapshot := old.sku_snapshot;
      new.product_name_snapshot := old.product_name_snapshot;
    end if;
  end if;

  if parent_order.order_type in ('return','credit_note') and new.unit_price_ht > 0 then
    new.unit_price_ht := -new.unit_price_ht;
  end if;

  if parent_order.order_type not in ('return','credit_note') and new.unit_price_ht < 0 then
    raise exception 'Negative prices are reserved for returns and credit notes' using errcode = '23514';
  end if;

  base_amount := round(new.quantity * new.unit_price_ht, 2);
  new.discount_amount_ht := case
    when new.discount_rate is not null then round(base_amount * new.discount_rate / 100, 2)
    else coalesce(new.discount_amount_ht, 0)
  end;

  if abs(new.discount_amount_ht) > abs(base_amount) then
    raise exception 'Discount exceeds line amount' using errcode = '23514';
  end if;

  new.line_total_ht := round(base_amount - new.discount_amount_ht, 2);
  new.net_unit_price_ht := round(new.line_total_ht / new.quantity, 4);
  new.updated_at := now();
  return new;
end;
$$;
