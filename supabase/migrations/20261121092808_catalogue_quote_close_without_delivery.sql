-- A confirmed quote can close without shipment; confirmed product orders must
-- close only through catalogue_admin_record_supplier_delivery with proof.
create or replace function public.catalogue_admin_transition_supplier_request(
  p_request_id uuid,p_next_status text,p_reference text default null
) returns void language plpgsql security invoker set search_path=''
as $$
declare
  v_previous text;
  v_kind text;
  v_reference text := nullif(trim(coalesce(p_reference,'')),'');
begin
  if not (select private.has_global_role(array['super_admin']::text[])) then
    raise exception 'Administrateur non autorisé' using errcode='42501';
  end if;
  if p_next_status not in ('verifying','forwarded','confirmed','closed','declined') then
    raise exception 'Statut non autorisé' using errcode='22023';
  end if;
  select status,request_kind into v_previous,v_kind from public.private_catalog_requests
    where id=p_request_id for update;
  if not found then raise exception 'Demande inconnue' using errcode='22023'; end if;
  if not (
    (v_previous='received' and p_next_status in ('verifying','declined')) or
    (v_previous='verifying' and p_next_status in ('forwarded','declined')) or
    (v_previous='forwarded' and p_next_status in ('confirmed','declined')) or
    (v_previous='confirmed' and v_kind='quote' and p_next_status='closed')
  ) then
    raise exception 'Transition interdite % -> % (preuve de livraison obligatoire pour une commande)',
      v_previous,p_next_status using errcode='22023';
  end if;
  if p_next_status in ('forwarded','confirmed') and length(coalesce(v_reference,''))<6 then
    raise exception 'Preuve fournisseur requise (6 caractères minimum)' using errcode='22023';
  end if;
  update public.private_catalog_requests set status=p_next_status where id=p_request_id;
  if p_next_status='forwarded' then
    insert into public.private_catalog_supplier_fulfillment
      (request_id,dispatch_reference,dispatched_at,updated_by)
      values (p_request_id,v_reference,now(),(select auth.uid()))
      on conflict(request_id) do update set
        dispatch_reference=excluded.dispatch_reference,dispatched_at=excluded.dispatched_at,
        updated_at=now(),updated_by=excluded.updated_by;
  elsif p_next_status='confirmed' then
    update public.private_catalog_supplier_fulfillment
      set confirmation_reference=v_reference,confirmed_at=now(),
          updated_by=(select auth.uid()),updated_at=now()
      where request_id=p_request_id and dispatched_at is not null;
    if not found then raise exception 'Transmission fournisseur non tracée' using errcode='22023'; end if;
  end if;
  insert into public.private_catalog_request_events
    (request_id,previous_status,next_status,evidence_reference,changed_by)
    values (p_request_id,v_previous,p_next_status,v_reference,(select auth.uid()));
end;
$$;
revoke all on function public.catalogue_admin_transition_supplier_request(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.catalogue_admin_transition_supplier_request(uuid,text,text)
  to authenticated;
