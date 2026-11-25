alter table public.public_catalogue_leads add column interest_brand_id uuid references public.brands(id) on delete restrict;
alter table public.public_catalogue_leads add column interest_status text not null default 'new' check(interest_status in ('new','contacted','closed'));
create index public_catalogue_leads_interest on public.public_catalogue_leads(interest_brand_id,created_at desc) where interest_brand_id is not null;
create function private.submit_public_brand_interest(p_brand_slug text,p_pharmacy_name text,p_contact_name text,p_email text,p_city text,p_note text,p_honeypot text) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; lead uuid; email text:=lower(trim(coalesce(p_email,''))); begin
 if coalesce(p_honeypot,'')<>'' then raise exception 'Demande invalide'; end if;
 if length(trim(coalesce(p_brand_slug,''))) not between 1 and 100 or length(trim(coalesce(p_pharmacy_name,''))) not between 2 and 180 or length(trim(coalesce(p_contact_name,''))) not between 2 and 120 or length(email) not between 5 and 254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(trim(coalesce(p_city,''))) not between 2 and 120 or length(coalesce(p_note,''))>1500 then raise exception 'Coordonnées invalides';end if;
 select x.id into b from public.brands x left join public.brand_discovery_directory d on d.brand_id=x.id where x.slug=p_brand_slug and (x.active or d.discoverable);
 if b is null then raise exception 'Marque indisponible'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(email,0));
 if (select count(*) from public.public_catalogue_leads l where lower(l.email)=email and l.created_at>now()-interval '15 minutes')>=3 then raise exception 'Trop de demandes';end if;
 insert into public.public_catalogue_leads(pharmacy_name,contact_name,email,city,note,interest_brand_id,created_by) values(trim(p_pharmacy_name),trim(p_contact_name),email,trim(p_city),nullif(trim(coalesce(p_note,'')),''),b,auth.uid()) returning id into lead;
 return lead;
end $$;
revoke all on function private.submit_public_brand_interest(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_public_brand_interest(text,text,text,text,text,text,text) to anon,authenticated;
create function public.submit_public_brand_interest(p_brand_slug text,p_pharmacy_name text,p_contact_name text,p_email text,p_city text,p_note text,p_honeypot text default '') returns uuid language sql security invoker set search_path='' as $$ select private.submit_public_brand_interest(p_brand_slug,p_pharmacy_name,p_contact_name,p_email,p_city,p_note,p_honeypot) $$;
revoke all on function public.submit_public_brand_interest(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_public_brand_interest(text,text,text,text,text,text,text) to anon,authenticated;
