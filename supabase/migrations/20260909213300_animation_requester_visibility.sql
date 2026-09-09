-- Keep the requesting commercial attached to the mission they created without
-- broadening access to other missions in the brand.
create or replace function private.can_access_mission(target_mission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.missions m
    where m.id = target_mission_id
      and m.archived_at is null
      and (
        private.user_is_tr1_for_brand(m.brand_id)
        or (
          m.assigned_user_id = (select auth.uid())
          and private.user_has_active_brand_membership((select auth.uid()), m.brand_id)
        )
        or (
          m.requested_by = (select auth.uid())
          and private.user_has_active_brand_membership((select auth.uid()), m.brand_id)
        )
        or private.has_brand_role(m.brand_id, array['brand_admin','brand_user'])
      )
  );
$$;

revoke all on function private.can_access_mission(uuid) from public, anon, authenticated;

comment on function private.can_access_mission(uuid) is
  'Mission read access for TR1/brand users, assigned intervenor, or the authenticated active-brand member who requested the mission.';
