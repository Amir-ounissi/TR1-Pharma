-- Unify all field visit completion paths around close_field_visit.
-- The legacy complete_field_visit RPC remains as a compatibility adapter for
-- older/mobile surfaces, but no longer owns a separate completion workflow.

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
      started_at = coalesce(started_at, actual_start_at, now()),
      actual_start_at = coalesce(actual_start_at, started_at, now()),
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
  interaction_id uuid;
  interaction_refs jsonb := '[]'::jsonb;
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
    select closeout.id, closeout.next_visit_id into closeout_id, next_visit_id
    from public.field_visit_closeouts closeout
    where closeout.visit_id = target_visit_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'interaction_id', i.id,
          'brand_id', i.brand_id,
          'brand_pharmacy_id', i.brand_pharmacy_id
        ) order by i.created_at, i.id
      ),
      '[]'::jsonb
    )
    into interaction_refs
    from public.interactions i
    where i.field_visit_id = target_visit_id
      and i.interaction_type = 'visit'
      and i.archived_at is null;

    return jsonb_build_object(
      'closeout_id', closeout_id,
      'next_visit_id', next_visit_id,
      'already_closed', true,
      'interactions', interaction_refs
    );
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
    order by fvb.is_primary desc, fvb.brand_id
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
      visibility,
      field_visit_id
    ) values (
      relation.brand_id,
      relation.brand_pharmacy_id,
      actor,
      'visit',
      coalesce(target.started_at, target.actual_start_at, target.scheduled_start_at, now()),
      'Visite terrain · ' || target.title,
      clean_summary,
      interaction_outcome,
      actor,
      case when next_visit_id is not null then 'visit'::public.commercial_task_type else null end,
      next_start,
      case when next_visit_id is not null then actor else null end,
      'shared',
      target_visit_id
    )
    returning id into interaction_id;

    interaction_refs := interaction_refs || jsonb_build_array(
      jsonb_build_object(
        'interaction_id', interaction_id,
        'brand_id', relation.brand_id,
        'brand_pharmacy_id', relation.brand_pharmacy_id
      )
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
      started_at = coalesce(started_at, actual_start_at, now()),
      actual_start_at = coalesce(actual_start_at, started_at, now()),
      completed_at = now(),
      actual_end_at = now(),
      updated_at = now()
  where id = target_visit_id;

  return jsonb_build_object(
    'closeout_id', closeout_id,
    'next_visit_id', next_visit_id,
    'already_closed', false,
    'interactions', interaction_refs
  );
end;
$$;

-- Compatibility adapter for legacy/mobile callers. It delegates persistence to
-- the canonical closeout RPC so every surface now creates the same closeout and
-- visit interactions. The legacy outcome column is retained only for old views.
create or replace function public.complete_field_visit(
  target_visit_id uuid,
  target_outcome text default null,
  target_next_start_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_outcome text;
  legacy_summary text;
  result jsonb;
begin
  if target_outcome is not null and target_outcome not in ('very_good','good','follow_up','problem') then
    raise exception 'Invalid visit outcome' using errcode = '23514';
  end if;

  canonical_outcome := case target_outcome
    when 'follow_up' then 'follow_up'
    when 'problem' then 'follow_up'
    else 'other'
  end;

  legacy_summary := case target_outcome
    when 'very_good' then 'Clôture rapide : très bien.'
    when 'good' then 'Clôture rapide : bien.'
    when 'follow_up' then 'Clôture rapide : à revoir.'
    when 'problem' then 'Clôture rapide : problème signalé.'
    else 'Clôture rapide depuis la fiche pharmacie.'
  end;

  result := public.close_field_visit(
    target_visit_id,
    jsonb_build_object(
      'outcome', canonical_outcome,
      'summary', legacy_summary,
      'input_mode', 'manual',
      'structured_payload', jsonb_build_object(
        'source', 'legacy_complete_field_visit',
        'legacy_outcome', target_outcome
      ),
      'next_visit_at', target_next_start_at,
      'next_objective', null
    )
  );

  update public.field_visits
  set outcome = target_outcome,
      actual_start_at = coalesce(actual_start_at, started_at),
      actual_end_at = coalesce(actual_end_at, completed_at),
      updated_at = now()
  where id = target_visit_id;

  return nullif(result->>'next_visit_id', '')::uuid;
end;
$$;

revoke all on function public.start_field_visit(uuid) from public, anon;
revoke all on function public.close_field_visit(uuid, jsonb) from public, anon;
revoke all on function public.complete_field_visit(uuid, text, timestamptz) from public, anon;

grant execute on function public.start_field_visit(uuid) to authenticated, service_role;
grant execute on function public.close_field_visit(uuid, jsonb) to authenticated, service_role;
grant execute on function public.complete_field_visit(uuid, text, timestamptz) to authenticated, service_role;

comment on function public.complete_field_visit(uuid, text, timestamptz) is
  'Compatibility adapter. New code must use close_field_visit; legacy callers are persisted through the same canonical visit closeout workflow.';
