create or replace function public.get_order_workflow_summary(
  target_brand_id uuid,
  target_period_start date default null,
  target_period_end date default null,
  target_agent_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  effective_agent_id uuid := target_agent_id;
  result jsonb;
begin
  if actor is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Brand access is required' using errcode = '42501';
  end if;

  if not private.has_elevated_brand_access(target_brand_id) then
    if effective_agent_id is null then
      effective_agent_id := actor;
    elsif effective_agent_id <> actor then
      raise exception 'Agent workflow scope is limited to self' using errcode = '42501';
    end if;
  end if;

  select jsonb_build_object(
    'pending_count', count(*) filter (where o.order_status = 'pending'),
    'pending_revenue_ht', coalesce(sum(o.net_amount_ht) filter (
      where o.order_status = 'pending'
        and o.order_type not in ('sample','return','credit_note')
        and o.net_amount_ht > 0
    ), 0),
    'needs_correction_count', count(*) filter (where o.order_status = 'needs_correction'),
    'rejected_count', count(*) filter (where o.order_status = 'rejected'),
    'booked_revenue_ht', coalesce(sum(o.net_amount_ht) filter (
      where o.order_status in ('confirmed','invoiced','partially_delivered','delivered')
        and o.order_type not in ('sample','return','credit_note')
        and o.net_amount_ht > 0
    ), 0),
    'invoiced_revenue_ht', coalesce(sum(o.net_amount_ht) filter (
      where o.order_status in ('invoiced','partially_delivered','delivered')
        and o.order_type not in ('sample','return','credit_note')
        and o.net_amount_ht > 0
    ), 0),
    'commercial_order_count', count(*) filter (
      where o.order_status in ('confirmed','invoiced','partially_delivered','delivered')
        and o.order_type not in ('sample','return','credit_note')
        and o.net_amount_ht > 0
    )
  ) into result
  from public.orders o
  where o.brand_id = target_brand_id
    and o.archived_at is null
    and (target_period_start is null or o.order_date::date >= target_period_start)
    and (target_period_end is null or o.order_date::date <= target_period_end)
    and (effective_agent_id is null or coalesce(o.source_agent_user_id, o.created_by) = effective_agent_id);

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_order_workflow_summary(uuid,date,date,uuid) from public, anon;
grant execute on function public.get_order_workflow_summary(uuid,date,date,uuid) to authenticated;;
