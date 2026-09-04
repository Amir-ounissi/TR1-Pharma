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

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
for insert
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.order_status in ('draft','needs_correction')
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
      and (
        private.has_brand_role(o.brand_id, array['tr1_manager','brand_admin'])
        or (
          private.current_user_is_brand_agent(o.brand_id)
          and o.created_by = (select auth.uid())
          and private.user_is_assigned_to_relation((select auth.uid()), o.brand_pharmacy_id)
        )
      )
  )
);

drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items
for update
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.order_status in ('draft','needs_correction')
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
      and (
        private.has_brand_role(o.brand_id, array['tr1_manager','brand_admin'])
        or (
          private.current_user_is_brand_agent(o.brand_id)
          and o.created_by = (select auth.uid())
          and private.user_is_assigned_to_relation((select auth.uid()), o.brand_pharmacy_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.order_status in ('draft','needs_correction')
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
  )
);

drop policy if exists order_items_delete on public.order_items;
create policy order_items_delete on public.order_items
for delete
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.order_status in ('draft','needs_correction')
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
      and (
        private.has_brand_role(o.brand_id, array['tr1_manager','brand_admin'])
        or (
          private.current_user_is_brand_agent(o.brand_id)
          and o.created_by = (select auth.uid())
          and private.user_is_assigned_to_relation((select auth.uid()), o.brand_pharmacy_id)
        )
      )
  )
);

create or replace function public.revise_order(
  target_order_id uuid,
  order_payload jsonb,
  item_payload jsonb,
  submit_after_revision boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  actor uuid := (select auth.uid());
  brand_operator boolean;
  actor_is_owner_agent boolean;
  item_record jsonb;
  requested_type public.order_type;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into target
  from public.orders
  where id = target_order_id
  for update;

  if target.id is null or not private.can_access_brand_pharmacy(target.brand_pharmacy_id) then
    raise exception 'Order unavailable' using errcode='42501';
  end if;

  if target.order_status not in ('draft','needs_correction') then
    raise exception 'Only a draft or correction request can be revised' using errcode='23514';
  end if;

  brand_operator := private.has_brand_role(target.brand_id, array['tr1_manager','brand_admin']);
  actor_is_owner_agent := private.current_user_is_brand_agent(target.brand_id)
    and target.created_by = actor
    and private.user_is_assigned_to_relation(actor, target.brand_pharmacy_id);

  if not (brand_operator or actor_is_owner_agent) then
    raise exception 'Order revision forbidden' using errcode='42501';
  end if;

  if jsonb_typeof(item_payload) <> 'array' or jsonb_array_length(item_payload) = 0 then
    raise exception 'At least one order item is required' using errcode='23514';
  end if;

  requested_type := coalesce(nullif(order_payload ->> 'order_type','')::public.order_type, target.order_type);

  update public.orders
  set external_order_id = case when order_payload ? 'external_order_id' then nullif(order_payload ->> 'external_order_id','') else external_order_id end,
      order_number = case when order_payload ? 'order_number' then nullif(order_payload ->> 'order_number','') else order_number end,
      order_type = requested_type,
      order_date = coalesce(nullif(order_payload ->> 'order_date','')::timestamptz, order_date),
      shipping_amount_ht = coalesce(nullif(order_payload ->> 'shipping_amount_ht','')::numeric, shipping_amount_ht),
      notes = case when order_payload ? 'notes' then nullif(order_payload ->> 'notes','') else notes end
  where id = target_order_id;

  delete from public.order_items where order_id = target_order_id;

  for item_record in select value from jsonb_array_elements(item_payload) loop
    insert into public.order_items(
      organization_id,brand_id,order_id,product_id,product_reference_id,quantity,free_quantity,
      unit_price_ht,discount_rate,discount_amount_ht,tax_rate
    ) values (
      target.organization_id,target.brand_id,target_order_id,
      (item_record ->> 'product_id')::uuid,
      nullif(item_record ->> 'product_reference_id','')::uuid,
      (item_record ->> 'quantity')::integer,
      coalesce((item_record ->> 'free_quantity')::integer,0),
      (item_record ->> 'unit_price_ht')::numeric,
      nullif(item_record ->> 'discount_rate','')::numeric,
      coalesce((item_record ->> 'discount_amount_ht')::numeric,0),
      nullif(item_record ->> 'tax_rate','')::numeric
    );
  end loop;

  if submit_after_revision then
    if not actor_is_owner_agent and not brand_operator then
      raise exception 'Order resubmission forbidden' using errcode='42501';
    end if;

    update public.orders
    set order_status = case when actor_is_owner_agent then 'pending'::public.order_status else order_status end,
        submitted_at = case when actor_is_owner_agent then now() else submitted_at end,
        reviewed_at = case when actor_is_owner_agent then null else reviewed_at end,
        reviewed_by = case when actor_is_owner_agent then null else reviewed_by end,
        review_note = case when actor_is_owner_agent then null else review_note end
    where id = target_order_id;
  end if;
end;
$$;

revoke all on function public.revise_order(uuid,jsonb,jsonb,boolean) from public;
grant execute on function public.revise_order(uuid,jsonb,jsonb,boolean) to authenticated;;
