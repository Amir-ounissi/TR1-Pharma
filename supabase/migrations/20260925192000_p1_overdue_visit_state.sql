-- P1 closeout hardening: distinguish stale planned visits from future visits.
-- A past planned/confirmed visit remains actionable until the user closes, cancels,
-- or replans it, but is no longer presented as an ordinary upcoming visit.

create or replace function private.sync_brand_pharmacy_next_action(target_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_action record;
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
      case
        when v.status in ('planned','confirmed') and v.scheduled_start_at < now()
          then 'visit_overdue'
        when v.visit_kind = 'client_visit' then 'commercial_visit'
        when v.visit_kind = 'prospecting' then 'prospecting_visit'
        when v.visit_kind = 'relationship' then 'relationship_visit'
        when v.visit_kind = 'training' then 'training'
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

  update public.brand_pharmacies bp
  set
    next_action_type = next_action.action_type,
    next_action_at = next_action.action_at,
    next_action_owner_id = next_action.owner_id
  where bp.id = target_relation_id;
end;
$$;

revoke all on function private.sync_brand_pharmacy_next_action(uuid) from public, anon, authenticated;

do $$
declare
  relation record;
begin
  for relation in
    select id
    from public.brand_pharmacies
    where archived_at is null
  loop
    perform private.sync_brand_pharmacy_next_action(relation.id);
  end loop;
end;
$$;

comment on function private.sync_brand_pharmacy_next_action(uuid) is
  'Maintains the canonical next-action cache across tasks, visits and missions; stale planned/confirmed visits are classified as visit_overdue.';
