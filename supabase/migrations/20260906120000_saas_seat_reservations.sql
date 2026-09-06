create table private.brand_seat_reservations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  email text not null,
  role_id smallint not null references public.roles(id) on delete restrict,
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint brand_seat_reservations_email_check check (
    email=lower(btrim(email))
    and char_length(email) between 3 and 320
    and position('@' in email) > 1
  )
);

create index brand_seat_reservations_brand_expiry_idx
  on private.brand_seat_reservations(brand_id,expires_at);

alter table private.brand_seat_reservations enable row level security;
revoke all on private.brand_seat_reservations from public,anon,authenticated;

create or replace function public.reserve_brand_saas_seat(
  target_brand_id uuid,
  target_email text,
  target_role_id smallint,
  target_invited_by uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  normalized_email text := lower(btrim(coalesce(target_email,'')));
  target_limit integer;
  used_seats bigint;
  reserved_seats bigint;
  reservation_id uuid;
begin
  if char_length(normalized_email) not between 3 and 320 or position('@' in normalized_email) <= 1 then
    raise exception 'A valid invitation email is required' using errcode='22023';
  end if;
  if target_role_id is null then
    raise exception 'Invitation role is required' using errcode='22023';
  end if;

  select entitlement.seat_limit into target_limit
  from public.brand_saas_entitlements entitlement
  where entitlement.brand_id=target_brand_id
  for update;

  if not found then
    raise exception 'Brand SaaS entitlement is required before assigning seats' using errcode='23514';
  end if;

  delete from private.brand_seat_reservations reservation
  where reservation.brand_id=target_brand_id
    and reservation.expires_at <= now();

  select count(distinct membership.user_id)::bigint into used_seats
  from public.memberships membership
  where membership.brand_id=target_brand_id
    and membership.status in ('invited','active');

  select count(*)::bigint into reserved_seats
  from private.brand_seat_reservations reservation
  where reservation.brand_id=target_brand_id
    and reservation.expires_at > now();

  if target_limit is not null and used_seats + reserved_seats >= target_limit then
    raise exception 'SaaS seat limit reached for this brand' using errcode='23514';
  end if;

  insert into private.brand_seat_reservations(
    brand_id,email,role_id,invited_by,expires_at
  ) values(
    target_brand_id,normalized_email,target_role_id,target_invited_by,now()+interval '10 minutes'
  )
  returning id into reservation_id;

  return reservation_id;
end;
$$;

create or replace function public.release_brand_saas_seat(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  delete from private.brand_seat_reservations reservation
  where reservation.id=target_reservation_id;
end;
$$;

create or replace function public.consume_brand_saas_seat(
  target_reservation_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  reservation_brand_id uuid;
  reservation private.brand_seat_reservations%rowtype;
  target_organization_id uuid;
  membership_id uuid;
begin
  if target_user_id is null then
    raise exception 'Invited user is required' using errcode='22023';
  end if;

  select seat_reservation.brand_id into reservation_brand_id
  from private.brand_seat_reservations seat_reservation
  where seat_reservation.id=target_reservation_id;

  if reservation_brand_id is null then
    raise exception 'SaaS seat reservation not found' using errcode='23514';
  end if;

  perform 1
  from public.brand_saas_entitlements entitlement
  where entitlement.brand_id=reservation_brand_id
  for update;

  if not found then
    raise exception 'Brand SaaS entitlement is required before assigning seats' using errcode='23514';
  end if;

  select seat_reservation.* into reservation
  from private.brand_seat_reservations seat_reservation
  where seat_reservation.id=target_reservation_id
  for update;

  if not found then
    raise exception 'SaaS seat reservation not found' using errcode='23514';
  end if;
  if reservation.expires_at <= now() then
    raise exception 'SaaS seat reservation expired' using errcode='23514';
  end if;

  select brand.organization_id into target_organization_id
  from public.brands brand
  where brand.id=reservation.brand_id;

  if target_organization_id is null then
    raise exception 'Brand organization is required before assigning seats' using errcode='23514';
  end if;

  delete from private.brand_seat_reservations seat_reservation
  where seat_reservation.id=target_reservation_id;

  insert into public.memberships(
    user_id,organization_id,brand_id,role_id,invited_by,status
  ) values(
    target_user_id,
    target_organization_id,
    reservation.brand_id,
    reservation.role_id,
    reservation.invited_by,
    'invited'
  )
  returning id into membership_id;

  return membership_id;
end;
$$;

revoke all on function public.reserve_brand_saas_seat(uuid,text,smallint,uuid) from public,anon,authenticated;
revoke all on function public.release_brand_saas_seat(uuid) from public,anon,authenticated;
revoke all on function public.consume_brand_saas_seat(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_brand_saas_seat(uuid,text,smallint,uuid) to service_role;
grant execute on function public.release_brand_saas_seat(uuid) to service_role;
grant execute on function public.consume_brand_saas_seat(uuid,uuid) to service_role;

create or replace function private.enforce_brand_seat_limit()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  target_limit integer;
  used_seats bigint;
  reserved_seats bigint;
begin
  if new.brand_id is null or new.status not in ('invited','active') then
    return new;
  end if;

  select entitlement.seat_limit into target_limit
  from public.brand_saas_entitlements entitlement
  where entitlement.brand_id=new.brand_id
  for update;

  if not found then
    raise exception 'Brand SaaS entitlement is required before assigning seats' using errcode='23514';
  end if;
  if target_limit is null then
    return new;
  end if;

  if exists(
    select 1
    from public.memberships membership
    where membership.brand_id=new.brand_id
      and membership.user_id=new.user_id
      and membership.status in ('invited','active')
      and membership.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    return new;
  end if;

  select count(distinct membership.user_id)::bigint into used_seats
  from public.memberships membership
  where membership.brand_id=new.brand_id
    and membership.status in ('invited','active')
    and membership.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  select count(*)::bigint into reserved_seats
  from private.brand_seat_reservations reservation
  where reservation.brand_id=new.brand_id
    and reservation.expires_at > now();

  if used_seats + reserved_seats >= target_limit then
    raise exception 'SaaS seat limit reached for this brand' using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_brand_seat_limit() from public,anon,authenticated;

create or replace function private.validate_brand_saas_seat_limit()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  used_seats bigint;
  reserved_seats bigint;
begin
  if new.seat_limit is null then
    return new;
  end if;

  select count(distinct membership.user_id)::bigint into used_seats
  from public.memberships membership
  where membership.brand_id=new.brand_id
    and membership.status in ('invited','active');

  select count(*)::bigint into reserved_seats
  from private.brand_seat_reservations reservation
  where reservation.brand_id=new.brand_id
    and reservation.expires_at > now();

  if new.seat_limit < used_seats + reserved_seats then
    raise exception 'Seat limit cannot be below current seat usage (%)',used_seats + reserved_seats using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_brand_saas_seat_limit() from public,anon,authenticated;

comment on table private.brand_seat_reservations is 'Short-lived seat commitments created before external Auth invitations so concurrent invitations cannot oversubscribe a tenant.';
comment on function public.reserve_brand_saas_seat(uuid,text,smallint,uuid) is 'Reserves one tenant seat under the entitlement lock before an external Auth invitation is sent.';
comment on function public.consume_brand_saas_seat(uuid,uuid) is 'Atomically replaces one valid seat reservation with the invited user membership.';
comment on function public.release_brand_saas_seat(uuid) is 'Releases only the reservation created by a failed invitation attempt.';
comment on function private.validate_brand_saas_seat_limit() is 'Prevents configuring a seat limit below current distinct invited/active users plus live invitation reservations.';