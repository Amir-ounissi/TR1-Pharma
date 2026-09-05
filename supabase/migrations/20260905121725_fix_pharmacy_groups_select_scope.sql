drop policy if exists pharmacy_groups_select on public.pharmacy_groups;

create policy pharmacy_groups_select
on public.pharmacy_groups
for select
to authenticated
using (
  private.has_global_role(array['super_admin'])
  or exists (
    select 1
    from public.pharmacies as pharmacy
    where pharmacy.pharmacy_group_id = pharmacy_groups.id
      and private.can_access_pharmacy(pharmacy.id)
  )
);

comment on policy pharmacy_groups_select on public.pharmacy_groups is
  'A group is visible when the user can access at least one pharmacy attached to it; super admins retain global visibility.';
