alter table public.field_visits
  add column actual_start_at timestamptz,
  add column actual_end_at timestamptz,
  add column outcome text,
  add constraint field_visits_actual_schedule_check check (
    actual_end_at is null or actual_start_at is null or actual_end_at >= actual_start_at
  ),
  add constraint field_visits_outcome_check check (
    outcome is null or outcome in ('very_good','good','follow_up','problem')
  );

alter table public.interactions
  add column field_visit_id uuid references public.field_visits(id) on delete set null,
  add column tags text[] not null default '{}';

create index interactions_field_visit_idx
  on public.interactions(field_visit_id, occurred_at desc)
  where archived_at is null and field_visit_id is not null;

create table public.interaction_attachments (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.interactions(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  bucket_id text not null default 'interaction-evidence',
  object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (size_bytes > 0 and size_bytes <= 3145728),
  check (mime_type in ('image/jpeg','image/png','image/webp')),
  check (
    object_path = brand_id::text || '/' || interaction_id::text || '/' || split_part(object_path, '/', 3)
  )
);

create index interaction_attachments_interaction_idx
  on public.interaction_attachments(interaction_id, created_at)
  where archived_at is null;

alter table public.interaction_attachments enable row level security;
revoke all on public.interaction_attachments from public, anon;
grant select, insert, update on public.interaction_attachments to authenticated;
grant all on public.interaction_attachments to service_role;

create policy interaction_attachments_select
on public.interaction_attachments for select to authenticated
using (
  archived_at is null and exists (
    select 1
    from public.interactions i
    where i.id = interaction_id
      and i.brand_id = brand_id
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
    where i.id = interaction_id
      and i.brand_id = brand_id
      and i.archived_at is null
      and i.created_by = (select auth.uid())
      and private.can_access_brand_pharmacy(i.brand_pharmacy_id)
  )
);

create policy interaction_attachments_update
on public.interaction_attachments for update to authenticated
using (
  uploaded_by = (select auth.uid()) or private.has_elevated_brand_access(brand_id)
)
with check (
  exists (
    select 1
    from public.interactions i
    where i.id = interaction_id
      and i.brand_id = brand_id
      and i.archived_at is null
      and private.can_access_brand_pharmacy(i.brand_pharmacy_id)
  )
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'interaction-evidence',
  'interaction-evidence',
  false,
  3145728,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create or replace function private.can_access_interaction_object(target_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.interactions i
    where i.id = split_part(target_name, '/', 2)::uuid
      and i.brand_id = split_part(target_name, '/', 1)::uuid
      and i.archived_at is null
      and private.can_access_brand_pharmacy(i.brand_pharmacy_id)
  );
$$;

create or replace function private.can_write_interaction_object(target_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.interactions i
    where i.id = split_part(target_name, '/', 2)::uuid
      and i.brand_id = split_part(target_name, '/', 1)::uuid
      and i.created_by = (select auth.uid())
      and i.archived_at is null
      and private.can_access_brand_pharmacy(i.brand_pharmacy_id)
  );
$$;

create policy interaction_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'interaction-evidence'
  and private.can_access_interaction_object(name)
);

create policy interaction_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'interaction-evidence'
  and owner_id = (select auth.uid())::text
  and private.can_write_interaction_object(name)
);

create policy interaction_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'interaction-evidence'
  and private.can_access_interaction_object(name)
  and owner_id = (select auth.uid())::text
);

create or replace function public.start_field_visit(target_visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.field_visits%rowtype;
begin
  select * into target
  from public.field_visits
  where id = target_visit_id
  for update;

  if actor is null or target.id is null or target.owner_user_id <> actor or target.archived_at is not null then
    raise exception 'Visit unavailable' using errcode = '42501';
  end if;
  if target.status not in ('planned','confirmed','in_progress') then
    raise exception 'Visit cannot be started' using errcode = '23514';
  end if;

  update public.field_visits
  set status = 'in_progress',
      actual_start_at = coalesce(actual_start_at, now()),
      updated_at = now()
  where id = target_visit_id;
end;
$$;

create or replace function public.complete_field_visit(
  target_visit_id uuid,
  target_outcome text default null,
  target_next_start_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.field_visits%rowtype;
  next_visit_id uuid;
  pharmacy_label text;
begin
  select * into target
  from public.field_visits
  where id = target_visit_id
  for update;

  if actor is null or target.id is null or target.owner_user_id <> actor or target.archived_at is not null then
    raise exception 'Visit unavailable' using errcode = '42501';
  end if;
  if target.status not in ('planned','confirmed','in_progress') then
    raise exception 'Visit cannot be completed' using errcode = '23514';
  end if;
  if target_outcome is not null and target_outcome not in ('very_good','good','follow_up','problem') then
    raise exception 'Invalid visit outcome' using errcode = '23514';
  end if;
  if target_next_start_at is not null and target_next_start_at <= now() then
    raise exception 'Next visit must be in the future' using errcode = '23514';
  end if;

  update public.field_visits
  set status = 'completed',
      actual_start_at = coalesce(actual_start_at, now()),
      actual_end_at = now(),
      outcome = target_outcome,
      updated_at = now()
  where id = target_visit_id;

  if target_next_start_at is not null then
    select coalesce(p.trade_name, p.legal_name, 'Pharmacie') into pharmacy_label
    from public.pharmacies p
    where p.id = target.pharmacy_id;

    insert into public.field_visits(
      owner_user_id, pharmacy_id, visit_kind, status, title, objective,
      scheduled_start_at, scheduled_end_at, notes, source, created_by
    )
    values (
      actor, target.pharmacy_id, target.visit_kind, 'planned',
      'Visite · ' || coalesce(pharmacy_label, 'Pharmacie'), null,
      target_next_start_at, target_next_start_at + interval '45 minutes',
      null, 'manual', actor
    )
    returning id into next_visit_id;

    insert into public.field_visit_brands(visit_id, brand_id, brand_pharmacy_id, objective, is_primary)
    select next_visit_id, brand_id, brand_pharmacy_id, objective, is_primary
    from public.field_visit_brands
    where visit_id = target_visit_id;
  end if;

  return next_visit_id;
end;
$$;

grant execute on function public.start_field_visit(uuid) to authenticated;
grant execute on function public.complete_field_visit(uuid, text, timestamptz) to authenticated;
