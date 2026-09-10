-- TR1 action engine v1
-- Separates action relevance, due state and business priority.

alter table public.tasks
  add column if not exists action_code text,
  add column if not exists triggered_at timestamptz,
  add column if not exists trigger_type text,
  add column if not exists trigger_id uuid,
  add column if not exists snoozed_until timestamptz,
  add column if not exists completion_reason text,
  add column if not exists dedupe_key text,
  add column if not exists rule_code text;

create unique index if not exists tasks_open_dedupe_key_unique
  on public.tasks(dedupe_key)
  where dedupe_key is not null
    and status in ('open','in_progress')
    and archived_at is null;

create index if not exists tasks_action_code_open_idx
  on public.tasks(action_code, brand_pharmacy_id, due_at)
  where status in ('open','in_progress') and archived_at is null;

create or replace function private.prepare_task_action_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.triggered_at := coalesce(new.triggered_at, new.created_at, now());

  if new.action_code is null then
    new.action_code := case
      when new.source = 'manual' then 'manual_' || new.task_type::text
      when new.source = 'interaction' then 'interaction_' || new.task_type::text
      when new.source = 'status_change' then 'status_' || new.task_type::text
      when new.source = 'import' then 'import_' || new.task_type::text
      else new.task_type::text
    end;
  end if;

  new.rule_code := coalesce(
    new.rule_code,
    case
      when new.source in ('manual','interaction') then 'user_action_v1'
      else 'legacy_action_v1'
    end
  );

  return new;
end;
$$;

drop trigger if exists prepare_task_action_metadata on public.tasks;
create trigger prepare_task_action_metadata
before insert on public.tasks
for each row execute function private.prepare_task_action_metadata();

-- Backfill semantic metadata for existing task rows.
update public.tasks
set
  triggered_at = coalesce(triggered_at, created_at),
  action_code = case
    when title = 'Suivi post-implantation' then 'post_implantation'
    when title = 'Activité watch — action de suivi' then 'activity_watch'
    when title = 'Activité at_risk — action de suivi' then 'activity_at_risk'
    when title = 'Activité dormant — action de suivi' then 'activity_dormant'
    when source = 'manual' then 'manual_' || task_type::text
    when source = 'interaction' then 'interaction_' || task_type::text
    when source = 'status_change' then 'status_' || task_type::text
    when source = 'import' then 'import_' || task_type::text
    else coalesce(action_code, task_type::text)
  end,
  rule_code = case
    when title = 'Suivi post-implantation' then 'post_implantation_v2'
    when title like 'Activité % — action de suivi' then 'activity_health_v2'
    when source in ('manual','interaction') then 'user_action_v1'
    else coalesce(rule_code, 'legacy_action_v1')
  end
where action_code is null
   or triggered_at is null
   or rule_code is null;

-- Post-implantation follows the first valid order only while there is still work to do.
create or replace function private.sync_post_implantation_follow_up(target_brand_pharmacy_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_record public.brand_pharmacies%rowtype;
  settings public.brand_settings%rowtype;
  first_order record;
  later_order record;
  follow_up_interaction record;
  owner_id uuid;
  due_date timestamptz;
  action_dedupe_key text;
  completion_actor uuid;
begin
  select * into relation_record
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id;

  if relation_record.id is null then return; end if;

  select * into settings
  from public.brand_settings
  where brand_id = relation_record.brand_id;

  select o.id, o.order_date, o.created_by
  into first_order
  from public.orders o
  where o.brand_pharmacy_id = target_brand_pharmacy_id
    and o.archived_at is null
    and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  order by o.order_date, o.created_at, o.id
  limit 1;

  if first_order.id is null then
    update public.tasks
    set
      status = 'completed',
      completed_at = coalesce(completed_at, now()),
      completed_by = coalesce(completed_by, (select auth.uid())),
      completion_reason = coalesce(completion_reason, 'trigger_no_longer_valid'),
      updated_at = now()
    where brand_pharmacy_id = target_brand_pharmacy_id
      and (action_code = 'post_implantation' or title = 'Suivi post-implantation')
      and status in ('open','in_progress')
      and archived_at is null;
    return;
  end if;

  select o.id, o.created_by
  into later_order
  from public.orders o
  where o.brand_pharmacy_id = target_brand_pharmacy_id
    and o.id <> first_order.id
    and o.archived_at is null
    and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  order by o.order_date, o.created_at, o.id
  limit 1;

  select i.id, i.created_by, i.occurred_at
  into follow_up_interaction
  from public.interactions i
  where i.brand_pharmacy_id = target_brand_pharmacy_id
    and i.archived_at is null
    and i.occurred_at >= first_order.order_date
    and i.interaction_type in ('call','email','visit','video_call','message','linkedin','event')
  order by i.occurred_at, i.created_at, i.id
  limit 1;

  if later_order.id is not null or follow_up_interaction.id is not null then
    completion_actor := coalesce(
      later_order.created_by,
      follow_up_interaction.created_by,
      (select auth.uid())
    );

    update public.tasks
    set
      status = 'completed',
      completed_at = coalesce(completed_at, now()),
      completed_by = coalesce(completed_by, completion_actor),
      completion_reason = case
        when later_order.id is not null then 'reorder_received'
        else 'commercial_follow_up_recorded'
      end,
      related_interaction_id = case
        when later_order.id is null then coalesce(related_interaction_id, follow_up_interaction.id)
        else related_interaction_id
      end,
      action_code = 'post_implantation',
      triggered_at = coalesce(triggered_at, first_order.order_date),
      trigger_type = 'order',
      trigger_id = first_order.id,
      rule_code = 'post_implantation_v2',
      updated_at = now()
    where brand_pharmacy_id = target_brand_pharmacy_id
      and (action_code = 'post_implantation' or title = 'Suivi post-implantation')
      and status in ('open','in_progress')
      and archived_at is null;
    return;
  end if;

  owner_id := case
    when relation_record.current_agent_user_id is not null
      and private.user_has_active_brand_membership(relation_record.current_agent_user_id, relation_record.brand_id)
      then relation_record.current_agent_user_id
    when relation_record.tr1_manager_user_id is not null
      and private.user_has_active_brand_membership(relation_record.tr1_manager_user_id, relation_record.brand_id)
      then relation_record.tr1_manager_user_id
    when first_order.created_by is not null
      and private.user_has_active_brand_membership(first_order.created_by, relation_record.brand_id)
      then first_order.created_by
    else null
  end;

  if owner_id is null then return; end if;

  due_date := first_order.order_date + make_interval(days => settings.post_implantation_follow_up_days);
  action_dedupe_key := 'post_implantation:' || target_brand_pharmacy_id::text || ':' || first_order.id::text;

  update public.tasks
  set
    due_at = due_date,
    assigned_to = owner_id,
    action_code = 'post_implantation',
    triggered_at = first_order.order_date,
    trigger_type = 'order',
    trigger_id = first_order.id,
    dedupe_key = action_dedupe_key,
    rule_code = 'post_implantation_v2',
    completion_reason = null,
    updated_at = now()
  where brand_pharmacy_id = target_brand_pharmacy_id
    and (action_code = 'post_implantation' or title = 'Suivi post-implantation')
    and status in ('open','in_progress')
    and archived_at is null;

  if not found then
    insert into public.tasks (
      brand_id,
      brand_pharmacy_id,
      task_type,
      title,
      status,
      priority,
      due_at,
      assigned_to,
      created_by,
      source,
      action_code,
      triggered_at,
      trigger_type,
      trigger_id,
      dedupe_key,
      rule_code
    ) values (
      relation_record.brand_id,
      target_brand_pharmacy_id,
      'follow_up',
      'Suivi post-implantation',
      'open',
      'high',
      due_date,
      owner_id,
      first_order.created_by,
      'automation',
      'post_implantation',
      first_order.order_date,
      'order',
      first_order.id,
      action_dedupe_key,
      'post_implantation_v2'
    );
  end if;
end;
$$;

create or replace function private.reconcile_post_implantation_after_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.brand_pharmacy_id is distinct from new.brand_pharmacy_id then
    perform private.sync_post_implantation_follow_up(old.brand_pharmacy_id);
  end if;

  perform private.sync_post_implantation_follow_up(new.brand_pharmacy_id);
  return new;
end;
$$;

drop trigger if exists reconcile_post_implantation_after_interaction on public.interactions;
create trigger reconcile_post_implantation_after_interaction
after insert or update of occurred_at, interaction_type, archived_at, brand_pharmacy_id
on public.interactions
for each row execute function private.reconcile_post_implantation_after_interaction();

-- Activity actions are mutually exclusive: the current health state owns the current action.
create or replace function private.ensure_activity_follow_up(
  target_brand_pharmacy_id uuid,
  target_status public.activity_status,
  target_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.brand_settings%rowtype;
  relation_record public.brand_pharmacies%rowtype;
  target_type public.commercial_task_type;
  target_priority public.task_priority;
  target_title text;
  target_due_at timestamptz;
  target_action_code text;
  target_owner uuid;
  target_dedupe_key text;
begin
  select * into relation_record
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id;

  if relation_record.id is null then return; end if;

  select * into settings
  from public.brand_settings
  where brand_id = relation_record.brand_id;

  target_type := (case target_status
    when 'watch' then 'check_stock'
    when 'at_risk' then 'follow_up'
    when 'dormant' then 'follow_up'
    else null
  end)::public.commercial_task_type;

  if target_type is null then
    update public.tasks
    set
      status = 'completed',
      completed_at = coalesce(completed_at, now()),
      completed_by = coalesce(completed_by, target_actor),
      completion_reason = coalesce(completion_reason, 'activity_recovered'),
      updated_at = now()
    where brand_pharmacy_id = target_brand_pharmacy_id
      and (left(coalesce(action_code, ''), 9) = 'activity_' or title like 'Activité % — action de suivi')
      and status in ('open','in_progress')
      and archived_at is null;
    return;
  end if;

  target_action_code := 'activity_' || target_status::text;
  target_priority := (case target_status
    when 'watch' then 'normal'
    when 'at_risk' then 'high'
    else 'urgent'
  end)::public.task_priority;
  target_title := 'Activité ' || target_status::text || ' — action de suivi';
  target_due_at := now() + case
    when target_status = 'dormant' then make_interval(days => settings.dormant_reactivation_follow_up_days)
    else interval '1 day'
  end;
  target_dedupe_key := target_action_code || ':' || target_brand_pharmacy_id::text;

  target_owner := case
    when relation_record.current_agent_user_id is not null
      and private.user_has_active_brand_membership(relation_record.current_agent_user_id, relation_record.brand_id)
      then relation_record.current_agent_user_id
    when relation_record.tr1_manager_user_id is not null
      and private.user_has_active_brand_membership(relation_record.tr1_manager_user_id, relation_record.brand_id)
      then relation_record.tr1_manager_user_id
    when target_actor is not null
      and private.user_has_active_brand_membership(target_actor, relation_record.brand_id)
      then target_actor
    else null
  end;

  update public.tasks
  set
    status = 'completed',
    completed_at = coalesce(completed_at, now()),
    completed_by = coalesce(completed_by, target_actor),
    completion_reason = 'activity_status_changed',
    updated_at = now()
  where brand_pharmacy_id = target_brand_pharmacy_id
    and (left(coalesce(action_code, ''), 9) = 'activity_' or title like 'Activité % — action de suivi')
    and coalesce(action_code,
      case
        when title = 'Activité watch — action de suivi' then 'activity_watch'
        when title = 'Activité at_risk — action de suivi' then 'activity_at_risk'
        when title = 'Activité dormant — action de suivi' then 'activity_dormant'
      end
    ) is distinct from target_action_code
    and status in ('open','in_progress')
    and archived_at is null;

  if target_owner is null then return; end if;

  update public.tasks
  set
    assigned_to = target_owner,
    task_type = target_type,
    title = target_title,
    priority = target_priority,
    action_code = target_action_code,
    triggered_at = coalesce(triggered_at, relation_record.activity_status_changed_at, now()),
    trigger_type = 'system',
    dedupe_key = target_dedupe_key,
    rule_code = 'activity_health_v2',
    completion_reason = null,
    updated_at = now()
  where brand_pharmacy_id = target_brand_pharmacy_id
    and coalesce(action_code,
      case
        when title = 'Activité watch — action de suivi' then 'activity_watch'
        when title = 'Activité at_risk — action de suivi' then 'activity_at_risk'
        when title = 'Activité dormant — action de suivi' then 'activity_dormant'
      end
    ) = target_action_code
    and status in ('open','in_progress')
    and archived_at is null;

  if not found then
    insert into public.tasks (
      brand_id,
      brand_pharmacy_id,
      task_type,
      title,
      status,
      priority,
      due_at,
      assigned_to,
      created_by,
      source,
      action_code,
      triggered_at,
      trigger_type,
      dedupe_key,
      rule_code
    ) values (
      relation_record.brand_id,
      relation_record.id,
      target_type,
      target_title,
      'open',
      target_priority,
      target_due_at,
      target_owner,
      coalesce(target_actor, target_owner),
      'automation',
      target_action_code,
      coalesce(relation_record.activity_status_changed_at, now()),
      'system',
      target_dedupe_key,
      'activity_health_v2'
    );
  end if;
end;
$$;

create or replace function private.reconcile_activity_actions_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.activity_status is distinct from old.activity_status then
    perform private.ensure_activity_follow_up(new.id, new.activity_status, (select auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_activity_actions on public.brand_pharmacies;
create trigger reconcile_activity_actions
after update of activity_status on public.brand_pharmacies
for each row execute function private.reconcile_activity_actions_trigger();

-- Reconcile historical automated actions immediately when this migration is applied.
do $$
declare
  relation_id uuid;
  relation_status public.activity_status;
begin
  for relation_id in
    select distinct o.brand_pharmacy_id
    from public.orders o
    where o.archived_at is null
      and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  loop
    perform private.sync_post_implantation_follow_up(relation_id);
  end loop;

  for relation_id, relation_status in
    select bp.id, bp.activity_status
    from public.brand_pharmacies bp
    where bp.archived_at is null
      and bp.activity_status in ('watch','at_risk','dormant')
  loop
    perform private.ensure_activity_follow_up(relation_id, relation_status, null);
  end loop;

  update public.tasks t
  set
    status = 'completed',
    completed_at = coalesce(t.completed_at, now()),
    completion_reason = coalesce(t.completion_reason, 'activity_status_changed'),
    updated_at = now()
  from public.brand_pharmacies bp
  where bp.id = t.brand_pharmacy_id
    and t.status in ('open','in_progress')
    and t.archived_at is null
    and left(coalesce(t.action_code, ''), 9) = 'activity_'
    and t.action_code is distinct from case bp.activity_status::text
      when 'watch' then 'activity_watch'
      when 'at_risk' then 'activity_at_risk'
      when 'dormant' then 'activity_dormant'
      else null
    end;
end;
$$;

-- Multibrand cockpit: relevance first, then deterministic business priority.
create or replace function public.get_agent_today_multibrand(
  target_date date default current_date,
  brand_filter uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Agent workspace authentication required' using errcode = '42501';
  end if;

  if brand_filter is not null
    and not private.has_brand_role(brand_filter, array['agent']) then
    raise exception 'Agent workspace brand forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'tasks', coalesce((
      select jsonb_agg(
        to_jsonb(rows)
        order by rows.action_score desc, rows.due_at asc nulls last, rows.pharmacy_name
      )
      from (
        select
          t.id,
          t.brand_id,
          b.name as brand_name,
          t.brand_pharmacy_id,
          bp.pharmacy_id,
          t.title,
          t.task_type,
          t.priority,
          t.source,
          t.action_code,
          t.rule_code,
          t.triggered_at,
          t.due_at,
          t.snoozed_until,
          (t.due_at is not null and t.due_at::date < target_date) as is_overdue,
          case
            when t.due_at is null then 'unscheduled'
            when t.due_at::date < target_date then 'overdue'
            when t.due_at::date = target_date then 'today'
            else 'upcoming'
          end as due_state,
          case
            when t.due_at is null then 0
            else greatest(0, target_date - t.due_at::date)
          end as days_overdue,
          least(100,
            case t.priority::text
              when 'urgent' then 25
              when 'high' then 15
              when 'normal' then 7
              else 0
            end
            + case
              when t.due_at is null then 0
              when t.due_at::date < target_date then least(25, 8 + (target_date - t.due_at::date))
              when t.due_at::date = target_date then 8
              else 0
            end
            + case t.source::text
              when 'manual' then 15
              when 'interaction' then 12
              when 'status_change' then 8
              else 0
            end
            + case bp.activity_status::text
              when 'dormant' then 30
              when 'at_risk' then 25
              when 'watch' then 12
              else 0
            end
            + case bp.priority_level::text
              when 'strategic' then 15
              when 'high' then 8
              when 'normal' then 3
              else 0
            end
            + case bp.potential_level::text
              when 'very_high' then 18
              when 'high' then 12
              when 'medium' then 5
              else 0
            end
          )::integer as action_score,
          array_remove(array[
            case
              when t.source = 'manual' then 'Action planifiée par le commercial'
              when t.source = 'interaction' then 'Suite d’un engagement commercial'
              else null
            end,
            case
              when t.due_at is not null and t.due_at::date < target_date
                then 'Échéance dépassée de ' || (target_date - t.due_at::date)::text || ' jour' || case when (target_date - t.due_at::date) > 1 then 's' else '' end
              when t.due_at is not null and t.due_at::date = target_date then 'À traiter aujourd’hui'
              else null
            end,
            case bp.activity_status::text
              when 'dormant' then 'Compte dormant à réactiver'
              when 'at_risk' then 'Compte à risque'
              when 'watch' then 'Activité à surveiller'
              else null
            end,
            case when bp.priority_level::text = 'strategic' then 'Compte stratégique' end,
            case when bp.potential_level::text in ('high','very_high') then 'Fort potentiel commercial' end
          ]::text[], null) as priority_reasons,
          bp.activity_status::text as account_activity_status,
          bp.priority_level::text as account_priority_level,
          bp.potential_level::text as potential_level,
          coalesce(p.trade_name, p.legal_name) as pharmacy_name,
          p.city
        from public.tasks t
        join public.brands b on b.id = t.brand_id
        join public.brand_pharmacies bp on bp.id = t.brand_pharmacy_id
        join public.pharmacies p on p.id = bp.pharmacy_id
        where t.assigned_to = (select auth.uid())
          and private.has_brand_role(t.brand_id, array['agent'])
          and (brand_filter is null or t.brand_id = brand_filter)
          and t.status in ('open', 'in_progress')
          and t.archived_at is null
          and (t.snoozed_until is null or t.snoozed_until::date <= target_date)
          and (
            t.due_at::date <= target_date
            or (
              t.due_at is null
              and t.source in ('manual','interaction')
              and t.priority in ('urgent','high')
            )
          )
      ) rows
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'brand_id', m.brand_id,
        'brand_name', b.name,
        'brand_pharmacy_id', m.brand_pharmacy_id,
        'pharmacy_id', m.pharmacy_id,
        'title', m.title,
        'objective', m.objective,
        'scheduled_start_at', m.scheduled_start_at,
        'priority', m.priority,
        'status', m.status,
        'pharmacy_name', coalesce(p.trade_name, p.legal_name),
        'city', p.city
      ) order by m.scheduled_start_at asc)
      from public.missions m
      join public.brands b on b.id = m.brand_id
      join public.pharmacies p on p.id = m.pharmacy_id
      where m.assigned_user_id = (select auth.uid())
        and private.has_brand_role(m.brand_id, array['agent'])
        and (brand_filter is null or m.brand_id = brand_filter)
        and m.archived_at is null
        and m.scheduled_start_at::date = target_date
        and m.status not in ('completed', 'cancelled', 'rejected', 'no_show')
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'brand_id', r.brand_id,
        'brand_name', b.name,
        'mission_id', r.mission_id,
        'title', m.title,
        'brand_pharmacy_id', m.brand_pharmacy_id,
        'pharmacy_id', m.pharmacy_id,
        'report_status', r.report_status,
        'pharmacy_name', coalesce(p.trade_name, p.legal_name)
      ) order by r.updated_at asc)
      from public.mission_reports r
      join public.missions m on m.id = r.mission_id
      join public.brands b on b.id = r.brand_id
      join public.pharmacies p on p.id = m.pharmacy_id
      where r.submitted_by = (select auth.uid())
        and private.has_brand_role(r.brand_id, array['agent'])
        and (brand_filter is null or r.brand_id = brand_filter)
        and r.archived_at is null
        and r.report_status in ('draft', 'needs_correction')
    ), '[]'::jsonb),
    'follow_ups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand_id', bp.brand_id,
        'brand_name', b.name,
        'brand_pharmacy_id', bp.id,
        'pharmacy_id', bp.pharmacy_id,
        'pharmacy_name', coalesce(p.trade_name, p.legal_name),
        'city', p.city,
        'last_interaction_at', bp.last_interaction_at,
        'priority', bp.priority_level,
        'activity_status', bp.activity_status,
        'reason', case bp.activity_status::text
          when 'dormant' then 'Compte dormant sans action ouverte'
          when 'at_risk' then 'Compte à risque sans action ouverte'
          when 'watch' then 'Activité à surveiller sans action ouverte'
          else 'Compte prioritaire sans prochaine action'
        end,
        'action_score', (
          case bp.activity_status::text
            when 'dormant' then 80
            when 'at_risk' then 70
            when 'watch' then 55
            else 30
          end
          + case bp.priority_level::text when 'strategic' then 10 when 'high' then 5 else 0 end
          + case bp.potential_level::text when 'very_high' then 10 when 'high' then 5 else 0 end
        )
      ) order by
        case bp.activity_status::text when 'dormant' then 3 when 'at_risk' then 2 when 'watch' then 1 else 0 end desc,
        bp.priority_level desc,
        bp.last_interaction_at asc nulls first)
      from public.brand_pharmacies bp
      join public.brands b on b.id = bp.brand_id
      join public.pharmacies p on p.id = bp.pharmacy_id
      where bp.current_agent_user_id = (select auth.uid())
        and private.has_brand_role(bp.brand_id, array['agent'])
        and (brand_filter is null or bp.brand_id = brand_filter)
        and bp.archived_at is null
        and bp.commercial_status <> 'lost'
        and (
          bp.activity_status::text in ('watch','at_risk','dormant')
          or (
            bp.priority_level::text in ('high','strategic')
            and (bp.last_interaction_at is null or bp.last_interaction_at < now() - interval '30 days')
          )
        )
        and not exists (
          select 1
          from public.tasks t
          where t.brand_pharmacy_id = bp.id
            and t.status in ('open', 'in_progress')
            and t.archived_at is null
            and (t.snoozed_until is null or t.snoozed_until::date <= target_date)
        )
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_agent_today_multibrand(date, uuid) from public, anon;
grant execute on function public.get_agent_today_multibrand(date, uuid) to authenticated, service_role;

comment on function public.get_agent_today_multibrand(date, uuid) is
  'Returns the current agent day across authorized brands with lifecycle-aware task relevance, date-level overdue semantics and deterministic business priority.';
