create table if not exists public.brand_pharmacy_commercial_terms (
  brand_pharmacy_id uuid primary key references public.brand_pharmacies(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  discount_rate numeric(5,2),
  ug_paid_quantity integer,
  ug_free_quantity integer,
  note text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_pharmacy_commercial_terms_discount_check
    check (discount_rate is null or (discount_rate >= 0 and discount_rate <= 100)),
  constraint brand_pharmacy_commercial_terms_ug_check
    check (
      (ug_paid_quantity is null and ug_free_quantity is null)
      or (ug_paid_quantity > 0 and ug_free_quantity >= 0)
    )
);

create index if not exists brand_pharmacy_commercial_terms_brand_idx
  on public.brand_pharmacy_commercial_terms (brand_id);

alter table public.brand_pharmacy_commercial_terms enable row level security;

-- Commercial terms are intentionally edited only through server actions using
-- the service role. Keep browser roles off this table and grant the server the
-- CRUD privileges required by the pricing resolver and override actions.
revoke all on table public.brand_pharmacy_commercial_terms from anon, authenticated;
grant select, insert, update, delete on table public.brand_pharmacy_commercial_terms to service_role;

comment on table public.brand_pharmacy_commercial_terms is
  'Manual TR1 overrides for brand-specific pharmacy commercial conditions. Effective pricing falls back to HubSpot when an override is absent.';

comment on column public.brand_pharmacy_commercial_terms.discount_rate is
  'Manual discount percentage override. NULL keeps HubSpot as source of truth.';

comment on column public.brand_pharmacy_commercial_terms.ug_paid_quantity is
  'Paid quantity basis for the manual free-units rule, for example 12 in 12+2.';

comment on column public.brand_pharmacy_commercial_terms.ug_free_quantity is
  'Free quantity earned per paid basis, for example 2 in 12+2.';
