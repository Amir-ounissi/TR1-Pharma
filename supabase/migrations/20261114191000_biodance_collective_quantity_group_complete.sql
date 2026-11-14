-- Corrige le cinquieme masque Biodance : l'EAN source valide est 8809891184606.
-- La migration initiale utilisait 8809891184613, absent du catalogue source.
insert into public.private_catalog_quantity_group_products(group_id,product_id)
select g.id,p.id
from public.private_catalog_quantity_groups g
join public.private_catalog_brands b on b.id=g.brand_id
join public.private_catalog_products p on p.brand_id=b.id
where b.slug='biodance'
  and g.name='Masques hydrogel Biodance'
  and g.active
  and g.minimum_total_units=12
  and g.quantity_multiple=4
  and p.ean='8809891184606'
on conflict do nothing;

update public.private_catalog_products p
set min_quantity=1,quantity_step=1
where p.ean='8809891184606'
  and exists (
    select 1
    from public.private_catalog_quantity_group_products gp
    join public.private_catalog_quantity_groups g on g.id=gp.group_id and g.active
    where gp.product_id=p.id and g.name='Masques hydrogel Biodance'
  );
