create or replace function public.approve_facilitator_access_request(
  target_request_id uuid,
  target_brand_id uuid,
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
  target_membership_id uuid;
  target_email text;
  target_display_name text;
  target_phone text;
  target_coverage text;
  requested_activities text[];
  normalized_skills text[];
  resolved_provider_type public.field_provider_type;
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
  if request_record.requested_profile_type <> 'facilitator' then
    raise exception 'This approval is only available for facilitator requests' using errcode = '23514';
  end if;

  select * into target_brand
  from public.brands
  where id = target_brand_id
    and is_active
    and status = 'active'
  for update;

  if target_brand.id is null then
    raise exception 'Target brand must be active' using errcode = '23514';
  end if;

  if jsonb_typeof(request_record.requested_access -> 'activities') = 'array' then
    select coalesce(array_agg(distinct activity order by activity), array[]::text[])
    into requested_activities
    from jsonb_array_elements_text(request_record.requested_access -> 'activities') as activity;
  else
    requested_activities := array[]::text[];
  end if;

  -- Compatibilité avec les anciennes demandes utilisant facilitator_kind.
  if cardinality(requested_activities) = 0 then
    requested_activities := case lower(coalesce(request_record.requested_access ->> 'facilitator_kind', ''))
      when 'animation' then array['animation']::text[]
      when 'animateur' then array['animation']::text[]
      when 'animator' then array['animation']::text[]
      when 'formation' then array['training']::text[]
      when 'formateur' then array['training']::text[]
      when 'trainer' then array['training']::text[]
      when 'animation + formation' then array['animation','training']::text[]
      when 'animation et formation' then array['animation','training']::text[]
      else array[]::text[]
    end;
  end if;

  select coalesce(array_agg(distinct activity order by activity), array[]::text[])
  into normalized_skills
  from unnest(requested_activities) as activity
  where activity in ('animation', 'training');

  if cardinality(normalized_skills) = 0 then
    raise exception 'At least one facilitator activity is required' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(requested_activities) activity
    where activity not in ('animation', 'training')
  ) then
    raise exception 'Unsupported facilitator activity' using errcode = '22023';
  end if;

  resolved_provider_type := case
    when normalized_skills = array['animation']::text[] then 'animator'::public.field_provider_type
    when normalized_skills = array['training']::text[] then 'trainer'::public.field_provider_type
    else 'other'::public.field_provider_type
  end;

  select
    nullif(btrim(platform_user.email), ''),
    coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(platform_user.email), ''), 'Intervenant'),
    coalesce(nullif(btrim(profile.phone), ''), nullif(btrim(request_record.requested_access ->> 'phone'), ''))
  into target_email, target_display_name, target_phone
  from public.users platform_user
  left join public.user_profiles profile on profile.user_id = platform_user.id
  where platform_user.id = request_record.user_id;

  if target_email is null then
    raise exception 'Facilitator email is required' using errcode = '23514';
  end if;

  target_coverage := coalesce(
    nullif(btrim(request_record.requested_access ->> 'service_area'), ''),
    nullif(btrim(request_record.requested_access ->> 'territory'), '')
  );

  target_membership_id := public.approve_access_request(
    target_request_id,
    target_brand.id,
    array[]::uuid[],
    review_note
  );

  insert into public.field_providers (
    organization_id,
    user_id,
    provider_type,
    display_name,
    email,
    phone,
    status,
    coverage_areas,
    skills,
    brands_authorized,
    archived_at
  ) values (
    target_brand.organization_id,
    request_record.user_id,
    resolved_provider_type,
    target_display_name,
    target_email,
    target_phone,
    'active',
    case when target_coverage is null then array[]::text[] else array[target_coverage]::text[] end,
    normalized_skills,
    array[target_brand.id]::uuid[],
    null
  )
  on conflict (organization_id, email)
  do update set
    user_id = excluded.user_id,
    provider_type = excluded.provider_type,
    display_name = excluded.display_name,
    phone = coalesce(excluded.phone, public.field_providers.phone),
    status = 'active',
    coverage_areas = (
      select coalesce(array_agg(distinct item order by item), array[]::text[])
      from unnest(public.field_providers.coverage_areas || excluded.coverage_areas) item
      where nullif(btrim(item), '') is not null
    ),
    skills = (
      select coalesce(array_agg(distinct item order by item), array[]::text[])
      from unnest(public.field_providers.skills || excluded.skills) item
      where item in ('animation', 'training')
    ),
    brands_authorized = (
      select coalesce(array_agg(distinct item order by item), array[]::uuid[])
      from unnest(public.field_providers.brands_authorized || excluded.brands_authorized) item
    ),
    archived_at = null;

  return target_membership_id;
end;
$$;

revoke all on function public.approve_facilitator_access_request(uuid, uuid, text) from public, anon;
grant execute on function public.approve_facilitator_access_request(uuid, uuid, text) to authenticated;

comment on function public.approve_facilitator_access_request(uuid, uuid, text) is
  'Approves a facilitator access request and creates/updates one multiskill field provider profile. Skills support animation, training, or both.';
