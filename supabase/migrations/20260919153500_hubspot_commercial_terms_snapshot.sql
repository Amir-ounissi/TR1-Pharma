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

comment on column public.brand_pharmacy_commercial_terms.hubspot_discount_rate is
  'Last discount percentage read from HubSpot. Manual TR1 discount_rate remains the priority override.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_paid_quantity is
  'Paid quantity basis from the latest HubSpot commercial-terms snapshot.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_free_quantity is
  'Free quantity from the latest HubSpot commercial-terms snapshot.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_potential is
  'Latest HubSpot potentiel value for the pharmacy.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_lead_status is
  'Latest HubSpot lead status used to derive Naali UG tiers.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_synced_at is
  'Timestamp of the latest successful HubSpot commercial-terms read.';
