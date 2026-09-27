-- Keep test/dry-run fixtures out of commercial performance without deleting audit history.
-- The exact marker is intentionally narrow so legitimate manual orders remain eligible.

create or replace view public.performance_booked_order_facts
with (security_invoker = true)
as
select
  o.id as order_id,
  o.brand_id,
  o.brand_pharmacy_id,
  o.pharmacy_id,
  o.order_date,
  o.net_amount_ht,
  o.is_initial_order,
  o.is_reorder,
  bp.territory_id,
  coalesce(o.source_agent_user_id, assignment.user_id, bp.current_agent_user_id) as agent_user_id_at_order
from public.orders o
join public.brand_pharmacies bp on bp.id = o.brand_pharmacy_id
left join lateral (
  select pa.user_id
  from public.pharmacy_assignments pa
  where pa.brand_pharmacy_id = o.brand_pharmacy_id
    and pa.assignment_type = 'commercial_agent'::public.assignment_type
    and pa.archived_at is null
    and pa.starts_at <= o.order_date::date
    and (pa.ends_at is null or pa.ends_at >= o.order_date::date)
  order by pa.starts_at desc, pa.created_at desc
  limit 1
) assignment on true
where o.archived_at is null
  and private.order_counts_for_booked_revenue(o.order_status, o.order_type, o.net_amount_ht)
  and coalesce(o.notes, '') <> 'Test E2E staging — HubSpot dry-run';

grant select on public.performance_booked_order_facts to authenticated, service_role;
