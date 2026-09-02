create or replace function private.backfill_historical_access_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_count integer := 0;
begin
  insert into public.access_requests (user_id, requested_profile_type, requested_access)
  select
    auth_user.id,
    auth_user.raw_user_meta_data ->> 'requested_profile_type',
    auth_user.raw_user_meta_data -> 'requested_access'
  from auth.users as auth_user
  join public.users as app_user on app_user.id = auth_user.id
  where auth_user.raw_user_meta_data ->> 'requested_profile_type' in ('brand', 'agent', 'facilitator')
    and jsonb_typeof(auth_user.raw_user_meta_data -> 'requested_access') = 'object'
    and octet_length((auth_user.raw_user_meta_data -> 'requested_access')::text) <= 8192
    and not exists (
      select 1
      from public.access_requests as request
      where request.user_id = auth_user.id
        and request.status = 'pending'
    )
    and not exists (
      select 1
      from public.memberships as membership
      where membership.user_id = auth_user.id
        and membership.brand_id is not null
        and membership.status = 'active'
    )
  on conflict (user_id) where status = 'pending' do nothing;

  get diagnostics created_count = row_count;
  return created_count;
end;
$$;

revoke all on function private.backfill_historical_access_requests() from public, anon, authenticated, service_role;

select private.backfill_historical_access_requests();
