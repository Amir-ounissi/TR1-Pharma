create table public.pharmacy_catalogue_links (
 id uuid primary key default gen_random_uuid(),
 pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(expires_at>created_at)
);
create index pharmacy_catalogue_links_pharmacy on public.pharmacy_catalogue_links(pharmacy_id,created_at desc);
create index pharmacy_catalogue_links_creator on public.pharmacy_catalogue_links(created_by);
alter table public.pharmacy_catalogue_links enable row level security;
revoke all on public.pharmacy_catalogue_links from public,anon,authenticated;
grant select on public.pharmacy_catalogue_links to authenticated;
grant insert(pharmacy_id,token_hash,expires_at) on public.pharmacy_catalogue_links to authenticated;
grant update(revoked_at) on public.pharmacy_catalogue_links to authenticated;
create policy catalogue_link_owner_read on public.pharmacy_catalogue_links for select to authenticated using ((select public.tr1_is_owner()));
create policy catalogue_link_owner_create on public.pharmacy_catalogue_links for insert to authenticated with check ((select public.tr1_is_owner()) and created_by=(select auth.uid()) and expires_at<=now()+interval '91 days' and revoked_at is null);
create policy catalogue_link_owner_revoke on public.pharmacy_catalogue_links for update to authenticated using ((select public.tr1_is_owner()) and revoked_at is null) with check ((select public.tr1_is_owner()) and revoked_at is not null);
alter table public.public_catalogue_leads add column catalogue_link_id uuid references public.pharmacy_catalogue_links(id) on delete restrict;
create index public_catalogue_leads_link on public.public_catalogue_leads(catalogue_link_id);
create function private.public_brand_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('brands',coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug) order by b.name),'[]'::jsonb),'products','[]'::jsonb)
 from public.brands b left join public.brand_discovery_directory d on d.brand_id=b.id
 where b.active or coalesce(d.discoverable,false);
$$;
revoke all on function private.public_brand_directory() from public,anon,authenticated;
grant execute on function private.public_brand_directory() to anon,authenticated;
create or replace function public.public_catalogue_data() returns jsonb language sql stable security invoker set search_path='' as $$ select private.public_brand_directory(); $$;
revoke execute on function private.public_catalogue_data() from public,anon,authenticated;
revoke execute on function public.submit_public_catalogue_request(text,text,text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
revoke execute on function private.submit_public_catalogue_request(text,text,text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
create function private.catalogue_link_lookup(p_token text) returns public.pharmacy_catalogue_links
language sql stable security invoker set search_path='' as $$
 select l from public.pharmacy_catalogue_links l where p_token ~ '^[a-f0-9]{64}$' and l.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex') and l.revoked_at is null and l.expires_at>now();
$$;
revoke execute on function private.catalogue_link_lookup(text) from public,anon,authenticated;
create function private.catalogue_link_price(p_pharmacy uuid,p_product uuid,p_qty integer) returns numeric
language sql stable security invoker set search_path='' as $$
 select coalesce((select r.price_ht from public.price_rules r where r.pharmacy_id=p_pharmacy and r.product_id=p_product and r.min_qty<=p_qty order by r.min_qty desc limit 1),
 (select q.price_ht from public.product_quantity_tiers q where q.product_id=p_product and q.verified and q.min_qty<=p_qty order by q.min_qty desc limit 1),p.price_ht)
 from public.products p where p.id=p_product;
$$;
revoke execute on function private.catalogue_link_price(uuid,uuid,integer) from public,anon,authenticated;
create function private.catalogue_link_data(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l public.pharmacy_catalogue_links; ph public.pharmacies; raw jsonb; result_products jsonb;
begin
 select * into l from private.catalogue_link_lookup(p_token);
 if l.id is null then return null;end if;
 select * into ph from public.pharmacies where id=l.pharmacy_id;
 raw:=private.public_catalogue_data();
 select coalesce(jsonb_agg(p || jsonb_build_object('price_ht',private.catalogue_link_price(l.pharmacy_id,(p->>'id')::uuid,(p->>'min_qty')::int),
 'tiers',coalesce((select jsonb_agg(jsonb_build_object('min_qty',n,'price_ht',private.catalogue_link_price(l.pharmacy_id,(p->>'id')::uuid,n)) order by n)
 from (select (p->>'min_qty')::int n union select q.min_qty from public.product_quantity_tiers q where q.product_id=(p->>'id')::uuid and q.verified union select r.min_qty from public.price_rules r where r.product_id=(p->>'id')::uuid and r.pharmacy_id=l.pharmacy_id) thresholds where n>=(p->>'min_qty')::int),'[]'::jsonb)) order by p->>'brand',p->>'name'),'[]'::jsonb) into result_products from jsonb_array_elements(raw->'products') p;
 return jsonb_build_object('brands',raw->'brands','products',result_products,'pharmacy',jsonb_build_object('name',ph.name,'city',ph.city),'expires_at',l.expires_at);
end $$;
revoke all on function private.catalogue_link_data(text) from public,anon,authenticated;
grant execute on function private.catalogue_link_data(text) to anon,authenticated;
create function public.catalogue_link_data(p_token text) returns jsonb language sql stable security invoker set search_path='' as $$ select private.catalogue_link_data(p_token); $$;
revoke all on function public.catalogue_link_data(text) from public,anon,authenticated;
grant execute on function public.catalogue_link_data(text) to anon,authenticated;
create function private.submit_catalogue_link_request(p_token text,p_contact_name text,p_email text,p_phone text,p_city text,p_note text,p_items jsonb,p_honeypot text) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.pharmacy_catalogue_links; ph public.pharmacies; lead uuid;
begin
 select * into l from private.catalogue_link_lookup(p_token);
 if l.id is null then raise exception 'Lien expiré ou invalide'; end if;
 select * into ph from public.pharmacies where id=l.pharmacy_id;
 lead:=private.submit_public_catalogue_request(p_contact_name,ph.name,p_email,p_phone,coalesce(nullif(trim(ph.city),''),p_city),null,ph.siret,p_note,p_items,p_honeypot);
 update public.public_catalogue_leads set matched_pharmacy_id=l.pharmacy_id,catalogue_link_id=l.id where id=lead;
 update public.public_catalogue_request_items i set unit_price_ht=private.catalogue_link_price(l.pharmacy_id,i.product_id,i.quantity),
 line_total_ht=round(i.quantity*private.catalogue_link_price(l.pharmacy_id,i.product_id,i.quantity),2)
 where i.request_id in (select r.id from public.public_catalogue_requests r where r.lead_id=lead);
 update public.public_catalogue_requests r set total_ht=(select sum(i.line_total_ht) from public.public_catalogue_request_items i where i.request_id=r.id) where r.lead_id=lead;
 return lead;
end $$;
revoke all on function private.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) to anon,authenticated;
create function public.submit_catalogue_link_request(p_token text,p_contact_name text,p_email text,p_phone text,p_city text,p_note text,p_items jsonb,p_honeypot text default '') returns uuid language sql security invoker set search_path='' as $$ select private.submit_catalogue_link_request(p_token,p_contact_name,p_email,p_phone,p_city,p_note,p_items,p_honeypot); $$;
revoke all on function public.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) to anon,authenticated;
