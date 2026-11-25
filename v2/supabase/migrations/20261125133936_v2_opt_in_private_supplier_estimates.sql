alter table public.pharmacy_catalogue_links add column show_supplier_estimates boolean not null default false;
grant insert(show_supplier_estimates) on public.pharmacy_catalogue_links to authenticated;
create function private.invitation_supplier_estimates(p_token text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'ean',p.ean,'brand',b.name,'brand_id',b.id,'offers',(
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
$$;
revoke all on function private.invitation_supplier_estimates(text) from public,anon,authenticated;
grant execute on function private.invitation_supplier_estimates(text) to anon,authenticated;
create function public.invitation_supplier_estimates(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$ select private.invitation_supplier_estimates(p_token); $$;
revoke all on function public.invitation_supplier_estimates(text) from public,anon,authenticated;
grant execute on function public.invitation_supplier_estimates(text) to anon,authenticated;
create function private.submit_invitation_estimate(p_token text,p_contact text,p_email text,p_brand_id uuid,p_note text,p_honeypot text) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.pharmacy_catalogue_links; ph public.pharmacies; v_email text:=lower(trim(coalesce(p_email,''))); lead uuid;
begin
 if coalesce(p_honeypot,'')<>'' or length(trim(coalesce(p_contact,''))) not between 2 and 120 or length(trim(coalesce(p_note,''))) not between 1 and 1200 then raise exception 'Demande invalide';end if;
 select * into l from private.catalogue_link_lookup(p_token);
 if l.id is null or not l.show_supplier_estimates or l.invite_email is distinct from v_email or not private.catalogue_invitation_email_allowed(p_token,v_email) then raise exception 'Invitation invalide';end if;
 if not exists(select 1 from jsonb_array_elements(private.invitation_supplier_estimates(p_token)) x where x->>'brand_id'=p_brand_id::text) then raise exception 'Marque indisponible';end if;
 select * into ph from public.pharmacies where id=l.pharmacy_id;
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 if (select count(*) from public.public_catalogue_leads c where lower(c.email)=v_email and c.created_at>now()-interval '15 minutes')>=3 then raise exception 'Trop de demandes';end if;
 insert into public.public_catalogue_leads(pharmacy_name,contact_name,email,city,note,matched_pharmacy_id,catalogue_link_id,interest_brand_id,created_by)
 values(ph.name,trim(p_contact),v_email,coalesce(nullif(trim(ph.city),''),'Non renseignée'),'Demande de devis indicatif (aucune commande) : '||trim(p_note),ph.id,l.id,p_brand_id,auth.uid()) returning id into lead;
 return lead;
end $$;
revoke all on function private.submit_invitation_estimate(text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function private.submit_invitation_estimate(text,text,text,uuid,text,text) to anon,authenticated;
create function public.submit_invitation_estimate(p_token text,p_contact text,p_email text,p_brand_id uuid,p_note text,p_honeypot text default '') returns uuid language sql security invoker set search_path='' as $$ select private.submit_invitation_estimate(p_token,p_contact,p_email,p_brand_id,p_note,p_honeypot); $$;
revoke all on function public.submit_invitation_estimate(text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_invitation_estimate(text,text,text,uuid,text,text) to anon,authenticated;
