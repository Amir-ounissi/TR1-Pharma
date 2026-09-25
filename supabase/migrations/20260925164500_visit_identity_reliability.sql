-- P0 reliability: make field visit identity deterministic across TR1 and HubSpot.
-- Existing duplicate rows are intentionally not deleted here; this migration prevents
-- new supported workflows from creating more duplicates and makes closeout reuse the
-- canonical interaction for each visit/brand.

create or replace function public.create_field_visit(
  target_pharmacy_id uuid,
  visit_payload jsonb,
  target_brand_pharmacy_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result_visit_id uuid;
  relation record;
  relation_count integer := 0;
  requested_start timestamptz;
  requested_end timestamptz;
  existing_source public.commercial_source;
  existing_status public.field_visit_status;
begin
  if actor is null or target_pharmacy_id is null or coalesce(array_length(target_brand_pharmacy_ids, 1), 0) = 0 then
    raise exception 'Visit pharmacy and brands are required' using errcode = '23514';
  end if;
  if nullif(visit_payload->>'title', '') is null then
    raise exception 'Visit title is required' using errcode = '23514';
  end if;
  if nullif(visit_payload->>'scheduled_start_at', '') is null or nullif(visit_payload->>'scheduled_end_at', '') is null then
    raise exception 'Visit end date must follow start date' using errcode = '23514';
  end if;

  requested_start := (visit_payload->>'scheduled_start_at')::timestamptz;
  requested_end := (visit_payload->>'scheduled_end_at')::timestamptz;
  if requested_end <= requested_start then
    raise exception 'Visit end date must follow start date' using errcode = '23514';
  end if;

  for relation in
    select bp.id, bp.brand_id, bp.pharmacy_id
    from public.brand_pharmacies bp
    where bp.id = any(target_brand_pharmacy_ids)
      and bp.archived_at is null
  loop
    relation_count := relation_count + 1;
    if relation.pharmacy_id <> target_pharmacy_id
       or not private.has_brand_role(relation.brand_id, array['agent'])
       or not private.user_is_assigned_to_relation(actor, relation.id) then
      raise exception 'Brand pharmacy unavailable for this visit' using errcode = '42501';
    end if;
  end loop;

  if relation_count <> cardinality(target_brand_pharmacy_ids) then
    raise exception 'Brand pharmacy unavailable for this visit' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      actor::text || '|' || target_pharmacy_id::text || '|' || requested_start::text,
      0
    )
  );

  select v.id, v.source, v.status
  into result_visit_id, existing_source, existing_status
  from public.field_visits v
  where v.owner_user_id = actor
    and v.pharmacy_id = target_pharmacy_id
    and v.scheduled_start_at = requested_start
    and v.archived_at is null
    and v.status <> 'cancelled'
  order by v.created_at, v.id
  limit 1
  for update;

  if result_visit_id is not null then
    insert into public.field_visit_brands(visit_id, brand_id, brand_pharmacy_id, objective, is_primary)
    select
      result_visit_id,
      bp.brand_id,
      bp.id,
      visit_payload->>'objective',
      not exists (
        select 1
        from public.field_visit_brands existing_link
        where existing_link.visit_id = result_visit_id
      ) and row_number() over (order by bp.id) = 1
    from public.brand_pharmacies bp
    where bp.id = any(target_brand_pharmacy_ids)
      and not exists (
        select 1
        from public.field_visit_brands existing_link
        where existing_link.visit_id = result_visit_id
          and existing_link.brand_id = bp.brand_id
      );

    if existing_source = 'import' and existing_status in ('planned', 'confirmed') then
      update public.field_visits
      set visit_kind = coalesce((visit_payload->>'visit_kind')::public.field_visit_kind, visit_kind),
          title = visit_payload->>'title',
          objective = visit_payload->>'objective',
          scheduled_end_at = requested_end,
          notes = visit_payload->>'notes',
          source = 'manual',
          updated_at = now()
      where id = result_visit_id;
    end if;

    return result_visit_id;
  end if;

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
    target_pharmacy_id,
    coalesce((visit_payload->>'visit_kind')::public.field_visit_kind, 'client_visit'),
    coalesce((visit_payload->>'status')::public.field_visit_status, 'planned'),
    visit_payload->>'title',
    visit_payload->>'objective',
    requested_start,
    requested_end,
    visit_payload->>'notes',
    'manual',
    actor
  )
  returning id into result_visit_id;

  insert into public.field_visit_brands(visit_id, brand_id, brand_pharmacy_id, objective, is_primary)
  select
    result_visit_id,
    bp.brand_id,
    bp.id,
    visit_payload->>'objective',
    row_number() over (order by bp.id) = 1
  from public.brand_pharmacies bp
  where bp.id = any(target_brand_pharmacy_ids);

  return result_visit_id;
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
    from (
      select distinct on (source.brand_id)
        source.id,
        source.brand_id,
        source.brand_pharmacy_id,
        source.created_at
      from public.interactions source
      where source.field_visit_id = target_visit_id
        and source.interaction_type = 'visit'
        and source.archived_at is null
      order by source.brand_id, source.created_at, source.id
    ) i;

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
    interaction_id := null;

    select i.id into interaction_id
    from public.interactions i
    where i.field_visit_id = target_visit_id
      and i.brand_id = relation.brand_id
      and i.interaction_type = 'visit'
      and i.archived_at is null
    order by i.created_at, i.id
    limit 1
    for update;

    if interaction_id is null then
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
    else
      update public.interactions
      set brand_pharmacy_id = relation.brand_pharmacy_id,
          occurred_at = coalesce(target.started_at, target.actual_start_at, target.scheduled_start_at, now()),
          subject = 'Visite terrain · ' || target.title,
          notes = clean_summary,
          outcome = interaction_outcome,
          assigned_user_id = actor,
          next_action_type = case when next_visit_id is not null then 'visit'::public.commercial_task_type else null end,
          next_action_at = next_start,
          next_action_owner_id = case when next_visit_id is not null then actor else null end,
          visibility = 'shared'
      where id = interaction_id;
    end if;

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

comment on function public.create_field_visit(uuid, jsonb, uuid[]) is
  'Creates one canonical field visit per agent/pharmacy/start. Retries reuse the visit and can extend its brand scope.';

comment on function public.close_field_visit(uuid, jsonb) is
  'Canonical closeout. Reuses the existing visit interaction for each brand instead of creating a duplicate.';
