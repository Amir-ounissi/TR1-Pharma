-- P2 HubSpot import finalization hardening.
-- Keep incomplete imported orders financially inert while they are assembled, then
-- recalculate once the line set is explicitly declared complete.

alter table public.orders
  add column if not exists line_items_complete boolean not null default true;

create or replace function private.recalculate_order_totals(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  totals record;
  rounding_adjustment numeric := 0;
  should_recalculate boolean := true;
begin
  select
    coalesce(nullif(to_jsonb(o) ->> 'rounding_adjustment_ht', '')::numeric, 0),
    coalesce(o.line_items_complete, true)
  into rounding_adjustment, should_recalculate
  from public.orders o
  where o.id = target_order_id;

  if not should_recalculate then
    return;
  end if;

  select
    coalesce(round(sum(quantity * unit_price_ht), 2), 0) as subtotal,
    coalesce(round(sum(discount_amount_ht), 2), 0) as discount,
    coalesce(round(sum(line_total_ht), 2), 0) as net,
    coalesce(round(sum(line_total_ht * tax_rate / 100), 2), 0) as tax
  into totals
  from public.order_items
  where order_id = target_order_id;

  perform set_config('app.recalculating_order', 'true', true);
  update public.orders
  set
    subtotal_ht = totals.subtotal,
    discount_amount_ht = totals.discount,
    net_amount_ht = round(totals.net + rounding_adjustment, 2),
    tax_amount = totals.tax,
    total_ttc = round(totals.net + rounding_adjustment + shipping_amount_ht + totals.tax, 2)
  where id = target_order_id;
  perform set_config('app.recalculating_order', 'false', true);
end;
$$;

create or replace function private.recalculate_order_totals_on_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.line_items_complete is true
    and old.line_items_complete is distinct from new.line_items_complete then
    perform private.recalculate_order_totals(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists recalculate_order_totals_on_completion on public.orders;
create trigger recalculate_order_totals_on_completion
after update of line_items_complete on public.orders
for each row
execute function private.recalculate_order_totals_on_completion();

-- Repair already-completed imports that were finalized before a completion
-- recalculation existed. Legitimate zero-value orders are excluded.
do $$
declare
  target record;
begin
  for target in
    select o.id
    from public.orders o
    where o.source = 'import'
      and o.line_items_complete is true
      and o.net_amount_ht = 0
      and o.archived_at is null
      and exists (
        select 1
        from public.order_items oi
        where oi.order_id = o.id
          and oi.line_total_ht <> 0
      )
  loop
    perform private.recalculate_order_totals(target.id);
  end loop;
end;
$$;
