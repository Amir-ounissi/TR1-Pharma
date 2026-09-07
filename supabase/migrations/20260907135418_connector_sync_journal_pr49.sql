create table public.connector_external_child_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connector_connections(id) on delete cascade,
  organization_id uuid not null,
  brand_id uuid not null,
  parent_entity_type public.import_entity_type not null,
  parent_tr1_record_id uuid not null,
  child_type text not null,
  child_key text not null,
  external_id text not null,
  external_updated_at timestamptz,
  sync_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connector_external_child_links_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint connector_external_child_links_child_type_check
    check (child_type in ('line_item')),
  constraint connector_external_child_links_child_key_check
    check (char_length(btrim(child_key)) between 1 and 512),
  constraint connector_external_child_links_external_id_check
    check (char_length(btrim(external_id)) between 1 and 512),
  constraint connector_external_child_links_sync_hash_check
    check (sync_hash is null or sync_hash ~ '^[0-9a-fA-F]{64}$')
);

create unique index connector_external_child_links_key_unique
  on public.connector_external_child_links(connection_id, parent_entity_type, parent_tr1_record_id, child_type, child_key);
create unique index connector_external_child_links_external_unique
  on public.connector_external_child_links(connection_id, child_type, external_id);

create table public.connector_sync_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.connector_sync_runs(id) on delete cascade,
  connection_id uuid not null references public.connector_connections(id) on delete cascade,
  organization_id uuid not null,
  brand_id uuid not null,
  entity_type public.import_entity_type not null,
  tr1_record_id uuid,
  child_key text,
  event_type text not null,
  status text not null,
  attempt integer not null default 1,
  external_id text,
  provider_status integer,
  provider_request_id text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint connector_sync_events_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint connector_sync_events_event_type_check
    check (event_type in ('create','update','associate','skip','retry','error')),
  constraint connector_sync_events_status_check
    check (status in ('planned','succeeded','failed')),
  constraint connector_sync_events_attempt_check check (attempt between 1 and 20),
  constraint connector_sync_events_provider_status_check
    check (provider_status is null or provider_status between 100 and 599),
  constraint connector_sync_events_child_key_check
    check (child_key is null or char_length(btrim(child_key)) between 1 and 512),
  constraint connector_sync_events_external_id_check
    check (external_id is null or char_length(btrim(external_id)) between 1 and 512),
  constraint connector_sync_events_provider_request_id_check
    check (provider_request_id is null or char_length(provider_request_id) <= 255),
  constraint connector_sync_events_error_code_check
    check (error_code is null or char_length(error_code) <= 120),
  constraint connector_sync_events_error_message_check
    check (error_message is null or char_length(error_message) <= 2000),
  constraint connector_sync_events_metadata_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384)
);

create index connector_sync_events_run_idx on public.connector_sync_events(run_id, id);
create index connector_sync_events_connection_error_idx
  on public.connector_sync_events(connection_id, created_at desc)
  where status = 'failed';

create or replace function private.prepare_connector_child_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
begin
  select * into connection_record
  from public.connector_connections
  where id = new.connection_id and archived_at is null;
  if connection_record.id is null then
    raise exception 'Connector connection not found' using errcode = 'P0002';
  end if;
  new.organization_id := connection_record.organization_id;
  new.brand_id := connection_record.brand_id;
  new.child_type := lower(btrim(new.child_type));
  new.child_key := btrim(new.child_key);
  new.external_id := btrim(new.external_id);
  return new;
end;
$$;

create trigger connector_external_child_links_prepare
before insert or update on public.connector_external_child_links
for each row execute function private.prepare_connector_child_link();
create trigger connector_external_child_links_updated_at
before update on public.connector_external_child_links
for each row execute function private.set_updated_at();

create or replace function private.prepare_connector_sync_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record public.connector_sync_runs%rowtype;
begin
  select * into run_record from public.connector_sync_runs where id = new.run_id;
  if run_record.id is null then
    raise exception 'Connector sync run not found' using errcode = 'P0002';
  end if;
  if new.connection_id <> run_record.connection_id or new.entity_type <> run_record.entity_type then
    raise exception 'Connector sync event scope mismatch' using errcode = '23514';
  end if;
  new.organization_id := run_record.organization_id;
  new.brand_id := run_record.brand_id;
  new.provider_request_id := nullif(btrim(new.provider_request_id), '');
  new.error_code := nullif(btrim(new.error_code), '');
  new.error_message := nullif(btrim(new.error_message), '');
  new.external_id := nullif(btrim(new.external_id), '');
  new.child_key := nullif(btrim(new.child_key), '');
  return new;
end;
$$;

create trigger connector_sync_events_prepare
before insert on public.connector_sync_events
for each row execute function private.prepare_connector_sync_event();

alter table public.connector_external_child_links enable row level security;
alter table public.connector_sync_events enable row level security;

create policy connector_external_child_links_select on public.connector_external_child_links
for select to authenticated using (private.can_manage_connectors(brand_id));
create policy connector_sync_events_select on public.connector_sync_events
for select to authenticated using (private.can_manage_connectors(brand_id));

revoke all on public.connector_external_child_links, public.connector_sync_events from public, anon, authenticated;
grant select on public.connector_external_child_links, public.connector_sync_events to authenticated;
grant all on public.connector_external_child_links, public.connector_sync_events to service_role;

create or replace function public.upsert_connector_external_child_link(
  target_connection_id uuid,
  target_parent_entity_type public.import_entity_type,
  target_parent_tr1_record_id uuid,
  target_child_type text,
  target_child_key text,
  target_external_id text,
  target_external_updated_at timestamptz default null,
  target_sync_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
begin
  if not private.is_service_role_request() then
    raise exception 'Connector runtime service access is required' using errcode = '42501';
  end if;

  insert into public.connector_external_child_links(
    connection_id, parent_entity_type, parent_tr1_record_id, child_type, child_key,
    external_id, external_updated_at, sync_hash
  ) values (
    target_connection_id, target_parent_entity_type, target_parent_tr1_record_id,
    target_child_type, target_child_key, target_external_id, target_external_updated_at, target_sync_hash
  )
  on conflict (connection_id, parent_entity_type, parent_tr1_record_id, child_type, child_key)
  do update set
    external_id = excluded.external_id,
    external_updated_at = excluded.external_updated_at,
    sync_hash = excluded.sync_hash,
    updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.record_connector_sync_event(
  target_run_id uuid,
  target_connection_id uuid,
  target_entity_type public.import_entity_type,
  target_tr1_record_id uuid,
  target_child_key text,
  target_event_type text,
  target_status text,
  target_attempt integer default 1,
  target_external_id text default null,
  target_provider_status integer default null,
  target_provider_request_id text default null,
  target_error_code text default null,
  target_error_message text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id bigint;
begin
  if not private.is_service_role_request() then
    raise exception 'Connector runtime service access is required' using errcode = '42501';
  end if;

  insert into public.connector_sync_events(
    run_id, connection_id, entity_type, tr1_record_id, child_key,
    event_type, status, attempt, external_id, provider_status,
    provider_request_id, error_code, error_message, metadata
  ) values (
    target_run_id, target_connection_id, target_entity_type, target_tr1_record_id, target_child_key,
    target_event_type, target_status, target_attempt, target_external_id, target_provider_status,
    target_provider_request_id, target_error_code, target_error_message, coalesce(target_metadata, '{}'::jsonb)
  ) returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.upsert_connector_external_child_link(uuid,public.import_entity_type,uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.record_connector_sync_event(uuid,uuid,public.import_entity_type,uuid,text,text,text,integer,text,integer,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.upsert_connector_external_child_link(uuid,public.import_entity_type,uuid,text,text,text,timestamptz,text) to service_role;
grant execute on function public.record_connector_sync_event(uuid,uuid,public.import_entity_type,uuid,text,text,text,integer,text,integer,text,text,text,jsonb) to service_role;
