alter type public.product_event_name add value if not exists 'whatsapp_link_started';
alter type public.product_event_name add value if not exists 'whatsapp_link_completed';
alter type public.product_event_name add value if not exists 'whatsapp_link_failed';
alter type public.product_event_name add value if not exists 'whatsapp_message_received';
alter type public.product_event_name add value if not exists 'whatsapp_message_processed';
alter type public.product_event_name add value if not exists 'whatsapp_assistant_response_sent';
alter type public.product_event_name add value if not exists 'whatsapp_draft_presented';
alter type public.product_event_name add value if not exists 'whatsapp_draft_confirmed';
alter type public.product_event_name add value if not exists 'whatsapp_draft_cancelled';
alter type public.product_event_name add value if not exists 'whatsapp_delivery_failed';

create type public.communication_channel_type as enum ('whatsapp');
create type public.whatsapp_event_status as enum ('received','processing','processed','rejected','failed');

create table public.communication_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  channel_type public.communication_channel_type not null,
  normalized_identifier text not null,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint communication_identifier_check check (normalized_identifier ~ '^\+[1-9][0-9]{7,14}$')
);
create unique index communication_channels_active_identifier
  on public.communication_channels(channel_type, normalized_identifier) where revoked_at is null;
create index communication_channels_user_idx on public.communication_channels(user_id, created_at desc);

create table public.whatsapp_link_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  failed_attempts integer not null default 0,
  constraint whatsapp_link_expiry_check check (expires_at > created_at),
  constraint whatsapp_link_attempts_check check (failed_attempts between 0 and 20)
);

create table public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text,
  provider_message_id text not null unique,
  phone_number text not null,
  event_type text not null,
  message_type text not null,
  message_text text,
  status public.whatsapp_event_status not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint whatsapp_event_phone_check check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  constraint whatsapp_event_text_check check (message_text is null or char_length(message_text) <= 1200),
  constraint whatsapp_event_error_check check (error_message is null or char_length(error_message) <= 500),
  constraint whatsapp_event_metadata_check check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096)
);
create unique index whatsapp_events_provider_event_unique on public.whatsapp_events(provider_event_id) where provider_event_id is not null;

create table public.whatsapp_rate_limits (
  rate_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (rate_key, window_started_at),
  constraint whatsapp_rate_count_check check (request_count > 0)
);

create table public.whatsapp_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  channel_id uuid references public.communication_channels(id) on delete set null,
  event_id uuid references public.whatsapp_events(id) on delete set null,
  event_name text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint whatsapp_audit_name_check check (char_length(event_name) between 2 and 80),
  constraint whatsapp_audit_metadata_check check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096)
);

alter table public.communication_channels enable row level security;
alter table public.whatsapp_link_tokens enable row level security;
alter table public.whatsapp_events enable row level security;
alter table public.whatsapp_rate_limits enable row level security;
alter table public.whatsapp_audit_logs enable row level security;

revoke all on public.communication_channels, public.whatsapp_link_tokens, public.whatsapp_events,
  public.whatsapp_rate_limits, public.whatsapp_audit_logs from anon, authenticated;
grant select on public.communication_channels, public.whatsapp_link_tokens, public.whatsapp_audit_logs to authenticated;
grant all on public.communication_channels, public.whatsapp_link_tokens, public.whatsapp_events,
  public.whatsapp_rate_limits, public.whatsapp_audit_logs to service_role;
grant usage on type public.communication_channel_type, public.whatsapp_event_status to authenticated, service_role;
grant usage, select on sequence public.whatsapp_audit_logs_id_seq to service_role;

create policy communication_channels_select on public.communication_channels for select to authenticated
using (user_id = (select auth.uid()));
create policy whatsapp_link_tokens_select on public.whatsapp_link_tokens for select to authenticated
using (user_id = (select auth.uid()));
create policy whatsapp_audit_select on public.whatsapp_audit_logs for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.start_whatsapp_link(target_brand_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  target_user uuid := (select auth.uid());
  target_org uuid;
  raw_code text;
begin
  if target_user is null or not private.can_access_brand(target_brand_id) then
    raise exception 'WhatsApp linking forbidden' using errcode = '42501';
  end if;
  select organization_id into target_org from public.brands where id = target_brand_id;
  delete from public.whatsapp_link_tokens
  where user_id = target_user and used_at is null;
  raw_code := 'TR1-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));
  insert into public.whatsapp_link_tokens(organization_id, brand_id, user_id, code_hash, expires_at)
  values (target_org, target_brand_id, target_user, encode(extensions.digest(raw_code, 'sha256'), 'hex'), now() + interval '10 minutes');
  perform public.track_product_event('whatsapp_link_started', target_brand_id, null, 'whatsapp', '{}'::jsonb);
  return query select raw_code, now() + interval '10 minutes';
end;
$$;

create or replace function public.revoke_whatsapp_channel(target_channel_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  channel_user_id uuid;
begin
  update public.communication_channels set revoked_at = now()
  where id = target_channel_id and user_id = (select auth.uid()) and revoked_at is null;
  if not found then raise exception 'WhatsApp channel unavailable' using errcode = '42501'; end if;
  select user_id into channel_user_id from public.communication_channels where id = target_channel_id;
  delete from public.assistant_contexts where user_id = channel_user_id;
  insert into public.whatsapp_audit_logs(organization_id,user_id,channel_id,event_name)
  select organization_id,user_id,id,'link_revoked'
  from public.communication_channels where id = target_channel_id;
end;
$$;

create or replace function public.claim_whatsapp_link(target_code text, target_phone text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  token_row public.whatsapp_link_tokens;
  channel_row public.communication_channels;
begin
  select * into token_row from public.whatsapp_link_tokens
  where code_hash = encode(extensions.digest(upper(btrim(target_code)), 'sha256'), 'hex')
  for update;
  if token_row.id is null or token_row.used_at is not null or token_row.expires_at <= now() then
    raise exception 'Invalid or expired linking code' using errcode = '22023';
  end if;
  update public.communication_channels set revoked_at = now()
  where user_id = token_row.user_id and channel_type = 'whatsapp' and revoked_at is null;
  delete from public.assistant_contexts where user_id = token_row.user_id;
  insert into public.communication_channels(organization_id,user_id,channel_type,normalized_identifier)
  values(token_row.organization_id,token_row.user_id,'whatsapp',target_phone)
  returning * into channel_row;
  update public.whatsapp_link_tokens set used_at = now() where id = token_row.id;
  insert into public.whatsapp_audit_logs(organization_id,user_id,channel_id,event_name)
  values(token_row.organization_id,token_row.user_id,channel_row.id,'link_completed');
  return jsonb_build_object('channel_id',channel_row.id,'user_id',channel_row.user_id,'brand_id',token_row.brand_id);
end;
$$;

create or replace function public.ingest_whatsapp_event(
  target_provider_event_id text,
  target_provider_message_id text,
  target_phone text,
  target_event_type text,
  target_message_type text,
  target_message_text text,
  target_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare event_row public.whatsapp_events; inserted boolean := true;
begin
  insert into public.whatsapp_events(provider_event_id,provider_message_id,phone_number,event_type,message_type,message_text,metadata)
  values(target_provider_event_id,target_provider_message_id,target_phone,target_event_type,target_message_type,target_message_text,coalesce(target_metadata,'{}'))
  on conflict(provider_message_id) do nothing
  returning * into event_row;
  if event_row.id is null then
    inserted := false;
    select * into event_row from public.whatsapp_events where provider_message_id = target_provider_message_id;
  end if;
  if inserted then
    insert into public.whatsapp_audit_logs(event_id,event_name) values(event_row.id,'webhook_received');
  end if;
  return jsonb_build_object('event_id',event_row.id,'duplicate',not inserted,'status',event_row.status);
end;
$$;

create or replace function public.check_whatsapp_rate_limit(
  target_key text, target_limit integer, target_window_seconds integer
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare bucket timestamptz; current_count integer;
begin
  bucket := to_timestamp(floor(extract(epoch from now()) / target_window_seconds) * target_window_seconds);
  insert into public.whatsapp_rate_limits(rate_key,window_started_at,request_count)
  values(left(target_key,200),bucket,1)
  on conflict(rate_key,window_started_at) do update set request_count = public.whatsapp_rate_limits.request_count + 1
  returning request_count into current_count;
  return current_count <= target_limit;
end;
$$;

create or replace function public.execute_whatsapp_assistant_tool(
  target_event_id uuid, target_tool text, target_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  event_row public.whatsapp_events;
  channel_row public.communication_channels;
  result jsonb;
begin
  select * into event_row from public.whatsapp_events where id = target_event_id;
  select * into channel_row from public.communication_channels
  where normalized_identifier = event_row.phone_number and channel_type = 'whatsapp' and revoked_at is null;
  if event_row.id is null or channel_row.id is null then raise exception 'WhatsApp identity unavailable' using errcode = '42501'; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',channel_row.user_id,'role','authenticated')::text, true);
  if target_tool = 'get_brand_contexts' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from public.get_my_brand_contexts() x;
  elsif target_tool = 'get_assistant_context' then
    select to_jsonb(c) into result from public.assistant_contexts c
    where c.user_id = channel_row.user_id and c.brand_id = (target_payload->>'target_brand_id')::uuid and c.expires_at > now();
  elsif target_tool = 'get_pending_draft' then
    select to_jsonb(d) into result from public.assistant_action_drafts d
    where d.user_id = channel_row.user_id
      and (
        (d.status = 'pending' and d.expires_at > now())
        or (d.status = 'confirmed' and d.confirmed_at > now() - interval '30 minutes')
      )
    order by d.created_at desc limit 1;
  elsif target_tool = 'search_authorized_pharmacies' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from public.search_authorized_pharmacies(
      (target_payload->>'target_brand_id')::uuid,target_payload->>'search_text',coalesce((target_payload->>'result_limit')::integer,20)) x;
  elsif target_tool = 'get_field_pharmacy_summary' then
    result := public.get_field_pharmacy_summary((target_payload->>'target_brand_pharmacy_id')::uuid);
  elsif target_tool = 'get_next_agent_visit' then
    result := public.get_next_agent_visit((target_payload->>'target_brand_id')::uuid);
  elsif target_tool = 'get_agent_today' then
    result := public.get_agent_today((target_payload->>'target_brand_id')::uuid,(target_payload->>'target_date')::date);
  elsif target_tool = 'get_recent_authorized_interactions' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from public.get_recent_authorized_interactions(
      (target_payload->>'target_brand_pharmacy_id')::uuid,5) x;
  elsif target_tool = 'create_assistant_draft' then
    result := to_jsonb(public.create_assistant_draft(
      (target_payload->>'target_brand_id')::uuid,(target_payload->>'target_brand_pharmacy_id')::uuid,
      (target_payload->>'target_action_type')::public.assistant_action_type,target_payload->'target_payload',
      (target_payload->>'target_confidence')::numeric));
  elsif target_tool = 'set_assistant_context' then
    result := to_jsonb(public.set_assistant_context(
      (target_payload->>'target_brand_id')::uuid,nullif(target_payload->>'target_brand_pharmacy_id','')::uuid,
      target_payload->>'target_last_intent',nullif(target_payload->>'target_pending_draft_id','')::uuid));
  elsif target_tool = 'confirm_assistant_draft' then
    result := public.confirm_assistant_draft((target_payload->>'target_draft_id')::uuid);
  elsif target_tool = 'cancel_assistant_draft' then
    result := to_jsonb(public.cancel_assistant_draft((target_payload->>'target_draft_id')::uuid));
  elsif target_tool = 'record_assistant_audit' then
    result := to_jsonb(public.record_assistant_audit(
      (target_payload->>'target_brand_id')::uuid,(target_payload->>'target_event')::public.assistant_audit_event,
      nullif(target_payload->>'target_pharmacy_id','')::uuid,nullif(target_payload->>'target_draft_id','')::uuid,
      coalesce(target_payload->'target_metadata','{}')));
  elsif target_tool = 'track_product_event' then
    result := to_jsonb(public.track_product_event(
      (target_payload->>'target_event')::public.product_event_name,(target_payload->>'target_brand_id')::uuid,
      nullif(target_payload->>'target_pharmacy_id','')::uuid,target_payload->>'target_source',
      coalesce(target_payload->'target_metadata','{}')));
  else raise exception 'WhatsApp tool forbidden' using errcode = '42501';
  end if;
  update public.communication_channels set last_used_at = now() where id = channel_row.id;
  return result;
end;
$$;

create or replace function public.complete_whatsapp_event(target_event_id uuid, target_status public.whatsapp_event_status, target_error text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.whatsapp_events set status=target_status,processed_at=now(),error_message=left(target_error,500) where id=target_event_id;
end;
$$;

create or replace function public.record_whatsapp_audit(
  target_event_id uuid,
  target_event_name text,
  target_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.whatsapp_audit_logs(organization_id,user_id,channel_id,event_id,event_name,metadata)
  select channel.organization_id,channel.user_id,channel.id,event.id,left(target_event_name,80),coalesce(target_metadata,'{}')
  from public.whatsapp_events event
  left join public.communication_channels channel
    on channel.normalized_identifier = event.phone_number
    and channel.channel_type = 'whatsapp'
    and channel.revoked_at is null
  where event.id = target_event_id;
end;
$$;

revoke all on function public.start_whatsapp_link(uuid), public.revoke_whatsapp_channel(uuid) from public, anon;
grant execute on function public.start_whatsapp_link(uuid), public.revoke_whatsapp_channel(uuid) to authenticated;
revoke all on function public.claim_whatsapp_link(text,text), public.ingest_whatsapp_event(text,text,text,text,text,text,jsonb),
  public.check_whatsapp_rate_limit(text,integer,integer), public.execute_whatsapp_assistant_tool(uuid,text,jsonb),
  public.complete_whatsapp_event(uuid,public.whatsapp_event_status,text),
  public.record_whatsapp_audit(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_link(text,text), public.ingest_whatsapp_event(text,text,text,text,text,text,jsonb),
  public.check_whatsapp_rate_limit(text,integer,integer), public.execute_whatsapp_assistant_tool(uuid,text,jsonb),
  public.complete_whatsapp_event(uuid,public.whatsapp_event_status,text),
  public.record_whatsapp_audit(uuid,text,jsonb) to service_role;
