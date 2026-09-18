-- P0 #162 — Audit express pharmacie / 4P+
-- One brand-scoped execution snapshot per visit, with history, evidence and
-- explicit next-action recommendations.

create table public.field_visit_audits (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.field_visits(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null,
  created_by uuid not null references public.users(id) on delete restrict,
  price_displayed boolean,
  displayed_price_ttc numeric(10,2),
  availability_status text not null default 'unknown'
    check (availability_status in ('available','low_stock','stockout','unknown')),
  stock_quantity integer check (stock_quantity is null or stock_quantity between 0 and 100000),
  stock_count_mode text not null default 'unknown'
    check (stock_count_mode in ('counted','estimated','unknown')),
  facings integer check (facings is null or facings between 0 and 1000),
  shelf_visibility text not null default 'unknown'
    check (shelf_visibility in ('high','medium','low','not_visible','unknown')),
  plv_present boolean,
  team_training_status text not null default 'unknown'
    check (team_training_status in ('trained','reinforce','not_trained','unknown')),
  tester_samples_status text not null default 'unknown'
    check (tester_samples_status in ('present','missing','not_applicable','unknown')),
  competition_visible boolean,
  competition_note text check (competition_note is null or char_length(competition_note) <= 1000),
  notes text check (notes is null or char_length(notes) <= 2000),
  recommendations text[] not null default '{}',
  audited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, brand_id),
  foreign key (visit_id, brand_id)
    references public.field_visit_brands(visit_id, brand_id) on delete cascade,
  foreign key (brand_pharmacy_id, brand_id)
    references public.brand_pharmacies(id, brand_id) on delete restrict,
  check (displayed_price_ttc is null or displayed_price_ttc between 0 and 10000)
);

create index field_visit_audits_relation_history_idx
  on public.field_visit_audits(brand_pharmacy_id, audited_at desc);

create index field_visit_audits_brand_history_idx
  on public.field_visit_audits(brand_id, audited_at desc);

alter table public.field_visit_audits enable row level security;
revoke all on public.field_visit_audits from public, anon;
grant select on public.field_visit_audits to authenticated;
grant all on public.field_visit_audits to service_role;

create policy field_visit_audits_select
on public.field_visit_audits for select to authenticated
using (
  private.can_access_brand_pharmacy(brand_pharmacy_id)
);

create table public.field_visit_audit_attachments (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.field_visit_audits(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  bucket_id text not null default 'audit-evidence',
  object_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (size_bytes > 0 and size_bytes <= 3145728),
  check (mime_type in ('image/jpeg','image/png','image/webp')),
  check (
    object_path = brand_id::text || '/' || audit_id::text || '/' || split_part(object_path, '/', 3)
  )
);

create index field_visit_audit_attachments_audit_idx
  on public.field_visit_audit_attachments(audit_id, created_at)
  where archived_at is null;

alter table public.field_visit_audit_attachments enable row level security;
revoke all on public.field_visit_audit_attachments from public, anon;
grant select, insert, update on public.field_visit_audit_attachments to authenticated;
grant all on public.field_visit_audit_attachments to service_role;

create policy field_visit_audit_attachments_select
on public.field_visit_audit_attachments for select to authenticated
using (
  archived_at is null
  and exists (
    select 1
    from public.field_visit_audits audit
    where audit.id = audit_id
      and audit.brand_id = brand_id
      and private.can_access_brand_pharmacy(audit.brand_pharmacy_id)
  )
);

create policy field_visit_audit_attachments_insert
on public.field_visit_audit_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.field_visit_audits audit
    where audit.id = audit_id
      and audit.brand_id = brand_id
      and audit.created_by = (select auth.uid())
      and private.can_access_brand_pharmacy(audit.brand_pharmacy_id)
  )
);

create policy field_visit_audit_attachments_update
on public.field_visit_audit_attachments for update to authenticated
using (
  uploaded_by = (select auth.uid())
  or private.has_elevated_brand_access(brand_id)
)
with check (
  exists (
    select 1
    from public.field_visit_audits audit
    where audit.id = audit_id
      and audit.brand_id = brand_id
      and private.can_access_brand_pharmacy(audit.brand_pharmacy_id)
  )
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'audit-evidence',
  'audit-evidence',
  false,
  3145728,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create or replace function private.can_access_audit_object(target_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  brand_text text := split_part(target_name, '/', 1);
  audit_text text := split_part(target_name, '/', 2);
begin
  if brand_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or audit_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.field_visit_audits audit
    where audit.id = audit_text::uuid
      and audit.brand_id = brand_text::uuid
      and private.can_access_brand_pharmacy(audit.brand_pharmacy_id)
  );
end;
$$;

create or replace function private.can_write_audit_object(target_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  brand_text text := split_part(target_name, '/', 1);
  audit_text text := split_part(target_name, '/', 2);
begin
  if brand_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or audit_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.field_visit_audits audit
    where audit.id = audit_text::uuid
      and audit.brand_id = brand_text::uuid
      and audit.created_by = (select auth.uid())
      and private.can_access_brand_pharmacy(audit.brand_pharmacy_id)
  );
end;
$$;

create policy audit_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'audit-evidence'
  and private.can_access_audit_object(name)
);

create policy audit_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'audit-evidence'
  and owner_id = (select auth.uid())::text
  and private.can_write_audit_object(name)
);

create policy audit_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'audit-evidence'
  and owner_id = (select auth.uid())::text
  and private.can_write_audit_object(name)
);

create or replace function public.save_field_visit_audit(
  target_visit_id uuid,
  target_brand_pharmacy_id uuid,
  audit_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_visit public.field_visits%rowtype;
  relation record;
  audit_id uuid;
  previous_audit_id uuid;
  recommendation_codes text[] := '{}';
  price_displayed_value boolean := nullif(audit_payload->>'price_displayed', '')::boolean;
  availability_value text := coalesce(nullif(audit_payload->>'availability_status', ''), 'unknown');
  stock_quantity_value integer := nullif(audit_payload->>'stock_quantity', '')::integer;
  stock_count_mode_value text := coalesce(nullif(audit_payload->>'stock_count_mode', ''), 'unknown');
  facings_value integer := nullif(audit_payload->>'facings', '')::integer;
  shelf_visibility_value text := coalesce(nullif(audit_payload->>'shelf_visibility', ''), 'unknown');
  plv_present_value boolean := nullif(audit_payload->>'plv_present', '')::boolean;
  team_training_value text := coalesce(nullif(audit_payload->>'team_training_status', ''), 'unknown');
  tester_samples_value text := coalesce(nullif(audit_payload->>'tester_samples_status', ''), 'unknown');
  competition_visible_value boolean := nullif(audit_payload->>'competition_visible', '')::boolean;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_visit
  from public.field_visits
  where id = target_visit_id
  for update;

  if target_visit.id is null
     or target_visit.archived_at is not null
     or target_visit.owner_user_id <> actor
     or target_visit.status not in ('planned','confirmed','in_progress','completed') then
    raise exception 'Visit unavailable' using errcode = '42501';
  end if;

  select
    fvb.brand_id,
    fvb.brand_pharmacy_id,
    bp.pharmacy_id
  into relation
  from public.field_visit_brands fvb
  join public.brand_pharmacies bp
    on bp.id = fvb.brand_pharmacy_id
   and bp.brand_id = fvb.brand_id
   and bp.archived_at is null
  where fvb.visit_id = target_visit_id
    and fvb.brand_pharmacy_id = target_brand_pharmacy_id;

  if relation.brand_id is null or relation.pharmacy_id <> target_visit.pharmacy_id then
    raise exception 'Brand pharmacy unavailable for this visit' using errcode = '42501';
  end if;

  if availability_value not in ('available','low_stock','stockout','unknown')
     or stock_count_mode_value not in ('counted','estimated','unknown')
     or shelf_visibility_value not in ('high','medium','low','not_visible','unknown')
     or team_training_value not in ('trained','reinforce','not_trained','unknown')
     or tester_samples_value not in ('present','missing','not_applicable','unknown') then
    raise exception 'Invalid audit value' using errcode = '23514';
  end if;

  if availability_value in ('low_stock','stockout') then
    recommendation_codes := array_append(recommendation_codes, 'reorder');
  end if;
  if price_displayed_value is false then
    recommendation_codes := array_append(recommendation_codes, 'price');
  end if;
  if plv_present_value is false then
    recommendation_codes := array_append(recommendation_codes, 'plv');
  end if;
  if team_training_value in ('reinforce','not_trained') then
    recommendation_codes := array_append(recommendation_codes, 'training');
  end if;
  if shelf_visibility_value in ('low','not_visible') or coalesce(facings_value, 1) = 0 then
    recommendation_codes := array_append(recommendation_codes, 'merchandising');
  end if;
  if competition_visible_value is true and team_training_value in ('reinforce','not_trained') then
    recommendation_codes := array_append(recommendation_codes, 'animation');
  end if;
  if competition_visible_value is true then
    recommendation_codes := array_append(recommendation_codes, 'follow_up');
  end if;

  select audit.id into previous_audit_id
  from public.field_visit_audits audit
  where audit.brand_pharmacy_id = target_brand_pharmacy_id
    and audit.visit_id <> target_visit_id
  order by audit.audited_at desc, audit.created_at desc
  limit 1;

  insert into public.field_visit_audits(
    visit_id,
    brand_id,
    brand_pharmacy_id,
    created_by,
    price_displayed,
    displayed_price_ttc,
    availability_status,
    stock_quantity,
    stock_count_mode,
    facings,
    shelf_visibility,
    plv_present,
    team_training_status,
    tester_samples_status,
    competition_visible,
    competition_note,
    notes,
    recommendations,
    audited_at,
    updated_at
  ) values (
    target_visit_id,
    relation.brand_id,
    target_brand_pharmacy_id,
    actor,
    price_displayed_value,
    case when price_displayed_value is true then nullif(audit_payload->>'displayed_price_ttc', '')::numeric else null end,
    availability_value,
    stock_quantity_value,
    stock_count_mode_value,
    facings_value,
    shelf_visibility_value,
    plv_present_value,
    team_training_value,
    tester_samples_value,
    competition_visible_value,
    nullif(btrim(audit_payload->>'competition_note'), ''),
    nullif(btrim(audit_payload->>'notes'), ''),
    recommendation_codes,
    now(),
    now()
  )
  on conflict (visit_id, brand_id) do update
  set
    price_displayed = excluded.price_displayed,
    displayed_price_ttc = excluded.displayed_price_ttc,
    availability_status = excluded.availability_status,
    stock_quantity = excluded.stock_quantity,
    stock_count_mode = excluded.stock_count_mode,
    facings = excluded.facings,
    shelf_visibility = excluded.shelf_visibility,
    plv_present = excluded.plv_present,
    team_training_status = excluded.team_training_status,
    tester_samples_status = excluded.tester_samples_status,
    competition_visible = excluded.competition_visible,
    competition_note = excluded.competition_note,
    notes = excluded.notes,
    recommendations = excluded.recommendations,
    audited_at = now(),
    updated_at = now()
  returning id into audit_id;

  return jsonb_build_object(
    'audit_id', audit_id,
    'previous_audit_id', previous_audit_id,
    'recommendations', to_jsonb(recommendation_codes)
  );
end;
$$;

revoke all on function public.save_field_visit_audit(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_field_visit_audit(uuid, uuid, jsonb) to authenticated, service_role;

comment on table public.field_visit_audits is
  'Brand-scoped 4P+ pharmacy execution snapshots recorded during a field visit. One snapshot per brand per visit preserves N vs N-1 history.';

comment on column public.field_visit_audits.recommendations is
  'Human-actionable recommendation codes derived deterministically from the audit snapshot; no automatic business action is created.';
