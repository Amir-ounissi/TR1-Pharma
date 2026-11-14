-- Les masques hydrogel Biodance suivent la consigne fournisseur AMALFI
-- Biodance2026.pdf page 1 : minimum GLOBAL 12, TOTAL multiple de 4.
-- Le fournisseur n'impose pas 4 unités par référence, donc ne pas
-- utiliser un minimum individuel de 4 ni un pas individuel de 4.
-- Les boutons offrent un raccourci +4/-4, mais la saisie individuelle
-- reste libre; la vérification du total collectif reste côté serveur.
update public.private_catalog_products p
set min_quantity=1,quantity_step=1
from public.private_catalog_quantity_group_products gp
join public.private_catalog_quantity_groups g on g.id=gp.group_id
join public.private_catalog_brands b on b.id=g.brand_id
where p.id=gp.product_id
  and b.slug='biodance'
  and g.active and g.name='Masques hydrogel Biodance'
  and g.minimum_total_units=12 and g.quantity_multiple=4;
