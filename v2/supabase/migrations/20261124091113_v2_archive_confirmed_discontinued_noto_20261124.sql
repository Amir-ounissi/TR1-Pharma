
-- Retrait non destructif des références dont l'arrêt est documenté.
-- Les traces commerciales restent accessibles au propriétaire ; le catalogue pharmacie filtre ces EAN.
create table public.product_discontinuations (
  brand_id uuid not null references public.brands(id) on delete cascade,
  ean text not null check(ean ~ '^[0-9]{8,14}$'),
  discontinued_on date not null,
  evidence_url text not null check(evidence_url ~ '^https://'),
  evidence_source text not null,
  editorial_note text,
  recorded_at timestamptz not null default now(),
  primary key(brand_id,ean)
);
alter table public.product_discontinuations enable row level security;
create policy product_discontinuations_owner on public.product_discontinuations
 for all to authenticated
 using(public.tr1_is_owner()) with check(public.tr1_is_owner());
revoke all on public.product_discontinuations from anon;
grant select,insert,update,delete on public.product_discontinuations to authenticated;

with evidence(ean,relative_path) as (
 values
 ('3770019227060','noto-huile-cbd-broad-spectrum-500mg-menthe-poivree-5-250592.html'),
 ('3770019227138','noto-huile-cbd-broad-spectrum-2000mg-mangue-20-250602.html'),
 ('3770019227053','noto-huile-cbd-broad-spectrum-500mg-citron-frais-5-250587.html'),
 ('3770019227077','noto-huile-cbd-broad-spectrum-500mg-fruits-rouges-5-250595.html'),
 ('3770019227121','noto-huile-cbd-broad-spectrum-1000mg-fraise-10-250597.html'),
 ('3770019227213','noto-huile-cbd-broad-spectrum-3000mg-peche-30-250599.html'),
 ('3770019227107','noto-gran-cbd-cbg-250mg-olympe-250605.html'),
 ('3770019227084','noto-gran-cbn-cbd-250mg-morphee-250606.html'),
 ('3770019227091','noto-gran-cbg-cbd-250mg-algos-250604.html'),
 ('3770019227046','noto-cbd-gummies-700mg-gomme-ananas-cerise-250603.html')
)
insert into public.product_discontinuations
 (brand_id,ean,discontinued_on,evidence_url,evidence_source,editorial_note)
select b.id,e.ean,'2026-05-20'::date,
 'https://www.vidal.fr/parapharmacie/'||e.relative_path,
 'VIDAL — Arrêt de commercialisation (20/05/2026)',
 'Statut VIDAL au 24/11/2026. Malgré la présence dans le catalogue Althesia de septembre 2026, masquer jusqu’à confirmation écrite du fournisseur.'
from evidence e
join public.products p on p.ean=e.ean
join public.brands b on b.id=p.brand_id and b.slug='noto'
on conflict(brand_id,ean) do nothing;

do $$
declare n integer;
begin
 select count(*) into n from public.product_discontinuations d
 join public.brands b on b.id=d.brand_id where b.slug='noto';
 if n<>10 then raise exception 'Attendu 10 EAN Nōto arrêtés, obtenu %',n; end if;
end $$;

update public.products p
set published=false,source_active=false,requires_review=true
from public.product_discontinuations d
where d.brand_id=p.brand_id and d.ean=p.ean;

-- Empêche une publication accidentelle via une future réimportation ou édition.
create or replace function private.reject_discontinued_publishing()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.published and exists(
   select 1 from public.product_discontinuations d
   where d.brand_id=new.brand_id and d.ean=new.ean
 ) then
   raise exception 'Référence arrêtée : publication interdite pour EAN %',new.ean;
 end if;
 return new;
end;$$;
create trigger protect_discontinued_products
before insert or update of published,ean,brand_id on public.products
for each row execute function private.reject_discontinued_publishing();

create or replace function private.reject_discontinued_pack_lines()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(
  select 1 from public.products p
  join public.product_discontinuations d on d.brand_id=p.brand_id and d.ean=p.ean
  where p.id=new.product_id
 ) then
  raise exception 'Référence arrêtée non autorisée dans un pack d’implantation';
 end if;
 return new;
end;$$;
create trigger protect_discontinued_pack_lines
before insert or update of product_id on public.brand_implantation_offer_lines
for each row execute function private.reject_discontinued_pack_lines();

-- La RPC privée est le seul catalogue documentaire Althesia affiché aux officines.
create or replace function private.althesia_showroom_catalogue()
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(
 jsonb_build_object(
  'id',p.id,'brand_id',b.id,'brand',b.name,'brand_slug',b.slug,
  'name',p.name,'sku',p.sku,'ean',p.ean,'format',p.format,
  'category',p.category,'image_url',p.image_url,
  'summary',s.source_summary,'ingredients',s.ingredients_and_doses,
  'dosage',s.dosage_and_duration,'audience',s.target_audience,
  'precautions',s.precaution_notes,
  'source_document',s.source_document,'source_page',s.source_page,
  'sub_brand',s.sub_brand,
  'retail_ttc',s.source_retail_ttc,'vat_rate',s.source_vat_rate,
  'market_status',s.market_status,
  'offers',coalesce((
   select jsonb_agg(jsonb_build_object(
    'paid_quantity',o.paid_quantity,'free_quantity',o.free_quantity,
    'price_ht',o.purchase_unit_ht,'price_confirmed',o.price_confirmed
   ) order by o.paid_quantity)
   from public.althesia_trade_offers o where o.product_id=p.id
  ),'[]'::jsonb)
 ) order by b.name,p.name
),'[]'::jsonb)
from public.products p
join public.brands b on b.id=p.brand_id
join public.althesia_product_specs s on s.product_id=p.id
where b.slug in('vitalora','bloomster','noto')
and not exists(
 select 1 from public.product_discontinuations d where d.brand_id=p.brand_id and d.ean=p.ean
)
and (select auth.uid()) is not null
and exists(
 select 1 from public.demo_catalogue_access a
 where a.brand_id=b.id and a.active
 and private.demo_can_access(a.pharmacy_id,a.brand_id)
);
$$;
revoke all on function private.althesia_showroom_catalogue() from public,anon;
grant execute on function private.althesia_showroom_catalogue() to authenticated;
