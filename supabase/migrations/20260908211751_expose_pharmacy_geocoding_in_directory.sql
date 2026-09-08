create or replace view public.brand_pharmacy_directory
with (security_invoker = true)
as
select
  bp.id,
  bp.brand_id,
  bp.pharmacy_id,
  bp.commercial_status,
  bp.activity_status,
  bp.priority_level,
  bp.potential_level,
  bp.potential_score,
  bp.current_agent_user_id,
  bp.territory_id,
  bp.next_action_type,
  bp.next_action_at,
  bp.last_interaction_at,
  bp.archived_at,
  p.legal_name,
  p.trade_name,
  p.cip_code,
  p.finess_code,
  p.siret,
  p.phone,
  p.email,
  p.postal_code,
  p.city,
  p.pharmacy_group_id,
  pg.name as pharmacy_group_name,
  t.name as territory_name,
  up.full_name as agent_name,
  concat_ws(' ', p.trade_name, p.legal_name, p.city, p.postal_code, p.cip_code, p.finess_code, p.siret, p.phone, p.email) as search_text,
  p.latitude,
  p.longitude,
  p.geocoding_status,
  p.geocoded_at,
  p.geocoding_source,
  p.address_line_1,
  p.address_line_2
from public.brand_pharmacies bp
join public.pharmacies p on p.id = bp.pharmacy_id
left join public.pharmacy_groups pg on pg.id = p.pharmacy_group_id
left join public.territories t on t.id = bp.territory_id
left join public.user_profiles up on up.user_id = bp.current_agent_user_id;
