-- Allow the requester/manager of an animation to open the shared invoice PDF
-- without broadening access to other mission evidence.

create or replace function private.can_access_mission_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and exists (
      select 1
      from public.mission_attachments attachment
      join public.missions mission
        on mission.id = attachment.mission_id
       and mission.brand_id = attachment.brand_id
      where attachment.object_path = object_name
        and attachment.archived_at is null
        and (
          private.user_is_tr1_for_brand(attachment.brand_id)
          or attachment.uploaded_by = (select auth.uid())
          or (
            mission.assigned_user_id = (select auth.uid())
            and private.user_has_active_brand_membership(
              (select auth.uid()),
              mission.brand_id
            )
          )
          or (
            attachment.visibility = 'shared'
            and private.has_brand_role(
              attachment.brand_id,
              array['brand_admin','brand_user']
            )
          )
          or (
            attachment.evidence_kind = 'invoice'
            and attachment.visibility = 'shared'
            and (
              mission.requested_by = (select auth.uid())
              or mission.managed_by = (select auth.uid())
            )
            and private.user_has_active_brand_membership(
              (select auth.uid()),
              mission.brand_id
            )
          )
        )
    );
$$;

revoke all on function private.can_access_mission_object(text)
from public, anon, authenticated;
grant execute on function private.can_access_mission_object(text) to authenticated;

comment on function private.can_access_mission_object(text) is
  'Private mission evidence access. Shared invoice PDFs are additionally visible to the active-brand mission requester/manager.';
