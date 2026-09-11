-- A former requester/manager must not retain invoice access after leaving the brand.

drop policy if exists animation_invoices_select on public.animation_invoices;
create policy animation_invoices_select on public.animation_invoices
for select to authenticated
using (
  facilitator_user_id = (select auth.uid())
  or private.user_is_tr1_for_brand(brand_id)
  or private.has_brand_role(brand_id, array['brand_admin'])
  or exists (
    select 1
    from public.missions mission
    where mission.id = mission_id
      and mission.brand_id = brand_id
      and (
        mission.requested_by = (select auth.uid())
        or mission.managed_by = (select auth.uid())
      )
      and private.user_has_active_brand_membership(
        (select auth.uid()),
        mission.brand_id
      )
  )
);

create or replace function private.animation_invoice_actor_can_review(
  target_mission public.missions,
  actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    actor is not null
    and (
      private.user_is_tr1_for_brand(target_mission.brand_id)
      or private.has_brand_role(target_mission.brand_id, array['brand_admin'])
      or (
        (
          target_mission.requested_by = actor
          or target_mission.managed_by = actor
        )
        and private.user_has_active_brand_membership(
          actor,
          target_mission.brand_id
        )
      )
    );
$$;

revoke all on function private.animation_invoice_actor_can_review(public.missions,uuid)
from public, anon, authenticated;

comment on function private.animation_invoice_actor_can_review(public.missions,uuid) is
  'Invoice-review authorization for TR1, active brand admins, or the active-brand mission requester/manager.';
