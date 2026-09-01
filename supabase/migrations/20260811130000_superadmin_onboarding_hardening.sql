create or replace function private.activate_invited_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.onboarding_completed_at is null and new.onboarding_completed_at is not null then
    update public.memberships
    set status = 'active'
    where user_id = new.user_id
      and brand_id is not null
      and status = 'invited';
  end if;
  return new;
end;
$$;

revoke all on function private.activate_invited_memberships() from public, anon, authenticated;

create or replace function public.accept_my_invited_memberships()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  activated_count bigint;
begin
  update public.memberships
  set status = 'active'
  where user_id = (select auth.uid())
    and brand_id is not null
    and status = 'invited';

  get diagnostics activated_count = row_count;
  return activated_count;
end;
$$;

revoke all on function public.accept_my_invited_memberships() from public, anon;
grant execute on function public.accept_my_invited_memberships() to authenticated, service_role;

comment on function public.accept_my_invited_memberships() is 'Active de manière idempotente les invitations tenant du user authentifié sans jamais promouvoir un rôle plateforme.';
