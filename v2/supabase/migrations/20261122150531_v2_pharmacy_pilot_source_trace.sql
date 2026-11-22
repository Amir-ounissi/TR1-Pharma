-- Track selective, read-only-derived pharmacy provenance in V2.
alter table public.pharmacies add column if not exists source_system text;
alter table public.pharmacies add column if not exists source_pharmacy_id uuid;
create unique index if not exists pharmacies_source_reference_idx
on public.pharmacies(source_system,source_pharmacy_id)
where source_system is not null and source_pharmacy_id is not null;
