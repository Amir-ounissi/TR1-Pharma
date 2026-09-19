alter table public.brand_pharmacy_commercial_terms
  add column if not exists hubspot_discount_rate numeric(5,2),
  add column if not exists hubspot_ug_paid_quantity integer,
  add column if not exists hubspot_ug_free_quantity integer,
  add column if not exists hubspot_potential text,
  add column if not exists hubspot_lead_status text,
  add column if not exists hubspot_synced_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.brand_pharmacy_commercial_terms'::regclass
      and conname = 'brand_pharmacy_commercial_terms_hubspot_discount_check'
  ) then
    alter table public.brand_pharmacy_commercial_terms
      add constraint brand_pharmacy_commercial_terms_hubspot_discount_check
      check (hubspot_discount_rate is null or (hubspot_discount_rate >= 0 and hubspot_discount_rate <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.brand_pharmacy_commercial_terms'::regclass
      and conname = 'brand_pharmacy_commercial_terms_hubspot_ug_check'
  ) then
    alter table public.brand_pharmacy_commercial_terms
      add constraint brand_pharmacy_commercial_terms_hubspot_ug_check
      check (
        (hubspot_ug_paid_quantity is null and hubspot_ug_free_quantity is null)
        or (hubspot_ug_paid_quantity > 0 and hubspot_ug_free_quantity >= 0)
      );
  end if;
end $$;

alter table public.connector_external_child_links
  drop constraint if exists connector_external_child_links_child_type_check;

alter table public.connector_external_child_links
  add constraint connector_external_child_links_child_type_check
  check (child_type in ('line_item', 'attachment'));

comment on column public.brand_pharmacy_commercial_terms.hubspot_discount_rate is
  'Last discount percentage synchronized from HubSpot. Manual discount_rate remains the override.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_paid_quantity is
  'Last HubSpot paid quantity basis for the pharmacy free-unit rule.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_free_quantity is
  'Last HubSpot free-unit quantity for the pharmacy free-unit rule.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_potential is
  'Last pharmacy potential value synchronized from HubSpot.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_lead_status is
  'Last pharmacy lead status synchronized from HubSpot.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_synced_at is
  'Timestamp of the last successful HubSpot commercial-terms snapshot.';
