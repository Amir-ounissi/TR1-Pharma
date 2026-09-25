-- P1 hotfix: next-action cache synchronization is an internal system update.
-- It must not be interpreted as a direct agent/facilitator edit of brand_pharmacies.

create or replace function private.enforce_brand_pharmacy_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.brand_settings%rowtype;
  internal_sync text := coalesce(current_setting('app.internal_brand_pharmacy_sync', true), '');
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  -- Only security-definer workflow functions set these transaction-local values.
  if internal_sync in ('order', 'next_action') then
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

create or replace function private.sync_brand_pharmacy_next_action(target_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_action record;
  previous_internal_sync text := coalesce(current_setting('app.internal_brand_pharmacy_sync', true), '');
begin
  if target_relation_id is null then
    return;
  end if;

  select candidate.action_type, candidate.action_at, candidate.owner_id
  into next_action
  from (
    select
      t.task_type::text as action_type,
      t.due_at as action_at,
      t.assigned_to as owner_id,
      1 as source_rank,
      t.created_at as created_at
    from public.tasks t
    where t.brand_pharmacy_id = target_relation_id
      and t.status in ('open','in_progress')
      and t.archived_at is null

    union all

    select
      case v.visit_kind
        when 'client_visit' then 'commercial_visit'
        when 'prospecting' then 'prospecting_visit'
        when 'relationship' then 'relationship_visit'
        when 'training' then 'training'
        else 'visit'
      end as action_type,
      v.scheduled_start_at as action_at,
      v.owner_user_id as owner_id,
      2 as source_rank,
      v.created_at as created_at
    from public.field_visit_brands fvb
    join public.field_visits v on v.id = fvb.visit_id
    where fvb.brand_pharmacy_id = target_relation_id
      and v.status in ('planned','confirmed','in_progress')
      and v.archived_at is null

    union all

    select
      case
        when m.status = 'report_pending' then 'report_pending'
        else m.mission_type::text
      end as action_type,
      case
        when m.status = 'report_pending' then coalesce(m.report_due_at, m.scheduled_end_at, m.scheduled_start_at)
        else m.scheduled_start_at
      end as action_at,
      m.assigned_user_id as owner_id,
      3 as source_rank,
      m.created_at as created_at
    from public.missions m
    where m.brand_pharmacy_id = target_relation_id
      and m.status in ('assigned','accepted','scheduled','in_progress','report_pending')
      and m.archived_at is null
  ) candidate
  order by candidate.action_at asc nulls last, candidate.source_rank, candidate.created_at
  limit 1;

  perform set_config('app.internal_brand_pharmacy_sync', 'next_action', true);

  update public.brand_pharmacies bp
  set
    next_action_type = next_action.action_type,
    next_action_at = next_action.action_at,
    next_action_owner_id = next_action.owner_id
  where bp.id = target_relation_id;

  perform set_config('app.internal_brand_pharmacy_sync', previous_internal_sync, true);
exception
  when others then
    perform set_config('app.internal_brand_pharmacy_sync', previous_internal_sync, true);
    raise;
end;
$$;

revoke all on function private.enforce_brand_pharmacy_update_scope() from public, anon, authenticated;
revoke all on function private.sync_brand_pharmacy_next_action(uuid) from public, anon, authenticated;
