alter table public.access_requests
  add column if not exists review_source text not null default 'platform';

alter table public.access_requests
  drop constraint if exists access_requests_review_source_check;
alter table public.access_requests
  add constraint access_requests_review_source_check
  check (review_source in ('platform','self_service'));

alter table public.brand_onboarding_sessions
  add column if not exists onboarding_mode text not null default 'managed',
  add column if not exists owner_user_id uuid references public.users(id) on delete set null,
  add column if not exists selected_plan_id uuid references public.saas_plans(id) on delete restrict;

alter table public.brand_onboarding_sessions
  drop constraint if exists brand_onboarding_sessions_mode_check;
alter table public.brand_onboarding_sessions
  add constraint brand_onboarding_sessions_mode_check
  check (onboarding_mode in ('managed','self_service'));

alter table public.brand_onboarding_sessions
  drop constraint if exists brand_onboarding_sessions_self_service_owner_check;
alter table public.brand_onboarding_sessions
  add constraint brand_onboarding_sessions_self_service_owner_check
  check (
    (onboarding_mode = 'managed' and owner_user_id is null)
    or (onboarding_mode = 'self_service' and owner_user_id is not null and selected_plan_id is not null)
  );

create unique index if not exists brand_onboarding_sessions_self_service_owner_active_unique
  on public.brand_onboarding_sessions(owner_user_id)
  where onboarding_mode = 'self_service'
    and status in ('in_progress','ready','blocked');

create or replace function private.can_manage_self_service_onboarding(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.brand_onboarding_sessions onboarding
      where onboarding.brand_id = target_brand_id
        and onboarding.onboarding_mode = 'self_service'
        and onboarding.owner_user_id = (select auth.uid())
        and onboarding.status in ('in_progress','ready','blocked')
    )
    and private.has_brand_role(target_brand_id, array['brand_admin']);
$$;

revoke all on function private.can_manage_self_service_onboarding(uuid) from public, anon, authenticated;

create or replace function public.get_my_self_service_onboarding()
returns table (
  onboarding_id uuid,
  organization_id uuid,
  brand_id uuid,
  status text,
  current_step text,
  step_statuses jsonb,
  selected_plan_key text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    onboarding.id,
    onboarding.organization_id,
    onboarding.brand_id,
    onboarding.status,
    onboarding.current_step,
    onboarding.step_statuses,
    plan.key
  from public.brand_onboarding_sessions onboarding
  join public.saas_plans plan on plan.id = onboarding.selected_plan_id
  where onboarding.onboarding_mode = 'self_service'
    and onboarding.owner_user_id = (select auth.uid())
    and onboarding.status in ('in_progress','ready','blocked')
  order by onboarding.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_self_service_onboarding() from public, anon;
grant execute on function public.get_my_self_service_onboarding() to authenticated;

create or replace function public.start_self_service_onboarding(
  organization_data jsonb,
  brand_data jsonb,
  target_plan_key text
)
returns table (organization_id uuid, brand_id uuid, onboarding_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  access_request_record public.access_requests%rowtype;
  existing_onboarding public.brand_onboarding_sessions%rowtype;
  created_organization_id uuid;
  created_brand_id uuid;
  created_onboarding_id uuid;
  platform_organization_id uuid;
  brand_admin_role_id smallint;
  selected_plan public.saas_plans%rowtype;
  selected_membership_id uuid;
  organization_slug text;
  brand_slug text;
  base_organization_slug text;
  base_brand_slug text;
  workspace_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into existing_onboarding
  from public.brand_onboarding_sessions onboarding
  where onboarding.onboarding_mode = 'self_service'
    and onboarding.owner_user_id = actor_user_id
    and onboarding.status in ('in_progress','ready','blocked')
  order by onboarding.created_at desc
  limit 1;

  if existing_onboarding.id is not null then
    return query
      select existing_onboarding.organization_id, existing_onboarding.brand_id, existing_onboarding.id;
    return;
  end if;

  if not exists (
    select 1 from auth.users auth_user
    where auth_user.id = actor_user_id
      and auth_user.email_confirmed_at is not null
  ) then
    raise exception 'Confirmed email is required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_profiles profile
    where profile.user_id = actor_user_id
      and profile.onboarding_completed_at is not null
      and nullif(btrim(profile.full_name), '') is not null
  ) then
    raise exception 'Personal onboarding must be completed first' using errcode = '42501';
  end if;

  select * into access_request_record
  from public.access_requests request
  where request.user_id = actor_user_id
    and request.requested_profile_type = 'brand'
    and request.status = 'pending'
  for update;

  if access_request_record.id is null then
    raise exception 'A pending brand access request is required' using errcode = '42501';
  end if;

  select plan.* into selected_plan
  from public.saas_plans plan
  where plan.key = lower(btrim(target_plan_key))
    and plan.is_active
    and plan.is_public
    and exists (
      select 1
      from public.saas_plan_capabilities plan_capability
      where plan_capability.plan_id = plan.id
        and plan_capability.capability_key = 'autonomous_onboarding'
        and plan_capability.enabled
    );

  if selected_plan.id is null then
    raise exception 'Selected plan does not support autonomous onboarding' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(organization_data ->> 'legal_name',''))) < 2
    or char_length(btrim(coalesce(brand_data ->> 'name',''))) < 2 then
    raise exception 'Organization and brand names are required' using errcode = '22023';
  end if;

  base_organization_slug := private.slugify_onboarding(
    coalesce(nullif(organization_data ->> 'trade_name',''), organization_data ->> 'legal_name')
  );
  base_brand_slug := private.slugify_onboarding(brand_data ->> 'name');
  if base_organization_slug = '' or base_brand_slug = '' then
    raise exception 'Invalid organization or brand name' using errcode = '22023';
  end if;

  organization_slug := base_organization_slug;
  if exists (select 1 from public.organizations where slug = organization_slug) then
    organization_slug := base_organization_slug || '-' || workspace_suffix;
  end if;
  brand_slug := base_brand_slug;
  if exists (select 1 from public.brands where slug = brand_slug) then
    brand_slug := base_brand_slug || '-' || workspace_suffix;
  end if;

  select id into platform_organization_id
  from public.organizations
  where is_platform_owner
  limit 1;
  if platform_organization_id is null then
    raise exception 'Platform organization is not configured' using errcode = 'P0002';
  end if;

  select id into brand_admin_role_id from public.roles where key = 'brand_admin';
  if brand_admin_role_id is null then
    raise exception 'Brand administrator role is not configured' using errcode = 'P0002';
  end if;

  insert into public.organizations(
    name, legal_name, trade_name, slug, country_code, currency_code, timezone,
    locale, status, external_id, created_by
  ) values (
    coalesce(nullif(organization_data ->> 'trade_name',''), organization_data ->> 'legal_name'),
    organization_data ->> 'legal_name',
    nullif(organization_data ->> 'trade_name',''),
    organization_slug,
    upper(coalesce(nullif(organization_data ->> 'country_code',''),'FR')),
    upper(coalesce(nullif(organization_data ->> 'currency_code',''),'EUR')),
    coalesce(nullif(organization_data ->> 'timezone',''),'Europe/Paris'),
    coalesce(nullif(organization_data ->> 'locale',''),'fr-FR'),
    'draft',
    nullif(organization_data ->> 'external_id',''),
    actor_user_id
  ) returning id into created_organization_id;

  insert into public.brands(
    organization_id, managed_by_organization_id, name, slug, code, country_code,
    currency_code, status, is_active, accent_color, short_description, launch_date, created_by
  ) values (
    created_organization_id,
    platform_organization_id,
    brand_data ->> 'name',
    brand_slug,
    upper(coalesce(nullif(brand_data ->> 'code',''), replace(brand_slug,'-','_'))),
    upper(coalesce(nullif(brand_data ->> 'country_code',''), organization_data ->> 'country_code','FR')),
    upper(coalesce(nullif(brand_data ->> 'currency_code',''), organization_data ->> 'currency_code','EUR')),
    'draft',
    false,
    nullif(brand_data ->> 'accent_color',''),
    nullif(brand_data ->> 'short_description',''),
    nullif(brand_data ->> 'launch_date','')::date,
    actor_user_id
  ) returning id into created_brand_id;

  update public.brand_settings settings
  set
    currency_code = upper(coalesce(nullif(brand_data ->> 'currency_code',''), organization_data ->> 'currency_code','EUR')),
    timezone = coalesce(nullif(organization_data ->> 'timezone',''),'Europe/Paris')
  where settings.brand_id = created_brand_id;

  update public.brand_saas_entitlements entitlement
  set
    plan_id = selected_plan.id,
    status = 'trialing',
    starts_at = now(),
    ends_at = null,
    created_by = coalesce(entitlement.created_by, actor_user_id),
    updated_by = actor_user_id
  where entitlement.brand_id = created_brand_id;

  insert into public.memberships(
    user_id, organization_id, brand_id, role_id, invited_by, status
  ) values (
    actor_user_id,
    created_organization_id,
    created_brand_id,
    brand_admin_role_id,
    actor_user_id,
    'active'
  ) returning id into selected_membership_id;

  insert into public.brand_onboarding_sessions(
    organization_id,
    brand_id,
    status,
    current_step,
    step_statuses,
    created_by,
    onboarding_mode,
    owner_user_id,
    selected_plan_id
  ) values (
    created_organization_id,
    created_brand_id,
    'in_progress',
    'users',
    jsonb_build_object(
      'organization','completed',
      'brand','completed',
      'users','in_progress',
      'territories','not_started',
      'pharmacies','not_started',
      'products','not_started',
      'settings','not_started',
      'orders','skipped',
      'verification','not_started',
      'activation','not_started'
    ),
    actor_user_id,
    'self_service',
    actor_user_id,
    selected_plan.id
  ) returning id into created_onboarding_id;

  update public.access_requests
  set
    status = 'approved',
    target_brand_id = created_brand_id,
    approved_membership_id = selected_membership_id,
    reviewer_note = 'Autonomous onboarding',
    reviewed_by = actor_user_id,
    reviewed_at = now(),
    review_source = 'self_service'
  where id = access_request_record.id;

  insert into public.onboarding_audit_logs(
    organization_id, brand_id, actor_user_id, event_name, metadata
  ) values (
    created_organization_id,
    created_brand_id,
    actor_user_id,
    'onboarding_started',
    jsonb_build_object('mode','self_service','plan',selected_plan.key)
  );

  return query select created_organization_id, created_brand_id, created_onboarding_id;
end;
$$;

revoke all on function public.start_self_service_onboarding(jsonb,jsonb,text) from public, anon;
grant execute on function public.start_self_service_onboarding(jsonb,jsonb,text) to authenticated;

create or replace function public.mark_self_service_onboarding_step(
  target_brand_id uuid,
  target_step text,
  target_status text default 'completed'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_step text;
  target_organization_id uuid;
begin
  if not private.can_manage_self_service_onboarding(target_brand_id) then
    raise exception 'Autonomous onboarding access is required' using errcode = '42501';
  end if;

  if target_step not in ('users','territories','pharmacies','products','settings') then
    raise exception 'Unknown onboarding step' using errcode = '22023';
  end if;
  if target_status not in ('in_progress','completed','skipped') then
    raise exception 'Invalid onboarding step status' using errcode = '22023';
  end if;
  if target_status = 'skipped' and target_step not in ('users','territories') then
    raise exception 'This onboarding step cannot be skipped' using errcode = '23514';
  end if;

  next_step := case target_step
    when 'users' then 'territories'
    when 'territories' then 'pharmacies'
    when 'pharmacies' then 'products'
    when 'products' then 'settings'
    when 'settings' then 'verification'
    else target_step
  end;

  update public.brand_onboarding_sessions onboarding
  set
    step_statuses = jsonb_set(
      onboarding.step_statuses,
      array[target_step],
      to_jsonb(target_status),
      true
    ),
    current_step = case when target_status in ('completed','skipped') then next_step else target_step end
  where onboarding.brand_id = target_brand_id
    and onboarding.onboarding_mode = 'self_service';

  select organization_id into target_organization_id from public.brands where id = target_brand_id;
  if target_status in ('completed','skipped') then
    insert into public.onboarding_audit_logs(
      organization_id, brand_id, actor_user_id, event_name, metadata
    ) values (
      target_organization_id,
      target_brand_id,
      (select auth.uid()),
      'onboarding_step_completed',
      jsonb_build_object('step',target_step,'status',target_status)
    );
  end if;
end;
$$;

revoke all on function public.mark_self_service_onboarding_step(uuid,text,text) from public, anon;
grant execute on function public.mark_self_service_onboarding_step(uuid,text,text) to authenticated;

create or replace function public.activate_self_service_brand(target_brand_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  blocking_count integer;
  target_organization_id uuid;
  target_plan_id uuid;
begin
  if not private.can_manage_self_service_onboarding(target_brand_id) then
    raise exception 'Autonomous onboarding access is required' using errcode = '42501';
  end if;

  select onboarding.selected_plan_id into target_plan_id
  from public.brand_onboarding_sessions onboarding
  where onboarding.brand_id = target_brand_id
    and onboarding.onboarding_mode = 'self_service';

  if target_plan_id is null or not exists (
    select 1
    from public.saas_plan_capabilities capability
    where capability.plan_id = target_plan_id
      and capability.capability_key = 'autonomous_onboarding'
      and capability.enabled
  ) then
    raise exception 'The selected plan does not support autonomous onboarding' using errcode = '23514';
  end if;

  select count(*) into blocking_count
  from public.get_brand_activation_checklist(target_brand_id)
  where blocking and not completed;

  if blocking_count > 0 then
    raise exception 'Brand activation blocked: % required checks missing', blocking_count using errcode = '23514';
  end if;

  select organization_id into target_organization_id
  from public.brands where id = target_brand_id;

  insert into public.onboarding_audit_logs(
    organization_id,brand_id,actor_user_id,event_name,metadata
  ) values (
    target_organization_id,
    target_brand_id,
    (select auth.uid()),
    'brand_activation_ready',
    jsonb_build_object('mode','self_service')
  );

  update public.brands
  set is_active = true, status = 'active', activated_at = now()
  where id = target_brand_id;
  update public.organizations
  set status = 'active'
  where id = target_organization_id;
  update public.brand_saas_entitlements
  set status = 'active', updated_by = (select auth.uid())
  where brand_id = target_brand_id;
  update public.brand_onboarding_sessions
  set
    status = 'completed',
    current_step = 'activation',
    step_statuses = jsonb_set(
      jsonb_set(step_statuses,'{verification}','"completed"'),
      '{activation}','"completed"'
    ),
    activated_at = now(),
    completed_at = now()
  where brand_id = target_brand_id
    and onboarding_mode = 'self_service';

  insert into public.onboarding_audit_logs(
    organization_id,brand_id,actor_user_id,event_name,metadata
  ) values
    (target_organization_id,target_brand_id,(select auth.uid()),'brand_activated',jsonb_build_object('mode','self_service')),
    (target_organization_id,target_brand_id,(select auth.uid()),'onboarding_completed',jsonb_build_object('mode','self_service'));

  return true;
end;
$$;

revoke all on function public.activate_self_service_brand(uuid) from public, anon;
grant execute on function public.activate_self_service_brand(uuid) to authenticated;

comment on function public.start_self_service_onboarding(jsonb,jsonb,text) is
  'Creates a draft organization and brand for a confirmed brand signup, grants only that user brand_admin on the inactive tenant, assigns an eligible public SaaS plan in trialing status, and opens a self-service onboarding session.';

comment on function public.activate_self_service_brand(uuid) is
  'Activates only the caller-owned self-service onboarding after the standard blocking checklist is complete.';
