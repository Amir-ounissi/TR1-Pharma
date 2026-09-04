alter table public.orders
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists review_note text;

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
  elevated boolean;
  clean_reason text := nullif(btrim(reason), '');
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.orders
  where id = target_order_id
  for update;

  if target.id is null or not private.can_access_brand_pharmacy(target.brand_pharmacy_id) then
    raise exception 'Order unavailable' using errcode = '42501';
  end if;

  elevated := private.has_elevated_brand_access(target.brand_id);

  if not elevated then
    if target.created_by <> actor then
      raise exception 'Order status change forbidden' using errcode = '42501';
    end if;

    if target.order_status = 'draft' and target_status not in ('draft','pending','cancelled') then
      raise exception 'Agent order must be submitted to the brand' using errcode = '42501';
    elsif target.order_status = 'needs_correction' and target_status not in ('needs_correction','pending','cancelled') then
      raise exception 'Corrected order must be resubmitted to the brand' using errcode = '42501';
    elsif target.order_status = 'pending' and target_status not in ('pending','cancelled') then
      raise exception 'Pending order is awaiting brand review' using errcode = '42501';
    elsif target.order_status not in ('draft','needs_correction','pending') and target_status <> target.order_status then
      raise exception 'Only the brand can change a reviewed order' using errcode = '42501';
    end if;
  else
    if target.order_status = 'pending' and target_status not in ('pending','confirmed','needs_correction','rejected','cancelled') then
      raise exception 'Pending order must be reviewed before invoicing' using errcode = '23514';
    end if;
    if target.order_status in ('invoiced','partially_delivered','delivered')
       and target_status not in ('cancelled','refunded',target.order_status) then
      raise exception 'Historical invoiced order status is immutable' using errcode = '42501';
    end if;
  end if;

  if target_status in ('needs_correction','rejected','cancelled') and clean_reason is null then
    raise exception 'A review reason is required' using errcode = '23514';
  end if;

  update public.orders
  set
    order_status = target_status,
    submitted_at = case
      when target_status = 'pending' then now()
      else submitted_at
    end,
    reviewed_at = case
      when target_status in ('confirmed','needs_correction','rejected') then now()
      when target_status = 'pending' then null
      else reviewed_at
    end,
    reviewed_by = case
      when target_status in ('confirmed','needs_correction','rejected') then actor
      when target_status = 'pending' then null
      else reviewed_by
    end,
    review_note = case
      when target_status in ('needs_correction','rejected') then clean_reason
      when target_status in ('confirmed','pending') then null
      else review_note
    end,
    cancellation_reason = case
      when target_status = 'cancelled' then clean_reason
      else cancellation_reason
    end
  where id = target_order_id;
end;
$$;

revoke all on function public.change_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.change_order_status(uuid, public.order_status, text) to authenticated;

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
    select 1
    from public.orders o
    where o.brand_pharmacy_id = new.brand_pharmacy_id
      and o.id <> new.id
      and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  ) into has_valid_order;

  if has_valid_order then
    return new;
  end if;

  update public.brand_pharmacies bp
  set
    commercial_status = case
      when new.order_status in ('pending','needs_correction') then 'pending_order'::public.commercial_status
      when bp.commercial_status = 'implanted' and bp.implanted_at is null then 'qualified'::public.commercial_status
      else bp.commercial_status
    end,
    activity_status = 'never_ordered'::public.activity_status
  where bp.id = new.brand_pharmacy_id;

  return new;
end;
$$;

drop trigger if exists sync_order_review_relation_status on public.orders;
create trigger sync_order_review_relation_status
after insert or update of order_status on public.orders
for each row execute function private.sync_order_review_relation_status();

-- An agent may edit order data only before submission or after a correction request.
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
for update to authenticated
using (
  private.can_access_brand_pharmacy(brand_pharmacy_id)
  and (
    private.has_elevated_brand_access(brand_id)
    or (
      created_by = (select auth.uid())
      and order_status in ('draft','needs_correction')
    )
  )
)
with check (
  private.can_access_brand_pharmacy(brand_pharmacy_id)
  and (
    private.has_elevated_brand_access(brand_id)
    or created_by = (select auth.uid())
  )
);

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
for insert to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
      and (
        private.has_elevated_brand_access(o.brand_id)
        or (o.created_by = (select auth.uid()) and o.order_status in ('draft','needs_correction'))
      )
  )
);

drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items
for update to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
      and (
        private.has_elevated_brand_access(o.brand_id)
        or (o.created_by = (select auth.uid()) and o.order_status in ('draft','needs_correction'))
      )
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
  )
);

drop policy if exists order_items_delete on public.order_items;
create policy order_items_delete on public.order_items
for delete to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
      and (
        private.has_elevated_brand_access(o.brand_id)
        or (o.created_by = (select auth.uid()) and o.order_status in ('draft','needs_correction'))
      )
  )
);

update public.orders
set submitted_at = coalesce(submitted_at, created_at)
where order_status in ('pending','confirmed','invoiced','partially_delivered','delivered')
  and submitted_at is null;;
