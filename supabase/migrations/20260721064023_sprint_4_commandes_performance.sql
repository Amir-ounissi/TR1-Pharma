-- Sprint 4: orders, implantation, reorder performance, activity and distribution.

begin;

alter type public.order_status rename value 'submitted' to 'pending';
alter type public.order_status add value if not exists 'invoiced' after 'confirmed';
alter type public.order_status add value if not exists 'partially_delivered' after 'invoiced';
alter type public.order_status add value if not exists 'delivered' after 'partially_delivered';
alter type public.order_status add value if not exists 'refunded' after 'cancelled';
alter type public.import_entity_type add value if not exists 'orders';

create type public.order_type as enum (
  'initial', 'reorder', 'complementary', 'replacement', 'sample',
  'return', 'credit_note', 'other'
);
create type public.order_payment_status as enum (
  'not_applicable', 'pending', 'partially_paid', 'paid', 'overdue', 'refunded'
);
create type public.order_source as enum ('manual', 'agent', 'brand', 'import', 'api', 'erp', 'system');
create type public.activity_history_source as enum ('order', 'scheduled_recalculation', 'manual', 'import', 'system');
create type public.distribution_snapshot_source as enum ('order', 'manual', 'scheduled_recalculation', 'system');
create type public.strategic_priority as enum ('standard', 'priority', 'strategic');

commit;
begin;

drop policy if exists orders_select on public.orders;
drop policy if exists orders_insert on public.orders;
drop policy if exists orders_update on public.orders;
drop policy if exists order_items_select on public.order_items;
drop policy if exists order_items_insert on public.order_items;
drop policy if exists order_items_update on public.order_items;
drop policy if exists order_items_delete on public.order_items;

alter table public.orders rename column created_by_user_id to created_by;
alter table public.orders rename column status to order_status;
alter table public.orders rename column ordered_at to order_date;
alter table public.orders rename column total_amount to total_ttc;
alter table public.orders drop constraint if exists orders_total_amount_check;
alter table public.orders
  add column external_order_id text,
  add column order_number text,
  add column order_type public.order_type not null default 'other',
  add column invoiced_at timestamptz,
  add column delivered_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancellation_reason text,
  add column source public.order_source not null default 'manual',
  add column source_user_id uuid references public.users(id) on delete set null,
  add column source_agent_user_id uuid references public.users(id) on delete set null,
  add column subtotal_ht numeric(14,2) not null default 0,
  add column discount_amount_ht numeric(14,2) not null default 0,
  add column net_amount_ht numeric(14,2) not null default 0,
  add column shipping_amount_ht numeric(14,2) not null default 0,
  add column tax_amount numeric(14,2) not null default 0,
  add column currency_code text not null default 'EUR',
  add column payment_status public.order_payment_status not null default 'pending',
  add column payment_due_at timestamptz,
  add column paid_at timestamptz,
  add column notes text,
  add column imported_at timestamptz,
  add column import_batch_id uuid references public.import_batches(id) on delete set null,
  add column archived_at timestamptz,
  add column is_initial_order boolean not null default false,
  add column is_reorder boolean not null default false;

update public.orders set order_date = coalesce(order_date, created_at), source_user_id = coalesce(source_user_id, created_by);
alter table public.orders alter column order_date set not null;
alter table public.orders alter column order_date set default now();
alter table public.orders
  add constraint orders_currency_code_check check (currency_code ~ '^[A-Z]{3}$'),
  add constraint orders_shipping_nonnegative_check check (shipping_amount_ht >= 0),
  add constraint orders_regular_amounts_check check (
    (order_type in ('return','credit_note') and net_amount_ht <= 0 and total_ttc <= 0)
    or (order_type not in ('return','credit_note') and subtotal_ht >= 0 and discount_amount_ht >= 0 and net_amount_ht >= 0 and tax_amount >= 0 and total_ttc >= 0)
  ),
  add constraint orders_cancellation_reason_check check (order_status <> 'cancelled' or nullif(btrim(cancellation_reason), '') is not null),
  add constraint orders_initial_reorder_flags_check check (not (is_initial_order and is_reorder)),
  add constraint orders_id_brand_unique unique (id, brand_id);

alter table public.order_items rename column unit_price to unit_price_ht;
alter table public.order_items drop constraint if exists order_items_unit_price_check;
alter table public.order_items
  add column product_id uuid references public.products(id) on delete restrict,
  add column sku_snapshot text,
  add column product_name_snapshot text,
  add column free_quantity integer not null default 0,
  add column discount_rate numeric(5,2),
  add column discount_amount_ht numeric(14,2) not null default 0,
  add column net_unit_price_ht numeric(14,4) not null default 0,
  add column line_total_ht numeric(14,2) not null default 0,
  add column tax_rate numeric(5,2) not null default 20,
  add column updated_at timestamptz not null default now();

update public.order_items oi set
  product_id = pr.product_id,
  sku_snapshot = pr.sku,
  product_name_snapshot = pr.label,
  net_unit_price_ht = oi.unit_price_ht,
  line_total_ht = round(oi.quantity * oi.unit_price_ht, 2)
from public.product_references pr where pr.id = oi.product_reference_id;
alter table public.order_items alter column product_id set not null;
alter table public.order_items alter column sku_snapshot set not null;
alter table public.order_items alter column product_name_snapshot set not null;
alter table public.order_items alter column product_reference_id drop not null;
alter table public.order_items
  add constraint order_items_product_brand_fk foreign key (product_id, brand_id) references public.products(id, brand_id),
  add constraint order_items_order_brand_fk foreign key (order_id, brand_id) references public.orders(id, brand_id) on delete cascade,
  add constraint order_items_free_quantity_check check (free_quantity >= 0),
  add constraint order_items_discount_rate_check check (discount_rate is null or discount_rate between 0 and 100),
  add constraint order_items_tax_rate_check check (tax_rate between 0 and 100),
  add constraint order_items_price_sign_check check (
    (unit_price_ht >= 0 and discount_amount_ht >= 0 and net_unit_price_ht >= 0 and line_total_ht >= 0)
    or (unit_price_ht <= 0 and discount_amount_ht <= 0 and net_unit_price_ht <= 0 and line_total_ht <= 0)
  );

alter table public.brand_settings
  add column active_max_days integer not null default 59 check (active_max_days >= 0),
  add column watch_start_days integer not null default 60 check (watch_start_days >= 1),
  add column at_risk_start_days integer not null default 75 check (at_risk_start_days >= 1),
  add column dormant_start_days integer not null default 90 check (dormant_start_days >= 1),
  add column post_implantation_follow_up_days integer not null default 15 check (post_implantation_follow_up_days between 1 and 365),
  add column expected_first_reorder_days integer not null default 45 check (expected_first_reorder_days between 1 and 365),
  add column dormant_reactivation_follow_up_days integer not null default 7 check (dormant_reactivation_follow_up_days between 1 and 365),
  add column automatic_activity_status_enabled boolean not null default true,
  add constraint brand_settings_activity_thresholds_check check (
    active_max_days < watch_start_days and watch_start_days < at_risk_start_days and at_risk_start_days < dormant_start_days
  );

insert into public.brand_settings (brand_id) select id from public.brands on conflict (brand_id) do nothing;

create or replace function private.ensure_brand_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.brand_settings (brand_id) values (new.id) on conflict (brand_id) do nothing;
  return new;
end;
$$;
create trigger ensure_brand_settings after insert on public.brands for each row execute function private.ensure_brand_settings();

alter table public.brand_pharmacies
  add column first_valid_order_at timestamptz,
  add column last_valid_order_at timestamptz,
  add column first_reorder_at timestamptz,
  add column activity_status_changed_at timestamptz;

alter table public.brand_pharmacy_products
  add column first_ordered_at timestamptz,
  add column last_ordered_at timestamptz,
  add column last_order_quantity integer,
  add column total_ordered_quantity integer not null default 0,
  add column valid_order_count integer not null default 0,
  add column manually_confirmed_present boolean not null default false,
  add column manually_confirmed_at timestamptz,
  add column manually_confirmed_by uuid references public.users(id) on delete set null,
  add constraint brand_pharmacy_products_order_metrics_check check (
    total_ordered_quantity >= 0 and valid_order_count >= 0 and (last_order_quantity is null or last_order_quantity >= 0)
  );

alter table public.products
  add column is_pharmacy_eligible boolean not null default true,
  add column counts_for_distribution boolean not null default true,
  add column strategic_priority public.strategic_priority not null default 'standard',
  add column product_family text;

create table public.brand_pharmacy_activity_history (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null,
  previous_activity_status public.activity_status not null,
  new_activity_status public.activity_status not null,
  reason text not null,
  triggering_order_id uuid references public.orders(id) on delete set null,
  calculated_at timestamptz not null default now(),
  changed_by uuid references public.users(id) on delete set null,
  source public.activity_history_source not null,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete cascade
);

create table public.brand_pharmacy_distribution_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null,
  snapshot_date date not null default current_date,
  eligible_product_count integer not null,
  implanted_product_count integer not null,
  strategic_eligible_count integer not null,
  strategic_implanted_count integer not null,
  distribution_rate numeric(6,2) not null,
  strategic_distribution_rate numeric(6,2) not null,
  source public.distribution_snapshot_source not null,
  created_at timestamptz not null default now(),
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete cascade,
  unique (brand_pharmacy_id, snapshot_date)
);

create unique index orders_external_id_unique on public.orders(brand_id, external_order_id)
  where external_order_id is not null and archived_at is null;
create index orders_brand_date_idx on public.orders(brand_id, order_date desc) where archived_at is null;
create index orders_relation_date_idx on public.orders(brand_pharmacy_id, order_date desc) where archived_at is null;
create index orders_pharmacy_idx on public.orders(pharmacy_id, brand_id);
create index orders_status_idx on public.orders(brand_id, order_status, order_date desc) where archived_at is null;
create index orders_invoiced_idx on public.orders(brand_id, invoiced_at desc) where invoiced_at is not null and archived_at is null;
create index orders_source_agent_idx on public.orders(source_agent_user_id, order_date desc) where archived_at is null;
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id, brand_id);
create index brand_pharmacies_activity_idx on public.brand_pharmacies(brand_id, activity_status, last_valid_order_at) where archived_at is null;
create index activity_history_relation_idx on public.brand_pharmacy_activity_history(brand_pharmacy_id, calculated_at desc);
create index distribution_snapshots_relation_idx on public.brand_pharmacy_distribution_snapshots(brand_pharmacy_id, snapshot_date desc);
create index brand_pharmacy_products_distribution_idx on public.brand_pharmacy_products(brand_pharmacy_id, status, product_id) where removed_at is null;

create or replace function private.order_counts_for_activity(
  target_status public.order_status,
  target_type public.order_type,
  target_net_amount numeric
)
returns boolean language sql immutable set search_path = '' as $$
  select target_status in ('invoiced','partially_delivered','delivered')
    and target_type not in ('return','credit_note')
    and not (target_type = 'sample' and target_net_amount = 0);
$$;

create or replace function private.order_counts_for_revenue(
  target_status public.order_status,
  target_type public.order_type,
  target_net_amount numeric
)
returns boolean language sql immutable set search_path = '' as $$
  select target_status in ('invoiced','partially_delivered','delivered')
    and not (target_type = 'sample' and target_net_amount = 0);
$$;

create or replace function private.validate_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  relation_record record;
  financial_change boolean := false;
begin
  select bp.brand_id, bp.pharmacy_id, b.organization_id into relation_record
  from public.brand_pharmacies bp join public.brands b on b.id = bp.brand_id
  where bp.id = new.brand_pharmacy_id and bp.archived_at is null;
  if relation_record.brand_id is null or relation_record.brand_id <> new.brand_id
    or relation_record.pharmacy_id <> new.pharmacy_id or relation_record.organization_id <> new.organization_id then
    raise exception 'Order brand pharmacy scope mismatch' using errcode = '23514';
  end if;
  if new.source_user_id is not null and not private.user_has_active_brand_membership(new.source_user_id, new.brand_id) then
    raise exception 'Order source user has no active brand membership' using errcode = '23514';
  end if;
  if new.source_agent_user_id is not null and not private.user_is_assigned_to_relation(new.source_agent_user_id, new.brand_pharmacy_id) then
    raise exception 'Order source agent is not assigned to this pharmacy' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.subtotal_ht := 0;
    new.discount_amount_ht := 0;
    new.net_amount_ht := 0;
    new.tax_amount := 0;
    new.total_ttc := round(new.shipping_amount_ht, 2);
  else
    financial_change := (new.subtotal_ht, new.discount_amount_ht, new.net_amount_ht, new.tax_amount, new.total_ttc)
      is distinct from (old.subtotal_ht, old.discount_amount_ht, old.net_amount_ht, old.tax_amount, old.total_ttc);
    if financial_change and coalesce(current_setting('app.recalculating_order', true), 'false') <> 'true' then
      raise exception 'Order totals are server controlled' using errcode = '42501';
    end if;
    if old.order_status in ('invoiced','partially_delivered','delivered') and (
      new.brand_id is distinct from old.brand_id or new.brand_pharmacy_id is distinct from old.brand_pharmacy_id
      or new.pharmacy_id is distinct from old.pharmacy_id or new.order_date is distinct from old.order_date
      or new.order_type is distinct from old.order_type or new.shipping_amount_ht is distinct from old.shipping_amount_ht
      or new.currency_code is distinct from old.currency_code
    ) and coalesce(current_setting('app.order_admin_correction', true), 'false') <> 'true' then
      raise exception 'Invoiced order financial identity is immutable' using errcode = '42501';
    end if;
  end if;
  if new.order_type = 'initial' and exists (
    select 1 from public.orders existing
    where existing.brand_pharmacy_id = new.brand_pharmacy_id and existing.id <> new.id
      and existing.order_date < new.order_date and existing.archived_at is null
      and private.order_counts_for_activity(existing.order_status, existing.order_type, existing.net_amount_ht)
  ) then
    raise exception 'An initial order already exists for this brand pharmacy' using errcode = '23514';
  end if;
  if new.order_status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;
  if new.order_status = 'invoiced' then new.invoiced_at := coalesce(new.invoiced_at, now()); end if;
  if new.order_status in ('partially_delivered','delivered') then
    new.invoiced_at := coalesce(new.invoiced_at, now());
    if new.order_status = 'delivered' then new.delivered_at := coalesce(new.delivered_at, now()); end if;
  end if;
  if new.payment_status = 'paid' then new.paid_at := coalesce(new.paid_at, now()); end if;
  return new;
end;
$$;

create or replace function private.validate_order_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent_order public.orders%rowtype;
  target_product public.products%rowtype;
  base_amount numeric;
begin
  select * into parent_order from public.orders where id = coalesce(new.order_id, old.order_id);
  if parent_order.id is null then raise exception 'Order unavailable' using errcode = '23503'; end if;
  if tg_op in ('UPDATE','DELETE') and parent_order.order_status in ('invoiced','partially_delivered','delivered')
    and coalesce(current_setting('app.order_admin_correction', true), 'false') <> 'true' then
    raise exception 'Items of an invoiced order are immutable' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if parent_order.order_status not in ('draft','pending') and coalesce(current_setting('app.order_admin_correction', true), 'false') <> 'true' then
    raise exception 'Items can only be edited on draft or pending orders' using errcode = '42501';
  end if;
  select * into target_product from public.products where id = new.product_id and brand_id = parent_order.brand_id;
  if target_product.id is null then raise exception 'Order item product brand mismatch' using errcode = '23514'; end if;
  new.brand_id := parent_order.brand_id;
  new.organization_id := parent_order.organization_id;
  if tg_op = 'INSERT' then
    new.sku_snapshot := target_product.sku;
    new.product_name_snapshot := target_product.name;
  else
    new.sku_snapshot := old.sku_snapshot;
    new.product_name_snapshot := old.product_name_snapshot;
  end if;
  if parent_order.order_type in ('return','credit_note') and new.unit_price_ht > 0 then new.unit_price_ht := -new.unit_price_ht; end if;
  if parent_order.order_type not in ('return','credit_note') and new.unit_price_ht < 0 then
    raise exception 'Negative prices are reserved for returns and credit notes' using errcode = '23514';
  end if;
  base_amount := round(new.quantity * new.unit_price_ht, 2);
  new.discount_amount_ht := case
    when new.discount_rate is not null then round(base_amount * new.discount_rate / 100, 2)
    else coalesce(new.discount_amount_ht, 0)
  end;
  if abs(new.discount_amount_ht) > abs(base_amount) then raise exception 'Discount exceeds line amount' using errcode = '23514'; end if;
  new.line_total_ht := round(base_amount - new.discount_amount_ht, 2);
  new.net_unit_price_ht := round(new.line_total_ht / new.quantity, 4);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.recalculate_order_totals(target_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  totals record;
begin
  select
    coalesce(round(sum(quantity * unit_price_ht), 2), 0) as subtotal,
    coalesce(round(sum(discount_amount_ht), 2), 0) as discount,
    coalesce(round(sum(line_total_ht), 2), 0) as net,
    coalesce(round(sum(line_total_ht * tax_rate / 100), 2), 0) as tax
  into totals from public.order_items where order_id = target_order_id;
  perform set_config('app.recalculating_order', 'true', true);
  update public.orders set
    subtotal_ht = totals.subtotal,
    discount_amount_ht = totals.discount,
    net_amount_ht = totals.net,
    tax_amount = totals.tax,
    total_ttc = round(totals.net + shipping_amount_ht + totals.tax, 2)
  where id = target_order_id;
  perform set_config('app.recalculating_order', 'false', true);
end;
$$;

create or replace function private.recalculate_order_totals_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.recalculate_order_totals(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end;
$$;

create or replace function private.recalculate_shipping_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.shipping_amount_ht is distinct from old.shipping_amount_ht then perform private.recalculate_order_totals(new.id); end if;
  return new;
end;
$$;

create or replace function private.upsert_order_products(target_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare line_record record; existing_id uuid;
begin
  for line_record in
    select o.brand_pharmacy_id, o.order_date, oi.product_id, sum(oi.quantity + oi.free_quantity)::integer as ordered_quantity
    from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.id = target_order_id group by o.brand_pharmacy_id, o.order_date, oi.product_id
  loop
    select bpp.id into existing_id from public.brand_pharmacy_products bpp
    where bpp.brand_pharmacy_id = line_record.brand_pharmacy_id and bpp.product_id = line_record.product_id
      and bpp.status <> 'removed' and bpp.removed_at is null order by bpp.created_at desc limit 1;
    if existing_id is null then
      insert into public.brand_pharmacy_products (
        brand_pharmacy_id, product_id, status, first_implanted_at, first_ordered_at,
        last_ordered_at, last_order_quantity, total_ordered_quantity, valid_order_count, source
      ) values (
        line_record.brand_pharmacy_id, line_record.product_id, 'implanted', line_record.order_date, line_record.order_date,
        line_record.order_date, line_record.ordered_quantity, line_record.ordered_quantity, 1, 'other'
      );
    else
      update public.brand_pharmacy_products set
        status = case when status = 'planned' then 'implanted'::public.implantation_status else status end,
        first_implanted_at = coalesce(first_implanted_at, line_record.order_date),
        first_ordered_at = least(coalesce(first_ordered_at, line_record.order_date), line_record.order_date),
        last_ordered_at = greatest(coalesce(last_ordered_at, line_record.order_date), line_record.order_date),
        last_order_quantity = line_record.ordered_quantity,
        total_ordered_quantity = total_ordered_quantity + line_record.ordered_quantity,
        valid_order_count = valid_order_count + 1,
        updated_at = now()
      where id = existing_id;
    end if;
  end loop;
end;
$$;

create or replace function private.capture_distribution_snapshot(
  target_brand_pharmacy_id uuid,
  target_source public.distribution_snapshot_source
)
returns void language plpgsql security definer set search_path = '' as $$
declare metrics record;
begin
  select bp.brand_id,
    count(distinct p.id) filter (where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution)::integer as eligible,
    count(distinct p.id) filter (where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution and bpp.status in ('implanted','active','temporarily_unavailable') and bpp.removed_at is null)::integer as implanted,
    count(distinct p.id) filter (where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution and p.strategic_priority = 'strategic')::integer as strategic_eligible,
    count(distinct p.id) filter (where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution and p.strategic_priority = 'strategic' and bpp.status in ('implanted','active','temporarily_unavailable') and bpp.removed_at is null)::integer as strategic_implanted
  into metrics
  from public.brand_pharmacies bp
  join public.products p on p.brand_id = bp.brand_id
  left join public.brand_pharmacy_products bpp on bpp.brand_pharmacy_id = bp.id and bpp.product_id = p.id
  where bp.id = target_brand_pharmacy_id group by bp.brand_id;
  if metrics.brand_id is null then return; end if;
  insert into public.brand_pharmacy_distribution_snapshots (
    brand_id, brand_pharmacy_id, snapshot_date, eligible_product_count, implanted_product_count,
    strategic_eligible_count, strategic_implanted_count, distribution_rate, strategic_distribution_rate, source
  ) values (
    metrics.brand_id, target_brand_pharmacy_id, current_date, metrics.eligible, metrics.implanted,
    metrics.strategic_eligible, metrics.strategic_implanted,
    case when metrics.eligible = 0 then 0 else round(metrics.implanted * 100.0 / metrics.eligible, 2) end,
    case when metrics.strategic_eligible = 0 then 0 else round(metrics.strategic_implanted * 100.0 / metrics.strategic_eligible, 2) end,
    target_source
  ) on conflict (brand_pharmacy_id, snapshot_date) do update set
    eligible_product_count = excluded.eligible_product_count,
    implanted_product_count = excluded.implanted_product_count,
    strategic_eligible_count = excluded.strategic_eligible_count,
    strategic_implanted_count = excluded.strategic_implanted_count,
    distribution_rate = excluded.distribution_rate,
    strategic_distribution_rate = excluded.strategic_distribution_rate,
    source = excluded.source,
    created_at = now();
end;
$$;

create or replace view public.brand_pharmacy_distribution
with (security_invoker = true) as
with eligible as (
  select p.brand_id,
    count(*) filter (where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution) as eligible_product_count,
    count(*) filter (where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution and p.strategic_priority = 'strategic') as strategic_eligible_count
  from public.products p group by p.brand_id
), implanted as (
  select bpp.brand_pharmacy_id,
    count(*) filter (where bpp.status in ('implanted','active','temporarily_unavailable') and bpp.removed_at is null) as implanted_product_count,
    count(*) filter (where bpp.status in ('implanted','active','temporarily_unavailable') and bpp.removed_at is null and p.strategic_priority = 'strategic') as strategic_implanted_count
  from public.brand_pharmacy_products bpp join public.products p on p.id = bpp.product_id
  group by bpp.brand_pharmacy_id
)
select bp.id as brand_pharmacy_id, bp.brand_id,
  coalesce(e.eligible_product_count, 0)::integer as eligible_product_count,
  coalesce(i.implanted_product_count, 0)::integer as implanted_product_count,
  coalesce(e.strategic_eligible_count, 0)::integer as strategic_eligible_count,
  coalesce(i.strategic_implanted_count, 0)::integer as strategic_implanted_count,
  case when coalesce(e.eligible_product_count, 0) = 0 then 0 else round(coalesce(i.implanted_product_count, 0) * 100.0 / e.eligible_product_count, 2) end as distribution_rate,
  case when coalesce(e.strategic_eligible_count, 0) = 0 then 0 else round(coalesce(i.strategic_implanted_count, 0) * 100.0 / e.strategic_eligible_count, 2) end as strategic_distribution_rate,
  coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'sku', p.sku) order by p.name)
    from public.products p left join public.brand_pharmacy_products missing on missing.brand_pharmacy_id = bp.id and missing.product_id = p.id
    where p.brand_id = bp.brand_id and p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
      and not (coalesce(missing.status, 'planned') in ('implanted','active','temporarily_unavailable') and missing.removed_at is null)), '[]'::jsonb) as missing_products
from public.brand_pharmacies bp
left join eligible e on e.brand_id = bp.brand_id
left join implanted i on i.brand_pharmacy_id = bp.id;

create or replace view public.brand_pharmacy_order_performance
with (security_invoker = true) as
with sequenced as (
  select o.*,
    row_number() over (partition by o.brand_pharmacy_id order by o.order_date, o.created_at, o.id) as order_sequence,
    lag(o.order_date) over (partition by o.brand_pharmacy_id order by o.order_date, o.created_at, o.id) as previous_order_at
  from public.orders o
  where o.archived_at is null and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
), activity_aggregates as (
  select brand_pharmacy_id,
    min(order_date) as first_valid_order_at,
    max(order_date) as last_valid_order_at,
    min(order_date) filter (where order_sequence > 1) as first_reorder_at,
    count(*)::integer as valid_order_count,
    count(*) filter (where order_sequence > 1)::integer as reorder_count,
    coalesce(sum(net_amount_ht) filter (where order_sequence = 1), 0) as initial_order_net_ht,
    coalesce(sum(net_amount_ht) filter (where order_sequence > 1), 0) as reorder_revenue_net_ht,
    round(avg(net_amount_ht), 2) as average_order_value_ht,
    round(avg(net_amount_ht) filter (where order_sequence > 1), 2) as average_reorder_value_ht,
    round(avg(extract(epoch from (order_date - previous_order_at)) / 86400) filter (where previous_order_at is not null), 1) as average_days_between_orders
  from sequenced group by brand_pharmacy_id
), revenue_aggregates as (
  select brand_pharmacy_id,
    coalesce(sum(net_amount_ht), 0) as total_revenue_net_ht,
    coalesce(sum(net_amount_ht) filter (where order_date >= now() - interval '12 months'), 0) as last_12_month_revenue_ht,
    coalesce(sum(net_amount_ht) filter (where order_date >= now() - interval '90 days'), 0) as last_90_day_revenue_ht
  from public.orders
  where archived_at is null and private.order_counts_for_revenue(order_status, order_type, net_amount_ht)
  group by brand_pharmacy_id
), product_aggregates as (
  select brand_pharmacy_id, count(distinct product_id)::integer as lifetime_product_count
  from public.brand_pharmacy_products where first_ordered_at is not null group by brand_pharmacy_id
)
select bp.id as brand_pharmacy_id, bp.brand_id,
  aa.first_valid_order_at, aa.last_valid_order_at, aa.first_reorder_at,
  coalesce(aa.valid_order_count, 0) as valid_order_count,
  coalesce(aa.reorder_count, 0) as reorder_count,
  coalesce(aa.initial_order_net_ht, 0) as initial_order_net_ht,
  coalesce(aa.reorder_revenue_net_ht, 0) as reorder_revenue_net_ht,
  coalesce(ra.total_revenue_net_ht, 0) as total_revenue_net_ht,
  coalesce(aa.average_order_value_ht, 0) as average_order_value_ht,
  coalesce(aa.average_reorder_value_ht, 0) as average_reorder_value_ht,
  aa.average_days_between_orders,
  case when aa.last_valid_order_at is null then null else current_date - aa.last_valid_order_at::date end as days_since_last_order,
  case
    when bp.activity_status = 'lost' then 'lost'::public.activity_status
    when aa.last_valid_order_at is null then 'never_ordered'::public.activity_status
    when current_date - aa.last_valid_order_at::date >= settings.dormant_start_days then 'dormant'::public.activity_status
    when current_date - aa.last_valid_order_at::date >= settings.at_risk_start_days then 'at_risk'::public.activity_status
    when current_date - aa.last_valid_order_at::date >= settings.watch_start_days then 'watch'::public.activity_status
    else 'active'::public.activity_status
  end as current_activity_status,
  case
    when aa.last_valid_order_at is null then null
    when aa.valid_order_count >= 2 and aa.average_days_between_orders is not null then aa.last_valid_order_at + make_interval(days => greatest(1, round(aa.average_days_between_orders)::integer))
    else aa.first_valid_order_at + make_interval(days => settings.expected_first_reorder_days)
  end as expected_next_order_at,
  case
    when aa.last_valid_order_at is null then 'unknown'
    when (case when aa.valid_order_count >= 2 and aa.average_days_between_orders is not null then aa.last_valid_order_at + make_interval(days => greatest(1, round(aa.average_days_between_orders)::integer)) else aa.first_valid_order_at + make_interval(days => settings.expected_first_reorder_days) end)::date < current_date then 'overdue'
    when (case when aa.valid_order_count >= 2 and aa.average_days_between_orders is not null then aa.last_valid_order_at + make_interval(days => greatest(1, round(aa.average_days_between_orders)::integer)) else aa.first_valid_order_at + make_interval(days => settings.expected_first_reorder_days) end)::date <= current_date + 7 then 'due'
    else 'upcoming'
  end as reorder_forecast_status,
  coalesce(pa.lifetime_product_count, 0) as lifetime_product_count,
  coalesce(ra.last_12_month_revenue_ht, 0) as last_12_month_revenue_ht,
  coalesce(ra.last_90_day_revenue_ht, 0) as last_90_day_revenue_ht
from public.brand_pharmacies bp
join public.brand_settings settings on settings.brand_id = bp.brand_id
left join activity_aggregates aa on aa.brand_pharmacy_id = bp.id
left join revenue_aggregates ra on ra.brand_pharmacy_id = bp.id
left join product_aggregates pa on pa.brand_pharmacy_id = bp.id;

create or replace view public.order_performance_dashboard
with (security_invoker = true) as
select bp.id as brand_pharmacy_id, bp.brand_id, bp.pharmacy_id, p.legal_name, p.trade_name, p.city,
  bp.current_agent_user_id, bp.commercial_status, bp.activity_status,
  perf.first_valid_order_at, perf.last_valid_order_at, perf.first_reorder_at,
  perf.valid_order_count, perf.reorder_count, perf.total_revenue_net_ht,
  perf.last_12_month_revenue_ht, perf.last_90_day_revenue_ht,
  perf.average_order_value_ht, perf.average_reorder_value_ht, perf.average_days_between_orders,
  perf.days_since_last_order, perf.current_activity_status, perf.expected_next_order_at, perf.reorder_forecast_status,
  dist.implanted_product_count, dist.eligible_product_count, dist.distribution_rate, dist.strategic_distribution_rate,
  (perf.valid_order_count = 1) as implanted_without_reorder
from public.brand_pharmacies bp
join public.pharmacies p on p.id = bp.pharmacy_id
join public.brand_pharmacy_order_performance perf on perf.brand_pharmacy_id = bp.id
join public.brand_pharmacy_distribution dist on dist.brand_pharmacy_id = bp.id
where bp.archived_at is null;

create or replace view public.order_anomalies
with (security_invoker = true) as
select o.id as order_id, o.brand_id, o.brand_pharmacy_id, 'initial_order_invalidated'::text as anomaly_type,
  'La commande ayant déclenché l’implantation a ensuite été annulée ou remboursée.'::text as description,
  o.updated_at as detected_at
from public.orders o
where o.is_initial_order and o.order_status in ('cancelled','refunded') and o.archived_at is null;

create or replace function private.ensure_activity_follow_up(
  target_brand_pharmacy_id uuid,
  target_status public.activity_status,
  target_actor uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare settings public.brand_settings%rowtype; relation_record public.brand_pharmacies%rowtype;
  target_type public.commercial_task_type; target_priority public.task_priority; target_title text; target_due_at timestamptz;
begin
  select * into relation_record from public.brand_pharmacies where id = target_brand_pharmacy_id;
  select * into settings from public.brand_settings where brand_id = relation_record.brand_id;
  target_type := (case target_status when 'watch' then 'check_stock' when 'at_risk' then 'follow_up' when 'dormant' then 'follow_up' else null end)::public.commercial_task_type;
  if target_type is null then return; end if;
  target_priority := (case target_status when 'watch' then 'normal' when 'at_risk' then 'high' else 'urgent' end)::public.task_priority;
  target_title := 'Activité ' || target_status::text || ' — action de suivi';
  target_due_at := now() + case when target_status = 'dormant' then make_interval(days => settings.dormant_reactivation_follow_up_days) else interval '1 day' end;
  if not exists (
    select 1 from public.tasks where brand_pharmacy_id = target_brand_pharmacy_id and title = target_title
      and status in ('open','in_progress') and archived_at is null
  ) and coalesce(relation_record.current_agent_user_id, relation_record.tr1_manager_user_id, target_actor) is not null then
    insert into public.tasks (brand_id, brand_pharmacy_id, task_type, title, status, priority, due_at, assigned_to, created_by, source)
    values (relation_record.brand_id, relation_record.id, target_type, target_title, 'open', target_priority, target_due_at,
      coalesce(relation_record.current_agent_user_id, relation_record.tr1_manager_user_id, target_actor),
      coalesce(target_actor, relation_record.current_agent_user_id, relation_record.tr1_manager_user_id), 'automation');
  end if;
end;
$$;

create or replace function private.recalculate_brand_pharmacy_activity(
  target_brand_pharmacy_id uuid,
  target_source public.activity_history_source,
  target_reason text,
  target_order_id uuid default null,
  target_actor uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare relation_record public.brand_pharmacies%rowtype; metrics public.brand_pharmacy_order_performance%rowtype;
  next_status public.activity_status;
begin
  select * into relation_record from public.brand_pharmacies where id = target_brand_pharmacy_id for update;
  if relation_record.id is null then return; end if;
  if pg_trigger_depth() = 0 and not private.has_brand_role(relation_record.brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Activity recalculation forbidden' using errcode = '42501';
  end if;
  select * into metrics from public.brand_pharmacy_order_performance where brand_pharmacy_id = target_brand_pharmacy_id;
  next_status := case when relation_record.activity_status = 'lost' then 'lost' else metrics.current_activity_status end;
  perform set_config('app.activity_history_managed', 'true', true);
  update public.brand_pharmacies set
    first_valid_order_at = metrics.first_valid_order_at,
    last_valid_order_at = metrics.last_valid_order_at,
    first_reorder_at = metrics.first_reorder_at,
    last_order_at = metrics.last_valid_order_at,
    activity_status = case when (select automatic_activity_status_enabled from public.brand_settings where brand_id = relation_record.brand_id) then next_status else activity_status end,
    activity_status_changed_at = case when activity_status is distinct from next_status then now() else activity_status_changed_at end,
    dormant_since = case when next_status = 'dormant' then coalesce(dormant_since, now()) else null end
  where id = target_brand_pharmacy_id;
  perform set_config('app.activity_history_managed', 'false', true);
  if relation_record.activity_status is distinct from next_status
    and (select automatic_activity_status_enabled from public.brand_settings where brand_id = relation_record.brand_id) then
    insert into public.brand_pharmacy_activity_history (
      brand_id, brand_pharmacy_id, previous_activity_status, new_activity_status, reason,
      triggering_order_id, changed_by, source
    ) values (
      relation_record.brand_id, relation_record.id, relation_record.activity_status, next_status,
      target_reason, target_order_id, target_actor, target_source
    );
    if next_status = 'active' then
      update public.tasks set status = 'completed', completed_at = now(), completed_by = target_actor
      where brand_pharmacy_id = relation_record.id and title like 'Activité % — action de suivi'
        and status in ('open','in_progress') and archived_at is null;
    else
      perform private.ensure_activity_follow_up(relation_record.id, next_status, target_actor);
    end if;
  end if;
end;
$$;

create or replace function private.record_manual_activity_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare reason_value text := nullif(current_setting('app.activity_change_reason', true), '');
begin
  if new.activity_status = old.activity_status or coalesce(current_setting('app.activity_history_managed', true), 'false') = 'true' then return new; end if;
  if not private.has_brand_role(new.brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Manual activity status change forbidden' using errcode = '42501';
  end if;
  if reason_value is null then raise exception 'Manual activity change requires a reason' using errcode = '23514'; end if;
  insert into public.brand_pharmacy_activity_history (
    brand_id, brand_pharmacy_id, previous_activity_status, new_activity_status, reason, changed_by, source
  ) values (new.brand_id, new.id, old.activity_status, new.activity_status, reason_value, (select auth.uid()), 'manual');
  new.activity_status_changed_at := now();
  return new;
end;
$$;

create or replace function private.process_order_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_is_valid boolean := private.order_counts_for_activity(new.order_status, new.order_type, new.net_amount_ht);
  old_is_valid boolean := case when tg_op = 'UPDATE' then private.order_counts_for_activity(old.order_status, old.order_type, old.net_amount_ht) else false end;
  prior_count integer; settings public.brand_settings%rowtype;
begin
  if new_is_valid and not old_is_valid then
    select count(*) into prior_count from public.orders existing
    where existing.brand_pharmacy_id = new.brand_pharmacy_id and existing.id <> new.id and existing.archived_at is null
      and private.order_counts_for_activity(existing.order_status, existing.order_type, existing.net_amount_ht)
      and (existing.order_date, existing.created_at, existing.id) < (new.order_date, new.created_at, new.id);
    perform set_config('app.recalculating_order', 'true', true);
    perform set_config('app.order_admin_correction', 'true', true);
    update public.orders set
      is_initial_order = prior_count = 0,
      is_reorder = prior_count > 0,
      order_type = case when order_type in ('initial','reorder','other') then case when prior_count = 0 then 'initial'::public.order_type else 'reorder'::public.order_type end else order_type end
    where id = new.id;
    perform set_config('app.recalculating_order', 'false', true);
    perform set_config('app.order_admin_correction', 'false', true);
    if prior_count = 0 then
      perform set_config('app.status_change_reason', 'Première commande valide facturée', true);
      perform set_config('app.status_change_source', 'automation', true);
      update public.brand_pharmacies set
        implanted_at = coalesce(implanted_at, new.order_date),
        commercial_status = case when commercial_status in ('targeted','qualified','contacted','appointment_scheduled','offer_sent','pending_order') then 'implanted' else commercial_status end
      where id = new.brand_pharmacy_id;
      select * into settings from public.brand_settings where brand_id = new.brand_id;
      if not exists (select 1 from public.tasks where brand_pharmacy_id = new.brand_pharmacy_id and title = 'Suivi post-implantation' and status in ('open','in_progress') and archived_at is null) then
        insert into public.tasks (brand_id, brand_pharmacy_id, task_type, title, status, priority, due_at, assigned_to, created_by, source)
        select new.brand_id, bp.id, 'follow_up', 'Suivi post-implantation', 'open', 'high', new.order_date + make_interval(days => settings.post_implantation_follow_up_days),
          coalesce(bp.current_agent_user_id, bp.tr1_manager_user_id, new.created_by), new.created_by, 'automation'
        from public.brand_pharmacies bp where bp.id = new.brand_pharmacy_id
          and coalesce(bp.current_agent_user_id, bp.tr1_manager_user_id, new.created_by) is not null;
      end if;
    end if;
    perform private.upsert_order_products(new.id);
    perform private.capture_distribution_snapshot(new.brand_pharmacy_id, 'order');
  end if;
  if new_is_valid is distinct from old_is_valid then
    perform private.recalculate_brand_pharmacy_activity(new.brand_pharmacy_id,
      case when new.source = 'import' then 'import'::public.activity_history_source else 'order'::public.activity_history_source end,
      case when new_is_valid then 'Commande valide enregistrée' else 'Commande valide annulée ou remboursée' end,
      new.id, new.created_by);
  end if;
  return new;
end;
$$;

create or replace function private.snapshot_manual_product_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 then perform private.capture_distribution_snapshot(coalesce(new.brand_pharmacy_id, old.brand_pharmacy_id), 'manual'); end if;
  return coalesce(new, old);
end;
$$;

create trigger validate_order before insert or update on public.orders for each row execute function private.validate_order();
create trigger validate_order_item before insert or update or delete on public.order_items for each row execute function private.validate_order_item();
create trigger recalculate_order_totals after insert or update or delete on public.order_items for each row execute function private.recalculate_order_totals_trigger();
create trigger recalculate_order_shipping after update of shipping_amount_ht on public.orders for each row execute function private.recalculate_shipping_trigger();
create trigger process_order_activity after insert or update of order_status on public.orders for each row execute function private.process_order_activity();
create trigger snapshot_manual_product_change after insert or update on public.brand_pharmacy_products for each row execute function private.snapshot_manual_product_change();
create trigger record_manual_activity_change before update of activity_status on public.brand_pharmacies for each row execute function private.record_manual_activity_change();
create trigger set_order_items_updated_at before update on public.order_items for each row execute function private.set_updated_at();
create trigger audit_order_items after insert or update or delete on public.order_items for each row execute function private.audit_row_change();
create trigger audit_activity_history after insert on public.brand_pharmacy_activity_history for each row execute function private.audit_row_change();

create or replace function public.create_order(
  target_brand_pharmacy_id uuid,
  order_payload jsonb,
  item_payload jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  relation_record record;
  new_order_id uuid := gen_random_uuid();
  requested_status public.order_status := coalesce((order_payload ->> 'order_status')::public.order_status, 'draft');
  requested_source public.order_source := coalesce((order_payload ->> 'source')::public.order_source, 'manual');
  item_record jsonb;
  actor uuid := (select auth.uid());
begin
  select bp.*, b.organization_id into relation_record
  from public.brand_pharmacies bp join public.brands b on b.id = bp.brand_id
  where bp.id = target_brand_pharmacy_id and bp.archived_at is null;
  if relation_record.id is null or not private.can_access_brand_pharmacy(relation_record.id) then
    raise exception 'Brand pharmacy unavailable' using errcode = '42501';
  end if;
  if not (private.has_brand_role(relation_record.brand_id, array['tr1_manager','brand_admin','brand_user'])
    or private.user_is_assigned_to_relation(actor, relation_record.id)) then
    raise exception 'Order creation forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(item_payload) <> 'array' or jsonb_array_length(item_payload) = 0 then
    raise exception 'At least one order item is required' using errcode = '23514';
  end if;
  insert into public.orders (
    id, organization_id, brand_id, brand_pharmacy_id, pharmacy_id, external_order_id, order_number,
    order_type, order_status, order_date, source, source_user_id, source_agent_user_id,
    shipping_amount_ht, currency_code, payment_status, payment_due_at, notes,
    imported_at, import_batch_id, created_by
  ) values (
    new_order_id, relation_record.organization_id, relation_record.brand_id, relation_record.id, relation_record.pharmacy_id,
    nullif(order_payload ->> 'external_order_id', ''), nullif(order_payload ->> 'order_number', ''),
    coalesce((order_payload ->> 'order_type')::public.order_type, 'other'), 'draft',
    coalesce((order_payload ->> 'order_date')::timestamptz, now()), requested_source, actor,
    case when requested_source = 'agent' then actor else nullif(order_payload ->> 'source_agent_user_id', '')::uuid end,
    coalesce((order_payload ->> 'shipping_amount_ht')::numeric, 0), coalesce(nullif(order_payload ->> 'currency_code', ''), 'EUR'),
    coalesce((order_payload ->> 'payment_status')::public.order_payment_status, 'pending'),
    nullif(order_payload ->> 'payment_due_at', '')::timestamptz, nullif(order_payload ->> 'notes', ''),
    case when requested_source = 'import' then now() else null end,
    nullif(order_payload ->> 'import_batch_id', '')::uuid, actor
  );
  for item_record in select value from jsonb_array_elements(item_payload) loop
    insert into public.order_items (
      organization_id, brand_id, order_id, product_id, product_reference_id, quantity, free_quantity,
      unit_price_ht, discount_rate, discount_amount_ht, tax_rate
    ) values (
      relation_record.organization_id, relation_record.brand_id, new_order_id,
      (item_record ->> 'product_id')::uuid, nullif(item_record ->> 'product_reference_id', '')::uuid,
      (item_record ->> 'quantity')::integer, coalesce((item_record ->> 'free_quantity')::integer, 0),
      (item_record ->> 'unit_price_ht')::numeric, nullif(item_record ->> 'discount_rate', '')::numeric,
      coalesce((item_record ->> 'discount_amount_ht')::numeric, 0), coalesce((item_record ->> 'tax_rate')::numeric, 20)
    );
  end loop;
  if requested_status <> 'draft' then
    update public.orders set order_status = requested_status,
      cancellation_reason = nullif(order_payload ->> 'cancellation_reason', '')
    where id = new_order_id;
  end if;
  return new_order_id;
end;
$$;

create or replace function public.change_order_status(
  target_order_id uuid,
  target_status public.order_status,
  reason text default null
)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.orders%rowtype;
begin
  select * into target from public.orders where id = target_order_id;
  if target.id is null then raise exception 'Order unavailable' using errcode = '42501'; end if;
  if not (private.has_elevated_brand_access(target.brand_id) or target.created_by = (select auth.uid())) then
    raise exception 'Order status change forbidden' using errcode = '42501';
  end if;
  if target.order_status in ('invoiced','partially_delivered','delivered') and target_status not in ('cancelled','refunded',target.order_status) then
    raise exception 'Historical invoiced order status is immutable' using errcode = '42501';
  end if;
  update public.orders set order_status = target_status,
    cancellation_reason = case when target_status = 'cancelled' then reason else cancellation_reason end
  where id = target_order_id;
end;
$$;

create or replace function public.change_activity_status(
  target_brand_pharmacy_id uuid,
  target_status public.activity_status,
  reason text
)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.brand_pharmacies%rowtype;
begin
  select * into target from public.brand_pharmacies where id = target_brand_pharmacy_id;
  if target.id is null or not private.has_brand_role(target.brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Activity status change forbidden' using errcode = '42501';
  end if;
  perform set_config('app.activity_change_reason', coalesce(reason, ''), true);
  update public.brand_pharmacies set activity_status = target_status where id = target.id;
end;
$$;

create or replace function public.recalculate_brand_activity(target_brand_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare relation_record record; processed integer := 0;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Activity recalculation forbidden' using errcode = '42501';
  end if;
  for relation_record in select id from public.brand_pharmacies where brand_id = target_brand_id and archived_at is null loop
    perform private.recalculate_brand_pharmacy_activity(relation_record.id, 'scheduled_recalculation', 'Recalcul manuel de la marque', null, (select auth.uid()));
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

create or replace function public.confirm_order_import(target_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare batch_record public.import_batches%rowtype; row_record public.import_rows%rowtype;
  created_count integer := 0; failed_count integer := 0; created_order_id uuid;
begin
  select * into batch_record from public.import_batches where id = target_batch_id for update;
  if batch_record.id is null or batch_record.entity_type <> 'orders' or batch_record.status <> 'preview' then
    raise exception 'Order import batch unavailable' using errcode = '42501';
  end if;
  if batch_record.created_by <> (select auth.uid()) and not private.has_brand_role(batch_record.brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Order import forbidden' using errcode = '42501';
  end if;
  for row_record in select * from public.import_rows where batch_id = target_batch_id and is_valid order by line_number loop
    begin
      created_order_id := public.create_order(
        (row_record.normalized_payload ->> 'brand_pharmacy_id')::uuid,
        (row_record.normalized_payload - 'items') || jsonb_build_object('source', 'import', 'import_batch_id', target_batch_id),
        row_record.normalized_payload -> 'items'
      );
      update public.import_rows set processed_entity_id = created_order_id where id = row_record.id;
      created_count := created_count + 1;
    exception when others then
      update public.import_rows set errors = errors || sqlerrm, is_valid = false where id = row_record.id;
      failed_count := failed_count + 1;
    end;
  end loop;
  update public.import_batches set status = case when failed_count = 0 then 'confirmed'::public.import_status else 'failed'::public.import_status end,
    confirmed_at = now(), error_rows = error_rows + failed_count,
    error_report = jsonb_build_object('created', created_count, 'failed', failed_count)
  where id = target_batch_id;
  return jsonb_build_object('created', created_count, 'failed', failed_count);
end;
$$;

alter table public.brand_pharmacy_activity_history enable row level security;
alter table public.brand_pharmacy_distribution_snapshots enable row level security;

create policy orders_select on public.orders for select to authenticated
using (private.can_access_brand_pharmacy(brand_pharmacy_id));
create policy orders_insert on public.orders for insert to authenticated with check (
  created_by = (select auth.uid()) and private.can_access_brand_pharmacy(brand_pharmacy_id)
  and (private.has_brand_role(brand_id, array['tr1_manager','brand_admin','brand_user'])
    or private.user_is_assigned_to_relation((select auth.uid()), brand_pharmacy_id))
);
create policy orders_update on public.orders for update to authenticated
using (
  private.can_access_brand_pharmacy(brand_pharmacy_id) and (
    private.has_elevated_brand_access(brand_id)
    or (created_by = (select auth.uid()) and order_status in ('draft','pending'))
  )
)
with check (
  private.can_access_brand_pharmacy(brand_pharmacy_id) and (
    private.has_elevated_brand_access(brand_id) or created_by = (select auth.uid())
  )
);

create policy order_items_select on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and private.can_access_brand_pharmacy(o.brand_pharmacy_id))
);
create policy order_items_insert on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders o where o.id = order_id and o.brand_id = brand_id
    and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
    and (private.has_elevated_brand_access(o.brand_id) or (o.created_by = (select auth.uid()) and o.order_status in ('draft','pending'))))
);
create policy order_items_update on public.order_items for update to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
  and (private.has_elevated_brand_access(o.brand_id) or (o.created_by = (select auth.uid()) and o.order_status in ('draft','pending')))))
with check (exists (select 1 from public.orders o where o.id = order_id and o.brand_id = brand_id and private.can_access_brand_pharmacy(o.brand_pharmacy_id)));
create policy order_items_delete on public.order_items for delete to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and private.can_access_brand_pharmacy(o.brand_pharmacy_id)
    and (private.has_elevated_brand_access(o.brand_id) or (o.created_by = (select auth.uid()) and o.order_status in ('draft','pending'))))
);

create policy activity_history_select on public.brand_pharmacy_activity_history for select to authenticated
using (private.can_access_brand_pharmacy(brand_pharmacy_id));
create policy distribution_snapshots_select on public.brand_pharmacy_distribution_snapshots for select to authenticated
using (private.can_access_brand_pharmacy(brand_pharmacy_id));

grant select, insert, update on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select on public.brand_pharmacy_activity_history, public.brand_pharmacy_distribution_snapshots to authenticated;
grant select on public.brand_pharmacy_distribution, public.brand_pharmacy_order_performance,
  public.order_performance_dashboard, public.order_anomalies to authenticated;

create or replace function public.create_brand_pharmacy(
  target_brand_id uuid,
  pharmacy_data jsonb,
  relation_data jsonb default '{}'::jsonb,
  existing_pharmacy_id uuid default null
)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  target_pharmacy_id uuid := existing_pharmacy_id;
  target_relation_id uuid;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Insufficient brand permission' using errcode = '42501';
  end if;

  if target_pharmacy_id is null then
    target_pharmacy_id := gen_random_uuid();
    insert into public.pharmacies (
      id, legal_name, trade_name, cip_code, finess_code, siret, phone, email, website,
      address_line_1, address_line_2, postal_code, city, country_code,
      latitude, longitude, pharmacy_group_id, created_by
    ) values (
      target_pharmacy_id, pharmacy_data ->> 'legal_name', nullif(pharmacy_data ->> 'trade_name', ''),
      nullif(pharmacy_data ->> 'cip_code', ''), nullif(pharmacy_data ->> 'finess_code', ''),
      nullif(pharmacy_data ->> 'siret', ''), nullif(pharmacy_data ->> 'phone', ''),
      nullif(pharmacy_data ->> 'email', ''), nullif(pharmacy_data ->> 'website', ''),
      nullif(pharmacy_data ->> 'address_line_1', ''), nullif(pharmacy_data ->> 'address_line_2', ''),
      nullif(pharmacy_data ->> 'postal_code', ''), nullif(pharmacy_data ->> 'city', ''),
      coalesce(nullif(pharmacy_data ->> 'country_code', ''), 'FR'),
      nullif(pharmacy_data ->> 'latitude', '')::numeric, nullif(pharmacy_data ->> 'longitude', '')::numeric,
      nullif(pharmacy_data ->> 'pharmacy_group_id', '')::uuid, (select auth.uid())
    );
  elsif not private.is_active_pharmacy(target_pharmacy_id) then
    raise exception 'Pharmacy unavailable' using errcode = '42501';
  end if;

  insert into public.brand_pharmacies (
    brand_id, pharmacy_id, commercial_status, activity_status, priority_level,
    potential_level, potential_score, source, source_details, current_agent_user_id,
    tr1_manager_user_id, territory_id, next_action_type, next_action_at,
    next_action_owner_id, notes, created_by
  ) values (
    target_brand_id, target_pharmacy_id,
    coalesce(nullif(relation_data ->> 'commercial_status', '')::public.commercial_status, 'targeted'),
    coalesce(nullif(relation_data ->> 'activity_status', '')::public.activity_status, 'never_ordered'),
    coalesce(nullif(relation_data ->> 'priority_level', '')::public.priority_level, 'normal'),
    coalesce(nullif(relation_data ->> 'potential_level', '')::public.potential_level, 'unknown'),
    nullif(relation_data ->> 'potential_score', '')::numeric,
    coalesce(nullif(relation_data ->> 'source', '')::public.pharmacy_source, 'tr1_prospecting'),
    nullif(relation_data ->> 'source_details', ''), nullif(relation_data ->> 'current_agent_user_id', '')::uuid,
    nullif(relation_data ->> 'tr1_manager_user_id', '')::uuid, nullif(relation_data ->> 'territory_id', '')::uuid,
    nullif(relation_data ->> 'next_action_type', ''), nullif(relation_data ->> 'next_action_at', '')::timestamptz,
    nullif(relation_data ->> 'next_action_owner_id', '')::uuid, nullif(relation_data ->> 'notes', ''), (select auth.uid())
  ) returning id into target_relation_id;

  return target_relation_id;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.change_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.change_activity_status(uuid, public.activity_status, text) from public, anon;
revoke all on function public.recalculate_brand_activity(uuid) from public, anon;
revoke all on function public.confirm_order_import(uuid) from public, anon;
grant execute on function public.create_order(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.change_activity_status(uuid, public.activity_status, text) to authenticated;
grant execute on function public.recalculate_brand_activity(uuid) to authenticated;
grant execute on function public.confirm_order_import(uuid) to authenticated;

revoke all on function private.order_counts_for_activity(public.order_status, public.order_type, numeric) from public, anon, authenticated;
revoke all on function private.order_counts_for_revenue(public.order_status, public.order_type, numeric) from public, anon, authenticated;
grant execute on function private.order_counts_for_activity(public.order_status, public.order_type, numeric) to authenticated;
grant execute on function private.order_counts_for_revenue(public.order_status, public.order_type, numeric) to authenticated;
revoke all on function private.validate_order() from public, anon, authenticated;
revoke all on function private.validate_order_item() from public, anon, authenticated;
revoke all on function private.recalculate_order_totals(uuid) from public, anon, authenticated;
revoke all on function private.recalculate_order_totals_trigger() from public, anon, authenticated;
revoke all on function private.recalculate_shipping_trigger() from public, anon, authenticated;
revoke all on function private.upsert_order_products(uuid) from public, anon, authenticated;
revoke all on function private.capture_distribution_snapshot(uuid, public.distribution_snapshot_source) from public, anon, authenticated;
revoke all on function private.ensure_activity_follow_up(uuid, public.activity_status, uuid) from public, anon, authenticated;
revoke all on function private.recalculate_brand_pharmacy_activity(uuid, public.activity_history_source, text, uuid, uuid) from public, anon, authenticated;
grant execute on function private.recalculate_brand_pharmacy_activity(uuid, public.activity_history_source, text, uuid, uuid) to authenticated;
revoke all on function private.process_order_activity() from public, anon, authenticated;
revoke all on function private.snapshot_manual_product_change() from public, anon, authenticated;
revoke all on function private.record_manual_activity_change() from public, anon, authenticated;
revoke all on function private.ensure_brand_settings() from public, anon, authenticated;

comment on view public.brand_pharmacy_order_performance is 'Agrégats exacts calculés depuis les commandes reconnues, avoirs et retours négatifs inclus dans le chiffre d’affaires.';
comment on view public.brand_pharmacy_distribution is 'Distribution numérique calculée depuis les produits éligibles et les présences produit non retirées.';
comment on view public.order_anomalies is 'Anomalies non corrigées automatiquement, notamment invalidation de la commande initiale.';
comment on function public.create_order(uuid, jsonb, jsonb) is 'Création transactionnelle d’une commande et de lignes dont les totaux sont recalculés côté PostgreSQL.';

commit;
