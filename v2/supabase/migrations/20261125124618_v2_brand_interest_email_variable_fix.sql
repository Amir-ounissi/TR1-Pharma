CREATE OR REPLACE FUNCTION private.submit_public_brand_interest(p_brand_slug text, p_pharmacy_name text, p_contact_name text, p_email text, p_city text, p_note text, p_honeypot text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b uuid; lead uuid; v_email text:=lower(trim(coalesce(p_email,''))); begin
 if coalesce(p_honeypot,'')<>'' then raise exception 'Demande invalide'; end if;
 if length(trim(coalesce(p_brand_slug,''))) not between 1 and 100 or length(trim(coalesce(p_pharmacy_name,''))) not between 2 and 180 or length(trim(coalesce(p_contact_name,''))) not between 2 and 120 or length(v_email) not between 5 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(trim(coalesce(p_city,''))) not between 2 and 120 or length(coalesce(p_note,''))>1500 then raise exception 'Coordonnées invalides';end if;
 select x.id into b from public.brands x left join public.brand_discovery_directory d on d.brand_id=x.id where x.slug=p_brand_slug and (x.active or d.discoverable);
 if b is null then raise exception 'Marque indisponible'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email,0));
 if (select count(*) from public.public_catalogue_leads l where lower(l.email)=v_email and l.created_at>now()-interval '15 minutes')>=3 then raise exception 'Trop de demandes';end if;
 insert into public.public_catalogue_leads(pharmacy_name,contact_name,email,city,note,interest_brand_id,created_by) values(trim(p_pharmacy_name),trim(p_contact_name),v_email,trim(p_city),nullif(trim(coalesce(p_note,'')),''),b,auth.uid()) returning id into lead;
 return lead;
end $function$;
