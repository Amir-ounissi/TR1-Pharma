-- Optional Vitalora demo seed. Run only AFTER importing the 18 unpublished Vitalora records into public.products.
-- ALL prices below are imaginary and must NEVER be used to fulfill orders.
-- Real brand stays inactive; no insert into real orders, prices, or permissions.
with ranked as (
  select p.*,row_number() over(order by p.sku) as rownum
  from public.products p join public.brands b on b.id=p.brand_id
  where b.slug='vitalora' and p.source_catalog='tr1_legacy_catalog' and not p.published
)
insert into public.demo_products
 (source_product_id,brand_id,name,sku,ean,format,category,description,image_url,demo_price_ht,min_qty,qty_step,active)
select id,brand_id,name,sku,ean,format,category,
 regexp_replace(coalesce(description,''),' ?Prix de vente conseillé catalogue : [0-9]+,[0-9]+ € TTC\\.','','gi'),
 image_url,(8 + ((rownum-1)%8))::numeric(12,2),3,3,true
from ranked on conflict(source_product_id) do nothing;
insert into public.demo_price_tiers(product_id,min_qty,price_ht)
select p.id,v.qty,case when v.qty=3 then p.demo_price_ht
when v.qty=6 then p.demo_price_ht-0.50 else p.demo_price_ht-1.00 end
from public.demo_products p
join public.brands b on b.id=p.brand_id
cross join (values (3),(6),(12)) v(qty)
where b.slug='vitalora'
on conflict (product_id,min_qty) do nothing;
-- Grant pilot access only after an owner has explicitly selected the pharmacy.
-- The customer-facing production permission public.pharmacy_brand_access remains unchanged.
