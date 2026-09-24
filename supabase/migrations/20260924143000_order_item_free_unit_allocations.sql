create table if not exists public.order_item_free_unit_allocations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  source text not null check (source in ('commercial_terms','manual')),
  quantity integer not null check (quantity > 0),
  classification text not null,
  created_at timestamptz not null default now(),
  constraint order_item_free_unit_allocations_source_unique unique(order_item_id, source)
);

alter table public.order_item_free_unit_allocations enable row level security;

create policy order_item_free_unit_allocations_select on public.order_item_free_unit_allocations
for select to authenticated using (private.can_access_brand(order_item_free_unit_allocations.brand_id));

create policy order_item_free_unit_allocations_insert on public.order_item_free_unit_allocations
for insert to authenticated with check (
  private.can_access_brand(order_item_free_unit_allocations.brand_id)
  and exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_free_unit_allocations.order_item_id
      and o.brand_id = order_item_free_unit_allocations.brand_id
      and (o.created_by = (select auth.uid()) or private.has_brand_role(order_item_free_unit_allocations.brand_id, array['tr1_manager','brand_admin']))
  )
);

create policy order_item_free_unit_allocations_delete on public.order_item_free_unit_allocations
for delete to authenticated using (
  private.can_access_brand(order_item_free_unit_allocations.brand_id)
  and exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_free_unit_allocations.order_item_id
      and o.brand_id = order_item_free_unit_allocations.brand_id
      and (o.created_by = (select auth.uid()) or private.has_brand_role(order_item_free_unit_allocations.brand_id, array['tr1_manager','brand_admin']))
  )
);

comment on table public.order_item_free_unit_allocations is
'Ventilation métier des UG: conditions commerciales automatiques ou UG manuelles classifiées selon la nomenclature HubSpot NAALI.';
