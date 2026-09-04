drop policy if exists mission_attachments_insert on public.mission_attachments;
create policy mission_attachments_insert on public.mission_attachments
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and private.can_access_mission(mission_id)
  and (visibility <> 'tr1_internal'::public.mission_visibility or private.user_is_tr1_for_brand(brand_id))
);

drop policy if exists mission_attachments_update on public.mission_attachments;
create policy mission_attachments_update on public.mission_attachments
for update to authenticated
using (
  private.user_is_tr1_for_brand(brand_id)
  or (uploaded_by = (select auth.uid()) and visibility <> 'tr1_internal'::public.mission_visibility)
)
with check (
  private.can_access_mission(mission_id)
  and (visibility <> 'tr1_internal'::public.mission_visibility or private.user_is_tr1_for_brand(brand_id))
);;
