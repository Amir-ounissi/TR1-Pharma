create or replace function public.get_next_best_actions(
  target_brand_id uuid,
  result_limit integer,
  target_brand_pharmacy_id uuid
)
returns table (
  brand_pharmacy_id uuid,
  pharmacy_name text,
  city text,
  territory_name text,
  agent_name text,
  action_type text,
  action_label text,
  action_score integer,
  confidence text,
  suggested_due_at date,
  rationale text[],
  evidence jsonb,
  has_next_action boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_brand_capability(target_brand_id, 'next_best_action')
    or not (
      private.has_global_role(array['super_admin'])
      or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user'])
    ) then
    raise exception 'Next best action forbidden' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select
      health.*,
      case
        when health.health_status = 'dormant' then 'reactivate_account'
        when health.health_status = 'at_risk' then 'recover_at_risk'
        when health.orders_count = 1
          and health.health_status in ('newly_implanted','awaiting_first_reorder','reorder_due_soon','reorder_overdue')
          then 'secure_first_reorder'
        when health.health_status = 'reorder_overdue' then 'recover_reorder'
        when health.health_status in ('reorder_due_soon','reorder_expected') then 'prepare_reorder'
        when health.recent_mission_without_follow_up then 'follow_up_mission'
        when not health.has_next_action then 'schedule_follow_up'
        else null
      end as resolved_action_type
    from public.commercial_account_health health
    where health.brand_id = target_brand_id
      and (target_brand_pharmacy_id is null or health.brand_pharmacy_id = target_brand_pharmacy_id)
  ), resolved as (
    select
      candidates.*,
      case candidates.resolved_action_type
        when 'reactivate_account' then 'Réactiver le compte dormant'
        when 'recover_at_risk' then 'Récupérer le compte à risque'
        when 'secure_first_reorder' then 'Sécuriser le premier réassort'
        when 'recover_reorder' then 'Relancer le réassort en retard'
        when 'prepare_reorder' then 'Préparer le prochain réassort'
        when 'follow_up_mission' then 'Faire le suivi de la mission'
        when 'schedule_follow_up' then 'Programmer la prochaine action'
        else null
      end as resolved_action_label,
      least(100, candidates.priority_score + case candidates.resolved_action_type
        when 'reactivate_account' then 10
        when 'recover_at_risk' then 8
        when 'secure_first_reorder' then 7
        when 'recover_reorder' then 6
        when 'follow_up_mission' then 5
        when 'prepare_reorder' then 4
        when 'schedule_follow_up' then 2
        else 0
      end)::integer as resolved_action_score,
      case
        when candidates.resolved_action_type = 'follow_up_mission' then 'high'
        when candidates.interval_source = 'median' then 'high'
        when candidates.interval_source = 'average' then 'medium'
        when candidates.resolved_action_type = 'secure_first_reorder' then 'medium'
        else 'low'
      end as resolved_confidence,
      case
        when candidates.resolved_action_type in ('reactivate_account','recover_at_risk','recover_reorder','follow_up_mission') then current_date
        when candidates.resolved_action_type in ('secure_first_reorder','prepare_reorder') then greatest(
          current_date,
          coalesce(candidates.expected_reorder_at::date - candidates.reorder_due_soon_days, current_date)
        )
        when candidates.resolved_action_type = 'schedule_follow_up' then current_date + 7
        else current_date
      end as resolved_due_at
    from candidates
    where candidates.resolved_action_type is not null
  )
  select
    resolved.brand_pharmacy_id,
    resolved.pharmacy_name,
    resolved.city,
    resolved.territory_name,
    resolved.agent_name,
    resolved.resolved_action_type,
    resolved.resolved_action_label,
    resolved.resolved_action_score,
    resolved.resolved_confidence,
    resolved.resolved_due_at,
    array_remove(array[
      case resolved.resolved_action_type
        when 'reactivate_account' then 'Le compte dépasse le seuil de dormance défini par la marque.'
        when 'recover_at_risk' then 'La cadence de commande est au-delà du seuil à risque défini par la marque.'
        when 'secure_first_reorder' then 'La pharmacie n’a encore passé qu’une seule commande valide.'
        when 'recover_reorder' then 'Le réassort attendu est dépassé.'
        when 'prepare_reorder' then 'La fenêtre de réassort calculée approche.'
        when 'follow_up_mission' then 'Une mission récente ne présente pas encore de suivi commercial postérieur.'
        when 'schedule_follow_up' then 'Aucune prochaine action ouverte n’est programmée.'
        else null
      end,
      case when resolved.expected_reorder_delay_days > 0
        then 'Réassort attendu en retard de ' || resolved.expected_reorder_delay_days || ' jours.' end,
      case when resolved.priority_level = 'strategic' then 'Compte stratégique.' end,
      case when resolved.potential_level in ('high','very_high') then 'Fort potentiel commercial.' end,
      case when resolved.revenue_trend in ('decline','strong_decline') then 'Chiffre d’affaires récent en baisse.' end,
      case when resolved.has_next_action then 'Une action est déjà ouverte : vérifier avant toute nouvelle création.' end
    ]::text[], null) as rationale,
    jsonb_strip_nulls(jsonb_build_object(
      'health_status', resolved.health_status,
      'orders_count', resolved.orders_count,
      'days_since_last_order', resolved.days_since_last_order,
      'expected_reorder_at', resolved.expected_reorder_at,
      'expected_reorder_delay_days', resolved.expected_reorder_delay_days,
      'expected_interval_days', resolved.expected_interval_days,
      'interval_source', resolved.interval_source,
      'revenue_trend', resolved.revenue_trend,
      'revenue_trend_percent', resolved.revenue_trend_percent,
      'priority_level', resolved.priority_level,
      'potential_level', resolved.potential_level,
      'has_next_action', resolved.has_next_action,
      'next_action_at', resolved.next_action_at,
      'recent_mission_without_follow_up', resolved.recent_mission_without_follow_up,
      'brand_rule_first_reorder_days', resolved.first_reorder_target_days,
      'brand_rule_due_soon_days', resolved.reorder_due_soon_days
    )) as evidence,
    resolved.has_next_action
  from resolved
  order by resolved.resolved_action_score desc, resolved.resolved_due_at, resolved.pharmacy_name
  limit least(greatest(coalesce(result_limit, 50), 1), 500);
end;
$$;

revoke all on function public.get_next_best_actions(uuid, integer, uuid) from public, anon;
grant execute on function public.get_next_best_actions(uuid, integer, uuid) to authenticated;
