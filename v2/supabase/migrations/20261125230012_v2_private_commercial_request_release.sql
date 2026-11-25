create function private.commercial_request_eligible(p_product uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.products p join public.brands b on b.id=p.brand_id left join public.althesia_product_specs s on s.product_id=p.id
 where p.id=p_product and p.price_ht>0 and p.min_qty>0 and p.qty_step>0 and nullif(trim(p.source_document),'') is not null
 and not exists(select 1 from public.product_discontinuations d where d.brand_id=p.brand_id and d.ean=p.ean)
 and (
 (p.published and p.price_verified and p.fr_market_checked and p.fr_label_checked and not p.requires_review and b.active and coalesce(p.source_active,true) and (s.product_id is null or s.market_status='verified'))
 or (b.slug in('beauty-of-joseon','biodance','dr-althea','medicube') and coalesce(p.source_active,true))
 or (b.slug in('vitalora','bloomster') and p.ean in('3770034273080','3770034273066','3770034273110','3770034273141','3770034273035','3770034273097','3770034273172','3770034273226','3770034273219','3770034273103','3770034273202','3770034273059','3770034273165','3770019227343','3770019227336') and s.market_status<>'food_cbd_blocked')
 or (b.slug='noto' and p.ean in('3770019227558','3770019227572','3770019227565','3770019227305','3770019227312') and s.market_status='review_required')
 or (b.slug='vk-swiss' and p.source_document like 'Facture fournisseur VK SWISS n° 2026-00236%' and p.ean in('7629999810969','7629999601949','7629999608559','7629999637191','7629999731837','7629999149366'))
 ));
$$;
revoke all on function private.commercial_request_eligible(uuid) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION private.commercial_request_catalogue_data()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with eligible as (
  select
    p.id, p.brand_id, b.name as brand_name, b.slug as brand_slug,
    p.name, p.sku, p.ean, case when p.published and not p.requires_review then p.description else 'Présentation commerciale sur la base du catalogue transmis. Fiche et disponibilité à confirmer auprès de la marque.' end as description, p.format, p.category,
    case when p.image_url ~ '^https://' and not exists(select 1 from public.product_media_audit ma where ma.product_id=p.id and ma.image_review_status='rejected') then p.image_url else null end as image_url, p.price_ht, p.vat_rate, p.min_qty, p.qty_step,
    case when p.published and not p.requires_review then p.benefits end as benefits, case when p.published and not p.requires_review then p.actives end as actives, case when p.published and not p.requires_review then p.inci end as inci, case when p.published and not p.requires_review then p.usage_advice end as usage_advice, case when p.published and not p.requires_review then p.precautions end as precautions,
    s.source_retail_ttc as retail_ttc
  from public.products p
  join public.brands b on b.id = p.brand_id
  left join public.althesia_product_specs s on s.product_id = p.id
  where private.commercial_request_eligible(p.id)
),
brand_rows as (
  select jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'catalogue_active', b.active,
      'short_description', d.short_description,
      'catalogue_note', d.catalogue_note,
      'terms', case when t.verified then jsonb_build_object(
        'minimum_order_units', t.minimum_order_units,
        'minimum_order_ht', t.minimum_order_ht,
        'shipping_fee_ht', t.shipping_fee_ht,
        'free_shipping_from_ht', t.free_shipping_from_ht
      ) else null end,
      'offers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'title', o.title,
          'offer_kind', o.offer_kind,
          'summary', o.summary,
          'min_distinct_references', o.min_distinct_references,
          'min_units_per_reference', o.min_units_per_reference,
          'free_units_per_reference', o.free_units_per_reference,
          'min_total_paid_units', o.min_total_paid_units,
          'min_order_ht', o.min_order_ht,
          'fixed_pack_ht', o.fixed_pack_ht,
          'discount_pct', o.discount_pct,
          'offer_conditions', o.offer_conditions,
          'plv_commitment', o.plv_commitment,
          'training_commitment', o.training_commitment,
          'shipping_terms', o.shipping_terms,
          'valid_from', o.valid_from,
          'valid_until', o.valid_until,
          'lines', coalesce((
            select jsonb_agg(jsonb_build_object(
              'product_id', p.id,
              'product_name', p.name,
              'paid_units', l.paid_units,
              'free_units', l.free_units,
              'line_note', l.line_note
            ) order by p.name)
            from public.brand_implantation_offer_lines l
            join public.products p on p.id = l.product_id
            where l.offer_id = o.id
          ), '[]'::jsonb)
        ) order by o.title)
        from public.brand_implantation_offers o
        where o.brand_id = b.id
          and b.active
          and o.published
          and o.verification_status = 'verified'
          and (o.valid_from is null or o.valid_from <= current_date)
          and (o.valid_until is null or o.valid_until >= current_date)
          and not exists (
            select 1
            from public.brand_implantation_offer_lines l
            left join eligible e on e.id = l.product_id
            where l.offer_id = o.id and e.id is null
          )
      ), '[]'::jsonb)
    ) order by b.name
  ) as value
  from public.brands b
  left join public.brand_discovery_directory d on d.brand_id = b.id
  left join public.brand_trade_terms t on t.brand_id = b.id
  where coalesce(d.discoverable, false) or b.active
),
product_rows as (
  select jsonb_agg(jsonb_build_object(
    'id', e.id,
    'brand_id', e.brand_id,
    'brand', e.brand_name,
    'brand_slug', e.brand_slug,
    'name', e.name,
    'sku', e.sku,
    'ean', e.ean,
    'description', e.description,
    'format', e.format,
    'category', e.category,
    'image_url', e.image_url,
    'price_ht', e.price_ht,
    'vat_rate', e.vat_rate,
    'min_qty', e.min_qty,
    'qty_step', e.qty_step,
    'benefits', e.benefits,
    'actives', e.actives,
    'inci', e.inci,
    'usage_advice', e.usage_advice,
    'precautions', e.precautions,
    'retail_ttc', e.retail_ttc,
    'tiers', coalesce((
      select jsonb_agg(jsonb_build_object('min_qty', q.min_qty, 'price_ht', q.price_ht) order by q.min_qty)
      from public.product_quantity_tiers q
      where q.product_id = e.id and q.verified
    ), '[]'::jsonb)
  ) order by e.brand_name, e.name) as value
  from eligible e
)
select jsonb_build_object(
  'brands', coalesce((select value from brand_rows), '[]'::jsonb),
  'products', coalesce((select value from product_rows), '[]'::jsonb)
);
$function$
;
revoke all on function private.commercial_request_catalogue_data() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION private.catalogue_link_data(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.pharmacy_catalogue_links; ph public.pharmacies; raw jsonb; result_products jsonb;
begin
 select * into l from private.catalogue_link_lookup(p_token);
 if l.id is null then return null;end if;
 select * into ph from public.pharmacies where id=l.pharmacy_id;
 raw:=private.commercial_request_catalogue_data();
 select coalesce(jsonb_agg(p || jsonb_build_object('price_ht',private.catalogue_link_price(l.pharmacy_id,(p->>'id')::uuid,(p->>'min_qty')::int),
 'tiers',coalesce((select jsonb_agg(jsonb_build_object('min_qty',n,'price_ht',private.catalogue_link_price(l.pharmacy_id,(p->>'id')::uuid,n)) order by n)
 from (select (p->>'min_qty')::int n union select q.min_qty from public.product_quantity_tiers q where q.product_id=(p->>'id')::uuid and q.verified union select o.paid_quantity from public.althesia_trade_offers o where o.product_id=(p->>'id')::uuid and o.price_confirmed and o.free_quantity=0 union select r.min_qty from public.price_rules r where r.product_id=(p->>'id')::uuid and r.pharmacy_id=l.pharmacy_id) thresholds where n>=(p->>'min_qty')::int),'[]'::jsonb)) order by p->>'brand',p->>'name'),'[]'::jsonb) into result_products from jsonb_array_elements(raw->'products') p;
 return jsonb_build_object('brands',raw->'brands','products',result_products,'pharmacy',jsonb_build_object('name',ph.name,'city',ph.city),'expires_at',l.expires_at);
end $function$
;
CREATE OR REPLACE FUNCTION private.catalogue_link_price(p_pharmacy uuid, p_product uuid, p_qty integer)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce((select r.price_ht from public.price_rules r where r.pharmacy_id=p_pharmacy and r.product_id=p_product and r.min_qty<=p_qty order by r.min_qty desc limit 1),
 (select q.price_ht from public.product_quantity_tiers q where q.product_id=p_product and q.verified and q.min_qty<=p_qty order by q.min_qty desc limit 1),(select o.purchase_unit_ht from public.althesia_trade_offers o where o.product_id=p_product and o.price_confirmed and o.free_quantity=0 and o.paid_quantity<=p_qty order by o.paid_quantity desc limit 1),p.price_ht)
 from public.products p where p.id=p_product;
$function$
;
CREATE OR REPLACE FUNCTION private.submit_public_catalogue_request(p_contact_name text, p_pharmacy_name text, p_email text, p_phone text, p_city text, p_postal_code text, p_siret text, p_note text, p_items jsonb, p_honeypot text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lead_id uuid;
  v_matched_pharmacy_id uuid;
  v_item_count integer;
  v_unique_count integer;
  v_brand record;
  v_request_id uuid;
  v_item record;
  v_recent_count integer;
  v_siret text := nullif(trim(coalesce(p_siret, '')), '');
begin
  if nullif(trim(coalesce(p_honeypot, '')), '') is not null then raise exception 'Demande invalide'; end if;
  if length(trim(coalesce(p_contact_name, ''))) not between 2 and 120
     or length(trim(coalesce(p_pharmacy_name, ''))) not between 2 and 180
     or length(trim(coalesce(p_city, ''))) not between 2 and 120 then
    raise exception 'Coordonnées professionnelles incomplètes';
  end if;
  if length(trim(coalesce(p_email, ''))) not between 5 and 254
     or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if length(coalesce(p_phone, '')) > 30 or length(coalesce(p_postal_code, '')) > 12
     or length(coalesce(p_siret, '')) > 14
     or (v_siret is not null and v_siret !~ '^[0-9]{14}$')
     or length(coalesce(p_note, '')) > 1500 then
    raise exception 'Coordonnées invalides';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Panier vide ou trop volumineux';
  end if;
  select count(*)::integer, count(distinct x.product_id)::integer
    into v_item_count, v_unique_count
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer);
  if v_item_count <> jsonb_array_length(p_items) or v_unique_count <> v_item_count then
    raise exception 'Panier invalide ou références en double';
  end if;
  if auth.uid() is not null and not exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('owner','pharmacy')
  ) then raise exception 'Compte non autorisé'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    left join public.products p on p.id = x.product_id
    left join public.brands b on b.id = p.brand_id
    left join public.althesia_product_specs s on s.product_id = p.id
    where p.id is null or x.quantity is null
      or x.quantity < p.min_qty or x.quantity > 5000
      or mod(x.quantity - p.min_qty, p.qty_step) <> 0
      or not private.commercial_request_eligible(p.id)
  ) then
    raise exception 'Une référence n’est plus disponible dans le catalogue privé ou ses conditions ont changé';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_email)), 0));
  select count(*)::integer into v_recent_count
  from public.public_catalogue_leads l
  where lower(l.email) = lower(trim(p_email))
    and l.created_at > now() - interval '15 minutes';
  if v_recent_count >= 3 then raise exception 'Trop de demandes récentes pour cette adresse e-mail'; end if;

  if v_siret is not null then
    select ph.id into v_matched_pharmacy_id from public.pharmacies ph where ph.siret = v_siret limit 1;
  end if;

  insert into public.public_catalogue_leads (
    pharmacy_name, contact_name, email, phone, city, postal_code, siret,
    note, matched_pharmacy_id, created_by
  ) values (
    trim(p_pharmacy_name), trim(p_contact_name), lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''), trim(p_city),
    nullif(trim(coalesce(p_postal_code, '')), ''), v_siret,
    nullif(trim(coalesce(p_note, '')), ''), v_matched_pharmacy_id, auth.uid()
  ) returning id into v_lead_id;

  for v_brand in
    select b.id as brand_id, round(sum(x.quantity * coalesce(tier.price_ht, p.price_ht)), 2) as total_ht
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    join public.products p on p.id = x.product_id
    join public.brands b on b.id = p.brand_id
    left join lateral (
      select q.price_ht from public.product_quantity_tiers q
      where q.product_id = p.id and q.verified and q.min_qty <= x.quantity
      order by q.min_qty desc limit 1
    ) tier on true
    group by b.id order by b.id
  loop
    insert into public.public_catalogue_requests (lead_id, brand_id, total_ht)
    values (v_lead_id, v_brand.brand_id, v_brand.total_ht)
    returning id into v_request_id;

    for v_item in
      select p.id as product_id, b.id as brand_id, p.name as product_name,
        b.name as brand_name, p.sku, x.quantity,
        coalesce(tier.price_ht, p.price_ht) as unit_price_ht, p.vat_rate
      from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
      join public.products p on p.id = x.product_id
      join public.brands b on b.id = p.brand_id
      left join lateral (
        select q.price_ht from public.product_quantity_tiers q
        where q.product_id = p.id and q.verified and q.min_qty <= x.quantity
        order by q.min_qty desc limit 1
      ) tier on true
      where b.id = v_brand.brand_id
    loop
      insert into public.public_catalogue_request_items (
        request_id, product_id, brand_id, product_name, brand_name, sku,
        quantity, unit_price_ht, line_total_ht, vat_rate
      ) values (
        v_request_id, v_item.product_id, v_item.brand_id, v_item.product_name,
        v_item.brand_name, v_item.sku, v_item.quantity, v_item.unit_price_ht,
        round(v_item.quantity * v_item.unit_price_ht, 2), v_item.vat_rate
      );
    end loop;
  end loop;
  return v_lead_id;
end;
$function$
;
revoke all on function private.submit_public_catalogue_request(text,text,text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
