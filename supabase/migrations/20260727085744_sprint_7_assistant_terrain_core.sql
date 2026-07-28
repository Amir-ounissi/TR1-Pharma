alter type public.product_event_name add value if not exists 'assistant_opened';
alter type public.product_event_name add value if not exists 'assistant_message_sent';
alter type public.product_event_name add value if not exists 'assistant_intent_resolved';
alter type public.product_event_name add value if not exists 'assistant_clarification_requested';
alter type public.product_event_name add value if not exists 'assistant_pharmacy_disambiguation_requested';
alter type public.product_event_name add value if not exists 'assistant_draft_created';
alter type public.product_event_name add value if not exists 'assistant_draft_modified';
alter type public.product_event_name add value if not exists 'assistant_draft_confirmed';
alter type public.product_event_name add value if not exists 'assistant_draft_cancelled';
alter type public.product_event_name add value if not exists 'assistant_action_failed';

create type public.assistant_action_type as enum (
  'interaction',
  'task',
  'interaction_with_next_action'
);

create type public.assistant_draft_status as enum (
  'pending',
  'confirmed',
  'cancelled',
  'expired',
  'failed'
);

create type public.assistant_audit_event as enum (
  'message_received',
  'intent_resolved',
  'clarification_requested',
  'tool_called',
  'draft_created',
  'draft_modified',
  'draft_confirmed',
  'draft_cancelled',
  'action_created',
  'error'
);

create table public.assistant_action_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  pharmacy_id uuid references public.pharmacies(id) on delete restrict,
  brand_pharmacy_id uuid references public.brand_pharmacies(id) on delete restrict,
  action_type public.assistant_action_type not null,
  payload jsonb not null,
  status public.assistant_draft_status not null default 'pending',
  confidence numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  executed_action_id uuid,
  error_message text,
  constraint assistant_drafts_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint assistant_drafts_payload_check check (
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384
  ),
  constraint assistant_drafts_expiration_check check (expires_at > created_at),
  constraint assistant_drafts_pharmacy_pair_check check (
    (pharmacy_id is null and brand_pharmacy_id is null)
    or (pharmacy_id is not null and brand_pharmacy_id is not null)
  ),
  constraint assistant_drafts_state_timestamps_check check (
    (status <> 'confirmed' or confirmed_at is not null)
    and (status <> 'cancelled' or cancelled_at is not null)
  )
);

create table public.assistant_contexts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  active_pharmacy_id uuid references public.pharmacies(id) on delete set null,
  active_brand_pharmacy_id uuid references public.brand_pharmacies(id) on delete set null,
  last_intent text,
  pending_draft_id uuid references public.assistant_action_drafts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  unique (user_id, brand_id),
  constraint assistant_context_intent_check check (last_intent is null or char_length(last_intent) <= 80),
  constraint assistant_context_expiration_check check (expires_at > updated_at)
);

create table public.assistant_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  pharmacy_id uuid references public.pharmacies(id) on delete set null,
  draft_id uuid references public.assistant_action_drafts(id) on delete set null,
  event_name public.assistant_audit_event not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint assistant_audit_metadata_check check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096
  )
);

create index assistant_drafts_owner_status_idx
  on public.assistant_action_drafts(user_id, brand_id, status, expires_at desc);
create index assistant_drafts_tenant_idx
  on public.assistant_action_drafts(organization_id, brand_id, created_at desc);
create index assistant_contexts_expiration_idx
  on public.assistant_contexts(expires_at);
create index assistant_audit_owner_time_idx
  on public.assistant_audit_logs(user_id, occurred_at desc);
create index assistant_audit_brand_time_idx
  on public.assistant_audit_logs(brand_id, occurred_at desc);

alter table public.assistant_action_drafts enable row level security;
alter table public.assistant_contexts enable row level security;
alter table public.assistant_audit_logs enable row level security;

revoke all on public.assistant_action_drafts, public.assistant_contexts, public.assistant_audit_logs from anon, authenticated;
grant select on public.assistant_action_drafts, public.assistant_contexts, public.assistant_audit_logs to authenticated;
grant all on public.assistant_action_drafts, public.assistant_contexts, public.assistant_audit_logs to service_role;
grant usage, select on sequence public.assistant_audit_logs_id_seq to service_role;
grant usage on type public.assistant_action_type, public.assistant_draft_status, public.assistant_audit_event to authenticated, service_role;

create policy assistant_drafts_select on public.assistant_action_drafts
for select to authenticated
using (
  user_id = (select auth.uid())
  and private.can_access_brand(brand_id)
);

create policy assistant_contexts_select on public.assistant_contexts
for select to authenticated
using (
  user_id = (select auth.uid())
  and private.can_access_brand(brand_id)
);

create policy assistant_audit_select on public.assistant_audit_logs
for select to authenticated
using (
  user_id = (select auth.uid())
  and private.can_access_brand(brand_id)
);

create or replace function private.validate_assistant_payload(
  target_action_type public.assistant_action_type,
  target_payload jsonb
)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(target_payload) <> 'object' or octet_length(target_payload::text) > 16384 then
    raise exception 'Assistant payload invalid' using errcode = '22023';
  end if;

  if target_action_type in ('interaction', 'interaction_with_next_action') then
    perform (target_payload ->> 'interaction_type')::public.interaction_type;
    perform (target_payload ->> 'outcome')::public.interaction_outcome;
    if nullif(btrim(target_payload ->> 'subject'), '') is null
      or char_length(target_payload ->> 'subject') > 160
      or nullif(btrim(target_payload ->> 'notes'), '') is null
      or char_length(target_payload ->> 'notes') > 1000 then
      raise exception 'Assistant interaction payload invalid' using errcode = '23514';
    end if;
    if target_action_type = 'interaction_with_next_action' then
      perform (target_payload ->> 'next_action_type')::public.commercial_task_type;
      perform (target_payload ->> 'next_action_at')::timestamptz;
    end if;
  elsif target_action_type = 'task' then
    perform (target_payload ->> 'task_type')::public.commercial_task_type;
    perform coalesce(nullif(target_payload ->> 'priority', ''), 'normal')::public.task_priority;
    perform (target_payload ->> 'due_at')::timestamptz;
    if nullif(btrim(target_payload ->> 'title'), '') is null
      or char_length(target_payload ->> 'title') > 160
      or char_length(coalesce(target_payload ->> 'description', '')) > 1000 then
      raise exception 'Assistant task payload invalid' using errcode = '23514';
    end if;
  end if;
end;
$$;

create or replace function private.insert_assistant_audit(
  target_organization_id uuid,
  target_brand_id uuid,
  target_user_id uuid,
  target_pharmacy_id uuid,
  target_draft_id uuid,
  target_event public.assistant_audit_event,
  target_metadata jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare target_id bigint;
begin
  if target_user_id is null
    or jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(target_metadata, '{}'::jsonb)::text) > 4096 then
    raise exception 'Assistant audit invalid' using errcode = '22023';
  end if;
  insert into public.assistant_audit_logs (
    organization_id, brand_id, user_id, pharmacy_id, draft_id, event_name, metadata
  ) values (
    target_organization_id, target_brand_id, target_user_id, target_pharmacy_id,
    target_draft_id, target_event, coalesce(target_metadata, '{}'::jsonb)
  ) returning id into target_id;
  return target_id;
end;
$$;

create or replace function public.record_assistant_audit(
  target_brand_id uuid,
  target_event public.assistant_audit_event,
  target_pharmacy_id uuid default null,
  target_draft_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  target_organization_id uuid;
begin
  if target_user_id is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Assistant audit forbidden' using errcode = '42501';
  end if;
  select organization_id into target_organization_id from public.brands where id = target_brand_id;
  if target_pharmacy_id is not null and not exists (
    select 1 from public.brand_pharmacies bp
    where bp.brand_id = target_brand_id
      and bp.pharmacy_id = target_pharmacy_id
      and bp.archived_at is null
      and private.can_access_brand_pharmacy(bp.id)
  ) then
    raise exception 'Assistant audit pharmacy forbidden' using errcode = '42501';
  end if;
  if target_draft_id is not null and not exists (
    select 1 from public.assistant_action_drafts d
    where d.id = target_draft_id and d.user_id = target_user_id and d.brand_id = target_brand_id
  ) then
    raise exception 'Assistant audit draft forbidden' using errcode = '42501';
  end if;
  return private.insert_assistant_audit(
    target_organization_id, target_brand_id, target_user_id, target_pharmacy_id,
    target_draft_id, target_event, target_metadata
  );
end;
$$;

create or replace function public.create_assistant_draft(
  target_brand_id uuid,
  target_brand_pharmacy_id uuid,
  target_action_type public.assistant_action_type,
  target_payload jsonb,
  target_confidence numeric default null
)
returns public.assistant_action_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  target_organization_id uuid;
  target_pharmacy_id uuid;
  trusted_payload jsonb;
  created_draft public.assistant_action_drafts;
begin
  if target_user_id is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Assistant draft forbidden' using errcode = '42501';
  end if;
  select b.organization_id into target_organization_id from public.brands b where b.id = target_brand_id;
  select bp.pharmacy_id into target_pharmacy_id
  from public.brand_pharmacies bp
  where bp.id = target_brand_pharmacy_id
    and bp.brand_id = target_brand_id
    and bp.archived_at is null
    and private.can_access_brand_pharmacy(bp.id);
  if target_pharmacy_id is null then
    raise exception 'Assistant pharmacy forbidden' using errcode = '42501';
  end if;
  if target_confidence is not null and (target_confidence < 0 or target_confidence > 1) then
    raise exception 'Assistant confidence invalid' using errcode = '22023';
  end if;
  trusted_payload := (coalesce(target_payload, '{}'::jsonb) - 'brand_id' - 'pharmacy_id' - 'brand_pharmacy_id')
    || jsonb_build_object(
      'brand_id', target_brand_id,
      'pharmacy_id', target_pharmacy_id,
      'brand_pharmacy_id', target_brand_pharmacy_id
    );
  perform private.validate_assistant_payload(target_action_type, trusted_payload);
  insert into public.assistant_action_drafts (
    organization_id, brand_id, user_id, pharmacy_id, brand_pharmacy_id,
    action_type, payload, confidence
  ) values (
    target_organization_id, target_brand_id, target_user_id, target_pharmacy_id,
    target_brand_pharmacy_id, target_action_type, trusted_payload, target_confidence
  ) returning * into created_draft;
  perform private.insert_assistant_audit(
    target_organization_id, target_brand_id, target_user_id, target_pharmacy_id,
    created_draft.id, 'draft_created', jsonb_build_object('action_type', target_action_type)
  );
  return created_draft;
end;
$$;

create or replace function public.update_assistant_draft(
  target_draft_id uuid,
  target_brand_pharmacy_id uuid,
  target_payload jsonb
)
returns public.assistant_action_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  existing_draft public.assistant_action_drafts;
  target_pharmacy_id uuid;
  trusted_payload jsonb;
begin
  select * into existing_draft
  from public.assistant_action_drafts d
  where d.id = target_draft_id and d.user_id = target_user_id
  for update;
  if existing_draft.id is null or not private.can_access_brand(existing_draft.brand_id) then
    raise exception 'Assistant draft forbidden' using errcode = '42501';
  end if;
  if existing_draft.status <> 'pending' or existing_draft.expires_at <= now() then
    raise exception 'Assistant draft is not editable' using errcode = '55000';
  end if;
  select bp.pharmacy_id into target_pharmacy_id
  from public.brand_pharmacies bp
  where bp.id = target_brand_pharmacy_id
    and bp.brand_id = existing_draft.brand_id
    and bp.archived_at is null
    and private.can_access_brand_pharmacy(bp.id);
  if target_pharmacy_id is null then
    raise exception 'Assistant pharmacy forbidden' using errcode = '42501';
  end if;
  trusted_payload := (coalesce(target_payload, '{}'::jsonb) - 'brand_id' - 'pharmacy_id' - 'brand_pharmacy_id')
    || jsonb_build_object(
      'brand_id', existing_draft.brand_id,
      'pharmacy_id', target_pharmacy_id,
      'brand_pharmacy_id', target_brand_pharmacy_id
    );
  perform private.validate_assistant_payload(existing_draft.action_type, trusted_payload);
  update public.assistant_action_drafts set
    pharmacy_id = target_pharmacy_id,
    brand_pharmacy_id = target_brand_pharmacy_id,
    payload = trusted_payload,
    updated_at = now(),
    error_message = null
  where id = target_draft_id
  returning * into existing_draft;
  perform private.insert_assistant_audit(
    existing_draft.organization_id, existing_draft.brand_id, target_user_id,
    target_pharmacy_id, existing_draft.id, 'draft_modified',
    jsonb_build_object('action_type', existing_draft.action_type)
  );
  return existing_draft;
end;
$$;

create or replace function public.cancel_assistant_draft(target_draft_id uuid)
returns public.assistant_action_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  existing_draft public.assistant_action_drafts;
begin
  select * into existing_draft
  from public.assistant_action_drafts d
  where d.id = target_draft_id and d.user_id = target_user_id
  for update;
  if existing_draft.id is null or not private.can_access_brand(existing_draft.brand_id) then
    raise exception 'Assistant draft forbidden' using errcode = '42501';
  end if;
  if existing_draft.status = 'cancelled' then
    return existing_draft;
  end if;
  if existing_draft.status <> 'pending' then
    raise exception 'Assistant draft cannot be cancelled' using errcode = '55000';
  end if;
  update public.assistant_action_drafts set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where id = target_draft_id
  returning * into existing_draft;
  perform private.insert_assistant_audit(
    existing_draft.organization_id, existing_draft.brand_id, target_user_id,
    existing_draft.pharmacy_id, existing_draft.id, 'draft_cancelled', '{}'::jsonb
  );
  return existing_draft;
end;
$$;

create or replace function public.confirm_assistant_draft(target_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  existing_draft public.assistant_action_drafts;
  action_id uuid;
  failure_message text;
begin
  select * into existing_draft
  from public.assistant_action_drafts d
  where d.id = target_draft_id and d.user_id = target_user_id
  for update;
  if existing_draft.id is null or not private.can_access_brand(existing_draft.brand_id) then
    raise exception 'Assistant draft forbidden' using errcode = '42501';
  end if;
  if existing_draft.status = 'confirmed' then
    return jsonb_build_object(
      'status', existing_draft.status,
      'action_id', existing_draft.executed_action_id,
      'already_confirmed', true
    );
  end if;
  if existing_draft.status <> 'pending' then
    raise exception 'Assistant draft cannot be confirmed' using errcode = '55000';
  end if;
  if existing_draft.expires_at <= now() then
    update public.assistant_action_drafts set status = 'expired', updated_at = now()
    where id = target_draft_id returning * into existing_draft;
    return jsonb_build_object('status', 'expired', 'action_id', null, 'already_confirmed', false);
  end if;
  if not private.can_access_brand_pharmacy(existing_draft.brand_pharmacy_id)
    or not exists (
      select 1 from public.brand_pharmacies bp
      where bp.id = existing_draft.brand_pharmacy_id
        and bp.brand_id = existing_draft.brand_id
        and bp.pharmacy_id = existing_draft.pharmacy_id
        and bp.archived_at is null
    ) then
    raise exception 'Assistant pharmacy forbidden' using errcode = '42501';
  end if;
  perform private.validate_assistant_payload(existing_draft.action_type, existing_draft.payload);

  begin
    if existing_draft.action_type in ('interaction', 'interaction_with_next_action') then
      action_id := public.create_commercial_interaction(
        existing_draft.brand_pharmacy_id,
        (existing_draft.payload ->> 'interaction_type')::public.interaction_type,
        (existing_draft.payload ->> 'outcome')::public.interaction_outcome,
        existing_draft.payload ->> 'subject',
        existing_draft.payload ->> 'notes',
        'shared',
        null,
        coalesce((existing_draft.payload ->> 'occurred_at')::timestamptz, now()),
        null,
        case when existing_draft.action_type = 'interaction_with_next_action'
          then (existing_draft.payload ->> 'next_action_type')::public.commercial_task_type end,
        case when existing_draft.action_type = 'interaction_with_next_action'
          then (existing_draft.payload ->> 'next_action_at')::timestamptz end,
        case when existing_draft.action_type = 'interaction_with_next_action'
          then target_user_id end
      );
    elsif existing_draft.action_type = 'task' then
      action_id := public.create_agent_task(
        existing_draft.brand_pharmacy_id,
        (existing_draft.payload ->> 'task_type')::public.commercial_task_type,
        existing_draft.payload ->> 'title',
        (existing_draft.payload ->> 'due_at')::timestamptz,
        coalesce(nullif(existing_draft.payload ->> 'priority', ''), 'normal')::public.task_priority,
        nullif(existing_draft.payload ->> 'description', '')
      );
    end if;
  exception when others then
    failure_message := left(sqlerrm, 500);
  end;

  if failure_message is not null then
    update public.assistant_action_drafts set
      status = 'failed',
      error_message = failure_message,
      updated_at = now()
    where id = target_draft_id;
    perform private.insert_assistant_audit(
      existing_draft.organization_id, existing_draft.brand_id, target_user_id,
      existing_draft.pharmacy_id, existing_draft.id, 'error',
      jsonb_build_object('stage', 'confirmation', 'message', failure_message)
    );
    return jsonb_build_object(
      'status', 'failed',
      'action_id', null,
      'already_confirmed', false,
      'error', failure_message
    );
  end if;

  update public.assistant_action_drafts set
    status = 'confirmed',
    confirmed_at = now(),
    executed_action_id = action_id,
    updated_at = now(),
    error_message = null
  where id = target_draft_id;
  perform private.insert_assistant_audit(
    existing_draft.organization_id, existing_draft.brand_id, target_user_id,
    existing_draft.pharmacy_id, existing_draft.id, 'draft_confirmed',
    jsonb_build_object('action_id', action_id, 'action_type', existing_draft.action_type)
  );
  perform private.insert_assistant_audit(
    existing_draft.organization_id, existing_draft.brand_id, target_user_id,
    existing_draft.pharmacy_id, existing_draft.id, 'action_created',
    jsonb_build_object('action_id', action_id)
  );
  return jsonb_build_object(
    'status', 'confirmed',
    'action_id', action_id,
    'already_confirmed', false
  );
end;
$$;

create or replace function public.set_assistant_context(
  target_brand_id uuid,
  target_brand_pharmacy_id uuid default null,
  target_last_intent text default null,
  target_pending_draft_id uuid default null
)
returns public.assistant_contexts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  target_organization_id uuid;
  target_pharmacy_id uuid;
  saved_context public.assistant_contexts;
begin
  if target_user_id is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Assistant context forbidden' using errcode = '42501';
  end if;
  select organization_id into target_organization_id from public.brands where id = target_brand_id;
  if target_brand_pharmacy_id is not null then
    select bp.pharmacy_id into target_pharmacy_id
    from public.brand_pharmacies bp
    where bp.id = target_brand_pharmacy_id
      and bp.brand_id = target_brand_id
      and bp.archived_at is null
      and private.can_access_brand_pharmacy(bp.id);
    if target_pharmacy_id is null then
      raise exception 'Assistant context pharmacy forbidden' using errcode = '42501';
    end if;
  end if;
  if target_pending_draft_id is not null and not exists (
    select 1 from public.assistant_action_drafts d
    where d.id = target_pending_draft_id
      and d.user_id = target_user_id
      and d.brand_id = target_brand_id
      and d.status = 'pending'
      and d.expires_at > now()
  ) then
    raise exception 'Assistant context draft forbidden' using errcode = '42501';
  end if;
  insert into public.assistant_contexts (
    organization_id, brand_id, user_id, active_pharmacy_id,
    active_brand_pharmacy_id, last_intent, pending_draft_id, expires_at
  ) values (
    target_organization_id, target_brand_id, target_user_id, target_pharmacy_id,
    target_brand_pharmacy_id, nullif(left(btrim(target_last_intent), 80), ''),
    target_pending_draft_id, now() + interval '30 minutes'
  )
  on conflict (user_id, brand_id) do update set
    active_pharmacy_id = excluded.active_pharmacy_id,
    active_brand_pharmacy_id = excluded.active_brand_pharmacy_id,
    last_intent = excluded.last_intent,
    pending_draft_id = excluded.pending_draft_id,
    updated_at = now(),
    expires_at = now() + interval '30 minutes'
  returning * into saved_context;
  return saved_context;
end;
$$;

create or replace function public.clear_assistant_context(target_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Assistant context forbidden' using errcode = '42501';
  end if;
  delete from public.assistant_contexts
  where user_id = (select auth.uid()) and brand_id = target_brand_id;
end;
$$;

create or replace function public.get_recent_authorized_interactions(
  target_brand_pharmacy_id uuid,
  result_limit integer default 5
)
returns table (
  id uuid,
  interaction_type public.interaction_type,
  outcome public.interaction_outcome,
  occurred_at timestamptz,
  subject text,
  notes text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.can_access_brand_pharmacy(target_brand_pharmacy_id) then
    raise exception 'Recent interactions forbidden' using errcode = '42501';
  end if;
  return query
  select i.id, i.interaction_type, i.outcome, i.occurred_at, i.subject, i.notes
  from public.interactions i
  where i.brand_pharmacy_id = target_brand_pharmacy_id
    and i.archived_at is null
  order by i.occurred_at desc
  limit least(greatest(result_limit, 1), 20);
end;
$$;

revoke all on function private.validate_assistant_payload(public.assistant_action_type, jsonb) from public, anon, authenticated;
revoke all on function private.insert_assistant_audit(uuid, uuid, uuid, uuid, uuid, public.assistant_audit_event, jsonb) from public, anon, authenticated;
revoke all on function public.record_assistant_audit(uuid, public.assistant_audit_event, uuid, uuid, jsonb) from public, anon;
revoke all on function public.create_assistant_draft(uuid, uuid, public.assistant_action_type, jsonb, numeric) from public, anon;
revoke all on function public.update_assistant_draft(uuid, uuid, jsonb) from public, anon;
revoke all on function public.cancel_assistant_draft(uuid) from public, anon;
revoke all on function public.confirm_assistant_draft(uuid) from public, anon;
revoke all on function public.set_assistant_context(uuid, uuid, text, uuid) from public, anon;
revoke all on function public.clear_assistant_context(uuid) from public, anon;
revoke all on function public.get_recent_authorized_interactions(uuid, integer) from public, anon;

grant execute on function public.record_assistant_audit(uuid, public.assistant_audit_event, uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.create_assistant_draft(uuid, uuid, public.assistant_action_type, jsonb, numeric) to authenticated, service_role;
grant execute on function public.update_assistant_draft(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.cancel_assistant_draft(uuid) to authenticated, service_role;
grant execute on function public.confirm_assistant_draft(uuid) to authenticated, service_role;
grant execute on function public.set_assistant_context(uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function public.clear_assistant_context(uuid) to authenticated, service_role;
grant execute on function public.get_recent_authorized_interactions(uuid, integer) to authenticated, service_role;
