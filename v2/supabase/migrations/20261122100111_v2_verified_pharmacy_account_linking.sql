
create or replace function private.link_pharmacy_account(
  p_pharmacy_id uuid,
  p_email text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_user uuid;
begin
 if v_actor is null or not exists (
   select 1 from public.profiles where id=v_actor and role='owner'
 ) then
  raise exception 'Accès administrateur requis';
 end if;
 if p_email is null or length(trim(p_email)) > 254 then
  raise exception 'Email invalide';
 end if;
 if not exists (select 1 from public.pharmacies where id=p_pharmacy_id) then
  raise exception 'Pharmacie introuvable';
 end if;
 select id into v_user from auth.users
 where lower(email) = lower(trim(p_email))
   and email_confirmed_at is not null and deleted_at is null
 limit 1;
 if v_user is null then
   raise exception 'Créer et confirmer d’abord le compte dans Supabase Auth';
 end if;
 if exists (select 1 from public.profiles where id=v_user and role='owner') then
   raise exception 'Un propriétaire ne peut pas être affecté comme pharmacie';
 end if;
 insert into public.profiles(id,role,display_name)
 values(v_user,'pharmacy',null)
 on conflict(id) do nothing;
 insert into public.pharmacy_memberships(pharmacy_id,user_id,active)
 values(p_pharmacy_id,v_user,true)
 on conflict(pharmacy_id,user_id) do update set active=true;
 insert into public.audit_events(actor_id,entity_type,entity_id,event_name,details)
 values(v_actor,'pharmacy_membership',p_pharmacy_id,'account_linked',
   jsonb_build_object('user_id',v_user));
 return v_user;
end $$;
revoke all on function private.link_pharmacy_account(uuid,text) from public,anon;
grant execute on function private.link_pharmacy_account(uuid,text) to authenticated;
create or replace function public.link_pharmacy_account(
 p_pharmacy_id uuid,p_email text
) returns uuid
language sql security invoker set search_path='' as $$
 select private.link_pharmacy_account(p_pharmacy_id,p_email);
$$;
revoke all on function public.link_pharmacy_account(uuid,text) from public,anon;
grant execute on function public.link_pharmacy_account(uuid,text) to authenticated;
