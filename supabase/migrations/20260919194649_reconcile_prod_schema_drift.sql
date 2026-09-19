-- Production schema reconciliation after historical direct Supabase hotfixes.
-- Additive/idempotent by design: preserve production-only legacy objects and data.
-- Canonical source blocks are copied from already-tested migrations below.


-- BEGIN canonical block: 20260907150000_facilitator_personal_workspace.sql
-- Animateur / formateur workspace: private missions outside TR1 + structured field evidence.
-- External/private missions are deliberately isolated from brand-scoped missions.

create table if not exists public.personal_field_missions (
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

create index if not exists personal_field_missions_user_schedule_idx
  on public.personal_field_missions(user_id, scheduled_start_at)
  where archived_at is null;

alter table public.personal_field_missions enable row level security;

drop policy if exists personal_field_missions_select on public.personal_field_missions;
create policy personal_field_missions_select on public.personal_field_missions
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists personal_field_missions_insert on public.personal_field_missions;
create policy personal_field_missions_insert on public.personal_field_missions
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists personal_field_missions_update on public.personal_field_missions;
create policy personal_field_missions_update on public.personal_field_missions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists personal_field_missions_delete on public.personal_field_missions;
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

alter table public.mission_attachments drop constraint if exists mission_attachments_evidence_kind_check;
alter table public.mission_attachments drop constraint if exists mission_attachments_analysis_status_check;

alter table public.mission_attachments
  add constraint mission_attachments_evidence_kind_check
    check (evidence_kind is null or evidence_kind in ('merch_before','merch_after','merch_detail','merch_plv','cash_register')),
  add constraint mission_attachments_analysis_status_check
    check (analysis_status is null or analysis_status in ('pending','needs_review','partial','confirmed','failed'));

create index if not exists mission_attachments_evidence_idx
  on public.mission_attachments(mission_id, evidence_kind, created_at desc)
  where archived_at is null and evidence_kind is not null;

create table if not exists public.personal_field_mission_evidence (
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

create index if not exists personal_field_mission_evidence_mission_idx
  on public.personal_field_mission_evidence(personal_mission_id, evidence_kind, created_at desc);

alter table public.personal_field_mission_evidence enable row level security;

drop policy if exists personal_field_mission_evidence_select on public.personal_field_mission_evidence;
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

drop policy if exists personal_field_mission_evidence_insert on public.personal_field_mission_evidence;
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

drop policy if exists personal_field_mission_evidence_update on public.personal_field_mission_evidence;
create policy personal_field_mission_evidence_update on public.personal_field_mission_evidence
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists personal_field_mission_evidence_delete on public.personal_field_mission_evidence;
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

drop policy if exists personal_field_evidence_storage_select on storage.objects;
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

drop policy if exists personal_field_evidence_storage_insert on storage.objects;
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

drop policy if exists personal_field_evidence_storage_delete on storage.objects;
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
-- END canonical block: 20260907150000_facilitator_personal_workspace.sql

-- BEGIN canonical block: 20260907154000_facilitator_sell_out_submission.sql
-- Facilitators can submit document sell-out from their own assigned mission without gaining review/validation rights.

alter table public.sell_out_captures
  add column if not exists source_mission_id uuid references public.missions(id) on delete set null,
  add column if not exists source_mission_attachment_id uuid references public.mission_attachments(id) on delete set null;

create unique index if not exists sell_out_captures_source_mission_attachment_uidx
  on public.sell_out_captures(source_mission_attachment_id)
  where source_mission_attachment_id is not null and archived_at is null;

create or replace function private.facilitator_can_read_sell_out_capture(target_capture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sell_out_captures capture
    join public.missions mission on mission.id = capture.source_mission_id
    join public.memberships membership
      on membership.user_id = (select auth.uid())
     and membership.brand_id = capture.brand_id
     and membership.status = 'active'
    join public.roles role on role.id = membership.role_id and role.key = 'facilitator'
    where capture.id = target_capture_id
      and capture.archived_at is null
      and capture.captured_by = (select auth.uid())
      and mission.assigned_user_id = (select auth.uid())
      and mission.brand_id = capture.brand_id
      and mission.brand_pharmacy_id = capture.brand_pharmacy_id
      and mission.archived_at is null
      and public.has_brand_capability(capture.brand_id, 'sell_out')
  );
$$;

revoke all on function private.facilitator_can_read_sell_out_capture(uuid) from public, anon, authenticated;
grant execute on function private.facilitator_can_read_sell_out_capture(uuid) to authenticated;

-- Preserve manager/agent sell-out rules and add read-only ownership for facilitator-created captures.
drop policy if exists sell_out_captures_select on public.sell_out_captures;
create policy sell_out_captures_select on public.sell_out_captures
for select to authenticated using (
  private.can_read_sell_out(brand_id, brand_pharmacy_id)
  or private.facilitator_can_read_sell_out_capture(id)
);

drop policy if exists sell_out_lines_select on public.sell_out_lines;
create policy sell_out_lines_select on public.sell_out_lines
for select to authenticated using (
  private.can_read_sell_out(brand_id, brand_pharmacy_id)
  or private.facilitator_can_read_sell_out_capture(capture_id)
);

drop policy if exists sell_out_evidence_select on public.sell_out_evidence;
create policy sell_out_evidence_select on public.sell_out_evidence
for select to authenticated using (
  exists (
    select 1
    from public.sell_out_captures capture
    where capture.id = capture_id
      and (
        private.can_read_sell_out(capture.brand_id, capture.brand_pharmacy_id)
        or private.facilitator_can_read_sell_out_capture(capture.id)
      )
  )
);

create or replace function private.can_store_sell_out_evidence(target_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sell_out_captures capture
    where capture.id::text = split_part(target_object_name, '/', 2)
      and capture.brand_id::text = split_part(target_object_name, '/', 1)
      and capture.archived_at is null
      and capture.status in ('draft','review_required')
      and (
        private.can_capture_sell_out(capture.brand_id, capture.brand_pharmacy_id)
        or private.facilitator_can_read_sell_out_capture(capture.id)
      )
  );
$$;

revoke all on function private.can_store_sell_out_evidence(text) from public, anon, authenticated;
grant execute on function private.can_store_sell_out_evidence(text) to authenticated;

drop policy if exists sell_out_evidence_objects_select on storage.objects;
create policy sell_out_evidence_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'sell-out-evidence'
  and exists (
    select 1
    from public.sell_out_captures capture
    where capture.id::text = split_part(name, '/', 2)
      and capture.brand_id::text = split_part(name, '/', 1)
      and (
        private.can_read_sell_out(capture.brand_id, capture.brand_pharmacy_id)
        or private.facilitator_can_read_sell_out_capture(capture.id)
      )
  )
);

-- Existing insert/delete policies call private.can_store_sell_out_evidence and therefore inherit the scoped facilitator rule.

create or replace function public.create_facilitator_sell_out_draft(
  target_mission_id uuid,
  target_mission_attachment_id uuid,
  target_period_start date,
  target_period_end date,
  target_confidence numeric,
  target_raw_extraction jsonb,
  target_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  mission_record public.missions%rowtype;
  attachment_record public.mission_attachments%rowtype;
  capture_id uuid := gen_random_uuid();
  line jsonb;
  product_uuid uuid;
  units integer;
  revenue numeric;
  confidence numeric;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into mission_record
  from public.missions mission
  where mission.id = target_mission_id
    and mission.assigned_user_id = actor
    and mission.archived_at is null;

  if mission_record.id is null
    or not private.has_brand_role(mission_record.brand_id, array['facilitator'])
    or not public.has_brand_capability(mission_record.brand_id, 'sell_out')
    or mission_record.status in ('cancelled','rejected','no_show')
    or mission_record.mission_type not in ('animation','training','merchandising','pharmacy_audit','product_launch','stock_check','other')
  then
    raise exception 'Facilitator mission is not eligible for sell-out' using errcode = '42501';
  end if;

  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid sell-out period' using errcode = '22023';
  end if;
  if target_confidence is not null and (target_confidence < 0 or target_confidence > 1) then
    raise exception 'Invalid extraction confidence' using errcode = '22023';
  end if;
  if jsonb_typeof(target_lines) <> 'array' or jsonb_array_length(target_lines) < 1 or jsonb_array_length(target_lines) > 150 then
    raise exception 'Sell-out review requires between 1 and 150 lines' using errcode = '22023';
  end if;
  if private.sell_out_payload_has_pii(target_raw_extraction) then
    raise exception 'Sell-out extraction must not contain patient or customer personal data' using errcode = '22023';
  end if;

  select * into attachment_record
  from public.mission_attachments attachment
  where attachment.id = target_mission_attachment_id
    and attachment.mission_id = mission_record.id
    and attachment.brand_id = mission_record.brand_id
    and attachment.uploaded_by = actor
    and attachment.archived_at is null
    and attachment.evidence_kind = 'cash_register';
  if attachment_record.id is null then
    raise exception 'Cash-register mission evidence is required' using errcode = '22023';
  end if;

  insert into public.sell_out_captures(
    id, organization_id, brand_id, brand_pharmacy_id, method, quality, status,
    period_start, period_end, observed_at, source_label, confidence, extraction_version,
    raw_extraction, captured_by, updated_by, source_mission_id, source_mission_attachment_id
  ) values (
    capture_id, mission_record.organization_id, mission_record.brand_id, mission_record.brand_pharmacy_id,
    'document', null, 'draft', target_period_start, target_period_end, now(),
    'Sortie de caisse · mission terrain', target_confidence, 'mobile-facilitator-v1',
    target_raw_extraction, actor, actor, mission_record.id, attachment_record.id
  );

  for line in select value from jsonb_array_elements(target_lines)
  loop
    product_uuid := nullif(line->>'productId', '')::uuid;
    units := nullif(line->>'unitsSold', '')::integer;
    revenue := nullif(line->>'revenueHt', '')::numeric;
    confidence := nullif(line->>'confidence', '')::numeric;

    if product_uuid is null or not exists (
      select 1 from public.products product
      where product.id = product_uuid
        and product.brand_id = mission_record.brand_id
        and product.is_active = true
        and product.discontinued_at is null
    ) then
      raise exception 'Every sell-out line must be matched to an active brand product' using errcode = '22023';
    end if;
    if units is null or units < 0 then
      raise exception 'Every sell-out line requires non-negative sold units' using errcode = '22023';
    end if;
    if revenue is not null and revenue < 0 then
      raise exception 'Sell-out revenue cannot be negative' using errcode = '22023';
    end if;
    if confidence is not null and (confidence < 0 or confidence > 1) then
      raise exception 'Invalid sell-out line confidence' using errcode = '22023';
    end if;

    insert into public.sell_out_lines(
      capture_id, organization_id, brand_id, brand_pharmacy_id, product_id,
      source_product_code, ean, label, units_sold, revenue_ht, confidence,
      created_by, updated_by
    ) values (
      capture_id, mission_record.organization_id, mission_record.brand_id, mission_record.brand_pharmacy_id,
      product_uuid, nullif(btrim(line->>'sourceProductCode'), ''), nullif(btrim(line->>'ean'), ''),
      nullif(btrim(line->>'label'), ''), units, revenue, confidence, actor, actor
    );
  end loop;

  update public.mission_attachments
  set analysis_status = 'confirmed',
      extracted_data = jsonb_build_object(
        'sell_out_capture_id', capture_id,
        'period_start', target_period_start,
        'period_end', target_period_end,
        'reviewed_lines', target_lines,
        'extraction', coalesce(target_raw_extraction, '{}'::jsonb)
      )
  where id = attachment_record.id;

  return capture_id;
end;
$$;

create or replace function public.submit_facilitator_sell_out_capture(
  target_capture_id uuid,
  target_storage_path text,
  target_file_name text,
  target_mime_type text,
  target_byte_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture_record public.sell_out_captures%rowtype;
  evidence_id uuid := gen_random_uuid();
  evidence_kind public.sell_out_evidence_kind;
begin
  select * into capture_record from public.sell_out_captures where id = target_capture_id for update;
  if capture_record.id is null or not private.facilitator_can_read_sell_out_capture(capture_record.id) then
    raise exception 'Facilitator sell-out capture unavailable' using errcode = '42501';
  end if;
  if capture_record.status <> 'draft' then
    raise exception 'Only a draft facilitator sell-out can be submitted' using errcode = '55000';
  end if;
  if split_part(target_storage_path, '/', 1) <> capture_record.brand_id::text
     or split_part(target_storage_path, '/', 2) <> capture_record.id::text then
    raise exception 'Invalid facilitator sell-out evidence path' using errcode = '22023';
  end if;
  if target_byte_size < 1 or target_byte_size > 10485760 then
    raise exception 'Invalid facilitator sell-out evidence size' using errcode = '22023';
  end if;
  if target_mime_type not in ('image/jpeg','image/png','application/pdf') then
    raise exception 'Unsupported facilitator sell-out evidence type' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'sell-out-evidence'
      and object.name = target_storage_path
  ) then
    raise exception 'Sell-out evidence is not present in private storage' using errcode = 'P0002';
  end if;

  evidence_kind := case when target_mime_type = 'application/pdf' then 'pdf'::public.sell_out_evidence_kind else 'photo'::public.sell_out_evidence_kind end;

  insert into public.sell_out_evidence(
    id, capture_id, organization_id, brand_id, kind, storage_path, file_name,
    mime_type, byte_size, created_by
  ) values (
    evidence_id, capture_record.id, capture_record.organization_id, capture_record.brand_id,
    evidence_kind, target_storage_path, btrim(target_file_name), target_mime_type,
    target_byte_size, (select auth.uid())
  );

  update public.sell_out_captures
  set status = 'review_required', updated_by = (select auth.uid())
  where id = capture_record.id;

  return evidence_id;
end;
$$;

revoke all on function public.create_facilitator_sell_out_draft(uuid, uuid, date, date, numeric, jsonb, jsonb) from public, anon;
revoke all on function public.submit_facilitator_sell_out_capture(uuid, text, text, text, bigint) from public, anon;
grant execute on function public.create_facilitator_sell_out_draft(uuid, uuid, date, date, numeric, jsonb, jsonb) to authenticated;
grant execute on function public.submit_facilitator_sell_out_capture(uuid, text, text, text, bigint) to authenticated;

comment on column public.sell_out_captures.source_mission_id is
  'Assigned TR1 mission that produced this sell-out capture when collected by a facilitator.';
comment on column public.sell_out_captures.source_mission_attachment_id is
  'Mission cash-register evidence reviewed by the facilitator before sell-out submission.';
-- END canonical block: 20260907154000_facilitator_sell_out_submission.sql

-- BEGIN canonical block: 20260907161500_facilitator_merch_plan_evidence.sql
-- Distinguish the merchandising plan photo from before/after execution photos.

alter table public.mission_attachments
  drop constraint if exists mission_attachments_evidence_kind_check;

alter table public.mission_attachments
  add constraint mission_attachments_evidence_kind_check
  check (
    evidence_kind is null
    or evidence_kind in ('merch_plan','merch_before','merch_after','merch_detail','merch_plv','cash_register')
  );

alter table public.personal_field_mission_evidence
  drop constraint if exists personal_field_mission_evidence_evidence_kind_check;

alter table public.personal_field_mission_evidence
  add constraint personal_field_mission_evidence_evidence_kind_check
  check (evidence_kind in ('merch_plan','merch_before','merch_after','merch_detail','merch_plv','cash_register'));

comment on column public.mission_attachments.evidence_kind is
  'Semantic proof collected during a TR1 mission: merchandising plan, before/after/detail/PLV, or cash-register sell-out evidence.';

comment on column public.personal_field_mission_evidence.evidence_kind is
  'Private mission evidence owned by the facilitator: merchandising plan, before/after/detail/PLV, or cash-register proof.';
-- END canonical block: 20260907161500_facilitator_merch_plan_evidence.sql

-- BEGIN canonical block: 20260907170000_facilitator_mission_closeout.sql
-- Enforce facilitator closeout evidence at the database boundary.
-- This complements the generic mission report validation without changing other field roles.

create or replace function private.enforce_facilitator_mission_closeout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_mission public.missions%rowtype;
  assigned_is_facilitator boolean := false;
  has_merch_plan boolean := false;
  has_merch_result boolean := false;
  cash_evidence_count integer := 0;
  untreated_cash_count integer := 0;
begin
  select * into target_mission
  from public.missions
  where id = new.mission_id;

  if target_mission.id is null or target_mission.assigned_user_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = target_mission.assigned_user_id
      and membership.brand_id = target_mission.brand_id
      and membership.status = 'active'
      and role.key = 'facilitator'
  ) into assigned_is_facilitator;

  if not assigned_is_facilitator then
    return new;
  end if;

  if new.report_status in ('draft','needs_correction','rejected') then
    new.data_quality_status := 'incomplete';
    return new;
  end if;

  if new.report_status not in ('submitted','validated') then
    return new;
  end if;

  if target_mission.mission_type in ('animation','merchandising') then
    select exists (
      select 1
      from public.mission_attachments attachment
      where attachment.mission_id = target_mission.id
        and attachment.uploaded_by = target_mission.assigned_user_id
        and attachment.archived_at is null
        and attachment.evidence_kind = 'merch_plan'
    ) into has_merch_plan;

    if not has_merch_plan then
      raise exception 'Facilitator closeout requires merch plan evidence' using errcode = '23514';
    end if;

    select exists (
      select 1
      from public.mission_attachments attachment
      where attachment.mission_id = target_mission.id
        and attachment.uploaded_by = target_mission.assigned_user_id
        and attachment.archived_at is null
        and attachment.evidence_kind in ('merch_after','merch_detail','merch_plv')
    ) into has_merch_result;

    if not has_merch_result then
      raise exception 'Facilitator closeout requires merchandising result evidence' using errcode = '23514';
    end if;
  end if;

  select count(*)::integer into cash_evidence_count
  from public.mission_attachments attachment
  where attachment.mission_id = target_mission.id
    and attachment.uploaded_by = target_mission.assigned_user_id
    and attachment.archived_at is null
    and attachment.evidence_kind = 'cash_register';

  if cash_evidence_count > 0 then
    select count(*)::integer into untreated_cash_count
    from public.mission_attachments attachment
    where attachment.mission_id = target_mission.id
      and attachment.uploaded_by = target_mission.assigned_user_id
      and attachment.archived_at is null
      and attachment.evidence_kind = 'cash_register'
      and not exists (
        select 1
        from public.sell_out_captures capture
        where capture.source_mission_attachment_id = attachment.id
          and capture.archived_at is null
          and capture.status in ('review_required','validated')
      );

    if untreated_cash_count > 0 then
      raise exception 'Cash-register evidence requires sell-out review before report submission' using errcode = '23514';
    end if;
  end if;

  new.data_quality_status := 'complete';
  return new;
end;
$$;

revoke all on function private.enforce_facilitator_mission_closeout() from public, anon, authenticated;

drop trigger if exists enforce_facilitator_mission_closeout on public.mission_reports;
create trigger enforce_facilitator_mission_closeout
before insert or update of report_status on public.mission_reports
for each row execute function private.enforce_facilitator_mission_closeout();

comment on function private.enforce_facilitator_mission_closeout() is
  'Requires facilitator merch-plan/result evidence and review of any uploaded cash-register proof before a mission report can be submitted.';
-- END canonical block: 20260907170000_facilitator_mission_closeout.sql

-- BEGIN canonical block: 20260910155500_product_trust_proposal_readiness.sql
-- Product Trust P0: an approved provider proposal must be operationally complete.
create or replace function public.review_provider_mission_proposal(
  target_mission_id uuid,
  target_decision public.mission_proposal_review_status,
  review_note text default null,
  target_start_at timestamptz default null,
  target_end_at timestamptz default null,
  target_budget_ht numeric default null,
  target_objective text default null,
  target_briefing text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target public.missions%rowtype;
  actor uuid := (select auth.uid());
  clean_note text := nullif(btrim(review_note), '');
  final_start timestamptz;
  final_end timestamptz;
  final_budget numeric;
  final_objective text;
  final_briefing text;
  proposal_product_count integer;
begin
  select *
  into target
  from public.missions
  where id = target_mission_id
  for update;

  if target.id is null
     or target.proposal_source <> 'provider'
     or target.proposal_review_status <> 'pending'
     or not (
       private.user_is_tr1_for_brand(target.brand_id)
       or private.has_brand_role(target.brand_id, array['brand_admin'])
     ) then
    raise exception 'Proposal unavailable' using errcode = '42501';
  end if;

  if target_decision not in ('approved', 'needs_correction', 'rejected') then
    raise exception 'Invalid proposal decision' using errcode = '23514';
  end if;

  if target_decision in ('needs_correction', 'rejected') and clean_note is null then
    raise exception 'Review note is required' using errcode = '23514';
  end if;

  final_start := coalesce(target_start_at, target.scheduled_start_at);
  final_end := coalesce(target_end_at, target.scheduled_end_at);
  final_budget := case
    when target_budget_ht is not null then target_budget_ht
    else coalesce(target.budget_estimated_ht, 0)
  end;
  final_objective := case
    when target_objective is not null then nullif(btrim(target_objective), '')
    else nullif(btrim(target.objective), '')
  end;
  final_briefing := case
    when target_briefing is not null then nullif(btrim(target_briefing), '')
    else nullif(btrim(target.briefing), '')
  end;

  if final_budget < 0 then
    raise exception 'Mission budget must be non-negative' using errcode = '23514';
  end if;

  if target_decision = 'approved' then
    select count(*)::integer
    into proposal_product_count
    from public.mission_products
    where mission_id = target_mission_id;

    if target.assigned_user_id is null then
      raise exception 'Mission assignee is required before approval' using errcode = '23514';
    end if;

    if final_start is null or final_end is null or final_end <= final_start then
      raise exception 'Mission end date must follow start date' using errcode = '23514';
    end if;

    if final_budget <= 0 then
      raise exception 'Mission budget must be greater than zero before approval' using errcode = '23514';
    end if;

    if final_objective is null then
      raise exception 'Mission objective is required before approval' using errcode = '23514';
    end if;

    if final_briefing is null then
      raise exception 'Mission briefing is required before approval' using errcode = '23514';
    end if;

    if proposal_product_count = 0 then
      raise exception 'At least one mission product is required before approval' using errcode = '23514';
    end if;
  end if;

  update public.missions
  set proposal_review_status = target_decision,
      proposal_reviewed_by_user_id = actor,
      proposal_reviewed_at = now(),
      proposal_review_note = clean_note,
      scheduled_start_at = final_start,
      scheduled_end_at = final_end,
      budget_estimated_ht = final_budget,
      cost_estimated_ht = final_budget,
      objective = coalesce(final_objective, objective),
      briefing = case when target_briefing is not null then final_briefing else briefing end,
      managed_by = actor,
      status = case
        when target_decision = 'approved' then 'scheduled'::public.mission_status
        when target_decision = 'rejected' then 'rejected'::public.mission_status
        else status
      end,
      rejection_reason = case
        when target_decision = 'rejected' then clean_note
        else rejection_reason
      end
  where id = target_mission_id;
end;
$function$;

-- Product Trust P0: an existing open task always wins over a new-action CTA.
create or replace function private.commercial_recommendation(
  health_status public.commercial_health_status,
  has_next_action boolean
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when has_next_action then 'Suivre l’action ouverte'
    when health_status = 'dormant' then 'Évaluer une réactivation'
    when health_status in ('at_risk','reorder_overdue') then 'Contacter la pharmacie'
    when health_status in ('awaiting_first_reorder','newly_implanted') then 'Sécuriser le premier réassort'
    when health_status in ('reorder_due_soon','reorder_expected') then 'Préparer une relance'
    else 'Programmer une prochaine action'
  end;
$$;
-- END canonical block: 20260910155500_product_trust_proposal_readiness.sql

-- BEGIN canonical block: 20260910163500_preserve_facilitator_proposal_details.sql
-- Product Trust P0 follow-up:
-- the facilitator proposal form already collects budget and products.
-- Persist those values for animation proposals so a complete proposal can
-- actually satisfy the approval-readiness rules.
create or replace function public.propose_mission(
  target_brand_pharmacy_id uuid,
  mission_payload jsonb,
  product_payload jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation public.brand_pharmacies%rowtype;
  actor uuid := (select auth.uid());
  mission_id uuid;
  product_record jsonb;
  mission_kind public.mission_type;
  proposed_budget numeric;
begin
  select * into relation
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id
    and archived_at is null;

  if relation.id is null
     or not private.has_brand_role(relation.brand_id, array['agent','facilitator']) then
    raise exception 'Brand pharmacy unavailable' using errcode = '42501';
  end if;

  mission_kind := (mission_payload->>'mission_type')::public.mission_type;

  if not private.mission_execution_role_allowed(relation.brand_id, actor, mission_kind) then
    raise exception 'Mission type is incompatible with provider role' using errcode = '42501';
  end if;

  if private.has_brand_role(relation.brand_id, array['agent'])
     and not private.user_is_assigned_to_relation(actor, relation.id) then
    raise exception 'Pharmacy is outside agent scope' using errcode = '42501';
  end if;

  if nullif(mission_payload->>'title','') is null
     or nullif(mission_payload->>'objective','') is null then
    raise exception 'Mission title and objective are required' using errcode = '23514';
  end if;

  if nullif(mission_payload->>'scheduled_start_at','') is null
     or nullif(mission_payload->>'scheduled_end_at','') is null
     or (mission_payload->>'scheduled_end_at')::timestamptz <= (mission_payload->>'scheduled_start_at')::timestamptz then
    raise exception 'Mission end date must follow start date' using errcode = '23514';
  end if;

  proposed_budget := nullif(mission_payload->>'budget_estimated_ht','')::numeric;
  if proposed_budget is not null and proposed_budget < 0 then
    raise exception 'Mission budget must be non-negative' using errcode = '23514';
  end if;

  insert into public.missions(
    organization_id,
    brand_id,
    brand_pharmacy_id,
    pharmacy_id,
    mission_type,
    status,
    title,
    objective,
    briefing,
    requested_by,
    managed_by,
    assigned_user_id,
    scheduled_start_at,
    scheduled_end_at,
    priority,
    location_mode,
    budget_estimated_ht,
    cost_estimated_ht,
    source,
    created_by,
    proposal_source,
    proposal_review_status,
    proposed_by_user_id
  )
  select
    b.organization_id,
    relation.brand_id,
    relation.id,
    relation.pharmacy_id,
    mission_kind,
    'requested',
    mission_payload->>'title',
    mission_payload->>'objective',
    mission_payload->>'briefing',
    actor,
    actor,
    actor,
    (mission_payload->>'scheduled_start_at')::timestamptz,
    (mission_payload->>'scheduled_end_at')::timestamptz,
    coalesce((mission_payload->>'priority')::public.mission_priority, 'normal'),
    case
      when mission_kind = 'animation' then 'in_pharmacy'::public.mission_location_mode
      else coalesce((mission_payload->>'location_mode')::public.mission_location_mode, 'in_pharmacy')
    end,
    proposed_budget,
    proposed_budget,
    'provider',
    actor,
    'provider',
    'pending',
    actor
  from public.brands b
  where b.id = relation.brand_id
  returning id into mission_id;

  for product_record in
    select value from jsonb_array_elements(coalesce(product_payload, '[]'::jsonb))
  loop
    if not exists (
      select 1
      from public.products p
      where p.id = (product_record->>'product_id')::uuid
        and p.brand_id = relation.brand_id
        and p.is_active
    ) then
      raise exception 'Mission product unavailable' using errcode = '42501';
    end if;

    insert into public.mission_products(mission_id, brand_id, product_id)
    values (mission_id, relation.brand_id, (product_record->>'product_id')::uuid);
  end loop;

  return mission_id;
end;
$$;

revoke all on function public.propose_mission(uuid, jsonb, jsonb) from public;
revoke all on function public.propose_mission(uuid, jsonb, jsonb) from anon;
grant execute on function public.propose_mission(uuid, jsonb, jsonb) to authenticated;

comment on function public.propose_mission(uuid, jsonb, jsonb) is
  'Creates a provider proposal while preserving the proposed budget, briefing and products for approval readiness.';
-- END canonical block: 20260910163500_preserve_facilitator_proposal_details.sql

-- BEGIN canonical block: 20260911152000_animation_invoicing.sql
-- Facilitator invoicing for completed, dated animation missions.
-- TR1 tracks invoice receipt / approval / payment status only; it does not execute payments.

alter table public.mission_attachments
  drop constraint if exists mission_attachments_evidence_kind_check;

alter table public.mission_attachments
  add constraint mission_attachments_evidence_kind_check
  check (
    evidence_kind is null
    or evidence_kind in (
      'merch_plan','merch_before','merch_after','merch_detail','merch_plv','cash_register','invoice'
    )
  );

create table if not exists public.animation_invoices (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  facilitator_user_id uuid not null references public.users(id) on delete restrict,
  attachment_id uuid not null references public.mission_attachments(id) on delete restrict,
  invoice_number text not null check (char_length(btrim(invoice_number)) between 1 and 100),
  amount_ht numeric(12,2) not null check (amount_ht >= 0),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
  amount_ttc numeric(12,2) not null check (amount_ttc >= 0),
  status text not null default 'submitted'
    check (status in ('submitted','approved','rejected','paid')),
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_ttc = round(amount_ht + vat_amount, 2)),
  check ((status = 'paid' and paid_at is not null) or status <> 'paid')
);

create index if not exists animation_invoices_brand_status_idx
  on public.animation_invoices(brand_id, status, submitted_at desc);
create index if not exists animation_invoices_facilitator_idx
  on public.animation_invoices(facilitator_user_id, submitted_at desc);

alter table public.animation_invoices enable row level security;

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
  )
);

revoke all on public.animation_invoices from anon;
grant select on public.animation_invoices to authenticated;
grant all on public.animation_invoices to service_role;

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
      or target_mission.requested_by = actor
      or target_mission.managed_by = actor
    );
$$;

revoke all on function private.animation_invoice_actor_can_review(public.missions,uuid)
from public, anon, authenticated;

create or replace function public.submit_animation_invoice(
  target_mission_id uuid,
  target_attachment_id uuid,
  target_invoice_number text,
  target_amount_ht numeric,
  target_vat_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  mission_record public.missions%rowtype;
  attachment_record public.mission_attachments%rowtype;
  invoice_record public.animation_invoices%rowtype;
  normalized_number text;
  normalized_ht numeric(12,2);
  normalized_vat numeric(12,2);
  invoice_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into mission_record
  from public.missions
  where id = target_mission_id
    and archived_at is null;

  if mission_record.id is null
     or mission_record.mission_type <> 'animation'::public.mission_type
     or mission_record.scheduled_start_at is null
     or mission_record.assigned_user_id is distinct from actor
  then
    raise exception 'Animation unavailable for invoicing' using errcode='42501';
  end if;

  if mission_record.status <> 'completed'::public.mission_status then
    raise exception 'Animation must be completed before invoicing' using errcode='23514';
  end if;

  if not exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = actor
      and membership.brand_id = mission_record.brand_id
      and membership.status = 'active'
      and role.key = 'facilitator'
  ) then
    raise exception 'Facilitator access required' using errcode='42501';
  end if;

  select * into attachment_record
  from public.mission_attachments
  where id = target_attachment_id
    and mission_id = mission_record.id
    and brand_id = mission_record.brand_id
    and uploaded_by = actor
    and archived_at is null;

  if attachment_record.id is null
     or attachment_record.evidence_kind <> 'invoice'
     or attachment_record.mime_type <> 'application/pdf'
  then
    raise exception 'A PDF invoice attachment is required' using errcode='23514';
  end if;

  normalized_number := btrim(coalesce(target_invoice_number,''));
  normalized_ht := round(coalesce(target_amount_ht,-1),2);
  normalized_vat := round(coalesce(target_vat_amount,0),2);

  if char_length(normalized_number) < 1 or char_length(normalized_number) > 100 then
    raise exception 'Invoice number is invalid' using errcode='23514';
  end if;
  if normalized_ht < 0 or normalized_vat < 0 then
    raise exception 'Invoice amounts are invalid' using errcode='23514';
  end if;

  select * into invoice_record
  from public.animation_invoices
  where mission_id = mission_record.id
  for update;

  if invoice_record.id is null then
    insert into public.animation_invoices(
      mission_id,brand_id,facilitator_user_id,attachment_id,invoice_number,
      amount_ht,vat_amount,amount_ttc,status,submitted_at
    ) values (
      mission_record.id,mission_record.brand_id,actor,attachment_record.id,normalized_number,
      normalized_ht,normalized_vat,round(normalized_ht + normalized_vat,2),'submitted',now()
    ) returning id into invoice_id;
  else
    if invoice_record.facilitator_user_id <> actor then
      raise exception 'Invoice owner mismatch' using errcode='42501';
    end if;
    if invoice_record.status <> 'rejected' then
      raise exception 'Only a rejected invoice can be resubmitted' using errcode='23514';
    end if;

    update public.animation_invoices
    set attachment_id = attachment_record.id,
        invoice_number = normalized_number,
        amount_ht = normalized_ht,
        vat_amount = normalized_vat,
        amount_ttc = round(normalized_ht + normalized_vat,2),
        status = 'submitted',
        review_note = null,
        submitted_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        paid_at = null,
        paid_by = null,
        updated_at = now()
    where id = invoice_record.id
    returning id into invoice_id;
  end if;

  return invoice_id;
end;
$$;

revoke all on function public.submit_animation_invoice(uuid,uuid,text,numeric,numeric) from public, anon;
grant execute on function public.submit_animation_invoice(uuid,uuid,text,numeric,numeric) to authenticated;

create or replace function public.review_animation_invoice(
  target_invoice_id uuid,
  target_decision text,
  target_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invoice_record public.animation_invoices%rowtype;
  mission_record public.missions%rowtype;
  normalized_note text := nullif(btrim(coalesce(target_review_note,'')),'');
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if target_decision not in ('approved','rejected') then
    raise exception 'Invoice decision is invalid' using errcode='23514';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'Review note is too long' using errcode='23514';
  end if;
  if target_decision = 'rejected' and normalized_note is null then
    raise exception 'A rejection reason is required' using errcode='23514';
  end if;

  select * into invoice_record
  from public.animation_invoices
  where id = target_invoice_id
  for update;

  if invoice_record.id is null or invoice_record.status <> 'submitted' then
    raise exception 'Submitted invoice unavailable' using errcode='23514';
  end if;

  select * into mission_record
  from public.missions
  where id = invoice_record.mission_id;

  if mission_record.id is null
     or not private.animation_invoice_actor_can_review(mission_record,actor)
     or actor = invoice_record.facilitator_user_id
  then
    raise exception 'Invoice review unavailable' using errcode='42501';
  end if;

  update public.animation_invoices
  set status = target_decision,
      review_note = normalized_note,
      reviewed_at = now(),
      reviewed_by = actor,
      updated_at = now()
  where id = invoice_record.id;
end;
$$;

revoke all on function public.review_animation_invoice(uuid,text,text) from public, anon;
grant execute on function public.review_animation_invoice(uuid,text,text) to authenticated;

create or replace function public.mark_animation_invoice_paid(target_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invoice_record public.animation_invoices%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into invoice_record
  from public.animation_invoices
  where id = target_invoice_id
  for update;

  if invoice_record.id is null or invoice_record.status <> 'approved' then
    raise exception 'Approved invoice unavailable' using errcode='23514';
  end if;

  if not (
    private.user_is_tr1_for_brand(invoice_record.brand_id)
    or private.has_brand_role(invoice_record.brand_id,array['brand_admin'])
  ) then
    raise exception 'Invoice payment status unavailable' using errcode='42501';
  end if;

  if actor = invoice_record.facilitator_user_id then
    raise exception 'Facilitator cannot mark own invoice paid' using errcode='42501';
  end if;

  update public.animation_invoices
  set status = 'paid',
      paid_at = now(),
      paid_by = actor,
      updated_at = now()
  where id = invoice_record.id;
end;
$$;

revoke all on function public.mark_animation_invoice_paid(uuid) from public, anon;
grant execute on function public.mark_animation_invoice_paid(uuid) to authenticated;

comment on table public.animation_invoices is
  'Invoice tracking for completed facilitator animation days. TR1 records approval/payment status but does not execute payments.';
comment on function public.submit_animation_invoice(uuid,uuid,text,numeric,numeric) is
  'Submits or resubmits a facilitator PDF invoice for one completed, dated animation.';
comment on function public.review_animation_invoice(uuid,text,text) is
  'Allows the animation requester/manager, brand admin or TR1 to approve or reject a submitted invoice.';
comment on function public.mark_animation_invoice_paid(uuid) is
  'Allows brand admins or TR1 to record an approved animation invoice as paid.';
-- END canonical block: 20260911152000_animation_invoicing.sql

-- BEGIN canonical block: 20260911152300_animation_invoice_storage_access.sql
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
-- END canonical block: 20260911152300_animation_invoice_storage_access.sql

-- BEGIN canonical block: 20260911152400_animation_invoice_requires_validated_report.sql
-- Invoicing starts only after the animation report has been reviewed and validated.

create or replace function private.validate_animation_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.missions mission
    where mission.id = new.mission_id
      and mission.brand_id = new.brand_id
      and mission.mission_type = 'animation'::public.mission_type
      and mission.status = 'completed'::public.mission_status
      and mission.scheduled_start_at is not null
      and mission.assigned_user_id = new.facilitator_user_id
      and exists (
        select 1
        from public.mission_reports report
        where report.mission_id = mission.id
          and report.archived_at is null
          and report.report_status = 'validated'::public.mission_report_status
      )
  ) then
    raise exception 'Animation invoice requires a completed mission with a validated report'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_animation_invoice()
from public, anon, authenticated;

drop trigger if exists validate_animation_invoice on public.animation_invoices;
create trigger validate_animation_invoice
before insert or update on public.animation_invoices
for each row execute function private.validate_animation_invoice();

comment on function private.validate_animation_invoice() is
  'Ensures animation invoices are attached to a completed, dated animation with a validated report and the same facilitator.';
-- END canonical block: 20260911152400_animation_invoice_requires_validated_report.sql

-- BEGIN canonical block: 20260911152500_animation_invoice_active_membership.sql
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
-- END canonical block: 20260911152500_animation_invoice_active_membership.sql
