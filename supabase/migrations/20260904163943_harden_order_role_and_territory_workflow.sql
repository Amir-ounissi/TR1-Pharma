create or replace function private.current_user_is_brand_agent(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = (select auth.uid())
      and m.brand_id = target_brand_id
      and m.status = 'active'
      and r.key = 'agent'
  );
$$;

create or replace function private.agent_can_cover_pharmacy(
  target_brand_id uuid,
  target_user_id uuid,
  target_pharmacy_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id and r.key = 'agent'
    join public.territories t on t.id = m.territory_id
    join public.pharmacies p on p.id = target_pharmacy_id
    where m.user_id = target_user_id
      and m.brand_id = target_brand_id
      and m.status = 'active'
      and t.brand_id = target_brand_id
      and t.archived_at is null
      and private.department_code_from_postal_code(p.postal_code) = any(
        coalesce(
          t.department_codes,
          case when t.department_code is null then array[]::text[] else array[t.department_code] end
        )
      )
  );
$$;

create or replace function private.validate_agent_created_brand_pharmacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    return new;
  end if;

  if private.current_user_is_brand_agent(new.brand_id)
     and not private.has_brand_role(new.brand_id, array['tr1_manager','brand_admin'])
     and new.current_agent_user_id = actor
     and coalesce(new.source::text, '') = 'agent'
     and not private.agent_can_cover_pharmacy(new.brand_id, actor, new.pharmacy_id)
  then
    raise exception 'Pharmacy is outside the agent territory' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_agent_created_brand_pharmacy on public.brand_pharmacies;
create trigger validate_agent_created_brand_pharmacy
before insert on public.brand_pharmacies
for each row execute function private.validate_agent_created_brand_pharmacy();

create or replace function public.search_pharmacy_directory_for_order(
  target_brand_id uuid,
  search_term text default null,
  candidate_siret text default null,
  candidate_cip text default null,
  candidate_finess text default null,
  candidate_name text default null,
  candidate_postal_code text default null,
  result_limit integer default 12
)
returns table(
  pharmacy_id uuid,
  brand_pharmacy_id uuid,
  relation_status text,
  legal_name text,
  trade_name text,
  siret text,
  cip_code text,
  finess_code text,
  postal_code text,
  city text,
  address_line_1 text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_agent boolean := false;
  normalized_search text := nullif(btrim(search_term), '');
  normalized_siret text := nullif(regexp_replace(upper(coalesce(candidate_siret, '')), '[^A-Z0-9]', '', 'g'), '');
  normalized_cip text := nullif(regexp_replace(upper(coalesce(candidate_cip, '')), '[^A-Z0-9]', '', 'g'), '');
  normalized_finess text := nullif(regexp_replace(upper(coalesce(candidate_finess, '')), '[^A-Z0-9]', '', 'g'), '');
  normalized_name text := nullif(private.normalize_reference_text(candidate_name), '');
  normalized_postal_code text := nullif(regexp_replace(coalesce(candidate_postal_code, ''), '[^0-9]', '', 'g'), '');
begin
  if actor is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Brand access is required' using errcode = '42501';
  end if;

  actor_is_agent := private.current_user_is_brand_agent(target_brand_id)
    and not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']);

  if normalized_search is null
    and normalized_siret is null
    and normalized_cip is null
    and normalized_finess is null
    and (normalized_name is null or normalized_postal_code is null)
  then
    return;
  end if;

  return query
  select
    pharmacy.id,
    relation.id,
    case when relation.id is null then 'global_only' else 'existing_brand_relation' end,
    pharmacy.legal_name,
    pharmacy.trade_name,
    pharmacy.siret,
    pharmacy.cip_code,
    pharmacy.finess_code,
    pharmacy.postal_code,
    pharmacy.city,
    pharmacy.address_line_1
  from public.pharmacies pharmacy
  left join public.brand_pharmacies relation
    on relation.pharmacy_id = pharmacy.id
    and relation.brand_id = target_brand_id
    and relation.archived_at is null
  where pharmacy.archived_at is null
    and pharmacy.is_active
    and (
      not actor_is_agent
      or (relation.id is not null and private.user_is_assigned_to_relation(actor, relation.id))
      or (relation.id is null and private.agent_can_cover_pharmacy(target_brand_id, actor, pharmacy.id))
    )
    and (
      (normalized_search is not null and (
        pharmacy.legal_name ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.trade_name, '') ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.city, '') ilike '%' || normalized_search || '%'
        or regexp_replace(upper(coalesce(pharmacy.siret, '')), '[^A-Z0-9]', '', 'g') like '%' || regexp_replace(upper(normalized_search), '[^A-Z0-9]', '', 'g') || '%'
        or regexp_replace(upper(coalesce(pharmacy.cip_code, '')), '[^A-Z0-9]', '', 'g') like '%' || regexp_replace(upper(normalized_search), '[^A-Z0-9]', '', 'g') || '%'
        or regexp_replace(upper(coalesce(pharmacy.finess_code, '')), '[^A-Z0-9]', '', 'g') like '%' || regexp_replace(upper(normalized_search), '[^A-Z0-9]', '', 'g') || '%'
      ))
      or (normalized_siret is not null and regexp_replace(upper(coalesce(pharmacy.siret, '')), '[^A-Z0-9]', '', 'g') = normalized_siret)
      or (normalized_cip is not null and regexp_replace(upper(coalesce(pharmacy.cip_code, '')), '[^A-Z0-9]', '', 'g') = normalized_cip)
      or (normalized_finess is not null and regexp_replace(upper(coalesce(pharmacy.finess_code, '')), '[^A-Z0-9]', '', 'g') = normalized_finess)
      or (
        normalized_name is not null
        and normalized_postal_code is not null
        and regexp_replace(coalesce(pharmacy.postal_code, ''), '[^0-9]', '', 'g') = normalized_postal_code
      )
    )
  order by
    case
      when normalized_siret is not null and regexp_replace(upper(coalesce(pharmacy.siret, '')), '[^A-Z0-9]', '', 'g') = normalized_siret then 0
      when normalized_cip is not null and regexp_replace(upper(coalesce(pharmacy.cip_code, '')), '[^A-Z0-9]', '', 'g') = normalized_cip then 1
      when normalized_finess is not null and regexp_replace(upper(coalesce(pharmacy.finess_code, '')), '[^A-Z0-9]', '', 'g') = normalized_finess then 2
      when normalized_name is not null and normalized_postal_code is not null and (
        private.normalize_reference_text(pharmacy.legal_name) = normalized_name
        or private.normalize_reference_text(coalesce(pharmacy.trade_name, '')) = normalized_name
      ) then 3
      else 4
    end,
    (relation.id is not null) desc,
    pharmacy.legal_name,
    pharmacy.id
  limit greatest(1, least(coalesce(result_limit, 12), 25));
end;
$$;

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
  select bp.*, b.organization_id
  into relation_record
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
$$;

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
for insert
with check (
  created_by = (select auth.uid())
  and private.can_access_brand_pharmacy(brand_pharmacy_id)
  and (
    private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])
    or (
      private.current_user_is_brand_agent(brand_id)
      and private.user_is_assigned_to_relation((select auth.uid()), brand_pharmacy_id)
    )
  )
);

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
for update
using (
  private.can_access_brand_pharmacy(brand_pharmacy_id)
  and private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])
)
with check (
  private.can_access_brand_pharmacy(brand_pharmacy_id)
  and private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])
);

create or replace function public.change_order_status(
  target_order_id uuid,
  target_status public.order_status,
  reason text default null
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
  actor_is_agent boolean;
  allowed boolean := false;
  clean_reason text := nullif(btrim(reason), '');
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target from public.orders where id = target_order_id for update;

  if target.id is null or not private.can_access_brand_pharmacy(target.brand_pharmacy_id) then
    raise exception 'Order unavailable' using errcode = '42501';
  end if;

  brand_operator := private.has_brand_role(target.brand_id, array['tr1_manager','brand_admin']);
  actor_is_agent := private.current_user_is_brand_agent(target.brand_id) and target.created_by = actor;

  if brand_operator then
    allowed := case target.order_status
      when 'draft' then target_status in ('draft','pending','confirmed','cancelled')
      when 'pending' then target_status in ('pending','confirmed','needs_correction','rejected','cancelled')
      when 'needs_correction' then target_status in ('needs_correction','pending','cancelled')
      when 'confirmed' then target_status in ('confirmed','invoiced','cancelled')
      when 'invoiced' then target_status in ('invoiced','partially_delivered','delivered','refunded')
      when 'partially_delivered' then target_status in ('partially_delivered','delivered','refunded')
      when 'delivered' then target_status in ('delivered','refunded')
      when 'rejected' then target_status = 'rejected'
      when 'cancelled' then target_status = 'cancelled'
      when 'refunded' then target_status = 'refunded'
      else false
    end;
  elsif actor_is_agent then
    allowed := case target.order_status
      when 'draft' then target_status in ('draft','pending','cancelled')
      when 'needs_correction' then target_status in ('needs_correction','pending','cancelled')
      when 'pending' then target_status in ('pending','cancelled')
      else target_status = target.order_status
    end;
  end if;

  if not allowed then
    raise exception 'Invalid order status transition' using errcode = '42501';
  end if;

  if target_status in ('needs_correction','rejected','cancelled') and clean_reason is null then
    raise exception 'A review reason is required' using errcode = '23514';
  end if;

  update public.orders
  set order_status = target_status,
      submitted_at = case when target_status = 'pending' then coalesce(submitted_at, now()) else submitted_at end,
      reviewed_at = case when target_status in ('confirmed','needs_correction','rejected') then now() when target_status = 'pending' then null else reviewed_at end,
      reviewed_by = case when target_status in ('confirmed','needs_correction','rejected') then actor when target_status = 'pending' then null else reviewed_by end,
      review_note = case when target_status in ('needs_correction','rejected') then clean_reason when target_status in ('confirmed','pending') then null else review_note end,
      cancellation_reason = case when target_status = 'cancelled' then clean_reason else cancellation_reason end,
      cancelled_at = case when target_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end,
      invoiced_at = case when target_status = 'invoiced' then coalesce(invoiced_at, now()) else invoiced_at end,
      delivered_at = case when target_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = target_order_id;
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
begin
  if new.order_status not in ('draft','pending','needs_correction','rejected','cancelled') then
    return new;
  end if;

  select exists (
    select 1 from public.orders o
    where o.brand_pharmacy_id = new.brand_pharmacy_id
      and o.id <> new.id
      and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  ) into has_valid_order;

  if has_valid_order then return new; end if;

  update public.brand_pharmacies bp
  set commercial_status = case
        when new.order_status in ('pending','needs_correction') then 'pending_order'::public.commercial_status
        when new.order_status in ('draft','rejected','cancelled') and bp.commercial_status = 'pending_order' then 'qualified'::public.commercial_status
        when bp.commercial_status = 'implanted' and bp.implanted_at is null then 'qualified'::public.commercial_status
        else bp.commercial_status
      end,
      activity_status = 'never_ordered'::public.activity_status
  where bp.id = new.brand_pharmacy_id;

  return new;
end;
$$;;
