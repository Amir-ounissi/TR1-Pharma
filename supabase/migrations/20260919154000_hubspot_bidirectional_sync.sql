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
end
$$;

alter table public.connector_external_child_links
  drop constraint if exists connector_external_child_links_child_type_check;

alter table public.connector_external_child_links
  add constraint connector_external_child_links_child_type_check
  check (child_type in ('line_item', 'attachment'));

update public.connector_entity_mappings mapping
set
  direction = 'bidirectional',
  conflict_strategy = 'tr1_wins',
  cursor_field = 'hs_lastmodifieddate',
  updated_at = now()
from public.connector_connections connection
join public.brands brand on brand.id = connection.brand_id
where mapping.connection_id = connection.id
  and mapping.brand_id = brand.id
  and connection.provider = 'hubspot'
  and brand.slug = 'naali'
  and mapping.entity_type in ('orders', 'visits', 'notes')
  and mapping.is_enabled = true;

comment on column public.brand_pharmacy_commercial_terms.hubspot_discount_rate is
  'Dernière remise HubSpot synchronisée. Le champ discount_rate reste un override TR1 manuel prioritaire.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_paid_quantity is
  'Base payante de la dernière règle UG HubSpot synchronisée.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_ug_free_quantity is
  'Quantité gratuite de la dernière règle UG HubSpot synchronisée.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_potential is
  'Dernier potentiel pharmacie lu depuis HubSpot.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_lead_status is
  'Dernier Lead Status pharmacie lu depuis HubSpot.';

comment on column public.brand_pharmacy_commercial_terms.hubspot_synced_at is
  'Date de la dernière synchronisation réussie des conditions commerciales HubSpot.';
