create table public.connector_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  brand_id uuid not null,
  provider text not null,
  name text not null,
  status text not null default 'draft',
  credential_status text not null default 'missing',
  credential_reference text,
  external_account_id text,
  base_url text,
  configuration jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connector_connections_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint connector_connections_provider_check
    check (provider in ('hubspot','salesforce','dynamics','erp','generic_api')),
  constraint connector_connections_name_check
    check (char_length(btrim(name)) between 2 and 120),
  constraint connector_connections_status_check
    check (status in ('draft','ready','active','paused','error','archived')),
  constraint connector_connections_credential_status_check
    check (credential_status in ('missing','configured','expired')),
  constraint connector_connections_credential_reference_check
    check (credential_reference is null or char_length(btrim(credential_reference)) between 3 and 255),
  constraint connector_connections_external_account_check
    check (external_account_id is null or char_length(btrim(external_account_id)) <= 255),
  constraint connector_connections_base_url_check
    check (base_url is null or char_length(btrim(base_url)) <= 500),
  constraint connector_connections_configuration_check
    check (jsonb_typeof(configuration) = 'object' and octet_length(configuration::text) <= 32768),
  constraint connector_connections_last_error_check
    check (last_error is null or char_length(last_error) <= 4000)
);

create unique index connector_connections_name_unique
  on public.connector_connections(brand_id, lower(name))
  where archived_at is null;
create index connector_connections_brand_status_idx
  on public.connector_connections(brand_id, status, updated_at desc)
  where archived_at is null;

create table public.connector_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connector_connections(id) on delete cascade,
  organization_id uuid not null,
  brand_id uuid not null,
  entity_type public.import_entity_type not null,
  external_object text not null,
  direction text not null default 'inbound',
  mapping_profile_id uuid references public.data_mapping_profiles(id) on delete set null,
  conflict_strategy text not null default 'manual',
  cursor_field text,
  is_enabled boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connector_entity_mappings_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint connector_entity_mappings_external_object_check
    check (char_length(btrim(external_object)) between 1 and 160),
  constraint connector_entity_mappings_direction_check
    check (direction in ('inbound','outbound','bidirectional')),
  constraint connector_entity_mappings_conflict_strategy_check
    check (conflict_strategy in ('manual','external_wins','tr1_wins','newest_wins')),
  constraint connector_entity_mappings_cursor_field_check
    check (cursor_field is null or char_length(btrim(cursor_field)) <= 160)
);

create unique index connector_entity_mappings_scope_unique
  on public.connector_entity_mappings(connection_id, entity_type, direction, lower(external_object));
create index connector_entity_mappings_brand_idx
  on public.connector_entity_mappings(brand_id, is_enabled, updated_at desc);

create table public.connector_external_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connector_connections(id) on delete cascade,
  organization_id uuid not null,
  brand_id uuid not null,
  entity_type public.import_entity_type not null,
  external_id text not null,
  tr1_record_id uuid not null,
  external_updated_at timestamptz,
  tr1_updated_at timestamptz,
  sync_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connector_external_links_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint connector_external_links_external_id_check
    check (char_length(btrim(external_id)) between 1 and 512),
  constraint connector_external_links_sync_hash_check
    check (sync_hash is null or sync_hash ~ '^[0-9a-fA-F]{64}$')
);

create unique index connector_external_links_external_unique
  on public.connector_external_links(connection_id, entity_type, external_id);
create unique index connector_external_links_tr1_unique
  on public.connector_external_links(connection_id, entity_type, tr1_record_id);

create table public.connector_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connector_connections(id) on delete cascade,
  organization_id uuid not null,
  brand_id uuid not null,
  entity_type public.import_entity_type not null,
  direction text not null,
  status text not null default 'queued',
  cursor_before text,
  cursor_after text,
  records_seen integer not null default 0,
  records_succeeded integer not null default 0,
  records_failed integer not null default 0,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  initiated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint connector_sync_runs_brand_organization_fk
    foreign key (brand_id, organization_id)
    references public.brands(id, organization_id) on delete cascade,
  constraint connector_sync_runs_direction_check
    check (direction in ('inbound','outbound')),
  constraint connector_sync_runs_status_check
    check (status in ('queued','running','succeeded','partial','failed','cancelled')),
  constraint connector_sync_runs_counts_check
    check (records_seen >= 0 and records_succeeded >= 0 and records_failed >= 0),
  constraint connector_sync_runs_error_summary_check
    check (error_summary is null or char_length(error_summary) <= 4000),
  constraint connector_sync_runs_completion_check
    check (
      (status in ('queued','running') and completed_at is null)
      or (status in ('succeeded','partial','failed','cancelled') and completed_at is not null)
    )
);

create index connector_sync_runs_connection_idx
  on public.connector_sync_runs(connection_id, created_at desc);
create index connector_sync_runs_brand_idx
  on public.connector_sync_runs(brand_id, status, created_at desc);

create or replace function private.connector_configuration_has_secret(target_configuration jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(target_configuration::text) ~ '"(access_token|refresh_token|api_key|apikey|client_secret|password|secret|bearer_token)"[[:space:]]*:', false);
$$;

create or replace function private.is_service_role_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

create or replace function private.can_manage_connectors(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_brand_capability(target_brand_id, 'connectors')
    and (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin'])
    );
$$;

revoke all on function private.connector_configuration_has_secret(jsonb) from public, anon, authenticated;
revoke all on function private.is_service_role_request() from public, anon, authenticated;
revoke all on function private.can_manage_connectors(uuid) from public, anon, authenticated;
grant execute on function private.can_manage_connectors(uuid) to authenticated;

create or replace function private.prepare_connector_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id from public.brands where id = new.brand_id;
  if new.organization_id is null then
    raise exception 'Unknown brand' using errcode = '22023';
  end if;

  new.name := btrim(new.name);
  new.provider := lower(btrim(new.provider));
  new.credential_reference := nullif(btrim(new.credential_reference), '');
  new.external_account_id := nullif(btrim(new.external_account_id), '');
  new.base_url := nullif(btrim(new.base_url), '');
  new.last_error := nullif(btrim(new.last_error), '');

  if private.connector_configuration_has_secret(new.configuration) then
    raise exception 'Connector configuration cannot contain credentials or secrets' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger connector_connections_prepare
before insert or update on public.connector_connections
for each row execute function private.prepare_connector_connection();
create trigger connector_connections_updated_at
before update on public.connector_connections
for each row execute function private.set_updated_at();
create trigger audit_connector_connections
after insert or update or delete on public.connector_connections
for each row execute function private.audit_row_change();

create or replace function private.prepare_connector_entity_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
  profile_record public.data_mapping_profiles%rowtype;
begin
  select * into connection_record
  from public.connector_connections
  where id = new.connection_id and archived_at is null;
  if connection_record.id is null then
    raise exception 'Connector connection not found' using errcode = 'P0002';
  end if;

  new.organization_id := connection_record.organization_id;
  new.brand_id := connection_record.brand_id;
  new.external_object := btrim(new.external_object);
  new.cursor_field := nullif(btrim(new.cursor_field), '');

  if new.mapping_profile_id is not null then
    select * into profile_record
    from public.data_mapping_profiles
    where id = new.mapping_profile_id and is_active;
    if profile_record.id is null
       or profile_record.brand_id <> new.brand_id
       or profile_record.entity_type <> new.entity_type then
      raise exception 'Mapping profile must belong to the connector brand and entity type' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger connector_entity_mappings_prepare
before insert or update on public.connector_entity_mappings
for each row execute function private.prepare_connector_entity_mapping();
create trigger connector_entity_mappings_updated_at
before update on public.connector_entity_mappings
for each row execute function private.set_updated_at();
create trigger audit_connector_entity_mappings
after insert or update or delete on public.connector_entity_mappings
for each row execute function private.audit_row_change();

create or replace function private.prepare_connector_external_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
begin
  select * into connection_record from public.connector_connections where id = new.connection_id and archived_at is null;
  if connection_record.id is null then
    raise exception 'Connector connection not found' using errcode = 'P0002';
  end if;
  new.organization_id := connection_record.organization_id;
  new.brand_id := connection_record.brand_id;
  new.external_id := btrim(new.external_id);
  return new;
end;
$$;

create trigger connector_external_links_prepare
before insert or update on public.connector_external_links
for each row execute function private.prepare_connector_external_link();
create trigger connector_external_links_updated_at
before update on public.connector_external_links
for each row execute function private.set_updated_at();

create or replace function private.prepare_connector_sync_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
begin
  select * into connection_record from public.connector_connections where id = new.connection_id and archived_at is null;
  if connection_record.id is null then
    raise exception 'Connector connection not found' using errcode = 'P0002';
  end if;
  new.organization_id := connection_record.organization_id;
  new.brand_id := connection_record.brand_id;
  return new;
end;
$$;

create trigger connector_sync_runs_prepare
before insert or update on public.connector_sync_runs
for each row execute function private.prepare_connector_sync_run();

alter table public.connector_connections enable row level security;
alter table public.connector_entity_mappings enable row level security;
alter table public.connector_external_links enable row level security;
alter table public.connector_sync_runs enable row level security;

create policy connector_connections_select on public.connector_connections
for select to authenticated using (private.can_manage_connectors(brand_id));
create policy connector_entity_mappings_select on public.connector_entity_mappings
for select to authenticated using (private.can_manage_connectors(brand_id));
create policy connector_external_links_select on public.connector_external_links
for select to authenticated using (private.can_manage_connectors(brand_id));
create policy connector_sync_runs_select on public.connector_sync_runs
for select to authenticated using (private.can_manage_connectors(brand_id));

revoke all on public.connector_connections, public.connector_entity_mappings, public.connector_external_links, public.connector_sync_runs from public, anon, authenticated;
grant select on public.connector_connections, public.connector_entity_mappings, public.connector_external_links, public.connector_sync_runs to authenticated;
grant all on public.connector_connections, public.connector_entity_mappings, public.connector_external_links, public.connector_sync_runs to service_role;

create or replace function public.save_connector_connection(
  target_brand_id uuid,
  target_connection_id uuid,
  target_provider text,
  target_name text,
  target_external_account_id text default null,
  target_base_url text default null,
  target_credential_reference text default null,
  target_configuration jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid := coalesce(target_connection_id, gen_random_uuid());
  actor_id uuid := (select auth.uid());
begin
  if not private.can_manage_connectors(target_brand_id) then
    raise exception 'Connector administration access is required' using errcode = '42501';
  end if;
  if target_configuration is null or jsonb_typeof(target_configuration) <> 'object' then
    raise exception 'Connector configuration must be an object' using errcode = '22023';
  end if;
  if private.connector_configuration_has_secret(target_configuration) then
    raise exception 'Connector configuration cannot contain credentials or secrets' using errcode = '22023';
  end if;

  if target_connection_id is null then
    insert into public.connector_connections(
      id, brand_id, provider, name, external_account_id, base_url,
      credential_reference, credential_status, configuration, created_by, updated_by
    ) values (
      result_id, target_brand_id, target_provider, target_name, target_external_account_id, target_base_url,
      nullif(btrim(target_credential_reference), ''),
      case when nullif(btrim(target_credential_reference), '') is null then 'missing' else 'configured' end,
      target_configuration, actor_id, actor_id
    );
  else
    update public.connector_connections
    set provider = target_provider,
        name = target_name,
        external_account_id = target_external_account_id,
        base_url = target_base_url,
        credential_reference = nullif(btrim(target_credential_reference), ''),
        credential_status = case when nullif(btrim(target_credential_reference), '') is null then 'missing' else 'configured' end,
        configuration = target_configuration,
        updated_by = actor_id,
        last_error = null
    where id = target_connection_id and brand_id = target_brand_id and archived_at is null;
    if not found then
      raise exception 'Connector connection not found' using errcode = 'P0002';
    end if;
  end if;

  return result_id;
end;
$$;

create or replace function public.set_connector_connection_status(
  target_connection_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
begin
  select * into connection_record from public.connector_connections where id = target_connection_id and archived_at is null;
  if connection_record.id is null then
    raise exception 'Connector connection not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_connectors(connection_record.brand_id) then
    raise exception 'Connector administration access is required' using errcode = '42501';
  end if;
  if target_status not in ('draft','ready','active','paused','error') then
    raise exception 'Invalid connector status' using errcode = '22023';
  end if;
  if target_status = 'active' and connection_record.credential_status <> 'configured' then
    raise exception 'Connector credentials must be configured before activation' using errcode = '22023';
  end if;

  update public.connector_connections
  set status = target_status,
      last_error = case when target_status = 'error' then last_error else null end,
      updated_by = (select auth.uid())
  where id = target_connection_id;
end;
$$;

create or replace function public.archive_connector_connection(target_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
begin
  select * into connection_record from public.connector_connections where id = target_connection_id and archived_at is null;
  if connection_record.id is null then
    raise exception 'Connector connection not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_connectors(connection_record.brand_id) then
    raise exception 'Connector administration access is required' using errcode = '42501';
  end if;

  update public.connector_connections
  set status = 'archived', archived_at = now(), updated_by = (select auth.uid())
  where id = target_connection_id;
end;
$$;

create or replace function public.save_connector_entity_mapping(
  target_connection_id uuid,
  target_mapping_id uuid,
  target_entity_type public.import_entity_type,
  target_external_object text,
  target_direction text,
  target_mapping_profile_id uuid default null,
  target_conflict_strategy text default 'manual',
  target_cursor_field text default null,
  target_is_enabled boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
  result_id uuid := coalesce(target_mapping_id, gen_random_uuid());
begin
  select * into connection_record from public.connector_connections where id = target_connection_id and archived_at is null;
  if connection_record.id is null then
    raise exception 'Connector connection not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_connectors(connection_record.brand_id) then
    raise exception 'Connector administration access is required' using errcode = '42501';
  end if;

  if target_mapping_id is null then
    insert into public.connector_entity_mappings(
      id, connection_id, entity_type, external_object, direction, mapping_profile_id,
      conflict_strategy, cursor_field, is_enabled, created_by, updated_by
    ) values (
      result_id, target_connection_id, target_entity_type, target_external_object, target_direction,
      target_mapping_profile_id, target_conflict_strategy, target_cursor_field, target_is_enabled,
      (select auth.uid()), (select auth.uid())
    );
  else
    update public.connector_entity_mappings
    set entity_type = target_entity_type,
        external_object = target_external_object,
        direction = target_direction,
        mapping_profile_id = target_mapping_profile_id,
        conflict_strategy = target_conflict_strategy,
        cursor_field = target_cursor_field,
        is_enabled = target_is_enabled,
        updated_by = (select auth.uid())
    where id = target_mapping_id and connection_id = target_connection_id;
    if not found then
      raise exception 'Connector entity mapping not found' using errcode = 'P0002';
    end if;
  end if;
  return result_id;
end;
$$;

create or replace function public.register_connector_sync_run(
  target_connection_id uuid,
  target_entity_type public.import_entity_type,
  target_direction text,
  target_cursor_before text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.connector_connections%rowtype;
  result_id uuid := gen_random_uuid();
begin
  if not private.is_service_role_request() then
    raise exception 'Connector sync registration is reserved to the trusted backend' using errcode = '42501';
  end if;
  select * into connection_record from public.connector_connections where id = target_connection_id and archived_at is null;
  if connection_record.id is null or connection_record.status <> 'active' then
    raise exception 'Connector connection must be active' using errcode = '55000';
  end if;

  insert into public.connector_sync_runs(
    id, connection_id, entity_type, direction, status, cursor_before, started_at
  ) values (
    result_id, target_connection_id, target_entity_type, target_direction, 'running', target_cursor_before, now()
  );
  return result_id;
end;
$$;

create or replace function public.complete_connector_sync_run(
  target_run_id uuid,
  target_status text,
  target_records_seen integer,
  target_records_succeeded integer,
  target_records_failed integer,
  target_cursor_after text default null,
  target_error_summary text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_role_request() then
    raise exception 'Connector sync completion is reserved to the trusted backend' using errcode = '42501';
  end if;
  if target_status not in ('succeeded','partial','failed','cancelled') then
    raise exception 'Invalid terminal sync status' using errcode = '22023';
  end if;
  if least(target_records_seen, target_records_succeeded, target_records_failed) < 0
     or target_records_succeeded + target_records_failed > target_records_seen then
    raise exception 'Invalid connector sync counters' using errcode = '22023';
  end if;

  update public.connector_sync_runs
  set status = target_status,
      records_seen = target_records_seen,
      records_succeeded = target_records_succeeded,
      records_failed = target_records_failed,
      cursor_after = nullif(btrim(target_cursor_after), ''),
      error_summary = nullif(btrim(target_error_summary), ''),
      completed_at = now()
  where id = target_run_id and status in ('queued','running');
  if not found then
    raise exception 'Connector sync run not found or already completed' using errcode = 'P0002';
  end if;

  update public.connector_connections connection
  set last_synced_at = case when target_status in ('succeeded','partial') then now() else connection.last_synced_at end,
      last_error = case when target_status = 'failed' then nullif(btrim(target_error_summary), '') else null end,
      status = case when target_status = 'failed' then 'error' else connection.status end
  from public.connector_sync_runs run
  where run.id = target_run_id and connection.id = run.connection_id;
end;
$$;

create or replace function public.upsert_connector_external_link(
  target_connection_id uuid,
  target_entity_type public.import_entity_type,
  target_external_id text,
  target_tr1_record_id uuid,
  target_external_updated_at timestamptz default null,
  target_tr1_updated_at timestamptz default null,
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
    raise exception 'Connector identity linking is reserved to the trusted backend' using errcode = '42501';
  end if;
  if nullif(btrim(target_external_id), '') is null then
    raise exception 'External identifier is required' using errcode = '22023';
  end if;

  insert into public.connector_external_links(
    connection_id, entity_type, external_id, tr1_record_id,
    external_updated_at, tr1_updated_at, sync_hash
  ) values (
    target_connection_id, target_entity_type, btrim(target_external_id), target_tr1_record_id,
    target_external_updated_at, target_tr1_updated_at, target_sync_hash
  )
  on conflict (connection_id, entity_type, external_id) do update set
    tr1_record_id = excluded.tr1_record_id,
    external_updated_at = excluded.external_updated_at,
    tr1_updated_at = excluded.tr1_updated_at,
    sync_hash = excluded.sync_hash
  returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.save_connector_connection(uuid,uuid,text,text,text,text,text,jsonb) from public, anon;
revoke all on function public.set_connector_connection_status(uuid,text) from public, anon;
revoke all on function public.archive_connector_connection(uuid) from public, anon;
revoke all on function public.save_connector_entity_mapping(uuid,uuid,public.import_entity_type,text,text,uuid,text,text,boolean) from public, anon;
revoke all on function public.register_connector_sync_run(uuid,public.import_entity_type,text,text) from public, anon, authenticated;
revoke all on function public.complete_connector_sync_run(uuid,text,integer,integer,integer,text,text) from public, anon, authenticated;
revoke all on function public.upsert_connector_external_link(uuid,public.import_entity_type,text,uuid,timestamptz,timestamptz,text) from public, anon, authenticated;

grant execute on function public.save_connector_connection(uuid,uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.set_connector_connection_status(uuid,text) to authenticated;
grant execute on function public.archive_connector_connection(uuid) to authenticated;
grant execute on function public.save_connector_entity_mapping(uuid,uuid,public.import_entity_type,text,text,uuid,text,text,boolean) to authenticated;
grant execute on function public.register_connector_sync_run(uuid,public.import_entity_type,text,text) to service_role;
grant execute on function public.complete_connector_sync_run(uuid,text,integer,integer,integer,text,text) to service_role;
grant execute on function public.upsert_connector_external_link(uuid,public.import_entity_type,text,uuid,timestamptz,timestamptz,text) to service_role;
