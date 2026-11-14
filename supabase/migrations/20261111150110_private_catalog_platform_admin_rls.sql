-- TR1 PHARMA: strict RLS for authenticated platform administrators.
-- No catalogue data is made public or available to uninvited users.
-- This grants only platform super-admins authenticated CRUD rights, enabling
-- the back-office to use the logged-in Supabase session instead of service key.
-- Service-role workflows remain unchanged.
do $policy$
declare
  catalogue_table text;
begin
  foreach catalogue_table in array array[
    'private_catalog_pharmacies',
    'private_catalog_memberships',
    'private_catalog_brands',
    'private_catalog_access',
    'private_catalog_products',
    'private_catalog_prices',
    'private_catalog_indicative_tiers',
    'private_catalog_contract_tiers',
    'private_catalog_requests',
    'private_catalog_request_items'
  ] loop
    execute format('alter table public.%I enable row level security', catalogue_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', catalogue_table);
    execute format(
      'create policy platform_superadmin_only on public.%I for all to authenticated using ((select private.has_global_role(array[''super_admin'']::text[]))) with check ((select private.has_global_role(array[''super_admin'']::text[])))',
      catalogue_table
    );
  end loop;
end
$policy$;
