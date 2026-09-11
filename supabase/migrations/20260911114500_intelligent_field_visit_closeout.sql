alter table public.field_visits
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create table public.field_visit_closeouts (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.field_visits(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  outcome text not null check (outcome in ('order_taken','no_order','follow_up','information','other')),
  summary text not null check (nullif(btrim(summary),'') is not null),
  input_mode text not null default 'manual' check (input_mode in ('manual','dictation','assistant')),
  structured_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_payload) = 'object'),
  next_visit_id uuid references public.field_visits(id) on delete set null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index field_visit_closeouts_completed_idx
  on public.field_visit_closeouts(completed_at desc);

alter table public.field_visit_closeouts enable row level security;
revoke all on public.field_visit_closeouts from public, anon;
grant select on public.field_visit_closeouts to authenticated;
grant all on public.field_visit_closeouts to service_role;

create policy field_visit_closeouts_select on public.field_visit_closeouts
for select to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1
    from public.field_visit_brands fvb
    where fvb.visit_id = field_visit_closeouts.visit_id
      and private.can_access_brand_pharmacy(fvb.brand_pharmacy_id)
  )
);

create or replace function public.start_field_visit(target_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.field_visits%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.field_visits
  where id = target_visit_id
  for update;

  if target.id is null or target.archived_at is not null or target.owner_user_id <> actor then
    raise exception 'Visit unavailable' using errcode = '42501';
  end if;

  if target.status not in ('planned','confirmed','in_progress') then
    raise exception 'Visit cannot be started' using errcode = '23514';
  end if;

  update public.field_visits
  set status = 'in_progress',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = target_visit_id;
end;
$$;

create or replace function public.close_field_visit(target_visit_id uuid, closeout_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.field_visits%rowtype;
  relation record;
  clean_summary text := nullif(btrim(closeout_payload->>'summary'), '');
  clean_outcome text := coalesce(nullif(closeout_payload->>'outcome', ''), 'other');
  clean_input_mode text := coalesce(nullif(closeout_payload->>'input_mode', ''), 'manual');
  structured jsonb := coalesce(closeout_payload->'structured_payload', '{}'::jsonb);
  next_start timestamptz := nullif(closeout_payload->>'next_visit_at', '')::timestamptz;
  next_objective text := nullif(btrim(closeout_payload->>'next_objective'), '');
  next_visit_id uuid;
  closeout_id uuid;
  interaction_outcome public.interaction_outcome;
  visit_duration interval;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.field_visits
  where id = target_visit_id
  for update;

  if target.id is null or target.archived_at is not null or target.owner_user_id <> actor then
    raise exception 'Visit unavailable' using errcode = '42501';
  end if;

  if target.status = 'cancelled' then
    raise exception 'Cancelled visit cannot be closed' using errcode = '23514';
  end if;

  if exists (select 1 from public.field_visit_closeouts where visit_id = target_visit_id) then
    select id, next_visit_id into closeout_id, next_visit_id
    from public.field_visit_closeouts
    where visit_id = target_visit_id;
    return jsonb_build_object('closeout_id', closeout_id, 'next_visit_id', next_visit_id, 'already_closed', true);
  end if;

  if clean_summary is null then
    raise exception 'Visit summary is required' using errcode = '23514';
  end if;
  if clean_outcome not in ('order_taken','no_order','follow_up','information','other') then
    raise exception 'Invalid visit outcome' using errcode = '23514';
  end if;
  if clean_input_mode not in ('manual','dictation','assistant') then
    raise exception 'Invalid input mode' using errcode = '23514';
  end if;
  if jsonb_typeof(structured) <> 'object' then
    raise exception 'Structured payload must be an object' using errcode = '23514';
  end if;
  if next_start is not null and next_start <= now() then
    raise exception 'Next visit must be scheduled in the future' using errcode = '23514';
  end if;

  visit_duration := greatest(target.scheduled_end_at - target.scheduled_start_at, interval '15 minutes');

  if next_start is not null then
    insert into public.field_visits(
      owner_user_id,
      pharmacy_id,
      visit_kind,
      status,
      title,
      objective,
      scheduled_start_at,
      scheduled_end_at,
      notes,
      source,
      created_by
    ) values (
      actor,
      target.pharmacy_id,
      target.visit_kind,
      'planned',
      'Suivi · ' || target.title,
      coalesce(next_objective, target.objective),
      next_start,
      next_start + visit_duration,
      'Planifiée depuis la clôture de la visite précédente.',
      'interaction',
      actor
    ) returning id into next_visit_id;

    insert into public.field_visit_brands(visit_id, brand_id, brand_pharmacy_id, objective, is_primary)
    select next_visit_id, brand_id, brand_pharmacy_id, coalesce(next_objective, objective), is_primary
    from public.field_visit_brands
    where visit_id = target_visit_id;
  end if;

  interaction_outcome := case clean_outcome
    when 'order_taken' then 'completed'::public.interaction_outcome
    when 'no_order' then 'completed'::public.interaction_outcome
    when 'follow_up' then 'decision_pending'::public.interaction_outcome
    when 'information' then 'information_sent'::public.interaction_outcome
    else 'other'::public.interaction_outcome
  end;

  for relation in
    select fvb.brand_id, fvb.brand_pharmacy_id
    from public.field_visit_brands fvb
    where fvb.visit_id = target_visit_id
  loop
    insert into public.interactions(
      brand_id,
      brand_pharmacy_id,
      created_by,
      interaction_type,
      occurred_at,
      subject,
      notes,
      outcome,
      assigned_user_id,
      next_action_type,
      next_action_at,
      next_action_owner_id,
      visibility
    ) values (
      relation.brand_id,
      relation.brand_pharmacy_id,
      actor,
      'visit',
      coalesce(target.started_at, target.scheduled_start_at, now()),
      'Visite terrain · ' || target.title,
      clean_summary,
      interaction_outcome,
      actor,
      case when next_visit_id is not null then 'visit'::public.commercial_task_type else null end,
      next_start,
      case when next_visit_id is not null then actor else null end,
      'shared'
    );
  end loop;

  insert into public.field_visit_closeouts(
    visit_id,
    created_by,
    outcome,
    summary,
    input_mode,
    structured_payload,
    next_visit_id
  ) values (
    target_visit_id,
    actor,
    clean_outcome,
    clean_summary,
    clean_input_mode,
    structured,
    next_visit_id
  ) returning id into closeout_id;

  update public.field_visits
  set status = 'completed',
      started_at = coalesce(started_at, now()),
      completed_at = now(),
      updated_at = now()
  where id = target_visit_id;

  return jsonb_build_object('closeout_id', closeout_id, 'next_visit_id', next_visit_id, 'already_closed', false);
end;
$$;

revoke all on function public.start_field_visit(uuid), public.close_field_visit(uuid, jsonb) from public, anon;
grant execute on function public.start_field_visit(uuid), public.close_field_visit(uuid, jsonb) to authenticated, service_role;

comment on table public.field_visit_closeouts is
  'Visit-level closeout contract designed for manual input today and dictation/assistant prefill later without changing the business workflow.';
comment on column public.field_visit_closeouts.structured_payload is
  'Structured assistant output. The human-readable summary remains the source of truth shown to users.';
