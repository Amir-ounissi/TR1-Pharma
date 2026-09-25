-- P1 hotfix: allow only nested trigger-driven maintenance of the next-action cache.
-- Direct user updates remain subject to the existing brand-pharmacy scope rules.

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

  -- Existing order workflow bypass.
  if coalesce(current_setting('app.internal_brand_pharmacy_sync', true), '') = 'order' then
    return new;
  end if;

  -- Canonical next-action maintenance is executed only from nested table triggers
  -- (tasks / field visits / missions). Permit that technical cache refresh only
  -- when no business fields other than next_action_* / updated_at are changed.
  if pg_trigger_depth() > 1
     and (
       to_jsonb(new) - array[
         'next_action_type','next_action_at','next_action_owner_id','updated_at'
       ]
     ) = (
       to_jsonb(old) - array[
         'next_action_type','next_action_at','next_action_owner_id','updated_at'
       ]
     )
  then
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
