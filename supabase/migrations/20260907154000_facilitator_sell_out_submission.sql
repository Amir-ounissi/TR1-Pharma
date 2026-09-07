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
