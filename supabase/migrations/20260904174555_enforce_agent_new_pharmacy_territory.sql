create or replace function private.enforce_agent_brand_pharmacy_territory()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    return new;
  end if;

  if private.current_user_is_brand_agent(new.brand_id)
     and new.current_agent_user_id = actor
     and not private.has_brand_role(new.brand_id, array['tr1_manager','brand_admin'])
     and not private.agent_can_cover_pharmacy(new.brand_id, actor, new.pharmacy_id)
  then
    raise exception 'Pharmacy is outside the agent territory' using errcode='42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_agent_brand_pharmacy_territory on public.brand_pharmacies;
create trigger enforce_agent_brand_pharmacy_territory
before insert or update of current_agent_user_id, pharmacy_id, territory_id on public.brand_pharmacies
for each row execute function private.enforce_agent_brand_pharmacy_territory();;
