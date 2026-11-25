CREATE OR REPLACE FUNCTION private.invitation_supplier_estimates(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'ean',p.ean,'brand',b.name,'brand_id',b.id,'retail_ttc',s.source_retail_ttc,'format',p.format,'offers',(
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
 and exists(select 1 from public.althesia_trade_offers t where t.product_id=p.id and t.price_confirmed and t.purchase_unit_ht>0 and t.paid_quantity>0 and nullif(trim(t.source_document),'') is not null);
$function$
;

create function private.submit_structured_invitation_estimate(p_token text,p_contact text,p_email text,p_brand_id uuid,p_items jsonb,p_note text,p_honeypot text)
returns uuid language plpgsql security definer set search_path='' as $$
declare item record; available jsonb; prod jsonb; tier jsonb; lines text:=''; total numeric:=0; n integer; 
begin
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Sélection invalide';end if;
 n:=jsonb_array_length(p_items);
 if n not between 1 and 5 or length(coalesce(p_note,''))>500 or coalesce(p_honeypot,'')<>'' then raise exception 'Sélection invalide';end if;
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
end $$;
revoke all on function private.submit_structured_invitation_estimate(text,text,text,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.submit_structured_invitation_estimate(text,text,text,uuid,jsonb,text,text) to anon,authenticated;
create function public.submit_structured_invitation_estimate(p_token text,p_contact text,p_email text,p_brand_id uuid,p_items jsonb,p_note text default '',p_honeypot text default '')
returns uuid language sql security invoker set search_path='' as $$ select private.submit_structured_invitation_estimate(p_token,p_contact,p_email,p_brand_id,p_items,p_note,p_honeypot); $$;
revoke all on function public.submit_structured_invitation_estimate(text,text,text,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.submit_structured_invitation_estimate(text,text,text,uuid,jsonb,text,text) to anon,authenticated;
