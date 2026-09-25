-- P1 Workflow terrain: unify the "next action" resolver without duplicating visits as tasks.
-- Tasks remain task records; field visits remain visit records. The cached
-- brand_pharmacies.next_action_* projection resolves the earliest actionable item.

create or replace function private.sync_brand_pharmacy_next_action(target_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_action record;
begin
  select candidate.action_type, candidate.action_at, candidate.owner_id
  into resolved_action
  from (
    select
      t.task_type::text as action_type,
      t.due_at as action_at,
      t.assigned_to as owner_id,
      t.created_at as created_at,
      0 as source_priority
    from public.tasks t
    where t.brand_pharmacy_id = target_relation_id
      and t.status in ('open','in_progress')
      and t.archived_at is null

    union all

    select
      'visit'::text as action_type,
      v.scheduled_start_at as action_at,
      v.owner_user_id as owner_id,
      v.created_at as created_at,
      1 as source_priority
    from public.field_visit_brands fvb
    join public.field_visits v on v.id = fvb.visit_id
    where fvb.brand_pharmacy_id = target_relation_id
      and v.status in ('planned','confirmed','in_progress')
      and v.archived_at is null
  ) candidate
  order by
    candidate.action_at asc nulls last,
    candidate.source_priority asc,
    candidate.created_at asc
  limit 1;

  update public.brand_pharmacies
  set
    next_action_type = resolved_action.action_type,
    next_action_at = resolved_action.action_at,
    next_action_owner_id = resolved_action.owner_id
  where id = target_relation_id;
end;
$$;

create or replace function private.sync_next_action_from_visit_brand_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.brand_pharmacy_id is distinct from new.brand_pharmacy_id then
    perform private.sync_brand_pharmacy_next_action(old.brand_pharmacy_id);
  end if;

  perform private.sync_brand_pharmacy_next_action(
    case when tg_op = 'DELETE' then old.brand_pharmacy_id else new.brand_pharmacy_id end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.sync_next_action_from_field_visit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_id uuid;
begin
  for relation_id in
    select fvb.brand_pharmacy_id
    from public.field_visit_brands fvb
    where fvb.visit_id = coalesce(new.id, old.id)
  loop
    perform private.sync_brand_pharmacy_next_action(relation_id);
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_next_action_from_visit_brand on public.field_visit_brands;
create trigger sync_next_action_from_visit_brand
after insert or update or delete on public.field_visit_brands
for each row execute function private.sync_next_action_from_visit_brand_trigger();

drop trigger if exists sync_next_action_from_field_visit on public.field_visits;
create trigger sync_next_action_from_field_visit
after update of status, scheduled_start_at, owner_user_id, archived_at on public.field_visits
for each row execute function private.sync_next_action_from_field_visit_trigger();

-- Recalculate only relations currently linked to an actionable field visit.
do $$
declare
  relation_id uuid;
begin
  for relation_id in
    select distinct fvb.brand_pharmacy_id
    from public.field_visit_brands fvb
    join public.field_visits v on v.id = fvb.visit_id
    where v.status in ('planned','confirmed','in_progress')
      and v.archived_at is null
  loop
    perform private.sync_brand_pharmacy_next_action(relation_id);
  end loop;
end;
$$;

revoke all on function private.sync_next_action_from_visit_brand_trigger() from public, anon, authenticated;
revoke all on function private.sync_next_action_from_field_visit_trigger() from public, anon, authenticated;

comment on function private.sync_brand_pharmacy_next_action(uuid) is
  'Resolves the cached next commercial action from actionable tasks and field visits, keeping source records in their native tables.';
