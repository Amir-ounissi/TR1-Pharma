-- TR1 PHARMA : transmission atomique d'un panier multimarque.
-- Une seule validation côté pharmacie crée une demande distincte par marque.
-- L'appel aux fonctions existantes conserve tous leurs contrôles tarifaires et d'accès.
create or replace function public.catalogue_submit_multibrand_request(p_groups jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group jsonb;
  v_slug text;
  v_lines jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_seen_slugs text[] := array[]::text[];
  v_line_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Catalogue non autorise' using errcode = '42501';
  end if;

  if p_groups is null
    or jsonb_typeof(p_groups) <> 'array'
    or jsonb_array_length(p_groups) not between 1 and 20 then
    raise exception 'Selection multimarque invalide' using errcode = '22023';
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    if jsonb_typeof(v_group) <> 'object'
      or jsonb_typeof(v_group->'slug') <> 'string'
      or jsonb_typeof(v_group->'lines') <> 'array' then
      raise exception 'Groupe fournisseur invalide' using errcode = '22023';
    end if;

    v_slug := v_group->>'slug';
    v_lines := v_group->'lines';

    if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'Marque invalide' using errcode = '22023';
    end if;

    if v_slug = any(v_seen_slugs) then
      raise exception 'Marque en doublon' using errcode = '22023';
    end if;
    v_seen_slugs := array_append(v_seen_slugs, v_slug);

    if jsonb_array_length(v_lines) not between 1 and 40 then
      raise exception 'Selection invalide pour une marque' using errcode = '22023';
    end if;

    v_line_count := v_line_count + jsonb_array_length(v_lines);
    if v_line_count > 40 then
      raise exception 'Une demande ne peut pas depasser 40 references' using errcode = '22023';
    end if;

    -- La fonction existante revalide l'officine, la marque, chaque produit,
    -- les minimums et les prix contractuels depuis la base.
    v_result := public.catalogue_submit_request(v_slug, v_lines);
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('brand_slug', v_slug, 'request', v_result)
    );
  end loop;

  return jsonb_build_object(
    'request_count', jsonb_array_length(v_results),
    'requests', v_results
  );
end;
$$;

revoke all on function public.catalogue_submit_multibrand_request(jsonb) from public, anon, authenticated;
grant execute on function public.catalogue_submit_multibrand_request(jsonb) to authenticated;
