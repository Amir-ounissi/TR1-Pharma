create or replace function public.search_pharmacy_directory_for_order(
  target_brand_id uuid,
  search_term text default null,
  candidate_siret text default null,
  candidate_cip text default null,
  candidate_finess text default null,
  candidate_name text default null,
  candidate_postal_code text default null,
  result_limit integer default 12
)
returns table (
  pharmacy_id uuid,
  brand_pharmacy_id uuid,
  relation_status text,
  legal_name text,
  trade_name text,
  siret text,
  cip_code text,
  finess_code text,
  postal_code text,
  city text,
  address_line_1 text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := nullif(btrim(search_term), '');
  normalized_siret text := nullif(regexp_replace(upper(coalesce(candidate_siret, '')), '[^A-Z0-9]', '', 'g'), '');
  normalized_cip text := nullif(regexp_replace(upper(coalesce(candidate_cip, '')), '[^A-Z0-9]', '', 'g'), '');
  normalized_finess text := nullif(regexp_replace(upper(coalesce(candidate_finess, '')), '[^A-Z0-9]', '', 'g'), '');
  normalized_name text := nullif(private.normalize_reference_text(candidate_name), '');
  normalized_postal_code text := nullif(regexp_replace(coalesce(candidate_postal_code, ''), '[^0-9]', '', 'g'), '');
begin
  if (select auth.uid()) is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Brand access is required' using errcode = '42501';
  end if;

  if normalized_search is null
    and normalized_siret is null
    and normalized_cip is null
    and normalized_finess is null
    and (normalized_name is null or normalized_postal_code is null) then
    return;
  end if;

  return query
  select
    pharmacy.id,
    relation.id,
    case when relation.id is null then 'global_only' else 'existing_brand_relation' end,
    pharmacy.legal_name,
    pharmacy.trade_name,
    pharmacy.siret,
    pharmacy.cip_code,
    pharmacy.finess_code,
    pharmacy.postal_code,
    pharmacy.city,
    pharmacy.address_line_1
  from public.pharmacies pharmacy
  left join public.brand_pharmacies relation
    on relation.pharmacy_id = pharmacy.id
    and relation.brand_id = target_brand_id
    and relation.archived_at is null
  where pharmacy.archived_at is null
    and pharmacy.is_active
    and (
      (normalized_search is not null and (
        pharmacy.legal_name ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.trade_name, '') ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.city, '') ilike '%' || normalized_search || '%'
        or regexp_replace(upper(coalesce(pharmacy.siret, '')), '[^A-Z0-9]', '', 'g') like '%' || regexp_replace(upper(normalized_search), '[^A-Z0-9]', '', 'g') || '%'
        or regexp_replace(upper(coalesce(pharmacy.cip_code, '')), '[^A-Z0-9]', '', 'g') like '%' || regexp_replace(upper(normalized_search), '[^A-Z0-9]', '', 'g') || '%'
        or regexp_replace(upper(coalesce(pharmacy.finess_code, '')), '[^A-Z0-9]', '', 'g') like '%' || regexp_replace(upper(normalized_search), '[^A-Z0-9]', '', 'g') || '%'
      ))
      or (normalized_siret is not null and regexp_replace(upper(coalesce(pharmacy.siret, '')), '[^A-Z0-9]', '', 'g') = normalized_siret)
      or (normalized_cip is not null and regexp_replace(upper(coalesce(pharmacy.cip_code, '')), '[^A-Z0-9]', '', 'g') = normalized_cip)
      or (normalized_finess is not null and regexp_replace(upper(coalesce(pharmacy.finess_code, '')), '[^A-Z0-9]', '', 'g') = normalized_finess)
      or (
        normalized_name is not null
        and normalized_postal_code is not null
        and regexp_replace(coalesce(pharmacy.postal_code, ''), '[^0-9]', '', 'g') = normalized_postal_code
      )
    )
  order by
    case
      when normalized_siret is not null and regexp_replace(upper(coalesce(pharmacy.siret, '')), '[^A-Z0-9]', '', 'g') = normalized_siret then 0
      when normalized_cip is not null and regexp_replace(upper(coalesce(pharmacy.cip_code, '')), '[^A-Z0-9]', '', 'g') = normalized_cip then 1
      when normalized_finess is not null and regexp_replace(upper(coalesce(pharmacy.finess_code, '')), '[^A-Z0-9]', '', 'g') = normalized_finess then 2
      when normalized_name is not null and normalized_postal_code is not null and (
        private.normalize_reference_text(pharmacy.legal_name) = normalized_name
        or private.normalize_reference_text(coalesce(pharmacy.trade_name, '')) = normalized_name
      ) then 3
      else 4
    end,
    (relation.id is not null) desc,
    pharmacy.legal_name,
    pharmacy.id
  limit greatest(1, least(coalesce(result_limit, 12), 25));
end;
$$;

revoke all on function public.search_pharmacy_directory_for_order(uuid, text, text, text, text, text, text, integer) from public, anon;
grant execute on function public.search_pharmacy_directory_for_order(uuid, text, text, text, text, text, text, integer) to authenticated;;
