create or replace function private.validate_brand_saas_seat_limit()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  used_seats bigint;
begin
  if new.seat_limit is null then
    return new;
  end if;

  select count(distinct membership.user_id)::bigint into used_seats
  from public.memberships membership
  where membership.brand_id=new.brand_id
    and membership.status in ('invited','active');

  if new.seat_limit < used_seats then
    raise exception 'Seat limit cannot be below current seat usage (%)',used_seats using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_brand_saas_seat_limit() from public,anon,authenticated;

create trigger validate_brand_saas_seat_limit_before_insert
before insert on public.brand_saas_entitlements
for each row execute function private.validate_brand_saas_seat_limit();

create trigger validate_brand_saas_seat_limit_before_update
before update of seat_limit on public.brand_saas_entitlements
for each row execute function private.validate_brand_saas_seat_limit();

comment on function private.validate_brand_saas_seat_limit() is 'Serializes seat-limit changes on the entitlement row and prevents configuring a limit below current distinct invited/active users.';