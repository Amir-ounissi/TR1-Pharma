update public.products p set source_document='Facture fournisseur VK SWISS n° 2026-00236 du 12/10/2026 — prix HT historiques, 12 payées + 3 offertes par référence ; conditions actuelles à confirmer.'
from public.brands b where p.brand_id=b.id and b.slug='vk-swiss' and not p.published and p.source_document is null and p.ean in ('7629999810969','7629999601949','7629999608559','7629999637191','7629999731837','7629999149366');
CREATE OR REPLACE FUNCTION private.invitation_supplier_estimates(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'ean',p.ean,'brand',b.name,'brand_id',b.id,'retail_ttc',s.source_retail_ttc,'format',p.format,'evidence_label','Catalogue fournisseur septembre 2026 — à reconfirmer','offers',(
 select jsonb_agg(jsonb_build_object('paid',t.paid_quantity,'free',t.free_quantity,'price_ht',t.purchase_unit_ht) order by t.paid_quantity,t.free_quantity)
 from public.althesia_trade_offers t where t.product_id=p.id and t.price_confirmed and t.purchase_unit_ht>0 and t.paid_quantity>0 and nullif(trim(t.source_document),'') is not null
 )) order by b.name,p.name),'[]'::jsonb)
 from private.catalogue_link_lookup(p_token) l
 join public.brands b on b.slug in ('vitalora','bloomster')
 join public.products p on p.brand_id=b.id
 join public.althesia_product_specs s on s.product_id=p.id
 where l.show_supplier_estimates and l.invite_email is not null and not p.published and s.market_status<>'food_cbd_blocked'
 and p.ean in ('3770034273080','3770034273066','3770034273110','3770034273141','3770034273035')
 and not exists(select 1 from public.product_discontinuations d where d.brand_id=p.brand_id and d.ean=p.ean)
 and exists(select 1 from public.althesia_trade_offers t where t.product_id=p.id and t.price_confirmed and t.purchase_unit_ht>0 and t.paid_quantity>0 and nullif(trim(t.source_document),'') is not null)) || (
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'ean',p.ean,'brand',b.name,'brand_id',b.id,'retail_ttc',null,'format',p.format,'evidence_label','Condition observée sur facture fournisseur du 12/10/2026 — non garantie pour une nouvelle commande','offers',jsonb_build_array(jsonb_build_object('paid',12,'free',3,'price_ht',v.price))) order by p.name),'[]'::jsonb)
 from private.catalogue_link_lookup(p_token) l
 join public.brands b on b.slug='vk-swiss'
 join public.products p on p.brand_id=b.id
 join (values ('7629999810969',17.00),('7629999601949',18.50),('7629999608559',18.00),('7629999637191',19.50),('7629999731837',18.00),('7629999149366',19.50)) v(ean,price) on v.ean=p.ean
 where l.show_supplier_estimates and l.invite_email is not null and not p.published and p.source_document like 'Facture fournisseur VK SWISS n° 2026-00236%'
 and not exists(select 1 from public.product_discontinuations d where d.brand_id=p.brand_id and d.ean=p.ean)
);
$function$
;
CREATE OR REPLACE FUNCTION private.submit_structured_invitation_estimate(p_token text, p_contact text, p_email text, p_brand_id uuid, p_items jsonb, p_note text, p_honeypot text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item record; available jsonb; prod jsonb; tier jsonb; lines text:=''; total numeric:=0; n integer; 
begin
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Sélection invalide';end if;
 n:=jsonb_array_length(p_items);
 if n not between 1 and 6 or length(coalesce(p_note,''))>300 or coalesce(p_honeypot,'')<>'' then raise exception 'Sélection invalide';end if;
 if (select count(distinct x.product_id) from jsonb_to_recordset(p_items) as x(product_id uuid,paid integer))<>n then raise exception 'Références en double ou invalides';end if;
 available:=private.invitation_supplier_estimates(p_token);
 for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid,paid integer) loop
  select value into prod from jsonb_array_elements(available) where value->>'id'=item.product_id::text and value->>'brand_id'=p_brand_id::text;
  if prod is null then raise exception 'Référence non accessible';end if;
  select value into tier from jsonb_array_elements(prod->'offers') where (value->>'paid')::integer=item.paid;
  if tier is null then raise exception 'Palier non disponible';end if;
  total:=total+item.paid*(tier->>'price_ht')::numeric;
  lines:=lines||case when lines='' then '' else chr(10) end||left(prod->>'name',120)||' ('||(prod->>'ean')||') : '||item.paid||' payées + '||(tier->>'free')||' UG × '||(tier->>'price_ht')||' EUR HT/u.';
 end loop;
 lines:=lines||chr(10)||'Total indicatif HT : '||round(total,2)||' EUR. Hors conditions complémentaires.'||case when trim(coalesce(p_note,''))='' then '' else chr(10)||'Précisions : '||trim(p_note) end;
 if length(lines)>1200 then raise exception 'Demande trop longue';end if;
 return private.submit_invitation_estimate(p_token,p_contact,p_email,p_brand_id,lines,p_honeypot);
end $function$
;
