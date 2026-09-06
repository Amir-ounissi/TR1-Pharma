create type public.sell_out_capture_method as enum (
  'document',
  'manual',
  'import',
  'stock_inference'
);

create type public.sell_out_quality as enum (
  'confirmed',
  'declared',
  'estimated',
  'imported'
);

create type public.sell_out_capture_status as enum (
  'draft',
  'review_required',
  'validated',
  'rejected',
  'archived'
);

create type public.sell_out_evidence_kind as enum (
  'photo',
  'pdf',
  'csv',
  'other'
);

create table public.sell_out_captures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null references public.brand_pharmacies(id) on delete cascade,
  trade_campaign_id uuid references public.trade_campaigns(id) on delete set null,
  method public.sell_out_capture_method not null,
  quality public.sell_out_quality,
  status public.sell_out_capture_status not null default 'draft',
  period_start date not null,
  period_end date not null,
  observed_at timestamptz not null default now(),
  source_label text,
  confidence numeric(5,4),
  extraction_version text,
  raw_extraction jsonb,
  validation_notes text,
  captured_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sell_out_captures_period_check check (period_end >= period_start),
  constraint sell_out_captures_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint sell_out_captures_source_label_check check (source_label is null or char_length(source_label) <= 300),
  constraint sell_out_captures_extraction_version_check check (extraction_version is null or char_length(extraction_version) <= 100),
  constraint sell_out_captures_raw_extraction_check check (raw_extraction is null or octet_length(raw_extraction::text) <= 131072),
  constraint sell_out_captures_validation_notes_check check (validation_notes is null or char_length(validation_notes) <= 5000),
  constraint sell_out_captures_review_check check (
    (reviewed_at is null and reviewed_by is null)
    or (reviewed_at is not null and reviewed_by is not null)
  )
);
create index sell_out_captures_brand_period_idx
  on public.sell_out_captures(brand_id, period_start, period_end)
  where archived_at is null;
create index sell_out_captures_pharmacy_period_idx
  on public.sell_out_captures(brand_pharmacy_id, period_end desc)
  where archived_at is null;
create index sell_out_captures_status_idx
  on public.sell_out_captures(brand_id, status, created_at desc)
  where archived_at is null;

create table public.sell_out_lines (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.sell_out_captures(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null references public.brand_pharmacies(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  source_product_code text,
  ean text,
  label text,
  units_sold integer,
  revenue_ht numeric(14,2),
  stock_before integer,
  delivered_units integer,
  stock_current integer,
  theoretical_units integer,
  confidence numeric(5,4),
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sell_out_lines_identity_check check (
    product_id is not null
    or nullif(btrim(source_product_code), '') is not null
    or nullif(btrim(ean), '') is not null
    or nullif(btrim(label), '') is not null
  ),
  constraint sell_out_lines_units_check check (units_sold is null or units_sold >= 0),
  constraint sell_out_lines_revenue_check check (revenue_ht is null or revenue_ht >= 0),
  constraint sell_out_lines_stock_before_check check (stock_before is null or stock_before >= 0),
  constraint sell_out_lines_delivered_check check (delivered_units is null or delivered_units >= 0),
  constraint sell_out_lines_stock_current_check check (stock_current is null or stock_current >= 0),
  constraint sell_out_lines_theoretical_check check (theoretical_units is null or theoretical_units >= 0),
  constraint sell_out_lines_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint sell_out_lines_source_product_code_check check (source_product_code is null or char_length(source_product_code) <= 120),
  constraint sell_out_lines_ean_check check (ean is null or char_length(ean) <= 32),
  constraint sell_out_lines_label_check check (label is null or char_length(label) <= 300)
);
create index sell_out_lines_capture_idx on public.sell_out_lines(capture_id);
create index sell_out_lines_brand_product_idx on public.sell_out_lines(brand_id, product_id)
  where product_id is not null;

create table public.sell_out_evidence (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.sell_out_captures(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind public.sell_out_evidence_kind not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text,
  extraction_payload_hash text,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint sell_out_evidence_storage_path_check check (char_length(storage_path) between 3 and 1024),
  constraint sell_out_evidence_file_name_check check (char_length(file_name) between 1 and 255),
  constraint sell_out_evidence_mime_type_check check (char_length(mime_type) between 1 and 120),
  constraint sell_out_evidence_byte_size_check check (byte_size between 1 and 10485760),
  constraint sell_out_evidence_sha256_check check (sha256 is null or sha256 ~ '^[0-9a-fA-F]{64}$'),
  constraint sell_out_evidence_payload_hash_check check (extraction_payload_hash is null or extraction_payload_hash ~ '^[0-9a-fA-F]{64}$'),
  unique (capture_id, storage_path)
);
create index sell_out_evidence_capture_idx on public.sell_out_evidence(capture_id, created_at desc);

create trigger sell_out_captures_updated_at
before update on public.sell_out_captures
for each row execute function private.set_updated_at();
create trigger sell_out_lines_updated_at
before update on public.sell_out_lines
for each row execute function private.set_updated_at();

create or replace function private.sell_out_payload_has_pii(target_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  payload_text text := lower(coalesce(target_payload::text, ''));
begin
  if target_payload is null then
    return false;
  end if;

  return payload_text ~ '"(patient|patient_name|nom_patient|prenom_patient|customer|customer_name|client_name|email|e-mail|phone|telephone|téléphone|mobile)"[[:space:]]*:'
    or payload_text ~ '[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+';
end;
$$;

create or replace function private.can_read_sell_out_brand(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_brand_capability(target_brand_id, 'sell_out')
    and (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user'])
    );
$$;

create or replace function private.can_read_sell_out(target_brand_id uuid, target_brand_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_brand_capability(target_brand_id, 'sell_out')
    and (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user'])
      or (
        private.has_brand_role(target_brand_id, array['agent'])
        and private.user_assigned_to_brand_pharmacy(target_brand_pharmacy_id, (select auth.uid()))
      )
    );
$$;

create or replace function private.can_capture_sell_out(target_brand_id uuid, target_brand_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_brand_capability(target_brand_id, 'sell_out')
    and (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin'])
      or (
        private.has_brand_role(target_brand_id, array['agent'])
        and private.user_assigned_to_brand_pharmacy(target_brand_pharmacy_id, (select auth.uid()))
      )
    );
$$;

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
      and private.can_capture_sell_out(capture.brand_id, capture.brand_pharmacy_id)
  );
$$;

revoke all on function private.sell_out_payload_has_pii(jsonb) from public, anon, authenticated;
revoke all on function private.can_read_sell_out_brand(uuid) from public, anon, authenticated;
revoke all on function private.can_read_sell_out(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_capture_sell_out(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_store_sell_out_evidence(text) from public, anon, authenticated;
grant execute on function private.can_read_sell_out_brand(uuid) to authenticated;
grant execute on function private.can_read_sell_out(uuid, uuid) to authenticated;
grant execute on function private.can_capture_sell_out(uuid, uuid) to authenticated;
grant execute on function private.can_store_sell_out_evidence(text) to authenticated;

alter table public.sell_out_captures enable row level security;
alter table public.sell_out_lines enable row level security;
alter table public.sell_out_evidence enable row level security;

create policy sell_out_captures_select on public.sell_out_captures
for select to authenticated using (private.can_read_sell_out(brand_id, brand_pharmacy_id));
create policy sell_out_lines_select on public.sell_out_lines
for select to authenticated using (private.can_read_sell_out(brand_id, brand_pharmacy_id));
create policy sell_out_evidence_select on public.sell_out_evidence
for select to authenticated using (
  exists (
    select 1
    from public.sell_out_captures capture
    where capture.id = capture_id
      and private.can_read_sell_out(capture.brand_id, capture.brand_pharmacy_id)
  )
);

revoke all on public.sell_out_captures, public.sell_out_lines, public.sell_out_evidence from anon, authenticated;
grant select on public.sell_out_captures, public.sell_out_lines, public.sell_out_evidence to authenticated;
grant all on public.sell_out_captures, public.sell_out_lines, public.sell_out_evidence to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'sell-out-evidence',
  'sell-out-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','application/pdf','text/csv','application/vnd.ms-excel']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy sell_out_evidence_objects_select on storage.objects
for select to authenticated
using (
  bucket_id = 'sell-out-evidence'
  and exists (
    select 1
    from public.sell_out_captures capture
    where capture.id::text = split_part(name, '/', 2)
      and capture.brand_id::text = split_part(name, '/', 1)
      and private.can_read_sell_out(capture.brand_id, capture.brand_pharmacy_id)
  )
);

create policy sell_out_evidence_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'sell-out-evidence'
  and private.can_store_sell_out_evidence(name)
);

create policy sell_out_evidence_objects_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'sell-out-evidence'
  and private.can_store_sell_out_evidence(name)
);

create or replace function public.save_sell_out_capture(
  target_capture_id uuid,
  target_brand_id uuid,
  target_brand_pharmacy_id uuid,
  target_method public.sell_out_capture_method,
  target_period_start date,
  target_period_end date,
  target_source_label text default null,
  target_confidence numeric default null,
  target_extraction_version text default null,
  target_raw_extraction jsonb default null,
  target_trade_campaign_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid := coalesce(target_capture_id, gen_random_uuid());
  organization_uuid uuid;
  existing_capture public.sell_out_captures%rowtype;
  initial_quality public.sell_out_quality;
begin
  if not private.can_capture_sell_out(target_brand_id, target_brand_pharmacy_id) then
    raise exception 'Sell-out capture forbidden' using errcode = '42501';
  end if;
  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid sell-out period' using errcode = '22023';
  end if;
  if target_confidence is not null and (target_confidence < 0 or target_confidence > 1) then
    raise exception 'Invalid confidence value' using errcode = '22023';
  end if;
  if private.sell_out_payload_has_pii(target_raw_extraction) then
    raise exception 'Sell-out extraction must not contain patient or customer personal data' using errcode = '22023';
  end if;

  select brand.organization_id
  into organization_uuid
  from public.brands brand
  join public.brand_pharmacies relation
    on relation.brand_id = brand.id
   and relation.id = target_brand_pharmacy_id
   and relation.archived_at is null
  where brand.id = target_brand_id;
  if organization_uuid is null then
    raise exception 'Unknown pharmacy for active brand' using errcode = '22023';
  end if;

  if target_trade_campaign_id is not null and not exists (
    select 1 from public.trade_campaigns campaign
    where campaign.id = target_trade_campaign_id
      and campaign.brand_id = target_brand_id
      and campaign.archived_at is null
  ) then
    raise exception 'Trade campaign is outside active brand' using errcode = '23514';
  end if;

  if target_capture_id is not null then
    select * into existing_capture from public.sell_out_captures where id = target_capture_id;
    if existing_capture.id is null then
      raise exception 'Sell-out capture not found' using errcode = 'P0002';
    end if;
    if existing_capture.brand_id <> target_brand_id or existing_capture.brand_pharmacy_id <> target_brand_pharmacy_id then
      raise exception 'Sell-out capture scope cannot be changed' using errcode = '42501';
    end if;
    if existing_capture.status in ('validated','rejected','archived') then
      raise exception 'Reviewed sell-out capture is immutable' using errcode = '55000';
    end if;
  end if;

  initial_quality := case target_method
    when 'manual' then 'declared'::public.sell_out_quality
    when 'import' then 'imported'::public.sell_out_quality
    when 'stock_inference' then 'estimated'::public.sell_out_quality
    else null
  end;

  insert into public.sell_out_captures(
    id, organization_id, brand_id, brand_pharmacy_id, trade_campaign_id,
    method, quality, status, period_start, period_end, source_label, confidence,
    extraction_version, raw_extraction, captured_by, updated_by
  ) values (
    result_id, organization_uuid, target_brand_id, target_brand_pharmacy_id, target_trade_campaign_id,
    target_method, initial_quality, 'draft', target_period_start, target_period_end,
    nullif(btrim(target_source_label), ''), target_confidence,
    nullif(btrim(target_extraction_version), ''), target_raw_extraction,
    (select auth.uid()), (select auth.uid())
  )
  on conflict (id) do update set
    trade_campaign_id = excluded.trade_campaign_id,
    method = excluded.method,
    quality = excluded.quality,
    status = 'draft',
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    source_label = excluded.source_label,
    confidence = excluded.confidence,
    extraction_version = excluded.extraction_version,
    raw_extraction = excluded.raw_extraction,
    validation_notes = null,
    updated_by = (select auth.uid()),
    reviewed_by = null,
    reviewed_at = null;

  return result_id;
end;
$$;

create or replace function public.save_sell_out_line(
  target_line_id uuid,
  target_capture_id uuid,
  target_product_id uuid,
  target_source_product_code text,
  target_ean text,
  target_label text,
  target_units_sold integer,
  target_revenue_ht numeric,
  target_stock_before integer default null,
  target_delivered_units integer default null,
  target_stock_current integer default null,
  target_confidence numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture_record public.sell_out_captures%rowtype;
  result_id uuid := coalesce(target_line_id, gen_random_uuid());
  computed_units integer;
begin
  select * into capture_record
  from public.sell_out_captures
  where id = target_capture_id and archived_at is null;
  if capture_record.id is null then
    raise exception 'Sell-out capture not found' using errcode = 'P0002';
  end if;
  if not private.can_capture_sell_out(capture_record.brand_id, capture_record.brand_pharmacy_id) then
    raise exception 'Sell-out line update forbidden' using errcode = '42501';
  end if;
  if capture_record.status not in ('draft','review_required') then
    raise exception 'Reviewed sell-out capture is immutable' using errcode = '55000';
  end if;
  if target_product_id is not null and not exists (
    select 1 from public.products product
    where product.id = target_product_id and product.brand_id = capture_record.brand_id
  ) then
    raise exception 'Sell-out product is outside active brand' using errcode = '23514';
  end if;
  if target_product_id is null
     and nullif(btrim(target_source_product_code), '') is null
     and nullif(btrim(target_ean), '') is null
     and nullif(btrim(target_label), '') is null then
    raise exception 'A product identifier is required' using errcode = '22023';
  end if;
  if target_confidence is not null and (target_confidence < 0 or target_confidence > 1) then
    raise exception 'Invalid confidence value' using errcode = '22023';
  end if;
  if target_revenue_ht is not null and target_revenue_ht < 0 then
    raise exception 'Revenue cannot be negative' using errcode = '22023';
  end if;

  if capture_record.method = 'stock_inference' then
    if target_stock_before is null or target_delivered_units is null or target_stock_current is null
       or target_stock_before < 0 or target_delivered_units < 0 or target_stock_current < 0 then
      raise exception 'Stock inference requires non-negative previous stock, deliveries and current stock' using errcode = '22023';
    end if;
    computed_units := greatest(target_stock_before + target_delivered_units - target_stock_current, 0);
  else
    if target_units_sold is null or target_units_sold < 0 then
      raise exception 'Sell-out units are required and cannot be negative' using errcode = '22023';
    end if;
    computed_units := target_units_sold;
  end if;

  insert into public.sell_out_lines(
    id, capture_id, organization_id, brand_id, brand_pharmacy_id, product_id,
    source_product_code, ean, label, units_sold, revenue_ht,
    stock_before, delivered_units, stock_current, theoretical_units,
    confidence, created_by, updated_by
  ) values (
    result_id, capture_record.id, capture_record.organization_id, capture_record.brand_id,
    capture_record.brand_pharmacy_id, target_product_id,
    nullif(btrim(target_source_product_code), ''), nullif(btrim(target_ean), ''), nullif(btrim(target_label), ''),
    computed_units, target_revenue_ht,
    target_stock_before, target_delivered_units, target_stock_current,
    case when capture_record.method = 'stock_inference' then computed_units else null end,
    target_confidence, (select auth.uid()), (select auth.uid())
  )
  on conflict (id) do update set
    product_id = excluded.product_id,
    source_product_code = excluded.source_product_code,
    ean = excluded.ean,
    label = excluded.label,
    units_sold = excluded.units_sold,
    revenue_ht = excluded.revenue_ht,
    stock_before = excluded.stock_before,
    delivered_units = excluded.delivered_units,
    stock_current = excluded.stock_current,
    theoretical_units = excluded.theoretical_units,
    confidence = excluded.confidence,
    updated_by = (select auth.uid());

  if capture_record.status = 'review_required' then
    update public.sell_out_captures
    set status = 'draft', reviewed_by = null, reviewed_at = null, validation_notes = null, updated_by = (select auth.uid())
    where id = capture_record.id;
  end if;

  return result_id;
end;
$$;

create or replace function public.add_sell_out_evidence(
  target_capture_id uuid,
  target_kind public.sell_out_evidence_kind,
  target_storage_path text,
  target_file_name text,
  target_mime_type text,
  target_byte_size bigint,
  target_sha256 text default null,
  target_extraction_payload_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture_record public.sell_out_captures%rowtype;
  result_id uuid := gen_random_uuid();
begin
  select * into capture_record
  from public.sell_out_captures
  where id = target_capture_id and archived_at is null;
  if capture_record.id is null then
    raise exception 'Sell-out capture not found' using errcode = 'P0002';
  end if;
  if not private.can_capture_sell_out(capture_record.brand_id, capture_record.brand_pharmacy_id) then
    raise exception 'Sell-out evidence update forbidden' using errcode = '42501';
  end if;
  if capture_record.status not in ('draft','review_required') then
    raise exception 'Reviewed sell-out capture is immutable' using errcode = '55000';
  end if;
  if split_part(target_storage_path, '/', 1) <> capture_record.brand_id::text
     or split_part(target_storage_path, '/', 2) <> capture_record.id::text then
    raise exception 'Invalid sell-out evidence storage path' using errcode = '22023';
  end if;
  if target_byte_size is null or target_byte_size < 1 or target_byte_size > 10485760 then
    raise exception 'Invalid evidence file size' using errcode = '22023';
  end if;
  if target_mime_type not in ('image/jpeg','image/png','application/pdf','text/csv','application/vnd.ms-excel') then
    raise exception 'Unsupported evidence file type' using errcode = '22023';
  end if;
  if target_sha256 is not null and target_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Invalid evidence hash' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'sell-out-evidence' and object.name = target_storage_path
  ) then
    raise exception 'Evidence file is not present in private storage' using errcode = 'P0002';
  end if;

  insert into public.sell_out_evidence(
    id, capture_id, organization_id, brand_id, kind, storage_path, file_name,
    mime_type, byte_size, sha256, extraction_payload_hash, created_by
  ) values (
    result_id, capture_record.id, capture_record.organization_id, capture_record.brand_id,
    target_kind, target_storage_path, btrim(target_file_name), target_mime_type,
    target_byte_size, lower(target_sha256), lower(target_extraction_payload_hash), (select auth.uid())
  );

  if capture_record.status = 'review_required' then
    update public.sell_out_captures
    set status = 'draft', reviewed_by = null, reviewed_at = null, validation_notes = null, updated_by = (select auth.uid())
    where id = capture_record.id;
  end if;

  return result_id;
end;
$$;

create or replace function public.submit_sell_out_capture(target_capture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture_record public.sell_out_captures%rowtype;
begin
  select * into capture_record
  from public.sell_out_captures
  where id = target_capture_id and archived_at is null;
  if capture_record.id is null then
    raise exception 'Sell-out capture not found' using errcode = 'P0002';
  end if;
  if not private.can_capture_sell_out(capture_record.brand_id, capture_record.brand_pharmacy_id) then
    raise exception 'Sell-out submission forbidden' using errcode = '42501';
  end if;
  if capture_record.status <> 'draft' then
    raise exception 'Only a draft sell-out capture can be submitted' using errcode = '55000';
  end if;
  if not exists (select 1 from public.sell_out_lines line where line.capture_id = target_capture_id) then
    raise exception 'At least one sell-out line is required' using errcode = '22023';
  end if;
  if capture_record.method = 'document' and not exists (
    select 1 from public.sell_out_evidence evidence where evidence.capture_id = target_capture_id
  ) then
    raise exception 'Document sell-out requires evidence before review' using errcode = '22023';
  end if;

  update public.sell_out_captures
  set status = 'review_required', updated_by = (select auth.uid())
  where id = target_capture_id;
end;
$$;

create or replace function public.validate_sell_out_capture(
  target_capture_id uuid,
  target_approved boolean,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture_record public.sell_out_captures%rowtype;
  final_quality public.sell_out_quality;
begin
  select * into capture_record
  from public.sell_out_captures
  where id = target_capture_id and archived_at is null;
  if capture_record.id is null then
    raise exception 'Sell-out capture not found' using errcode = 'P0002';
  end if;
  if not private.can_capture_sell_out(capture_record.brand_id, capture_record.brand_pharmacy_id) then
    raise exception 'Sell-out validation forbidden' using errcode = '42501';
  end if;
  if capture_record.status <> 'review_required' then
    raise exception 'Sell-out capture must be submitted before validation' using errcode = '55000';
  end if;
  if capture_record.method = 'document' and not exists (
    select 1 from public.sell_out_evidence evidence where evidence.capture_id = target_capture_id
  ) then
    raise exception 'Document sell-out requires evidence before validation' using errcode = '22023';
  end if;

  final_quality := case capture_record.method
    when 'document' then 'confirmed'::public.sell_out_quality
    when 'manual' then 'declared'::public.sell_out_quality
    when 'stock_inference' then 'estimated'::public.sell_out_quality
    when 'import' then 'imported'::public.sell_out_quality
  end;

  update public.sell_out_captures
  set
    status = case when target_approved then 'validated'::public.sell_out_capture_status else 'rejected'::public.sell_out_capture_status end,
    quality = case when target_approved then final_quality else quality end,
    validation_notes = nullif(btrim(target_notes), ''),
    reviewed_by = (select auth.uid()),
    reviewed_at = now(),
    updated_by = (select auth.uid())
  where id = target_capture_id;
end;
$$;

create or replace function public.archive_sell_out_capture(target_capture_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture_record public.sell_out_captures%rowtype;
begin
  select * into capture_record
  from public.sell_out_captures
  where id = target_capture_id and archived_at is null;
  if capture_record.id is null then
    raise exception 'Sell-out capture not found' using errcode = 'P0002';
  end if;
  if not (
    private.has_global_role(array['super_admin'])
    or (
      public.has_brand_capability(capture_record.brand_id, 'sell_out')
      and private.has_brand_role(capture_record.brand_id, array['tr1_manager','brand_admin'])
    )
  ) then
    raise exception 'Sell-out archive forbidden' using errcode = '42501';
  end if;

  update public.sell_out_captures
  set status = 'archived', archived_at = now(), updated_by = (select auth.uid())
  where id = target_capture_id;
end;
$$;

create or replace function public.get_sell_out_overview(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date
)
returns table(
  validated_captures bigint,
  observed_pharmacies bigint,
  active_pharmacies bigint,
  coverage_rate numeric,
  sell_out_units bigint,
  sell_out_revenue_ht numeric,
  sell_in_units bigint,
  sell_in_revenue_ht numeric,
  sell_out_sell_in_rate numeric,
  confirmed_units bigint,
  declared_units bigint,
  estimated_units bigint,
  imported_units bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_read_sell_out_brand(target_brand_id) then
    raise exception 'Sell-out analytics access forbidden' using errcode = '42501';
  end if;
  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid sell-out analytics period' using errcode = '22023';
  end if;

  return query
  with captures as (
    select capture.id, capture.brand_pharmacy_id, capture.quality
    from public.sell_out_captures capture
    where capture.brand_id = target_brand_id
      and capture.status = 'validated'
      and capture.archived_at is null
      and capture.period_end >= target_period_start
      and capture.period_start <= target_period_end
  ), line_metrics as (
    select
      coalesce(sum(line.units_sold), 0)::bigint as units,
      coalesce(sum(line.revenue_ht), 0)::numeric as revenue,
      coalesce(sum(line.units_sold) filter (where capture.quality = 'confirmed'), 0)::bigint as confirmed,
      coalesce(sum(line.units_sold) filter (where capture.quality = 'declared'), 0)::bigint as declared,
      coalesce(sum(line.units_sold) filter (where capture.quality = 'estimated'), 0)::bigint as estimated,
      coalesce(sum(line.units_sold) filter (where capture.quality = 'imported'), 0)::bigint as imported
    from captures capture
    left join public.sell_out_lines line on line.capture_id = capture.id
  ), panel as (
    select count(*)::bigint as total
    from public.brand_pharmacies relation
    where relation.brand_id = target_brand_id
      and relation.archived_at is null
      and relation.commercial_status in ('implanted','active','to_develop','dormant')
  ), observed as (
    select count(distinct brand_pharmacy_id)::bigint as total from captures
  ), sell_in_units_metric as (
    select coalesce(sum(item.quantity + item.free_quantity), 0)::bigint as units
    from public.orders orders
    join public.order_items item on item.order_id = orders.id
    where orders.brand_id = target_brand_id
      and orders.archived_at is null
      and orders.order_date::date between target_period_start and target_period_end
      and private.order_counts_for_activity(orders.order_status, orders.order_type, orders.net_amount_ht)
  ), sell_in_revenue_metric as (
    select coalesce(sum(orders.net_amount_ht), 0)::numeric as revenue
    from public.orders orders
    where orders.brand_id = target_brand_id
      and orders.archived_at is null
      and orders.order_date::date between target_period_start and target_period_end
      and private.order_counts_for_revenue(orders.order_status, orders.order_type, orders.net_amount_ht)
  )
  select
    (select count(*)::bigint from captures),
    observed.total,
    panel.total,
    case when panel.total = 0 then 0::numeric else round(observed.total::numeric * 100.0 / panel.total::numeric, 2) end,
    line_metrics.units,
    round(line_metrics.revenue, 2),
    sell_in_units_metric.units,
    round(sell_in_revenue_metric.revenue, 2),
    case when sell_in_units_metric.units = 0 then 0::numeric else round(line_metrics.units::numeric * 100.0 / sell_in_units_metric.units::numeric, 2) end,
    line_metrics.confirmed,
    line_metrics.declared,
    line_metrics.estimated,
    line_metrics.imported
  from line_metrics, panel, observed, sell_in_units_metric, sell_in_revenue_metric;
end;
$$;

grant execute on function public.save_sell_out_capture(uuid, uuid, uuid, public.sell_out_capture_method, date, date, text, numeric, text, jsonb, uuid) to authenticated;
grant execute on function public.save_sell_out_line(uuid, uuid, uuid, text, text, text, integer, numeric, integer, integer, integer, numeric) to authenticated;
grant execute on function public.add_sell_out_evidence(uuid, public.sell_out_evidence_kind, text, text, text, bigint, text, text) to authenticated;
grant execute on function public.submit_sell_out_capture(uuid) to authenticated;
grant execute on function public.validate_sell_out_capture(uuid, boolean, text) to authenticated;
grant execute on function public.archive_sell_out_capture(uuid) to authenticated;
grant execute on function public.get_sell_out_overview(uuid, date, date) to authenticated;
