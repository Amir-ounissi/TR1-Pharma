-- Product Trust P0 follow-up:
-- the facilitator proposal form already collects budget and products.
-- Persist those values for animation proposals so a complete proposal can
-- actually satisfy the approval-readiness rules.
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
  proposed_budget numeric;
begin
  select * into relation
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id
    and archived_at is null;

  if relation.id is null
     or not private.has_brand_role(relation.brand_id, array['agent','facilitator']) then
    raise exception 'Brand pharmacy unavailable' using errcode = '42501';
  end if;

  mission_kind := (mission_payload->>'mission_type')::public.mission_type;

  if not private.mission_execution_role_allowed(relation.brand_id, actor, mission_kind) then
    raise exception 'Mission type is incompatible with provider role' using errcode = '42501';
  end if;

  if private.has_brand_role(relation.brand_id, array['agent'])
     and not private.user_is_assigned_to_relation(actor, relation.id) then
    raise exception 'Pharmacy is outside agent scope' using errcode = '42501';
  end if;

  if nullif(mission_payload->>'title','') is null
     or nullif(mission_payload->>'objective','') is null then
    raise exception 'Mission title and objective are required' using errcode = '23514';
  end if;

  if nullif(mission_payload->>'scheduled_start_at','') is null
     or nullif(mission_payload->>'scheduled_end_at','') is null
     or (mission_payload->>'scheduled_end_at')::timestamptz <= (mission_payload->>'scheduled_start_at')::timestamptz then
    raise exception 'Mission end date must follow start date' using errcode = '23514';
  end if;

  proposed_budget := nullif(mission_payload->>'budget_estimated_ht','')::numeric;
  if proposed_budget is not null and proposed_budget < 0 then
    raise exception 'Mission budget must be non-negative' using errcode = '23514';
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
    case
      when mission_kind = 'animation' then 'in_pharmacy'::public.mission_location_mode
      else coalesce((mission_payload->>'location_mode')::public.mission_location_mode, 'in_pharmacy')
    end,
    proposed_budget,
    proposed_budget,
    'provider',
    actor,
    'provider',
    'pending',
    actor
  from public.brands b
  where b.id = relation.brand_id
  returning id into mission_id;

  for product_record in
    select value from jsonb_array_elements(coalesce(product_payload, '[]'::jsonb))
  loop
    if not exists (
      select 1
      from public.products p
      where p.id = (product_record->>'product_id')::uuid
        and p.brand_id = relation.brand_id
        and p.is_active
    ) then
      raise exception 'Mission product unavailable' using errcode = '42501';
    end if;

    insert into public.mission_products(mission_id, brand_id, product_id)
    values (mission_id, relation.brand_id, (product_record->>'product_id')::uuid);
  end loop;

  return mission_id;
end;
$$;

revoke all on function public.propose_mission(uuid, jsonb, jsonb) from public;
revoke all on function public.propose_mission(uuid, jsonb, jsonb) from anon;
grant execute on function public.propose_mission(uuid, jsonb, jsonb) to authenticated;

comment on function public.propose_mission(uuid, jsonb, jsonb) is
  'Creates a provider proposal while preserving the proposed budget, briefing and products for approval readiness.';
