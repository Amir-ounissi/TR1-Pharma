alter table public.territories
  add column if not exists department_codes text[];

update public.territories
set department_codes = array[upper(btrim(department_code))]
where department_code is not null
  and btrim(department_code) <> ''
  and coalesce(cardinality(department_codes), 0) = 0;

create index if not exists territories_department_codes_gin_idx
  on public.territories using gin (department_codes)
  where archived_at is null
    and department_codes is not null;

create or replace function private.department_code_from_postal_code(value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g');

  if length(normalized) <> 5 then
    return null;
  end if;

  if left(normalized, 3) in ('971', '972', '973', '974', '976') then
    return left(normalized, 3);
  end if;

  if left(normalized, 2) = '20' then
    if normalized::integer < 20200 then
      return '2A';
    end if;

    return '2B';
  end if;

  return left(normalized, 2);
end;
$$;

revoke all on function private.department_code_from_postal_code(text)
  from public, anon, authenticated;

create or replace function private.infer_brand_pharmacy_territory_from_department()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pharmacy_department_code text;
  matching_territory_ids uuid[];
begin
  if new.archived_at is not null or new.territory_id is not null then
    return new;
  end if;

  select private.department_code_from_postal_code(pharmacy.postal_code)
  into pharmacy_department_code
  from public.pharmacies pharmacy
  where pharmacy.id = new.pharmacy_id;

  if pharmacy_department_code is null then
    return new;
  end if;

  select coalesce(array_agg(distinct territory.id), array[]::uuid[])
  into matching_territory_ids
  from public.territories territory
  join public.memberships membership
    on membership.territory_id = territory.id
   and membership.brand_id = new.brand_id
   and membership.status = 'active'
  join public.roles role
    on role.id = membership.role_id
   and role.key = 'agent'
  where territory.brand_id = new.brand_id
    and territory.archived_at is null
    and pharmacy_department_code = any(
      coalesce(territory.department_codes, array[]::text[])
    );

  if cardinality(matching_territory_ids) = 1 then
    new.territory_id := matching_territory_ids[1];
  end if;

  return new;
end;
$$;

revoke all on function private.infer_brand_pharmacy_territory_from_department()
  from public, anon, authenticated;

drop trigger if exists infer_brand_pharmacy_territory_from_department
  on public.brand_pharmacies;

create trigger infer_brand_pharmacy_territory_from_department
before insert or update on public.brand_pharmacies
for each row
execute function private.infer_brand_pharmacy_territory_from_department();

create or replace function public.approve_access_request_with_departments(
  target_request_id uuid,
  target_brand_id uuid,
  target_department_codes text[],
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
  normalized_department_codes text[];
  target_membership_id uuid;
  created_territory_id uuid;
  agent_label text;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required'
      using errcode = '42501';
  end if;

  select array_agg(normalized.code order by normalized.code)
  into normalized_department_codes
  from (
    select distinct upper(btrim(code)) as code
    from unnest(coalesce(target_department_codes, array[]::text[])) as code
    where btrim(code) <> ''
  ) normalized;

  if coalesce(cardinality(normalized_department_codes), 0) = 0
    or cardinality(normalized_department_codes) > 101
  then
    raise exception 'At least one French department is required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(normalized_department_codes) as department_code
    where department_code !~
      '^(0[1-9]|1[0-9]|2[1-9]|[3-8][0-9]|9[0-5]|2A|2B|97[1-4]|976)$'
  ) then
    raise exception 'Invalid French department code'
      using errcode = '22023';
  end if;

  select *
  into request_record
  from public.access_requests
  where id = target_request_id
  for update;

  if request_record.id is null then
    raise exception 'Access request not found'
      using errcode = 'P0002';
  end if;

  if request_record.status <> 'pending' then
    raise exception 'Access request has already been reviewed'
      using errcode = 'P0001';
  end if;

  if request_record.requested_profile_type <> 'agent' then
    raise exception 'Department approval is only available for agent requests'
      using errcode = '23514';
  end if;

  select *
  into target_brand
  from public.brands
  where id = target_brand_id
    and is_active
    and status = 'active'
  for update;

  if target_brand.id is null then
    raise exception 'Target brand must be active'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.territories territory
    join public.memberships membership
      on membership.territory_id = territory.id
     and membership.brand_id = target_brand.id
     and membership.status = 'active'
    join public.roles role
      on role.id = membership.role_id
     and role.key = 'agent'
    where territory.brand_id = target_brand.id
      and territory.archived_at is null
      and coalesce(territory.department_codes, array[]::text[])
        && normalized_department_codes
      and membership.user_id <> request_record.user_id
  ) then
    raise exception 'One or more departments are already covered by an active agent'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.brand_pharmacies brand_pharmacy
    join public.pharmacies pharmacy
      on pharmacy.id = brand_pharmacy.pharmacy_id
    where brand_pharmacy.brand_id = target_brand.id
      and brand_pharmacy.archived_at is null
      and private.department_code_from_postal_code(pharmacy.postal_code)
        = any(normalized_department_codes)
      and (
        (
          brand_pharmacy.current_agent_user_id is not null
          and brand_pharmacy.current_agent_user_id <> request_record.user_id
        )
        or exists (
          select 1
          from public.pharmacy_assignments assignment
          where assignment.brand_pharmacy_id = brand_pharmacy.id
            and assignment.assignment_type = 'commercial_agent'
            and assignment.is_primary
            and assignment.ends_at is null
            and assignment.archived_at is null
            and assignment.user_id <> request_record.user_id
        )
      )
  ) then
    raise exception 'Department contains pharmacies assigned to another primary agent'
      using errcode = '23514';
  end if;

  select coalesce(
    nullif(btrim(profile.full_name), ''),
    nullif(btrim(platform_user.email), ''),
    'Agent'
  )
  into agent_label
  from public.users platform_user
  left join public.user_profiles profile
    on profile.user_id = platform_user.id
  where platform_user.id = request_record.user_id;

  insert into public.territories (
    organization_id,
    brand_id,
    name,
    code,
    territory_type,
    country_code,
    department_code,
    department_codes
  )
  values (
    target_brand.organization_id,
    target_brand.id,
    'Secteur ' || left(coalesce(agent_label, 'Agent'), 80)
      || ' — ' || array_to_string(normalized_department_codes, ' / '),
    'AG-' || upper(left(replace(target_request_id::text, '-', ''), 8)),
    'custom',
    'FR',
    case
      when cardinality(normalized_department_codes) = 1
        then normalized_department_codes[1]
      else null
    end,
    normalized_department_codes
  )
  returning id into created_territory_id;

  target_membership_id := public.approve_access_request(
    target_request_id,
    target_brand.id,
    array[]::uuid[],
    review_note
  );

  update public.memberships
  set territory_id = created_territory_id
  where id = target_membership_id;

  update public.access_requests
  set target_territory_id = created_territory_id
  where id = target_request_id;

  update public.brand_pharmacies brand_pharmacy
  set territory_id = created_territory_id
  from public.pharmacies pharmacy
  where brand_pharmacy.brand_id = target_brand.id
    and brand_pharmacy.pharmacy_id = pharmacy.id
    and brand_pharmacy.archived_at is null
    and private.department_code_from_postal_code(pharmacy.postal_code)
      = any(normalized_department_codes)
    and brand_pharmacy.territory_id is distinct from created_territory_id;

  return target_membership_id;
end;
$$;

revoke all on function public.approve_access_request_with_departments(
  uuid,
  uuid,
  text[],
  text
) from public, anon;

grant execute on function public.approve_access_request_with_departments(
  uuid,
  uuid,
  text[],
  text
) to authenticated;
