alter table public.pharmacy_catalogue_links add column invite_email text check(invite_email is null or (invite_email=lower(trim(invite_email)) and length(invite_email) between 5 and 254 and invite_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'));
alter table public.pharmacy_catalogue_links add column activated_at timestamptz;
alter table public.pharmacy_catalogue_links add column activated_by uuid references public.profiles(id) on delete restrict;
alter table public.pharmacy_catalogue_links add constraint link_activation_consistency check ((activated_at is null and activated_by is null) or (activated_at is not null and activated_by is not null and invite_email is not null));
grant insert(invite_email) on public.pharmacy_catalogue_links to authenticated;
create index pharmacy_catalogue_links_activated_by on public.pharmacy_catalogue_links(activated_by);
create or replace function private.catalogue_link_lookup(p_token text) returns public.pharmacy_catalogue_links language sql stable security invoker set search_path='' as $$
 select l from public.pharmacy_catalogue_links l where p_token ~ '^[a-f0-9]{64}$' and l.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex') and l.revoked_at is null and
 ((l.activated_at is null and l.expires_at>now()) or (l.activated_at is not null and exists(select 1 from public.pharmacy_memberships m join public.profiles p on p.id=m.user_id where m.pharmacy_id=l.pharmacy_id and m.user_id=auth.uid() and m.active and p.role='pharmacy')));
$$;
create function private.catalogue_invitation_status(p_token text) returns text language sql stable security definer set search_path='' as $$
 select case when l.revoked_at is not null then 'unavailable' when l.activated_at is not null then case when exists(select 1 from public.pharmacy_memberships m join public.profiles p on p.id=m.user_id where m.pharmacy_id=l.pharmacy_id and m.user_id=auth.uid() and m.active and p.role='pharmacy') then 'activated' else 'login_required' end when l.expires_at<=now() then 'unavailable' when l.invite_email is null then 'legacy' else 'invited' end
 from public.pharmacy_catalogue_links l where p_token ~ '^[a-f0-9]{64}$' and l.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
$$;
revoke all on function private.catalogue_invitation_status(text) from public,anon,authenticated;
grant execute on function private.catalogue_invitation_status(text) to anon,authenticated;
create function public.catalogue_invitation_status(p_token text) returns text language sql stable security invoker set search_path='' as $$ select private.catalogue_invitation_status(p_token); $$;
revoke all on function public.catalogue_invitation_status(text) from public,anon,authenticated;
grant execute on function public.catalogue_invitation_status(text) to anon,authenticated;
create function private.catalogue_invitation_email_allowed(p_token text,p_email text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pharmacy_catalogue_links l where p_token ~ '^[a-f0-9]{64}$' and l.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex') and l.revoked_at is null and l.invite_email=lower(trim(p_email)) and ((l.activated_at is null and l.expires_at>now()) or (l.activated_at is not null and exists(select 1 from public.pharmacy_memberships m join auth.users u on u.id=m.user_id where m.pharmacy_id=l.pharmacy_id and m.active and lower(u.email)=l.invite_email and u.email_confirmed_at is not null and u.deleted_at is null))) and not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=l.invite_email and p.role='owner'));
$$;
revoke all on function private.catalogue_invitation_email_allowed(text,text) from public,anon,authenticated;
grant execute on function private.catalogue_invitation_email_allowed(text,text) to anon,authenticated;
create function public.catalogue_invitation_email_allowed(p_token text,p_email text) returns boolean language sql stable security invoker set search_path='' as $$ select private.catalogue_invitation_email_allowed(p_token,p_email); $$;
revoke all on function public.catalogue_invitation_email_allowed(text,text) from public,anon,authenticated;
grant execute on function public.catalogue_invitation_email_allowed(text,text) to anon,authenticated;
create or replace function private.submit_catalogue_link_request(p_token text,p_contact_name text,p_email text,p_phone text,p_city text,p_note text,p_items jsonb,p_honeypot text) returns uuid language plpgsql security definer set search_path='' as $$
declare l public.pharmacy_catalogue_links; ph public.pharmacies; lead uuid; actor uuid:=auth.uid(); verified_email text; existing_role text;
begin
 if actor is null then raise exception 'Connexion nécessaire';end if;
 select lower(u.email) into verified_email from auth.users u where u.id=actor and u.email_confirmed_at is not null and u.deleted_at is null;
 if verified_email is null or verified_email<>lower(trim(coalesce(p_email,''))) then raise exception 'Adresse email non vérifiée';end if;
 select * into l from public.pharmacy_catalogue_links where p_token ~ '^[a-f0-9]{64}$' and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex') and revoked_at is null for update;
 if l.id is null then raise exception 'Lien invalide';end if;
 select p.role into existing_role from public.profiles p where p.id=actor;
 if existing_role is not null and existing_role<>'pharmacy' then raise exception 'Compte non officinal';end if;
 if l.activated_at is null then
   if l.expires_at<=now() or l.invite_email is null or l.invite_email<>verified_email then raise exception 'Invitation non valide pour cet email';end if;
   if exists(select 1 from public.pharmacy_memberships m where m.pharmacy_id=l.pharmacy_id and m.user_id=actor and not m.active) then raise exception 'Compte suspendu';end if;
   insert into public.profiles(id,role,display_name) values(actor,'pharmacy',trim(p_contact_name)) on conflict(id) do nothing;
   insert into public.pharmacy_memberships(pharmacy_id,user_id,active) values(l.pharmacy_id,actor,true) on conflict(pharmacy_id,user_id) do nothing;
 else
   if not exists(select 1 from public.pharmacy_memberships m where m.pharmacy_id=l.pharmacy_id and m.user_id=actor and m.active) then raise exception 'Officine non autorisée';end if;
 end if;
 select * into ph from public.pharmacies where id=l.pharmacy_id;
 lead:=private.submit_public_catalogue_request(p_contact_name,ph.name,verified_email,p_phone,coalesce(nullif(trim(ph.city),''),p_city),null,ph.siret,p_note,p_items,p_honeypot);
 update public.public_catalogue_leads set matched_pharmacy_id=l.pharmacy_id,catalogue_link_id=l.id where id=lead;
 update public.public_catalogue_request_items i set unit_price_ht=private.catalogue_link_price(l.pharmacy_id,i.product_id,i.quantity),line_total_ht=round(i.quantity*private.catalogue_link_price(l.pharmacy_id,i.product_id,i.quantity),2) where i.request_id in (select r.id from public.public_catalogue_requests r where r.lead_id=lead);
 update public.public_catalogue_requests r set total_ht=(select sum(i.line_total_ht) from public.public_catalogue_request_items i where i.request_id=r.id) where r.lead_id=lead;
 if l.activated_at is null then
   update public.pharmacy_catalogue_links set activated_at=now(),activated_by=actor where id=l.id;
   insert into public.audit_events(actor_id,entity_type,entity_id,event_name,details) values(actor,'pharmacy_membership',l.pharmacy_id,'catalogue_invitation_activated',jsonb_build_object('link_id',l.id,'lead_id',lead));
 end if;
 return lead;
end $$;
revoke execute on function private.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) from public,anon;
revoke execute on function public.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) from public,anon;
grant execute on function private.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) to authenticated;
grant execute on function public.submit_catalogue_link_request(text,text,text,text,text,text,jsonb,text) to authenticated;
create function private.pharmacy_link_order_history() returns table(id uuid,brand_name text,status text,total_ht numeric,created_at timestamptz) language sql stable security definer set search_path='' as $$
 select r.id,b.name,r.status,r.total_ht,r.created_at from public.public_catalogue_requests r join public.public_catalogue_leads l on l.id=r.lead_id join public.brands b on b.id=r.brand_id where l.catalogue_link_id is not null and exists(select 1 from public.pharmacy_memberships m join public.profiles p on p.id=m.user_id where m.pharmacy_id=l.matched_pharmacy_id and m.user_id=auth.uid() and m.active and p.role='pharmacy') order by r.created_at desc limit 100;
$$;
revoke all on function private.pharmacy_link_order_history() from public,anon,authenticated;
grant execute on function private.pharmacy_link_order_history() to authenticated;
create function public.pharmacy_link_order_history() returns table(id uuid,brand_name text,status text,total_ht numeric,created_at timestamptz) language sql stable security invoker set search_path='' as $$ select * from private.pharmacy_link_order_history(); $$;
revoke all on function public.pharmacy_link_order_history() from public,anon,authenticated;
grant execute on function public.pharmacy_link_order_history() to authenticated;
