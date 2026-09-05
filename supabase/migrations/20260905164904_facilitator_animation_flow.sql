create or replace function public.get_provider_mission_pharmacies_v2()
returns table(
  brand_id uuid,
  brand_name text,
  brand_pharmacy_id uuid,
  pharmacy_id uuid,
  pharmacy_name text,
  postal_code text,
  city text,
  address_line_1 text,
  cip_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct
    b.id,
    b.name,
    bp.id,
    p.id,
    coalesce(p.trade_name, p.legal_name),
    p.postal_code,
    p.city,
    p.address_line_1,
    p.cip_code
  from public.memberships m
  join public.roles r on r.id = m.role_id
  join public.brands b on b.id = m.brand_id
  join public.brand_pharmacies bp on bp.brand_id = b.id and bp.archived_at is null
  join public.pharmacies p on p.id = bp.pharmacy_id and p.archived_at is null
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and r.key = 'facilitator'
    and b.is_active = true
  order by b.name, coalesce(p.trade_name, p.legal_name);
$$;

revoke all on function public.get_provider_mission_pharmacies_v2() from public;
revoke all on function public.get_provider_mission_pharmacies_v2() from anon;
grant execute on function public.get_provider_mission_pharmacies_v2() to authenticated;

create or replace function public.propose_animation_batch(animation_payload jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  item jsonb;
  relation public.brand_pharmacies%rowtype;
  target_brand public.brands%rowtype;
  target_pharmacy public.pharmacies%rowtype;
  start_at timestamptz;
  end_at timestamptz;
  mission_id uuid;
  mission_ids uuid[] := array[]::uuid[];
  item_count integer;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(animation_payload) <> 'array' then
    raise exception 'Animation payload must be an array' using errcode = '23514';
  end if;

  item_count := jsonb_array_length(animation_payload);
  if item_count < 1 or item_count > 30 then
    raise exception 'Animation batch must contain between 1 and 30 rows' using errcode = '23514';
  end if;

  for item in select value from jsonb_array_elements(animation_payload)
  loop
    select * into relation
    from public.brand_pharmacies
    where id = (item->>'brand_pharmacy_id')::uuid
      and archived_at is null;

    if relation.id is null
      or not private.has_brand_role(relation.brand_id, array['facilitator'])
      or not private.mission_execution_role_allowed(relation.brand_id, actor, 'animation'::public.mission_type)
    then
      raise exception 'Brand pharmacy unavailable for animation' using errcode = '42501';
    end if;

    select * into target_brand from public.brands where id = relation.brand_id and is_active = true;
    select * into target_pharmacy from public.pharmacies where id = relation.pharmacy_id and archived_at is null;

    if target_brand.id is null or target_pharmacy.id is null then
      raise exception 'Brand pharmacy unavailable for animation' using errcode = '42501';
    end if;

    start_at := nullif(item->>'scheduled_start_at', '')::timestamptz;
    end_at := nullif(item->>'scheduled_end_at', '')::timestamptz;

    if start_at is null or end_at is null or end_at <= start_at then
      raise exception 'Mission end date must follow start date' using errcode = '23514';
    end if;

    insert into public.missions(
      organization_id,
      brand_id,
      brand_pharmacy_id,
      pharmacy_id,
      mission_type,
      status,
      title,
      objective,
      briefing,
      requested_by,
      managed_by,
      assigned_user_id,
      scheduled_start_at,
      scheduled_end_at,
      priority,
      location_mode,
      budget_estimated_ht,
      cost_estimated_ht,
      source,
      created_by,
      proposal_source,
      proposal_review_status,
      proposed_by_user_id
    ) values (
      target_brand.organization_id,
      target_brand.id,
      relation.id,
      target_pharmacy.id,
      'animation',
      'requested',
      'Animation ' || target_brand.name || ' — ' || coalesce(target_pharmacy.trade_name, target_pharmacy.legal_name),
      'Animation de la gamme ' || target_brand.name,
      null,
      actor,
      actor,
      actor,
      start_at,
      end_at,
      'normal',
      'in_pharmacy',
      null,
      null,
      'provider',
      actor,
      'provider',
      'pending',
      actor
    ) returning id into mission_id;

    mission_ids := array_append(mission_ids, mission_id);
  end loop;

  return mission_ids;
end;
$$;

revoke all on function public.propose_animation_batch(jsonb) from public;
revoke all on function public.propose_animation_batch(jsonb) from anon;
grant execute on function public.propose_animation_batch(jsonb) to authenticated;

create or replace function public.propose_mission(
  target_brand_pharmacy_id uuid,
  mission_payload jsonb,
  product_payload jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation public.brand_pharmacies%rowtype;
  actor uuid := (select auth.uid());
  mission_id uuid;
  product_record jsonb;
  mission_kind public.mission_type;
begin
  select * into relation from public.brand_pharmacies where id = target_brand_pharmacy_id and archived_at is null;
  if relation.id is null or not private.has_brand_role(relation.brand_id, array['agent','facilitator']) then
    raise exception 'Brand pharmacy unavailable' using errcode = '42501';
  end if;

  mission_kind := (mission_payload->>'mission_type')::public.mission_type;

  if not private.mission_execution_role_allowed(relation.brand_id, actor, mission_kind) then
    raise exception 'Mission type is incompatible with provider role' using errcode = '42501';
  end if;
  if private.has_brand_role(relation.brand_id, array['agent']) and not private.user_is_assigned_to_relation(actor, relation.id) then
    raise exception 'Pharmacy is outside agent scope' using errcode = '42501';
  end if;
  if nullif(mission_payload->>'title','') is null or nullif(mission_payload->>'objective','') is null then
    raise exception 'Mission title and objective are required' using errcode = '23514';
  end if;
  if nullif(mission_payload->>'scheduled_start_at','') is null
    or nullif(mission_payload->>'scheduled_end_at','') is null
    or (mission_payload->>'scheduled_end_at')::timestamptz <= (mission_payload->>'scheduled_start_at')::timestamptz
  then
    raise exception 'Mission end date must follow start date' using errcode = '23514';
  end if;

  insert into public.missions(
    organization_id, brand_id, brand_pharmacy_id, pharmacy_id, mission_type, status, title, objective, briefing,
    requested_by, managed_by, assigned_user_id, scheduled_start_at, scheduled_end_at, priority, location_mode,
    budget_estimated_ht, cost_estimated_ht, source, created_by, proposal_source, proposal_review_status, proposed_by_user_id
  )
  select
    b.organization_id,
    relation.brand_id,
    relation.id,
    relation.pharmacy_id,
    mission_kind,
    'requested',
    mission_payload->>'title',
    mission_payload->>'objective',
    mission_payload->>'briefing',
    actor,
    actor,
    actor,
    (mission_payload->>'scheduled_start_at')::timestamptz,
    (mission_payload->>'scheduled_end_at')::timestamptz,
    coalesce((mission_payload->>'priority')::public.mission_priority, 'normal'),
    case when mission_kind = 'animation' then 'in_pharmacy'::public.mission_location_mode
         else coalesce((mission_payload->>'location_mode')::public.mission_location_mode, 'in_pharmacy') end,
    case when private.has_brand_role(relation.brand_id, array['facilitator']) then null
         else nullif(mission_payload->>'budget_estimated_ht','')::numeric end,
    case when private.has_brand_role(relation.brand_id, array['facilitator']) then null
         else nullif(mission_payload->>'budget_estimated_ht','')::numeric end,
    'provider',
    actor,
    'provider',
    'pending',
    actor
  from public.brands b
  where b.id = relation.brand_id
  returning id into mission_id;

  if mission_kind <> 'animation' then
    for product_record in select value from jsonb_array_elements(product_payload)
    loop
      if not exists(
        select 1 from public.products p
        where p.id = (product_record->>'product_id')::uuid
          and p.brand_id = relation.brand_id
          and p.is_active
      ) then
        raise exception 'Mission product unavailable' using errcode = '42501';
      end if;
      insert into public.mission_products(mission_id, brand_id, product_id)
      values (mission_id, relation.brand_id, (product_record->>'product_id')::uuid);
    end loop;
  end if;

  return mission_id;
end;
$$;

revoke all on function public.propose_mission(uuid, jsonb, jsonb) from public;
revoke all on function public.propose_mission(uuid, jsonb, jsonb) from anon;
grant execute on function public.propose_mission(uuid, jsonb, jsonb) to authenticated;

create or replace function public.resubmit_provider_mission_proposal(
  target_mission_id uuid,
  mission_payload jsonb,
  product_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.missions%rowtype;
  actor uuid := (select auth.uid());
  product_record jsonb;
  new_start timestamptz;
  new_end timestamptz;
begin
  select * into target from public.missions where id = target_mission_id for update;
  if target.id is null
    or target.proposal_source <> 'provider'
    or target.proposal_review_status <> 'needs_correction'
    or target.proposed_by_user_id <> actor
  then
    raise exception 'Proposal unavailable' using errcode = '42501';
  end if;

  new_start := coalesce(nullif(mission_payload->>'scheduled_start_at','')::timestamptz, target.scheduled_start_at);
  new_end := coalesce(nullif(mission_payload->>'scheduled_end_at','')::timestamptz, target.scheduled_end_at);
  if new_start is null or new_end is null or new_end <= new_start then
    raise exception 'Mission end date must follow start date' using errcode = '23514';
  end if;

  update public.missions
  set title = coalesce(nullif(btrim(mission_payload->>'title'),''), title),
      objective = coalesce(nullif(btrim(mission_payload->>'objective'),''), objective),
      briefing = coalesce(mission_payload->>'briefing', briefing),
      scheduled_start_at = new_start,
      scheduled_end_at = new_end,
      location_mode = case when mission_type = 'animation' then 'in_pharmacy'::public.mission_location_mode else location_mode end,
      proposal_review_status = 'pending',
      proposal_reviewed_by_user_id = null,
      proposal_reviewed_at = null,
      proposal_review_note = null
  where id = target_mission_id;

  if target.mission_type <> 'animation' and product_payload is not null then
    delete from public.mission_products where mission_id = target_mission_id;
    for product_record in select value from jsonb_array_elements(product_payload)
    loop
      if not exists(
        select 1 from public.products p
        where p.id = (product_record->>'product_id')::uuid
          and p.brand_id = target.brand_id
          and p.is_active
      ) then
        raise exception 'Mission product unavailable' using errcode = '42501';
      end if;
      insert into public.mission_products(mission_id, brand_id, product_id)
      values (target_mission_id, target.brand_id, (product_record->>'product_id')::uuid);
    end loop;
  end if;
end;
$$;

revoke all on function public.resubmit_provider_mission_proposal(uuid, jsonb, jsonb) from public;
revoke all on function public.resubmit_provider_mission_proposal(uuid, jsonb, jsonb) from anon;
grant execute on function public.resubmit_provider_mission_proposal(uuid, jsonb, jsonb) to authenticated;
