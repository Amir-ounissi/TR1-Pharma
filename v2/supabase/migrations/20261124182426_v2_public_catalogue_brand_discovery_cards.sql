CREATE OR REPLACE FUNCTION private.public_catalogue_data()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with eligible as (
  select
    p.id, p.brand_id, b.name as brand_name, b.slug as brand_slug,
    p.name, p.sku, p.ean, p.description, p.format, p.category,
    p.image_url, p.price_ht, p.vat_rate, p.min_qty, p.qty_step,
    p.benefits, p.actives, p.inci, p.usage_advice, p.precautions,
    s.source_retail_ttc as retail_ttc
  from public.products p
  join public.brands b on b.id = p.brand_id
  left join public.althesia_product_specs s on s.product_id = p.id
  where b.active
    and p.published
    and not p.requires_review
    and p.price_verified
    and p.price_ht > 0
    and p.fr_market_checked
    and p.fr_label_checked
    and nullif(trim(p.fr_market_document), '') is not null
    and nullif(trim(p.ean), '') is not null
    and nullif(trim(p.description), '') is not null
    and length(trim(p.description)) >= 10
    and p.image_url ~ '^https://'
    and not exists (
      select 1 from public.product_media_audit ma
      where ma.product_id = p.id
        and (ma.image_review_status <> 'verified' or not ma.applied_to_draft or ma.candidate_image_url <> p.image_url)
    )
    and coalesce(p.source_active, true)
    and (s.product_id is null or s.market_status = 'verified')
    and not exists (
      select 1 from public.product_discontinuations d
      where d.brand_id = p.brand_id and d.ean = p.ean
    )
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