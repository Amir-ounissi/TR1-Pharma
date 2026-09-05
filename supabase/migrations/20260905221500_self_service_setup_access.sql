create or replace function private.can_read_self_service_setup(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.brand_onboarding_sessions onboarding
      join public.memberships membership
        on membership.brand_id = onboarding.brand_id
       and membership.user_id = onboarding.owner_user_id
       and membership.status = 'active'
      join public.roles role on role.id = membership.role_id
      where onboarding.brand_id = target_brand_id
        and onboarding.onboarding_mode = 'self_service'
        and onboarding.owner_user_id = (select auth.uid())
        and onboarding.status in ('in_progress','ready','blocked')
        and role.key = 'brand_admin'
    );
$$;

create or replace function private.can_read_self_service_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.brand_onboarding_sessions onboarding
      join public.memberships membership
        on membership.brand_id = onboarding.brand_id
       and membership.user_id = onboarding.owner_user_id
       and membership.status = 'active'
      join public.roles role on role.id = membership.role_id
      where onboarding.organization_id = target_organization_id
        and onboarding.onboarding_mode = 'self_service'
        and onboarding.owner_user_id = (select auth.uid())
        and onboarding.status in ('in_progress','ready','blocked')
        and role.key = 'brand_admin'
    );
$$;

revoke all on function private.can_read_self_service_setup(uuid) from public, anon;
revoke all on function private.can_read_self_service_organization(uuid) from public, anon;
grant execute on function private.can_read_self_service_setup(uuid) to authenticated, service_role;
grant execute on function private.can_read_self_service_organization(uuid) to authenticated, service_role;

create policy brands_self_service_setup_select
on public.brands
for select
to authenticated
using (private.can_read_self_service_setup(id));

create policy organizations_self_service_setup_select
on public.organizations
for select
to authenticated
using (private.can_read_self_service_organization(id));

create policy brand_settings_self_service_setup_select
on public.brand_settings
for select
to authenticated
using (private.can_read_self_service_setup(brand_id));

create or replace function private.ensure_self_service_setup_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.onboarding_mode = 'self_service' then
    insert into public.brand_settings(brand_id)
    values (new.brand_id)
    on conflict (brand_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.ensure_self_service_setup_settings() from public, anon, authenticated;

create trigger ensure_self_service_setup_settings
after insert on public.brand_onboarding_sessions
for each row execute function private.ensure_self_service_setup_settings();

-- Existing self-service sessions created before this hardening remain resumable.
insert into public.brand_settings(brand_id)
select onboarding.brand_id
from public.brand_onboarding_sessions onboarding
where onboarding.onboarding_mode = 'self_service'
on conflict (brand_id) do nothing;
