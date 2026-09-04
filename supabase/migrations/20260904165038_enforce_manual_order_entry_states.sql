create or replace function private.enforce_manual_order_entry_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_agent boolean := false;
begin
  if actor is null then
    return new;
  end if;

  actor_is_agent := private.current_user_is_brand_agent(new.brand_id)
    and not private.has_brand_role(new.brand_id, array['tr1_manager','brand_admin']);

  if actor_is_agent and new.order_status not in ('draft','pending') then
    new.order_status := 'pending'::public.order_status;
    new.submitted_at := coalesce(new.submitted_at, now());
  elsif new.source = 'manual'
        and private.has_brand_role(new.brand_id, array['tr1_manager','brand_admin'])
        and new.order_status not in ('draft','confirmed') then
    raise exception 'Manual brand orders must be draft or confirmed' using errcode='23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_agent_order_submission on public.orders;
drop trigger if exists enforce_manual_order_entry_state on public.orders;
create trigger enforce_manual_order_entry_state
before insert on public.orders
for each row execute function private.enforce_manual_order_entry_state();

create or replace function public.create_order(
  target_brand_pharmacy_id uuid,
  order_payload jsonb,
  item_payload jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  relation_record record;
  new_order_id uuid := gen_random_uuid();
  requested_status public.order_status := coalesce((order_payload ->> 'order_status')::public.order_status, 'draft');
  requested_source public.order_source := coalesce((order_payload ->> 'source')::public.order_source, 'manual');
  item_record jsonb;
  actor uuid := (select auth.uid());
  elevated boolean;
  actor_is_agent boolean;
begin
  select bp.*, b.organization_id into relation_record
  from public.brand_pharmacies bp
  join public.brands b on b.id = bp.brand_id
  where bp.id = target_brand_pharmacy_id and bp.archived_at is null;

  if relation_record.id is null or not private.can_access_brand_pharmacy(relation_record.id) then
    raise exception 'Brand pharmacy unavailable' using errcode = '42501';
  end if;

  elevated := private.has_brand_role(relation_record.brand_id, array['tr1_manager','brand_admin']);
  actor_is_agent := private.current_user_is_brand_agent(relation_record.brand_id);

  if not elevated and not actor_is_agent then
    raise exception 'Order creation forbidden' using errcode = '42501';
  end if;

  if actor_is_agent and not elevated then
    if not private.user_is_assigned_to_relation(actor, relation_record.id) then
      raise exception 'Order creation forbidden' using errcode = '42501';
    end if;
    if requested_status not in ('draft','pending') then
      raise exception 'Agent orders must be draft or pending brand review' using errcode = '42501';
    end if;
  elsif requested_source = 'manual' and requested_status not in ('draft','confirmed') then
    raise exception 'Manual brand orders must be draft or confirmed' using errcode='23514';
  end if;

  if jsonb_typeof(item_payload) <> 'array' or jsonb_array_length(item_payload) = 0 then
    raise exception 'At least one order item is required' using errcode = '23514';
  end if;

  insert into public.orders (
    id,organization_id,brand_id,brand_pharmacy_id,pharmacy_id,external_order_id,order_number,
    order_type,order_status,order_date,source,source_user_id,source_agent_user_id,shipping_amount_ht,
    currency_code,payment_status,payment_due_at,notes,imported_at,import_batch_id,created_by
  ) values (
    new_order_id,relation_record.organization_id,relation_record.brand_id,relation_record.id,relation_record.pharmacy_id,
    nullif(order_payload ->> 'external_order_id',''),nullif(order_payload ->> 'order_number',''),
    coalesce((order_payload ->> 'order_type')::public.order_type,'other'),'draft',
    coalesce((order_payload ->> 'order_date')::timestamptz,now()),requested_source,actor,
    case when actor_is_agent and not elevated then actor else nullif(order_payload ->> 'source_agent_user_id','')::uuid end,
    coalesce((order_payload ->> 'shipping_amount_ht')::numeric,0),
    coalesce(nullif(order_payload ->> 'currency_code',''),'EUR'),
    coalesce((order_payload ->> 'payment_status')::public.order_payment_status,'not_applicable'),
    nullif(order_payload ->> 'payment_due_at','')::timestamptz,nullif(order_payload ->> 'notes',''),
    case when requested_source = 'import' then now() else null end,
    nullif(order_payload ->> 'import_batch_id','')::uuid,actor
  );

  for item_record in select value from jsonb_array_elements(item_payload) loop
    insert into public.order_items (
      organization_id,brand_id,order_id,product_id,product_reference_id,quantity,free_quantity,
      unit_price_ht,discount_rate,discount_amount_ht,tax_rate
    ) values (
      relation_record.organization_id,relation_record.brand_id,new_order_id,
      (item_record ->> 'product_id')::uuid,nullif(item_record ->> 'product_reference_id','')::uuid,
      (item_record ->> 'quantity')::integer,coalesce((item_record ->> 'free_quantity')::integer,0),
      (item_record ->> 'unit_price_ht')::numeric,nullif(item_record ->> 'discount_rate','')::numeric,
      coalesce((item_record ->> 'discount_amount_ht')::numeric,0),nullif(item_record ->> 'tax_rate','')::numeric
    );
  end loop;

  if requested_status <> 'draft' then
    update public.orders
    set order_status = requested_status,
        cancellation_reason = nullif(order_payload ->> 'cancellation_reason','')
    where id = new_order_id;
  end if;

  return new_order_id;
end;
$$;;
