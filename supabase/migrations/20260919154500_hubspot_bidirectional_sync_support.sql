alter table public.brand_pharmacy_commercial_terms
  add column if not exists hubspot_discount_rate numeric(5,2),
  add column if not exists hubspot_ug_paid_quantity integer,
  add column if not exists hubspot_ug_free_quantity integer,
  add column if not exists hubspot_potential text,
  add column if not exists hubspot_lead_status text,
  add column if not exists hubspot_synced_at timestamptz;

alter table public.brand_pharmacy_commercial_terms
  drop constraint if exists brand_pharmacy_commercial_terms_hubspot_discount_check,
  add constraint brand_pharmacy_commercial_terms_hubspot_discount_check
    check (hubspot_discount_rate is null or (hubspot_discount_rate >= 0 and hubspot_discount_rate <= 100));

alter table public.brand_pharmacy_commercial_terms
  drop constraint if exists brand_pharmacy_commercial_terms_hubspot_ug_check,
  add constraint brand_pharmacy_commercial_terms_hubspot_ug_check
    check (
      (hubspot_ug_paid_quantity is null and hubspot_ug_free_quantity is null)
      or (hubspot_ug_paid_quantity > 0 and hubspot_ug_free_quantity >= 0)
    );

alter table public.connector_external_child_links
  drop constraint if exists connector_external_child_links_child_type_check;

alter table public.connector_external_child_links
  add constraint connector_external_child_links_child_type_check
  check (child_type in ('line_item','attachment'));

comment on column public.brand_pharmacy_commercial_terms.hubspot_discount_rate is
  'Latest discount percentage synchronized read-only from HubSpot. Manual discount_rate remains the TR1 override.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_paid_quantity is
  'Latest HubSpot paid quantity basis for free-units terms.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_free_quantity is
  'Latest HubSpot free quantity for commercial free-units terms.';
comment on column public.brand_pharmacy_commercial_terms.hubspot_synced_at is
  'Last successful HubSpot commercial terms snapshot timestamp.';
