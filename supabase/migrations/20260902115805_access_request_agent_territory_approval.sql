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
  selected_brand_pharmacy_ids uuid[];
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
    and archived_at is null;

  if target_territory.id is null then
    raise exception 'Target territory must belong to the selected active brand' using errcode = '23514';
  end if;

  select coalesce(array_agg(id order by id), array[]::uuid[])
  into selected_brand_pharmacy_ids
  from public.brand_pharmacies
  where brand_id = target_brand_id
    and territory_id = target_territory.id
    and archived_at is null;

  target_membership_id := public.approve_access_request(
    target_request_id,
    target_brand_id,
    selected_brand_pharmacy_ids,
    review_note
  );

  update public.memberships
  set territory_id = target_territory.id
  where id = target_membership_id;

  return target_membership_id;
end;
$$;

revoke all on function public.approve_access_request_with_territory(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.approve_access_request_with_territory(uuid, uuid, uuid, text) to authenticated;
