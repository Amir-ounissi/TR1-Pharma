create function private.release_catalogue_product(p_product_id uuid,p_supplier_reference text,p_activate_brand boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p public.products; s public.althesia_product_specs; actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and role='owner') then raise exception 'Accès propriétaire requis';end if;
 if length(trim(coalesce(p_supplier_reference,''))) not between 6 and 400 then raise exception 'Justificatif fournisseur requis';end if;
 select * into p from public.products where id=p_product_id for update;
 if p.id is null then raise exception 'Produit introuvable';end if;
 if exists(select 1 from public.product_discontinuations d where d.brand_id=p.brand_id and d.ean=p.ean) then raise exception 'Référence arrêtée';end if;
 if p.requires_review or not p.price_verified or p.price_ht<=0 or not p.fr_market_checked or not p.fr_label_checked or length(trim(coalesce(p.fr_market_document,'')))<6 or coalesce(p.ean,'') !~ '^[0-9]{8,14}$' or length(trim(coalesce(p.description,'')))<10 or coalesce(p.image_url,'') !~ '^https://' then raise exception 'Fiche, prix ou conformité à vérifier';end if;
 if exists(select 1 from public.product_media_audit a where a.product_id=p.id and (a.image_review_status<>'verified' or not a.applied_to_draft or a.candidate_image_url<>p.image_url)) then raise exception 'Visuel à vérifier dans Photos produits';end if;
 select * into s from public.althesia_product_specs where product_id=p.id for update;
 if s.market_status='food_cbd_blocked' then raise exception 'Référence bloquée pour contrôle réglementaire spécifique';end if;
 if not p_activate_brand and not exists(select 1 from public.brands b where b.id=p.brand_id and b.active) then raise exception 'Marque non activée';end if;
 if p_activate_brand then update public.brands set active=true where id=p.brand_id;end if;
 if s.product_id is not null then update public.althesia_product_specs set market_status='verified' where product_id=p.id;end if;
 update public.products set source_active=true,published=true where id=p.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,event_name,details) values(actor,'product',p.id,'catalogue_release',jsonb_build_object('supplier_reference',trim(p_supplier_reference),'old_source_active',p.source_active,'old_market_status',s.market_status,'market_document',p.fr_market_document,'price_ht',p.price_ht,'brand_activation_confirmed',p_activate_brand));
end $$;
revoke all on function private.release_catalogue_product(uuid,text,boolean) from public,anon,authenticated;
grant execute on function private.release_catalogue_product(uuid,text,boolean) to authenticated;
create function public.release_catalogue_product(p_product_id uuid,p_supplier_reference text,p_activate_brand boolean default false) returns void language sql security invoker set search_path='' as $$ select private.release_catalogue_product(p_product_id,p_supplier_reference,p_activate_brand); $$;
revoke all on function public.release_catalogue_product(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.release_catalogue_product(uuid,text,boolean) to authenticated;
