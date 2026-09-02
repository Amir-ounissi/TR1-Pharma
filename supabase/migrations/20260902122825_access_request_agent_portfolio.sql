alter table public.access_requests
  add column if not exists target_territory_id uuid references public.territories(id) on delete restrict;

create index if not exists access_requests_target_territory_idx
  on public.access_requests(target_territory_id)
  where target_territory_id is not null;

create or replace function private.assign_territory_portfolio_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  portfolio_agent_user_ids uuid[];
  portfolio_agent_user_id uuid;
begin
  if new.archived_at is not null or new.territory_id is null then
    return new;
  end if;

  select coalesce(array_agg(distinct membership.user_id), array[]::uuid[])
  into portfolio_agent_user_ids
  from public.memberships membership
  join public.roles role on role.id = membership.role_id
  where membership.brand_id = new.brand_id
    and membership.territory_id = new.territory_id
    and membership.status = 'active'
    and role.key = 'agent';

  if cardinality(portfolio_agent_user_ids) > 1 then
    raise exception 'Territory has multiple active agent portfolios' using errcode = '23514';
  end if;
  if cardinality(portfolio_agent_user_ids) = 0 then
    return new;
  end if;

  portfolio_agent_user_id := portfolio_agent_user_ids[1];

  if new.current_agent_user_id is not null and new.current_agent_user_id <> portfolio_agent_user_id then
    raise exception 'Territory pharmacy already has another primary agent' using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.pharmacy_assignments assignment
    where assignment.brand_pharmacy_id = new.id
      and assignment.assignment_type = 'commercial_agent'
      and assignment.is_primary
      and assignment.ends_at is null
      and assignment.archived_at is null
      and assignment.user_id <> portfolio_agent_user_id
  ) then
    raise exception 'Territory pharmacy already has another primary agent' using errcode = '23514';
  end if;

  insert into public.pharmacy_assignments (
    brand_id,
    brand_pharmacy_id,
    user_id,
    assignment_type,
    is_primary,
    assigned_by,
    assignment_reason
  )
  select
    new.brand_id,
    new.id,
    portfolio_agent_user_id,
    'commercial_agent'::public.assignment_type,
    true,
    (select auth.uid()),
    'Portefeuille principal dérivé du territoire'
  where not exists (
    select 1
    from public.pharmacy_assignments assignment
    where assignment.brand_pharmacy_id = new.id
      and assignment.user_id = portfolio_agent_user_id
      and assignment.assignment_type = 'commercial_agent'
      and assignment.is_primary
      and assignment.ends_at is null
      and assignment.archived_at is null
  );

  return new;
end;
$$;

drop trigger if exists assign_territory_portfolio_owner on public.brand_pharmacies;
create trigger assign_territory_portfolio_owner
after insert or update of territory_id, archived_at on public.brand_pharmacies
for each row execute function private.assign_territory_portfolio_owner();

create or replace function public.approve_access_request_with_territory(
  target_request_id uuid,
  target_brand_id uuid,
  target_territory_id uuid,
  review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.access_requests%rowtype;
  target_brand public.brands%rowtype;
  target_territory public.territories%rowtype;
  target_membership_id uuid;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode = '42501';
  end if;

  select * into request_record
  from public.access_requests
  where id = target_request_id
  for update;

  if request_record.id is null then
    raise exception 'Access request not found' using errcode = 'P0002';
  end if;
  if request_record.status <> 'pending' then
    raise exception 'Access request has already been reviewed' using errcode = 'P0001';
  end if;
  if request_record.requested_profile_type <> 'agent' then
    raise exception 'Territory approval is only available for agent requests' using errcode = '23514';
  end if;

  select * into target_brand
  from public.brands
  where id = target_brand_id
    and is_active
    and status = 'active';

  if target_brand.id is null then
    raise exception 'Target brand must be active' using errcode = '23514';
  end if;

  select * into target_territory
  from public.territories
  where id = target_territory_id
    and brand_id = target_brand_id
    and archived_at is null
  for update;

  if target_territory.id is null then
    raise exception 'Target territory must belong to the selected active brand' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.brand_id = target_brand.id
      and membership.territory_id = target_territory.id
      and membership.status = 'active'
      and role.key = 'agent'
      and membership.user_id <> request_record.user_id
  ) then
    raise exception 'Territory already has an active agent portfolio' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.brand_pharmacies pharmacy
    where pharmacy.brand_id = target_brand.id
      and pharmacy.territory_id = target_territory.id
      and pharmacy.archived_at is null
      and pharmacy.current_agent_user_id is not null
      and pharmacy.current_agent_user_id <> request_record.user_id
  ) or exists (
    select 1
    from public.pharmacy_assignments assignment
    join public.brand_pharmacies pharmacy on pharmacy.id = assignment.brand_pharmacy_id
    where pharmacy.brand_id = target_brand.id
      and pharmacy.territory_id = target_territory.id
      and pharmacy.archived_at is null
      and assignment.assignment_type = 'commercial_agent'
      and assignment.is_primary
      and assignment.ends_at is null
      and assignment.archived_at is null
      and assignment.user_id <> request_record.user_id
  ) then
    raise exception 'Territory contains pharmacies assigned to another primary agent' using errcode = '23514';
  end if;

  target_membership_id := public.approve_access_request(
    target_request_id,
    target_brand_id,
    array[]::uuid[],
    review_note
  );

  update public.memberships
  set territory_id = target_territory.id
  where id = target_membership_id;

  update public.access_requests
  set target_territory_id = target_territory.id
  where id = target_request_id;

  insert into public.pharmacy_assignments (
    brand_id,
    brand_pharmacy_id,
    user_id,
    assignment_type,
    is_primary,
    assigned_by,
    assignment_reason
  )
  select
    target_brand.id,
    pharmacy.id,
    request_record.user_id,
    'commercial_agent'::public.assignment_type,
    true,
    (select auth.uid()),
    'Portefeuille principal attribué par territoire'
  from public.brand_pharmacies pharmacy
  where pharmacy.brand_id = target_brand.id
    and pharmacy.territory_id = target_territory.id
    and pharmacy.archived_at is null;

  return target_membership_id;
end;
$$;

revoke all on function public.approve_access_request_with_territory(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.approve_access_request_with_territory(uuid, uuid, uuid, text) to authenticated;
