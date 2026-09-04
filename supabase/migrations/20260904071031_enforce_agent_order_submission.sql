create or replace function private.enforce_agent_order_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_agent boolean := false;
begin
  if actor is null then
    return new;
  end if;

  actor_is_agent := exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = actor
      and membership.brand_id = new.brand_id
      and membership.status = 'active'
      and role.key = 'agent'
  );

  if actor_is_agent
     and not private.has_elevated_brand_access(new.brand_id)
     and new.order_status not in ('draft','pending') then
    new.order_status := 'pending'::public.order_status;
    new.submitted_at := coalesce(new.submitted_at, now());
  elsif actor_is_agent and new.order_status = 'pending' then
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_agent_order_submission on public.orders;
create trigger enforce_agent_order_submission
before insert on public.orders
for each row execute function private.enforce_agent_order_submission();;
