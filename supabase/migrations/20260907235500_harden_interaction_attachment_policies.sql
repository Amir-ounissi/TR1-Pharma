drop policy if exists interaction_attachments_select on public.interaction_attachments;
drop policy if exists interaction_attachments_insert on public.interaction_attachments;
drop policy if exists interaction_attachments_update on public.interaction_attachments;

create policy interaction_attachments_select
on public.interaction_attachments for select to authenticated
using (
  archived_at is null and exists (
    select 1
    from public.interactions i
    where i.id = interaction_attachments.interaction_id
      and i.brand_id = interaction_attachments.brand_id
      and i.archived_at is null
      and private.can_access_brand_pharmacy(i.brand_pharmacy_id)
  )
);

create policy interaction_attachments_insert
on public.interaction_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid()) and exists (
    select 1
    from public.interactions i
    where i.id = interaction_attachments.interaction_id
      and i.brand_id = interaction_attachments.brand_id
      and i.archived_at is null
      and i.created_by = (select auth.uid())
      and private.can_access_brand_pharmacy(i.brand_pharmacy_id)
  )
);

create policy interaction_attachments_update
on public.interaction_attachments for update to authenticated
using (
  uploaded_by = (select auth.uid()) or private.has_elevated_brand_access(interaction_attachments.brand_id)
)
with check (
  exists (
    select 1
    from public.interactions i
    where i.id = interaction_attachments.interaction_id
      and i.brand_id = interaction_attachments.brand_id
      and i.archived_at is null
      and private.can_access_brand_pharmacy(i.brand_pharmacy_id)
  )
);
