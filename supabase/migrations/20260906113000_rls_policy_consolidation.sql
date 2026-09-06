-- Consolidate permissive SELECT policies without changing authorization semantics.
-- This removes Supabase multiple_permissive_policies performance warnings.

-- Access requests: keep one SELECT policy, split platform management by command.
drop policy if exists access_requests_manage_platform on public.access_requests;
drop policy if exists access_requests_insert_platform on public.access_requests;
drop policy if exists access_requests_update_platform on public.access_requests;
drop policy if exists access_requests_delete_platform on public.access_requests;

create policy access_requests_insert_platform
on public.access_requests
for insert to authenticated
with check (private.has_global_role(array['super_admin']));

create policy access_requests_update_platform
on public.access_requests
for update to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

create policy access_requests_delete_platform
on public.access_requests
for delete to authenticated
using (private.has_global_role(array['super_admin']));

-- Self-service onboarding reads are folded into the canonical SELECT policies.
drop policy if exists brands_select on public.brands;
drop policy if exists brands_self_service_setup_select on public.brands;
create policy brands_select
on public.brands
for select to authenticated
using (
  private.can_access_brand(id)
  or private.can_read_self_service_setup(id)
);

drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_self_service_setup_select on public.organizations;
create policy organizations_select
on public.organizations
for select to authenticated
using (
  private.has_global_role(array['super_admin'])
  or exists (
    select 1
    from public.memberships membership
    where membership.organization_id = id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
  or private.can_read_self_service_organization(id)
);

drop policy if exists brand_settings_select on public.brand_settings;
drop policy if exists brand_settings_self_service_setup_select on public.brand_settings;
create policy brand_settings_select
on public.brand_settings
for select to authenticated
using (
  private.can_access_brand(brand_id)
  or private.can_read_self_service_setup(brand_id)
);

-- Performance objectives: SELECT remains scope-aware; management is split by command.
drop policy if exists performance_objectives_manage on public.performance_objectives;
drop policy if exists performance_objectives_insert_manage on public.performance_objectives;
drop policy if exists performance_objectives_update_manage on public.performance_objectives;
drop policy if exists performance_objectives_delete_manage on public.performance_objectives;

create policy performance_objectives_insert_manage
on public.performance_objectives
for insert to authenticated
with check (private.can_manage_performance_objectives(brand_id));

create policy performance_objectives_update_manage
on public.performance_objectives
for update to authenticated
using (private.can_manage_performance_objectives(brand_id))
with check (private.can_manage_performance_objectives(brand_id));

create policy performance_objectives_delete_manage
on public.performance_objectives
for delete to authenticated
using (private.can_manage_performance_objectives(brand_id));
