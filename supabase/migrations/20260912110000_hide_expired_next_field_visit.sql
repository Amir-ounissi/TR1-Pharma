create or replace function public.get_my_next_field_visit(brand_filter uuid default null::uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
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
    'visit_id', v.id,
    'pharmacy_id', v.pharmacy_id,
    'name', coalesce(p.trade_name, p.legal_name),
    'address', concat_ws(', ', p.address_line_1, concat_ws(' ', p.postal_code, p.city)),
    'city', p.city,
    'phone', p.phone,
    'latitude', p.latitude,
    'longitude', p.longitude,
    'visit_kind', v.visit_kind,
    'status', v.status,
    'title', v.title,
    'objective', v.objective,
    'scheduled_at', v.scheduled_start_at,
    'scheduled_end_at', v.scheduled_end_at,
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand_id', fvb.brand_id,
        'brand_name', b.name,
        'brand_pharmacy_id', fvb.brand_pharmacy_id,
        'objective', fvb.objective,
        'is_primary', fvb.is_primary
      ) order by fvb.is_primary desc, b.name asc)
      from public.field_visit_brands fvb
      join public.brands b on b.id = fvb.brand_id
      where fvb.visit_id = v.id
        and private.has_brand_role(fvb.brand_id, array['agent'])
        and (brand_filter is null or fvb.brand_id = brand_filter)
    ), '[]'::jsonb),
    'primary_contact', (
      select jsonb_build_object(
        'name', concat_ws(' ', c.first_name, c.last_name),
        'phone', c.phone
      )
      from public.pharmacy_contacts c
      where c.pharmacy_id = p.id
        and c.is_primary
        and c.archived_at is null
      limit 1
    )
  ) into result
  from public.field_visits v
  join public.pharmacies p on p.id = v.pharmacy_id
  where v.owner_user_id = (select auth.uid())
    and v.archived_at is null
    and v.status in ('planned', 'confirmed', 'in_progress')
    and coalesce(v.scheduled_end_at, v.scheduled_start_at) >= now()
    and (
      brand_filter is null
      or exists (
        select 1
        from public.field_visit_brands scoped
        where scoped.visit_id = v.id
          and scoped.brand_id = brand_filter
          and private.has_brand_role(scoped.brand_id, array['agent'])
      )
    )
  order by
    case when v.status = 'in_progress' then 0 else 1 end,
    v.scheduled_start_at asc
  limit 1;

  return result;
end;
$function$;
