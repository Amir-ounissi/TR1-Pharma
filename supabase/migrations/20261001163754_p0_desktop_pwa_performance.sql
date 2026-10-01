-- P0 performance: accelerate the field critical path on desktop and PWA.
-- Keeps authorization semantics intact while avoiding repeated per-row role checks
-- when the active brand has already been authorized once.

create index if not exists pharmacy_assignments_user_relation_active_idx
  on public.pharmacy_assignments (user_id, brand_pharmacy_id, starts_at, ends_at)
  where archived_at is null;

create index if not exists brand_pharmacies_pharmacy_active_idx
  on public.brand_pharmacies (pharmacy_id, id, brand_id)
  where archived_at is null;

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
  current_user_id uuid := (select auth.uid());
  day_start timestamptz := target_date::timestamp at time zone 'Europe/Paris';
  day_end timestamptz := (target_date + 1)::timestamp at time zone 'Europe/Paris';
begin
  if current_user_id is null then
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
          (t.due_at is not null and t.due_at < day_start) as is_overdue,
          case
            when t.due_at is null then 'unscheduled'
            when t.due_at < day_start then 'overdue'
            when t.due_at < day_end then 'today'
            else 'upcoming'
          end as due_state,
          case
            when t.due_at is null then 0
            else greatest(0, target_date - (t.due_at at time zone 'Europe/Paris')::date)
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
              when t.due_at < day_start then least(25, 8 + (target_date - (t.due_at at time zone 'Europe/Paris')::date))
              when t.due_at < day_end then 8
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
              when t.due_at is not null and t.due_at < day_start
                then 'Échéance dépassée de ' || (target_date - (t.due_at at time zone 'Europe/Paris')::date)::text || ' jour' ||
                  case when (target_date - (t.due_at at time zone 'Europe/Paris')::date) > 1 then 's' else '' end
              when t.due_at is not null and t.due_at < day_end then 'À traiter aujourd’hui'
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
        where t.assigned_to = current_user_id
          and (brand_filter is not null or private.has_brand_role(t.brand_id, array['agent']))
          and (brand_filter is null or t.brand_id = brand_filter)
          and t.status in ('open', 'in_progress')
          and t.archived_at is null
          and (t.snoozed_until is null or t.snoozed_until < day_end)
          and (
            t.due_at < day_end
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
      where m.assigned_user_id = current_user_id
        and (brand_filter is not null or private.has_brand_role(m.brand_id, array['agent']))
        and (brand_filter is null or m.brand_id = brand_filter)
        and m.archived_at is null
        and m.scheduled_start_at >= day_start
        and m.scheduled_start_at < day_end
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
      where r.submitted_by = current_user_id
        and (brand_filter is not null or private.has_brand_role(r.brand_id, array['agent']))
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
      where bp.current_agent_user_id = current_user_id
        and (brand_filter is not null or private.has_brand_role(bp.brand_id, array['agent']))
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
            and (t.snoozed_until is null or t.snoozed_until < day_end)
        )
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_agent_today_multibrand(date, uuid) from public, anon;
grant execute on function public.get_agent_today_multibrand(date, uuid) to authenticated, service_role;
