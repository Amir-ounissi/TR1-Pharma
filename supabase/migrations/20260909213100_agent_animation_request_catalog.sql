create or replace function public.get_animation_request_pharmacies(target_brand_id uuid)
returns table(
  brand_pharmacy_id uuid,
  pharmacy_name text,
  city text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    bp.id,
    coalesce(p.trade_name, p.legal_name, 'Pharmacie') as pharmacy_name,
    p.city
  from public.brand_pharmacies bp
  join public.pharmacies p on p.id = bp.pharmacy_id
  where bp.brand_id = target_brand_id
    and bp.archived_at is null
    and private.can_request_animation_for_pharmacy(bp.id, (select auth.uid()))
  order by coalesce(p.trade_name, p.legal_name, 'Pharmacie'), p.city;
$$;

revoke all on function public.get_animation_request_pharmacies(uuid) from public, anon;
grant execute on function public.get_animation_request_pharmacies(uuid) to authenticated;

comment on function public.get_animation_request_pharmacies(uuid) is
  'Returns only pharmacies on which the current user may request an animation; agents are restricted to their active primary portfolio.';
