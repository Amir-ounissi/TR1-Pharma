-- Les soins Biodance hors cinq masques ont un prix fixe fournisseur.
-- Les prix HT TR1 (prix source + 10 %) sont déjà enregistrés en base,
-- mais n'apparaissaient pas aux pharmacies faute de palier indicatif.
-- Ce script n'invente aucun nouveau tarif : il expose le tarif déjà validé
-- sur les références sans grille dégressive.
insert into public.private_catalog_indicative_tiers
  (product_id,min_quantity,price_min_ht,price_max_ht)
select p.id,p.min_quantity,round(p.price_ht::numeric,2),round(p.price_ht::numeric,2)
from public.private_catalog_products p
join public.private_catalog_brands b on b.id=p.brand_id
where b.slug='biodance' and p.active
  and p.price_ht is not null
  and not exists (
    select 1 from public.private_catalog_indicative_tiers t
    where t.product_id=p.id
  )
on conflict (product_id,min_quantity) do nothing;
