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

  brand_operator := private.has_brand_role(target.brand_id, array['tr1_manager','brand_admin']);
  actor_is_owner_agent := private.current_user_is_brand_agent(target.brand_id)
    and target.created_by = actor
    and private.user_is_assigned_to_relation(actor, target.brand_pharmacy_id);

  if not (brand_operator or actor_is_owner_agent) then
    raise exception 'Order revision forbidden' using errcode='42501';
  end if;

  if target.order_status not in ('draft','needs_correction','pending') then
    raise exception 'Only an unvalidated order can be revised' using errcode='23514';
  end if;

  if jsonb_typeof(item_payload) <> 'array' or jsonb_array_length(item_payload) = 0 then
    raise exception 'At least one order item is required' using errcode='23514';
  end if;

  requested_type := coalesce(nullif(order_payload ->> 'order_type','')::public.order_type, target.order_type);

  -- Pending orders are normally immutable at line level. This narrowly scoped
  -- transaction-local flag lets this audited RPC replace the lines after all
  -- ownership/role/status checks above have passed.
  perform set_config('app.order_admin_correction', 'true', true);

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
grant execute on function public.revise_order(uuid,jsonb,jsonb,boolean) to authenticated;
