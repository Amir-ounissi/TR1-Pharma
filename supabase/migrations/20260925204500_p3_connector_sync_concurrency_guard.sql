-- P3 performance: prevent concurrent connector sync runs for the same scope.
-- Multiple agent page requests can otherwise start the same HubSpot inbound sync
-- before the previous run has completed, multiplying remote calls and DB load.

update public.connector_sync_runs
set
  status = 'cancelled',
  completed_at = coalesce(completed_at, now()),
  error_summary = coalesce(error_summary, 'Automatically cancelled as a stale connector sync run')
where status = 'running'
  and started_at < now() - interval '15 minutes';

create unique index if not exists connector_sync_runs_one_running_per_scope_idx
  on public.connector_sync_runs(connection_id, entity_type, direction)
  where status = 'running';

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

  select *
  into connection_record
  from public.connector_connections
  where id = target_connection_id
    and archived_at is null;

  if connection_record.id is null or connection_record.status <> 'active' then
    raise exception 'Connector connection must be active' using errcode = '55000';
  end if;

  -- A crashed serverless invocation must not block the scope forever.
  update public.connector_sync_runs
  set
    status = 'cancelled',
    completed_at = coalesce(completed_at, now()),
    error_summary = coalesce(error_summary, 'Automatically cancelled as a stale connector sync run')
  where connection_id = target_connection_id
    and entity_type = target_entity_type
    and direction = target_direction
    and status = 'running'
    and started_at < now() - interval '15 minutes';

  begin
    insert into public.connector_sync_runs(
      id, connection_id, entity_type, direction, status, cursor_before, started_at
    ) values (
      result_id, target_connection_id, target_entity_type, target_direction, 'running', target_cursor_before, now()
    );
  exception
    when unique_violation then
      raise exception 'Connector sync already running for this connection, entity and direction'
        using errcode = '55P03';
  end;

  return result_id;
end;
$$;

revoke all on function public.register_connector_sync_run(uuid,public.import_entity_type,text,text)
  from public, anon, authenticated;
grant execute on function public.register_connector_sync_run(uuid,public.import_entity_type,text,text)
  to service_role;

comment on index public.connector_sync_runs_one_running_per_scope_idx is
  'P3 guard: at most one active connector sync per connection/entity/direction.';
