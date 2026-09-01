create type public.access_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  requested_profile_type text not null check (requested_profile_type in ('brand', 'agent', 'facilitator')),
  requested_access jsonb not null default '{}'::jsonb,
  status public.access_request_status not null default 'pending',
  target_brand_id uuid references public.brands(id) on delete set null,
  approved_membership_id uuid references public.memberships(id) on delete restrict,
  reviewer_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected', 'cancelled') and reviewed_at is not null and reviewed_by is not null)
  ),
  check (
    (status = 'approved' and target_brand_id is not null and approved_membership_id is not null)
    or status <> 'approved'
  )
);

create index access_requests_status_created_idx
  on public.access_requests(status, created_at desc);

create index access_requests_target_brand_idx
  on public.access_requests(target_brand_id)
  where target_brand_id is not null;

create trigger set_access_requests_updated_at
before update on public.access_requests
for each row execute function private.set_updated_at();

alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon;
grant select, update on public.access_requests to authenticated;

create policy access_requests_select_self_or_platform on public.access_requests
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_global_role(array['super_admin'])
);

create policy access_requests_manage_platform on public.access_requests
for all to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

comment on table public.access_requests is
  'Demandes d’accès créées à l’inscription. Les données déclaratives restent hors autorisation : seul un super_admin attribue une membership active.';

create or replace function public.approve_access_request(
  target_request_id uuid,
  target_brand_id uuid,
  selected_brand_pharmacy_ids uuid[] default array[]::uuid[],
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
  target_role_id smallint;
  target_role_key text;
  target_membership_id uuid;
  target_agent_id uuid;
  valid_pharmacy_count integer;
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

  select * into target_brand
  from public.brands
  where id = target_brand_id
    and is_active
    and status = 'active';

  if target_brand.id is null then
    raise exception 'Target brand must be active' using errcode = '23514';
  end if;

  target_role_key := case request_record.requested_profile_type
    when 'brand' then 'brand_admin'
    when 'agent' then 'agent'
    when 'facilitator' then 'facilitator'
    else null
  end;
  if target_role_key is null then
    raise exception 'Unsupported access request type' using errcode = '23514';
  end if;

  if target_role_key <> 'agent' and coalesce(cardinality(selected_brand_pharmacy_ids), 0) > 0 then
    raise exception 'Only agents can receive pharmacy assignments at approval' using errcode = '23514';
  end if;

  select id into target_role_id from public.roles where key = target_role_key;
  if target_role_id is null then
    raise exception 'Target role not found' using errcode = 'P0002';
  end if;

  insert into public.memberships (
    user_id, organization_id, brand_id, role_id, invited_by, status
  ) values (
    request_record.user_id, target_brand.organization_id, target_brand.id, target_role_id, (select auth.uid()), 'active'
  )
  on conflict (user_id, organization_id, brand_id, role_id)
  do update set status = 'active', invited_by = excluded.invited_by
  returning id into target_membership_id;

  if target_role_key = 'agent' then
    select count(*) into valid_pharmacy_count
    from public.brand_pharmacies
    where brand_id = target_brand.id
      and archived_at is null
      and id = any(selected_brand_pharmacy_ids);
    if valid_pharmacy_count <> cardinality(selected_brand_pharmacy_ids) then
      raise exception 'A pharmacy assignment does not belong to the selected brand' using errcode = '23514';
    end if;

    insert into public.agents (user_id, kind, is_active)
    values (request_record.user_id, 'commercial', true)
    on conflict (user_id, kind)
    do update set is_active = true
    returning id into target_agent_id;

    insert into public.agent_brand_assignments (brand_id, agent_id, starts_at)
    values (target_brand.id, target_agent_id, current_date)
    on conflict (brand_id, agent_id, starts_at) do nothing;

    insert into public.pharmacy_assignments (
      brand_id, brand_pharmacy_id, user_id, assignment_type, is_primary, assigned_by, assignment_reason
    )
    select
      target_brand.id,
      selected_id,
      request_record.user_id,
      'commercial_agent'::public.assignment_type,
      false,
      (select auth.uid()),
      'Activation depuis une demande d''accès'
    from unnest(selected_brand_pharmacy_ids) as selected_id
    where not exists (
      select 1
      from public.pharmacy_assignments existing_assignment
      where existing_assignment.brand_id = target_brand.id
        and existing_assignment.brand_pharmacy_id = selected_id
        and existing_assignment.user_id = request_record.user_id
        and existing_assignment.assignment_type = 'commercial_agent'
        and existing_assignment.ends_at is null
        and existing_assignment.archived_at is null
    );
  end if;

  update public.access_requests
  set
    status = 'approved',
    target_brand_id = target_brand.id,
    approved_membership_id = target_membership_id,
    reviewer_note = nullif(btrim(review_note), ''),
    reviewed_by = (select auth.uid()),
    reviewed_at = now()
  where id = request_record.id;

  return target_membership_id;
end;
$$;

revoke all on function public.approve_access_request(uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.approve_access_request(uuid, uuid, uuid[], text) to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_profile text := new.raw_user_meta_data ->> 'requested_profile_type';
begin
  insert into public.users (id, email) values (new.id, coalesce(new.email, ''));
  insert into public.user_profiles (user_id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));

  if requested_profile in ('brand', 'agent', 'facilitator') then
    insert into public.access_requests (user_id, requested_profile_type, requested_access)
    values (
      new.id,
      requested_profile,
      coalesce(new.raw_user_meta_data -> 'requested_access', '{}'::jsonb)
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
