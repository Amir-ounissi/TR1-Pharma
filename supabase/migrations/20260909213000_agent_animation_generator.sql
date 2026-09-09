-- Dedicated animation request contract for brand teams and field agents.
-- Agents may only request an animation for pharmacies in their active primary portfolio.

alter table public.missions
  add column if not exists execution_requirements jsonb not null default '{"report_required":true,"merch_plan_required":true,"merch_result_required":true,"cash_register_required":false,"before_after_required":false,"sales_by_product_required":false}'::jsonb;

alter table public.missions
  drop constraint if exists missions_execution_requirements_object_check;
alter table public.missions
  add constraint missions_execution_requirements_object_check
  check (jsonb_typeof(execution_requirements) = 'object');

comment on column public.missions.execution_requirements is
  'Mission-specific proof and closeout requirements configured when the mission is requested.';

create or replace function private.can_request_animation_for_pharmacy(
  target_brand_pharmacy_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brand_pharmacies bp
    where bp.id = target_brand_pharmacy_id
      and bp.archived_at is null
      and (
        private.user_is_tr1_for_brand(bp.brand_id)
        or private.has_brand_role(bp.brand_id, array['brand_admin'])
        or (
          private.has_brand_role(bp.brand_id, array['agent'])
          and target_user_id = (select auth.uid())
          and exists (
            select 1
            from public.pharmacy_assignments pa
            where pa.brand_pharmacy_id = bp.id
              and pa.brand_id = bp.brand_id
              and pa.user_id = target_user_id
              and pa.assignment_type = 'commercial_agent'
              and pa.is_primary
              and pa.ends_at is null
              and pa.archived_at is null
          )
        )
      )
  );
$$;

revoke all on function private.can_request_animation_for_pharmacy(uuid,uuid) from public, anon, authenticated;

create or replace function public.get_animation_facilitators(target_brand_id uuid)
returns table(user_id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id, coalesce(up.full_name, u.email, 'Animateur') as full_name
  from public.memberships m
  join public.roles r on r.id = m.role_id
  join public.users u on u.id = m.user_id
  left join public.user_profiles up on up.user_id = m.user_id
  where m.brand_id = target_brand_id
    and m.status = 'active'
    and r.key = 'facilitator'
    and (
      private.user_is_tr1_for_brand(target_brand_id)
      or private.has_brand_role(target_brand_id, array['brand_admin','agent'])
    )
  order by coalesce(up.full_name, u.email, 'Animateur');
$$;

revoke all on function public.get_animation_facilitators(uuid) from public, anon;
grant execute on function public.get_animation_facilitators(uuid) to authenticated;

create or replace function public.request_animation(
  target_brand_pharmacy_id uuid,
  target_assigned_user_id uuid default null,
  mission_payload jsonb default '{}'::jsonb,
  product_payload jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_record public.brand_pharmacies%rowtype;
  mission_id uuid;
  product_record jsonb;
  actor uuid := (select auth.uid());
  requirements jsonb;
  target_status public.mission_status;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into relation_record
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id
    and archived_at is null;

  if relation_record.id is null
     or not private.can_request_animation_for_pharmacy(target_brand_pharmacy_id, actor)
  then
    raise exception 'Animation pharmacy unavailable' using errcode='42501';
  end if;

  if coalesce(nullif(btrim(mission_payload->>'title'),''),'') = ''
     or coalesce(nullif(btrim(mission_payload->>'objective'),''),'') = ''
  then
    raise exception 'Animation title and objective are required' using errcode='23514';
  end if;

  if nullif(mission_payload->>'scheduled_start_at','') is null
     or nullif(mission_payload->>'scheduled_end_at','') is null
     or (mission_payload->>'scheduled_end_at')::timestamptz <= (mission_payload->>'scheduled_start_at')::timestamptz
  then
    raise exception 'Animation requires a valid requested time range' using errcode='23514';
  end if;

  if target_assigned_user_id is not null then
    if not private.mission_execution_role_allowed(relation_record.brand_id, target_assigned_user_id, 'animation'::public.mission_type)
       or not exists (
         select 1
         from public.memberships membership
         join public.roles role on role.id = membership.role_id
         where membership.user_id = target_assigned_user_id
           and membership.brand_id = relation_record.brand_id
           and membership.status = 'active'
           and role.key = 'facilitator'
       )
    then
      raise exception 'Selected facilitator is unavailable for this brand' using errcode='42501';
    end if;
    target_status := 'assigned'::public.mission_status;
  else
    target_status := 'requested'::public.mission_status;
  end if;

  requirements := coalesce(mission_payload->'execution_requirements','{}'::jsonb);
  requirements := jsonb_build_object(
    'report_required', true,
    'merch_plan_required', coalesce((requirements->>'merch_plan_required')::boolean, true),
    'merch_result_required', coalesce((requirements->>'merch_result_required')::boolean, true),
    'cash_register_required', coalesce((requirements->>'cash_register_required')::boolean, true),
    'before_after_required', coalesce((requirements->>'before_after_required')::boolean, false),
    'sales_by_product_required', coalesce((requirements->>'sales_by_product_required')::boolean, true)
  );

  insert into public.missions(
    organization_id,brand_id,brand_pharmacy_id,pharmacy_id,mission_type,status,title,objective,briefing,
    requested_by,managed_by,assigned_user_id,scheduled_start_at,scheduled_end_at,priority,location_mode,
    budget_estimated_ht,cost_estimated_ht,provider_cost_ht,travel_cost_ht,report_due_at,source,created_by,
    execution_requirements
  )
  select
    b.organization_id,relation_record.brand_id,relation_record.id,relation_record.pharmacy_id,
    'animation'::public.mission_type,target_status,
    btrim(mission_payload->>'title'),btrim(mission_payload->>'objective'),nullif(btrim(mission_payload->>'briefing'),''),
    actor,actor,target_assigned_user_id,
    (mission_payload->>'scheduled_start_at')::timestamptz,
    (mission_payload->>'scheduled_end_at')::timestamptz,
    coalesce((mission_payload->>'priority')::public.mission_priority,'normal'::public.mission_priority),
    'in_pharmacy'::public.mission_location_mode,
    nullif(mission_payload->>'budget_estimated_ht','')::numeric,
    nullif(mission_payload->>'cost_estimated_ht','')::numeric,
    coalesce(nullif(mission_payload->>'provider_cost_ht','')::numeric,0),
    coalesce(nullif(mission_payload->>'travel_cost_ht','')::numeric,0),
    nullif(mission_payload->>'report_due_at','')::timestamptz,
    'manual',actor,requirements
  from public.brands b
  where b.id = relation_record.brand_id
  returning id into mission_id;

  for product_record in select value from jsonb_array_elements(coalesce(product_payload,'[]'::jsonb)) loop
    if not exists (
      select 1 from public.products p
      where p.id = (product_record->>'product_id')::uuid
        and p.brand_id = relation_record.brand_id
        and p.is_active
    ) then
      raise exception 'Animation product unavailable' using errcode='23514';
    end if;

    insert into public.mission_products(
      mission_id,brand_id,product_id,objective_type,target_quantity,priority,briefing_notes
    ) values (
      mission_id,relation_record.brand_id,(product_record->>'product_id')::uuid,
      'other'::public.mission_objective_type,
      nullif(product_record->>'target_quantity','')::integer,
      coalesce((product_record->>'priority')::public.mission_priority,'normal'::public.mission_priority),
      nullif(btrim(product_record->>'briefing_notes'),'')
    );
  end loop;

  return mission_id;
end;
$$;

revoke all on function public.request_animation(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.request_animation(uuid,uuid,jsonb,jsonb) to authenticated;

create or replace function private.enforce_facilitator_mission_closeout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_mission public.missions%rowtype;
  assigned_is_facilitator boolean := false;
  requirements jsonb;
  has_merch_plan boolean := false;
  has_merch_before boolean := false;
  has_merch_after boolean := false;
  has_merch_result boolean := false;
  cash_evidence_count integer := 0;
  untreated_cash_count integer := 0;
begin
  select * into target_mission
  from public.missions
  where id = new.mission_id;

  if target_mission.id is null or target_mission.assigned_user_id is null then return new; end if;

  select exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = target_mission.assigned_user_id
      and membership.brand_id = target_mission.brand_id
      and membership.status = 'active'
      and role.key = 'facilitator'
  ) into assigned_is_facilitator;

  if not assigned_is_facilitator then return new; end if;

  if new.report_status in ('draft','needs_correction','rejected') then
    new.data_quality_status := 'incomplete';
    return new;
  end if;
  if new.report_status not in ('submitted','validated') then return new; end if;

  requirements := coalesce(target_mission.execution_requirements,'{}'::jsonb);

  select
    bool_or(attachment.evidence_kind = 'merch_plan'),
    bool_or(attachment.evidence_kind = 'merch_before'),
    bool_or(attachment.evidence_kind = 'merch_after'),
    bool_or(attachment.evidence_kind in ('merch_after','merch_detail','merch_plv')),
    count(*) filter (where attachment.evidence_kind = 'cash_register')::integer
  into has_merch_plan,has_merch_before,has_merch_after,has_merch_result,cash_evidence_count
  from public.mission_attachments attachment
  where attachment.mission_id = target_mission.id
    and attachment.uploaded_by = target_mission.assigned_user_id
    and attachment.archived_at is null;

  if target_mission.mission_type in ('animation','merchandising') then
    if coalesce((requirements->>'merch_plan_required')::boolean,true) and not coalesce(has_merch_plan,false) then
      raise exception 'Facilitator closeout requires merch plan evidence' using errcode='23514';
    end if;
    if coalesce((requirements->>'merch_result_required')::boolean,true) and not coalesce(has_merch_result,false) then
      raise exception 'Facilitator closeout requires merchandising result evidence' using errcode='23514';
    end if;
    if coalesce((requirements->>'before_after_required')::boolean,false)
       and (not coalesce(has_merch_before,false) or not coalesce(has_merch_after,false))
    then
      raise exception 'Facilitator closeout requires before and after merchandising evidence' using errcode='23514';
    end if;
  end if;

  if coalesce((requirements->>'cash_register_required')::boolean,false) and cash_evidence_count = 0 then
    raise exception 'Facilitator closeout requires cash-register evidence' using errcode='23514';
  end if;

  if cash_evidence_count > 0 then
    select count(*)::integer into untreated_cash_count
    from public.mission_attachments attachment
    where attachment.mission_id = target_mission.id
      and attachment.uploaded_by = target_mission.assigned_user_id
      and attachment.archived_at is null
      and attachment.evidence_kind = 'cash_register'
      and not exists (
        select 1
        from public.sell_out_captures capture
        where capture.source_mission_attachment_id = attachment.id
          and capture.archived_at is null
          and capture.status in ('review_required','validated')
      );
    if untreated_cash_count > 0 then
      raise exception 'Cash-register evidence requires sell-out review before report submission' using errcode='23514';
    end if;
  end if;

  new.data_quality_status := 'complete';
  return new;
end;
$$;

revoke all on function private.enforce_facilitator_mission_closeout() from public, anon, authenticated;

comment on function public.request_animation(uuid,uuid,jsonb,jsonb) is
  'Creates an animation request for brand managers or agents, with portfolio-scoped agent authorization and mission-specific closeout requirements.';
