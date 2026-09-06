create or replace function private.user_assigned_to_brand_pharmacy(
  target_brand_pharmacy_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_is_assigned_to_relation(target_user_id, target_brand_pharmacy_id);
$$;

revoke all on function private.user_assigned_to_brand_pharmacy(uuid, uuid) from public, anon, authenticated;
