
-- TR1 V2: Althesia catalogue provenance, non-commercial price schedules and owner-only remuneration.
create table if not exists public.althesia_product_specs (
 product_id uuid primary key references public.products(id) on delete cascade,
 sub_brand text,
 supplier_code text,
 source_summary text,
 ingredients_and_doses text,
 dosage_and_duration text,
 target_audience text,
 precaution_notes text,
 source_document text not null,
 source_page integer check(source_page is null or source_page > 0),
 source_retail_ttc numeric(12,2) check(source_retail_ttc is null or source_retail_ttc >= 0),
 source_vat_rate numeric(5,2) check(source_vat_rate is null or source_vat_rate between 0 and 100),
 market_status text not null default 'review_required'
   check(market_status in ('review_required','food_cbd_blocked','verified')),
 product_source_checked boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.althesia_trade_offers (
 product_id uuid not null references public.products(id) on delete cascade,
 paid_quantity integer not null check(paid_quantity>0),
 free_quantity integer not null default 0 check(free_quantity>=0),
 purchase_unit_ht numeric(12,2) not null check(purchase_unit_ht>=0),
 source_document text not null,
 price_confirmed boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(product_id,paid_quantity)
);
create table if not exists public.althesia_commercial_program (
 id text primary key check(id='althesia'),
 source_document text not null,
 multi_2_pct numeric(5,2) not null default 2.5,
 multi_3_pct numeric(5,2) not null default 5,
 per_brand_annual_min_ht numeric(12,2) not null default 500,
 freight_1_ht numeric(12,2) not null default 200,
 freight_2_ht numeric(12,2) not null default 300,
 freight_3_ht numeric(12,2) not null default 400,
 year_rebate jsonb not null default '[{"from_ht":5000,"pct":2},{"from_ht":10000,"pct":3},{"from_ht":25000,"pct":5},{"from_ht":50000,"pct":7}]'::jsonb,
 verified boolean not null default false,
 notes text,
 updated_at timestamptz not null default now()
);
create table if not exists public.althesia_program_brands (
 brand_id uuid primary key references public.brands(id) on delete cascade,
 program_id text not null references public.althesia_commercial_program(id)
);
create table if not exists public.brand_commission_settings (
 brand_id uuid primary key references public.brands(id) on delete cascade,
 rate_percent numeric(6,3) check(rate_percent is null or rate_percent between 0 and 100),
 base_type text not null default 'undetermined'
   check(base_type in ('undetermined','order_ht','invoiced_ht','collected_ht','net_ht_after_discounts')),
 trigger_event text not null default 'undetermined'
   check(trigger_event in ('undetermined','order_validated','invoice_issued','payment_collected')),
 beneficiary text not null default 'TR1 PHARMA / agent à confirmer',
 source_document text,
 review_status text not null default 'draft'
   check(review_status in ('draft','confirmed')),
 confirmation_reference text,
 effective_from date,
 notes text,
 updated_at timestamptz not null default now(),
 constraint commission_confirmed_fields check(
  review_status<>'confirmed' or (
   base_type<>'undetermined' and trigger_event<>'undetermined'
   and confirmation_reference is not null and length(trim(confirmation_reference))>=6
   and effective_from is not null and rate_percent is not null
  ))
);
create table if not exists public.brand_bonus_rules (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,
 title text not null check(length(trim(title))>=3),
 bonus_type text not null check(bonus_type in ('fixed','per_unit','percent')),
 amount numeric(12,2) not null check(amount>=0),
 threshold_ht numeric(12,2) check(threshold_ht is null or threshold_ht>=0),
 threshold_units integer check(threshold_units is null or threshold_units>=0),
 event_condition text,
 source_document text,
 review_status text not null default 'draft' check(review_status in ('draft','confirmed')),
 confirmation_reference text,
 effective_from date,
 effective_until date,
 created_at timestamptz not null default now(),
 constraint bonus_confirmed_proof check(
  review_status<>'confirmed' or (
    confirmation_reference is not null and length(trim(confirmation_reference))>=6
    and event_condition is not null and length(trim(event_condition))>=5
    and effective_from is not null
  )
),
 constraint bonus_dates check(effective_until is null or effective_from is null or effective_until>=effective_from)
);
create index if not exists althesia_specs_status_idx on public.althesia_product_specs(market_status);
create index if not exists althesia_trade_offers_product_idx on public.althesia_trade_offers(product_id,paid_quantity);
create index if not exists brand_bonus_brand_idx on public.brand_bonus_rules(brand_id,review_status);
alter table public.althesia_product_specs enable row level security;
alter table public.althesia_trade_offers enable row level security;
alter table public.althesia_commercial_program enable row level security;
alter table public.althesia_program_brands enable row level security;
alter table public.brand_commission_settings enable row level security;
alter table public.brand_bonus_rules enable row level security;
create policy althesia_specs_read on public.althesia_product_specs
for select to authenticated using (
 public.tr1_is_owner() or exists(
  select 1 from public.products p
  join public.demo_catalogue_access a on a.brand_id=p.brand_id
  where p.id=althesia_product_specs.product_id and a.active
    and private.demo_can_access(a.pharmacy_id,a.brand_id)
 )
);
create policy althesia_offers_read on public.althesia_trade_offers
for select to authenticated using (
 public.tr1_is_owner() or exists(
  select 1 from public.products p
  join public.demo_catalogue_access a on a.brand_id=p.brand_id
  where p.id=althesia_trade_offers.product_id and a.active
    and private.demo_can_access(a.pharmacy_id,a.brand_id)
 )
);
create policy althesia_specs_owner_insert on public.althesia_product_specs
for insert to authenticated with check(public.tr1_is_owner());
create policy althesia_specs_owner_update on public.althesia_product_specs
for update to authenticated using(public.tr1_is_owner()) with check(public.tr1_is_owner());
create policy althesia_offers_owner_insert on public.althesia_trade_offers
for insert to authenticated with check(public.tr1_is_owner());
create policy althesia_offers_owner_update on public.althesia_trade_offers
for update to authenticated using(public.tr1_is_owner()) with check(public.tr1_is_owner());
create policy althesia_program_owner_read on public.althesia_commercial_program
for select to authenticated using(public.tr1_is_owner() or exists(
 select 1 from public.demo_catalogue_access a where a.active
 and private.demo_can_access(a.pharmacy_id,a.brand_id)
));
create policy althesia_program_brands_read on public.althesia_program_brands
for select to authenticated using(public.tr1_is_owner() or exists(
 select 1 from public.demo_catalogue_access a where a.active and a.brand_id=althesia_program_brands.brand_id
 and private.demo_can_access(a.pharmacy_id,a.brand_id)
));
create policy althesia_commission_owner_read on public.brand_commission_settings
for select to authenticated using(public.tr1_is_owner());
create policy althesia_commission_owner_insert on public.brand_commission_settings
for insert to authenticated with check(public.tr1_is_owner());
create policy althesia_commission_owner_update on public.brand_commission_settings
for update to authenticated using(public.tr1_is_owner()) with check(public.tr1_is_owner());
create policy althesia_bonus_owner_read on public.brand_bonus_rules
for select to authenticated using(public.tr1_is_owner());
create policy althesia_bonus_owner_insert on public.brand_bonus_rules
for insert to authenticated with check(public.tr1_is_owner());
create policy althesia_bonus_owner_update on public.brand_bonus_rules
for update to authenticated using(public.tr1_is_owner()) with check(public.tr1_is_owner());
create policy althesia_bonus_owner_delete on public.brand_bonus_rules
for delete to authenticated using(public.tr1_is_owner());
revoke all on public.brand_commission_settings,public.brand_bonus_rules from anon;
revoke all on public.althesia_product_specs,public.althesia_trade_offers,
public.althesia_commercial_program,public.althesia_program_brands from anon;
grant select,insert,update on public.brand_commission_settings to authenticated;
grant select,insert,update,delete on public.brand_bonus_rules to authenticated;
grant select,insert,update on public.althesia_product_specs,public.althesia_trade_offers to authenticated;
grant select on public.althesia_commercial_program,public.althesia_program_brands to authenticated;
