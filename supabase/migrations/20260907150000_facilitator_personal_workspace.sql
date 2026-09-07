-- Animateur / formateur workspace: private missions outside TR1 + structured field evidence.
-- External/private missions are deliberately isolated from brand-scoped missions.

create table public.personal_field_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mission_type public.mission_type not null default 'animation',
  status text not null default 'planned'
    check (status in ('planned','in_progress','completed','cancelled')),
  title text not null,
  brand_name text not null,
  pharmacy_name text not null,
  pharmacy_address text,
  postal_code text,
  city text,
  objective text,
  briefing text,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  interactions_count integer not null default 0 check (interactions_count >= 0),
  units_sold_declared integer not null default 0 check (units_sold_declared >= 0),
  participants_count integer not null default 0 check (participants_count >= 0),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at is null or scheduled_end_at > scheduled_start_at),
  check (actual_end_at is null or actual_start_at is null or actual_end_at >= actual_start_at)
);

create index personal_field_missions_user_schedule_idx
  on public.personal_field_missions(user_id, scheduled_start_at)
  where archived_at is null;

alter table public.personal_field_missions enable row level security;

create policy personal_field_missions_select on public.personal_field_missions
for select to authenticated
using (user_id = (select auth.uid()));

create policy personal_field_missions_insert on public.personal_field_missions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy personal_field_missions_update on public.personal_field_missions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy personal_field_missions_delete on public.personal_field_missions
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.personal_field_missions from anon;
grant select, insert, update, delete on public.personal_field_missions to authenticated;
grant all on public.personal_field_missions to service_role;

-- Existing TR1 mission attachments gain a semantic evidence type. Existing rows remain valid.
alter table public.mission_attachments
  add column if not exists evidence_kind text,
  add column if not exists analysis_status text,
  add column if not exists extracted_data jsonb not null default '{}'::jsonb;

alter table public.mission_attachments
  add constraint mission_attachments_evidence_kind_check
    check (evidence_kind is null or evidence_kind in ('merch_before','merch_after','merch_detail','merch_plv','cash_register')),
  add constraint mission_attachments_analysis_status_check
    check (analysis_status is null or analysis_status in ('pending','needs_review','partial','confirmed','failed'));

create index mission_attachments_evidence_idx
  on public.mission_attachments(mission_id, evidence_kind, created_at desc)
  where archived_at is null and evidence_kind is not null;

create table public.personal_field_mission_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  personal_mission_id uuid not null references public.personal_field_missions(id) on delete cascade,
  evidence_kind text not null
    check (evidence_kind in ('merch_before','merch_after','merch_detail','merch_plv','cash_register')),
  bucket_id text not null default 'personal-field-evidence'
    check (bucket_id = 'personal-field-evidence'),
  object_path text not null unique,
  original_name text not null,
  mime_type text not null
    check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending','needs_review','partial','confirmed','failed')),
  extracted_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (object_path = user_id::text || '/' || personal_mission_id::text || '/' || split_part(object_path, '/', 3))
);

create index personal_field_mission_evidence_mission_idx
  on public.personal_field_mission_evidence(personal_mission_id, evidence_kind, created_at desc);

alter table public.personal_field_mission_evidence enable row level security;

create policy personal_field_mission_evidence_select on public.personal_field_mission_evidence
for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_field_missions mission
    where mission.id = personal_mission_id
      and mission.user_id = (select auth.uid())
  )
);

create policy personal_field_mission_evidence_insert on public.personal_field_mission_evidence
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_field_missions mission
    where mission.id = personal_mission_id
      and mission.user_id = (select auth.uid())
  )
);

create policy personal_field_mission_evidence_update on public.personal_field_mission_evidence
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy personal_field_mission_evidence_delete on public.personal_field_mission_evidence
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.personal_field_mission_evidence from anon;
grant select, insert, update, delete on public.personal_field_mission_evidence to authenticated;
grant all on public.personal_field_mission_evidence to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'personal-field-evidence',
  'personal-field-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy personal_field_evidence_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'personal-field-evidence'
  and owner_id = (select auth.uid())::text
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.personal_field_missions mission
    where mission.id = nullif(split_part(name, '/', 2), '')::uuid
      and mission.user_id = (select auth.uid())
  )
);

create policy personal_field_evidence_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'personal-field-evidence'
  and owner_id = (select auth.uid())::text
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.personal_field_missions mission
    where mission.id = nullif(split_part(name, '/', 2), '')::uuid
      and mission.user_id = (select auth.uid())
  )
);

create policy personal_field_evidence_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'personal-field-evidence'
  and owner_id = (select auth.uid())::text
  and split_part(name, '/', 1) = (select auth.uid())::text
);

comment on table public.personal_field_missions is
  'Private workspace missions created by a field facilitator/trainer outside TR1 brand assignments. Brand organizations cannot access these rows.';

comment on column public.mission_attachments.evidence_kind is
  'Semantic proof collected during a TR1 mission: merchandising or cash-register sell-out evidence.';

comment on column public.mission_attachments.analysis_status is
  'Human/automated review state. cash_register uploads begin pending; no extraction is implied until processed.';
