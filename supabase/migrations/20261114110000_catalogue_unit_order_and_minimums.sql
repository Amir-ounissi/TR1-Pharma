-- TR1 PHARMA / catalogue pharmacie.
-- Autorise les quantites a l'unite au-dessus du minimum de chaque reference.
-- quantity_step reste une donnee fournisseur, mais ne bloque plus la saisie
-- d'une quantite intermediaire dans le parcours de commande.
create or replace function public.catalogue_submit_request(p_slug text,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_brand uuid;
  v_mode text;
  v_item jsonb;
  v_product public.private_catalog_products%rowtype;
  v_qty integer;
  v_unit numeric(12,2);
  v_request uuid;
  v_lines jsonb := '[]'::jsonb;
  v_firm boolean := true;
  v_total numeric(14,2) := 0;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_pharmacy is null then raise exception 'Catalogue non autorise' using errcode='42501'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Marque invalide' using errcode='22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array'
    or jsonb_array_length(p_lines) not between 1 and 40 then
    raise exception 'Selection invalide' using errcode='22023';
  end if;
  select b.id,a.pricing_mode into v_brand,v_mode
    from public.private_catalog_access a
    join public.private_catalog_brands b on b.id=a.brand_id
    where a.pharmacy_id=v_pharmacy and a.active and b.active and b.slug=p_slug;
  if not found then raise exception 'Marque non autorisee' using errcode='42501'; end if;
  if (select count(*) from public.private_catalog_requests r
    where r.created_by=(select auth.uid())
      and r.created_at>now()-interval '1 hour') >= 20 then
    raise exception 'Trop de demandes. Reessayez plus tard.' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_item)<>'object'
      or jsonb_typeof(v_item->'product_id')<>'string'
      or jsonb_typeof(v_item->'quantity')<>'number'
      or (v_item->>'quantity') !~ '^[0-9]{1,5}$' then
      raise exception 'Ligne invalide' using errcode='22023';
    end if;
    select * into v_product from public.private_catalog_products p
      where p.id=(v_item->>'product_id')::uuid and p.brand_id=v_brand and p.active;
    if not found then raise exception 'Reference indisponible' using errcode='22023'; end if;
    if v_product.id = any(v_seen) then
      raise exception 'References en doublon' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_product.id);
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty>5000 or v_qty<v_product.min_quantity then
      raise exception 'Minimum de commande non respecte: % unites minimum', v_product.min_quantity
        using errcode='22023';
    end if;
    v_unit:=null;
    if v_mode='contractual' then
      select t.price_ht into v_unit from (
        select c.min_quantity,c.price_ht from public.private_catalog_contract_tiers c
          where c.product_id=v_product.id and c.pharmacy_id=v_pharmacy
        union all
        select v_product.min_quantity,f.price_ht
          from public.private_catalog_prices f where f.product_id=v_product.id
            and f.pharmacy_id=v_pharmacy
            and not exists(select 1 from public.private_catalog_contract_tiers c
              where c.product_id=v_product.id and c.pharmacy_id=v_pharmacy
                and c.min_quantity=v_product.min_quantity)
      ) t where t.min_quantity<=v_qty
        order by t.min_quantity desc limit 1;
    end if;
    if v_unit is null then v_firm:=false;
    else v_total:=v_total+v_unit*v_qty; end if;
    v_lines:=v_lines || jsonb_build_array(jsonb_build_object(
      'product_id',v_product.id,'product_name',v_product.name,
      'sku',v_product.sku,'quantity',v_qty,'vat_rate',v_product.vat_rate,
      'unit_price_ht',v_unit));
  end loop;
  if v_total>100000000 then
    raise exception 'Montant superieur a la limite autorisee' using errcode='22023';
  end if;
  insert into public.private_catalog_requests
    (pharmacy_id,brand_id,created_by,request_kind,total_ht,status)
    values(v_pharmacy,v_brand,(select auth.uid()),
      case when v_firm then 'order' else 'quote' end,
      case when v_firm then v_total else null end,'received')
    returning id into v_request;
  for v_item in select value from jsonb_array_elements(v_lines) loop
    insert into public.private_catalog_request_items(
      request_id,product_id,product_name,sku,quantity,unit_price_ht,vat_rate,line_total_ht)
    values(v_request,(v_item->>'product_id')::uuid,v_item->>'product_name',
      v_item->>'sku',(v_item->>'quantity')::integer,
      case when v_firm then (v_item->>'unit_price_ht')::numeric else null end,
      (v_item->>'vat_rate')::numeric,
      case when v_firm then
        (v_item->>'unit_price_ht')::numeric*(v_item->>'quantity')::integer else null end);
  end loop;
  return jsonb_build_object('id',v_request,'request_kind',
    case when v_firm then 'order' else 'quote' end);
end $$;
