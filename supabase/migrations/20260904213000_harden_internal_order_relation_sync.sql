-- Internal order workflows legitimately synchronize brand-pharmacy state.
-- Keep manual agent restrictions intact while distinguishing these nested
-- system updates from direct user edits.

create or replace function private.enforce_brand_pharmacy_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.brand_settings%rowtype;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  -- Only security-definer workflow functions set this transaction-local flag.
  -- It must never be used by ordinary user-facing update paths.
  if coalesce(current_setting('app.internal_brand_pharmacy_sync', true), '') = 'order' then
    return new;
  end if;

  if private.has_brand_role(old.brand_id, array['tr1_manager','brand_admin']) then
    return new;
  end if;

  if old.current_agent_user_id = (select auth.uid()) then
    select * into settings
    from public.brand_settings
    where brand_id = old.brand_id;

    if coalesce(settings.allow_agents_to_edit_potential, false) then
      if (
        to_jsonb(new) - array[
          'potential_level','potential_score','next_action_type','next_action_at',
          'next_action_owner_id','notes','last_interaction_at','updated_at'
        ]
      ) = (
        to_jsonb(old) - array[
          'potential_level','potential_score','next_action_type','next_action_at',
          'next_action_owner_id','notes','last_interaction_at','updated_at'
        ]
      ) then
        return new;
      end if;
    else
      if (
        to_jsonb(new) - array[
          'next_action_type','next_action_at','next_action_owner_id',
          'notes','last_interaction_at','updated_at'
        ]
      ) = (
        to_jsonb(old) - array[
          'next_action_type','next_action_at','next_action_owner_id',
          'notes','last_interaction_at','updated_at'
        ]
      ) then
        return new;
      end if;
    end if;
  end if;

  raise exception 'Agent update scope exceeded' using errcode = '42501';
end;
$$;

create or replace function private.sync_order_review_relation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_valid_order boolean;
  previous_internal_sync text := coalesce(current_setting('app.internal_brand_pharmacy_sync', true), '');
  previous_activity_managed text := coalesce(current_setting('app.activity_history_managed', true), '');
  previous_status_source text := coalesce(current_setting('app.status_change_source', true), '');
  previous_status_reason text := coalesce(current_setting('app.status_change_reason', true), '');
begin
  if new.order_status not in ('draft','pending','needs_correction','rejected','cancelled') then
    return new;
  end if;

  select exists (
    select 1
    from public.orders o
    where o.brand_pharmacy_id = new.brand_pharmacy_id
      and o.id <> new.id
      and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  ) into has_valid_order;

  if has_valid_order then
    return new;
  end if;

  perform set_config('app.internal_brand_pharmacy_sync', 'order', true);
  perform set_config('app.activity_history_managed', 'true', true);
  perform set_config('app.status_change_source', 'system', true);
  perform set_config('app.status_change_reason', 'Order workflow synchronization', true);

  begin
    update public.brand_pharmacies bp
    set commercial_status = case
          when new.order_status in ('pending','needs_correction')
            then 'pending_order'::public.commercial_status
          when new.order_status in ('draft','rejected','cancelled')
               and bp.commercial_status = 'pending_order'
            then 'qualified'::public.commercial_status
          when bp.commercial_status = 'implanted' and bp.implanted_at is null
            then 'qualified'::public.commercial_status
          else bp.commercial_status
        end,
        activity_status = case
          when bp.activity_status = 'lost' then 'lost'::public.activity_status
          else 'never_ordered'::public.activity_status
        end
    where bp.id = new.brand_pharmacy_id;
  exception when others then
    perform set_config('app.internal_brand_pharmacy_sync', previous_internal_sync, true);
    perform set_config('app.activity_history_managed', previous_activity_managed, true);
    perform set_config('app.status_change_source', previous_status_source, true);
    perform set_config('app.status_change_reason', previous_status_reason, true);
    raise;
  end;

  perform set_config('app.internal_brand_pharmacy_sync', previous_internal_sync, true);
  perform set_config('app.activity_history_managed', previous_activity_managed, true);
  perform set_config('app.status_change_source', previous_status_source, true);
  perform set_config('app.status_change_reason', previous_status_reason, true);

  return new;
end;
$$;

-- Narrow agent submission path inside create_order.
-- Direct UPDATE on public.orders remains manager-only; an agent-created draft
-- is submitted through the already hardened security-definer lifecycle RPC.
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
    if actor_is_agent and not elevated then
      -- Agents never receive direct UPDATE rights on reviewed order rows.
      -- The hardened lifecycle RPC owns the draft -> pending transition.
      perform public.change_order_status(new_order_id, requested_status, null);
    else
      -- Preserve the existing elevated/import behavior.
      update public.orders
      set order_status = requested_status,
          cancellation_reason = nullif(order_payload ->> 'cancellation_reason','')
      where id = new_order_id;

      if not found then
        raise exception 'Order status transition was not applied' using errcode = '42501';
      end if;
    end if;
  end if;

  return new_order_id;
end;
$$;
