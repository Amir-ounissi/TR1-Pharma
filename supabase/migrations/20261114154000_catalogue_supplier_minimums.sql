-- Validation serveur des minimums fournisseur sur un panier multimarque.
-- Verifie les prix contractuels uniquement; une demande au tarif indicatif reste un devis.
create or replace function private.catalogue_validate_supplier_minimums(p_groups jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_pharmacy uuid := private.catalogue_current_pharmacy_id();
 v_supplier record;
 v_line record;
 v_total_units integer;
 v_total_ht numeric := 0;
 v_all_priced boolean;
 v_unit_price numeric;
 v_pricing_qty integer;
 v_group_id uuid;
begin
 if v_pharmacy is null or (select auth.uid()) is null then
   raise exception 'Catalogue non autorise' using errcode='42501';
 end if;
 if jsonb_typeof(p_groups)<>'array' or jsonb_array_length(p_groups)>20 then
   raise exception 'Panier invalide' using errcode='22023';
 end if;

 for v_supplier in
   select s.id,s.display_name,t.minimum_order_units,t.minimum_order_ht
   from public.private_catalog_suppliers s
   join public.private_catalog_supplier_terms t on t.supplier_id=s.id
   where s.active and t.active and t.verified_at is not null
 loop
   v_total_units:=0;v_total_ht:=0;v_all_priced:=true;
   for v_line in
     select p.id as product_id,p.min_quantity,p.brand_id,
       a.pricing_mode,(l.value->>'quantity')::integer as quantity
     from jsonb_array_elements(p_groups) g
     join public.private_catalog_brands b on b.slug=g.value->>'slug' and b.active
     join public.private_catalog_supplier_brands sb on sb.brand_id=b.id
       and sb.supplier_id=v_supplier.id
     join public.private_catalog_access a on a.brand_id=b.id
       and a.pharmacy_id=v_pharmacy and a.active
     cross join lateral jsonb_array_elements(
       case when jsonb_typeof(g.value->'lines')='array' then g.value->'lines'
       else '[]'::jsonb end) l
     join public.private_catalog_products p
       on p.id::text=l.value->>'product_id' and p.brand_id=b.id and p.active
     where (l.value->>'quantity') ~ '^[0-9]{1,5}$'
   loop
     v_total_units:=v_total_units+v_line.quantity;
     if v_line.pricing_mode<>'contractual' then
       v_all_priced:=false;
       continue;
     end if;

     -- Retenir le total de la collection pour les paliers mutualises.
     select gp.group_id into v_group_id
       from public.private_catalog_quantity_group_products gp
       join public.private_catalog_quantity_groups q on q.id=gp.group_id and q.active
       where gp.product_id=v_line.product_id;
     v_pricing_qty:=v_line.quantity;
     if v_group_id is not null then
       select coalesce(sum((l.value->>'quantity')::integer),0)::integer
         into v_pricing_qty
       from jsonb_array_elements(p_groups) g
       cross join lateral jsonb_array_elements(
         case when jsonb_typeof(g.value->'lines')='array'
              then g.value->'lines' else '[]'::jsonb end) l
       join public.private_catalog_quantity_group_products gp
         on gp.group_id=v_group_id and gp.product_id::text=l.value->>'product_id'
       where (l.value->>'quantity')~'^[0-9]{1,5}$';
     end if;

     select c.price_ht into v_unit_price from public.private_catalog_contract_tiers c
       where c.pharmacy_id=v_pharmacy and c.product_id=v_line.product_id
         and c.min_quantity<=v_pricing_qty
       order by c.min_quantity desc limit 1;
     if v_unit_price is null then
       select f.price_ht into v_unit_price from public.private_catalog_prices f
       where f.pharmacy_id=v_pharmacy and f.product_id=v_line.product_id;
     end if;
     if v_unit_price is null then v_all_priced:=false;
     else v_total_ht:=v_total_ht+v_unit_price*v_line.quantity;end if;
     v_unit_price:=null;
   end loop;

   if v_total_units>0 then
     if v_supplier.minimum_order_units is not null
       and v_total_units<v_supplier.minimum_order_units then
       raise exception 'Minimum fournisseur % : % unites',
         v_supplier.display_name,v_supplier.minimum_order_units
         using errcode='22023';
     end if;
     if v_supplier.minimum_order_ht is not null and v_all_priced
       and v_total_ht<v_supplier.minimum_order_ht then
       raise exception 'Minimum fournisseur % : % EUR HT',
         v_supplier.display_name,v_supplier.minimum_order_ht
         using errcode='22023';
     end if;
   end if;
 end loop;
end $$;
revoke all on function private.catalogue_validate_supplier_minimums(jsonb) from public,anon,authenticated;
grant execute on function private.catalogue_validate_supplier_minimums(jsonb) to authenticated;

-- Ne jamais diffuser des seuils en brouillon sur l'espace pharmacie.
create or replace function public.catalogue_commercial_context()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_groups jsonb;
  v_suppliers jsonb;
begin
  if (select auth.uid()) is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'brand_slug',b.slug,'name',g.name,
    'minimum_total_units',g.minimum_total_units,
    'quantity_multiple',g.quantity_multiple,
    'product_ids',(
      select coalesce(jsonb_agg(gp.product_id),'[]'::jsonb)
      from public.private_catalog_quantity_group_products gp
      join public.private_catalog_products p on p.id=gp.product_id and p.active
      where gp.group_id=g.id
    )
  ) order by b.slug,g.name),'[]'::jsonb)
  into v_groups
  from public.private_catalog_quantity_groups g
  join public.private_catalog_brands b on b.id=g.brand_id and b.active
  join public.private_catalog_access a on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
  where g.active;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.display_name,
    'brand_slugs',(
      select coalesce(jsonb_agg(b.slug order by b.name),'[]'::jsonb)
      from public.private_catalog_supplier_brands sb
      join public.private_catalog_brands b on b.id=sb.brand_id and b.active
      join public.private_catalog_access a on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
      where sb.supplier_id=s.id
    ),
    'minimum_order_units',t.minimum_order_units,
    'minimum_order_ht',t.minimum_order_ht,
    'shipping_fee_ht',t.shipping_fee_ht,
    'free_shipping_from_ht',t.free_shipping_from_ht,
    'gift_rules',coalesce(t.gift_rules,'[]'::jsonb),
    'conditions_verified',coalesce(t.active and t.verified_at is not null,false)
  ) order by s.display_name),'[]'::jsonb)
  into v_suppliers
  from public.private_catalog_suppliers s
  left join public.private_catalog_supplier_terms t
    on t.supplier_id=s.id and t.active and t.verified_at is not null
  where s.active and exists (
    select 1 from public.private_catalog_supplier_brands sb
    join public.private_catalog_brands b on b.id=sb.brand_id and b.active
    join public.private_catalog_access a on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
    where sb.supplier_id=s.id
  );

  return jsonb_build_object('quantity_groups',v_groups,'suppliers',v_suppliers);
end $$;
revoke all on function public.catalogue_commercial_context() from public,anon,authenticated;
grant execute on function public.catalogue_commercial_context() to authenticated;

CREATE OR REPLACE FUNCTION public.catalogue_submit_multibrand_request(p_groups jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  -- Controle les minimums fournisseur sur le panier COMBINÉ.
  perform private.catalogue_validate_supplier_minimums(p_groups);
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
$function$

