create or replace function private.can_create_pharmacy_contact(target_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_global_role(array['super_admin'])
  or exists (
    select 1
    from public.brand_pharmacies bp
    where bp.pharmacy_id = target_pharmacy_id
      and bp.archived_at is null
      and private.has_brand_role(bp.brand_id, array['tr1_manager','brand_admin'])
  )
  or exists (
    select 1
    from public.brand_pharmacies bp
    join public.brand_settings settings on settings.brand_id = bp.brand_id
    where bp.pharmacy_id = target_pharmacy_id
      and bp.archived_at is null
      and private.current_user_is_brand_agent(bp.brand_id)
      and private.user_is_assigned_to_relation((select auth.uid()), bp.id)
      and settings.allow_agents_to_create_contacts
  );
$$;

drop policy if exists pharmacy_contacts_insert on public.pharmacy_contacts;
create policy pharmacy_contacts_insert on public.pharmacy_contacts
for insert
with check (private.can_create_pharmacy_contact(pharmacy_id));

drop policy if exists pharmacy_contacts_update on public.pharmacy_contacts;
create policy pharmacy_contacts_update on public.pharmacy_contacts
for update
using (private.can_create_pharmacy_contact(pharmacy_id))
with check (private.can_create_pharmacy_contact(pharmacy_id));

create or replace function private.enforce_brand_pharmacy_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.brand_settings%rowtype;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if private.has_brand_role(old.brand_id, array['tr1_manager','brand_admin']) then
    return new;
  end if;

  if old.current_agent_user_id = (select auth.uid()) then
    select * into settings
    from public.brand_settings
    where brand_id = old.brand_id;

    if coalesce(settings.allow_agents_to_edit_potential, false) then
      if (
        to_jsonb(new) - array[
          'potential_level','potential_score','next_action_type','next_action_at',
          'next_action_owner_id','notes','last_interaction_at','updated_at'
        ]
      ) = (
        to_jsonb(old) - array[
          'potential_level','potential_score','next_action_type','next_action_at',
          'next_action_owner_id','notes','last_interaction_at','updated_at'
        ]
      ) then
        return new;
      end if;
    else
      if (
        to_jsonb(new) - array[
          'next_action_type','next_action_at','next_action_owner_id',
          'notes','last_interaction_at','updated_at'
        ]
      ) = (
        to_jsonb(old) - array[
          'next_action_type','next_action_at','next_action_owner_id',
          'notes','last_interaction_at','updated_at'
        ]
      ) then
        return new;
      end if;
    end if;
  end if;

  raise exception 'Agent update scope exceeded' using errcode = '42501';
end;
$$;

drop policy if exists pharmacies_update on public.pharmacies;
create policy pharmacies_update on public.pharmacies
for update
using (
  private.can_access_pharmacy(id)
  and (
    private.has_global_role(array['super_admin'])
    or exists (
      select 1
      from public.brand_pharmacies bp
      where bp.pharmacy_id = pharmacies.id
        and bp.archived_at is null
        and private.has_brand_role(bp.brand_id, array['tr1_manager','brand_admin'])
    )
  )
)
with check (
  private.can_access_pharmacy(id)
  and (
    private.has_global_role(array['super_admin'])
    or exists (
      select 1
      from public.brand_pharmacies bp
      where bp.pharmacy_id = pharmacies.id
        and bp.archived_at is null
        and private.has_brand_role(bp.brand_id, array['tr1_manager','brand_admin'])
    )
  )
);

drop policy if exists territories_select on public.territories;
create policy territories_select on public.territories
for select
using (
  (brand_id is not null and private.can_access_brand(brand_id))
  or (
    brand_id is null
    and exists (
      select 1
      from public.memberships m
      where m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.organization_id = territories.organization_id
    )
  )
  or private.has_global_role(array['super_admin'])
);;
