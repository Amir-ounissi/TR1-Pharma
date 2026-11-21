-- TR1 solo-agent: verified laboratory contact, delivery tracking and documentary proof.
-- Changes are admin-only; no automatic email, no external dispatch.
create table if not exists public.private_catalog_supplier_contacts (
  supplier_id uuid primary key references public.private_catalog_suppliers(id) on delete cascade,
  contact_name text not null default '' check (length(contact_name)<=160),
  contact_email text not null check (
    length(contact_email) between 6 and 254
    and contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  verification_source text not null default '' check (length(verification_source)<=500),
  verified boolean not null default false,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint supplier_contact_verified_proof check (
    not verified or (length(trim(verification_source))>=8 and verified_at is not null)
  )
);
alter table public.private_catalog_supplier_contacts enable row level security;
revoke all on public.private_catalog_supplier_contacts from public,anon,authenticated;
grant select,insert,update on public.private_catalog_supplier_contacts to authenticated;
create policy supplier_contacts_admin_only on public.private_catalog_supplier_contacts
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));

alter table public.private_catalog_supplier_fulfillment
  add column if not exists shipping_carrier text,
  add column if not exists tracking_reference text,
  add column if not exists shipped_at timestamptz,
  add column if not exists expected_delivery_date date,
  add column if not exists delivery_reference text,
  add column if not exists delivered_at timestamptz;
alter table public.private_catalog_supplier_fulfillment
  add constraint supplier_tracking_requires_reference check (
    shipped_at is null or length(trim(coalesce(tracking_reference,'')))>=6
  ),
  add constraint supplier_delivery_requires_shipping check (
    delivered_at is null or (
      shipped_at is not null and length(trim(coalesce(delivery_reference,'')))>=6
    )
  );

create table if not exists public.private_catalog_shipping_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.private_catalog_requests(id) on delete cascade,
  event_kind text not null check (event_kind in ('shipped','delivered')),
  evidence_reference text not null check (length(trim(evidence_reference))>=6),
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists private_catalog_shipping_events_request_idx
  on public.private_catalog_shipping_events(request_id,created_at desc);
alter table public.private_catalog_shipping_events enable row level security;
revoke all on public.private_catalog_shipping_events from public,anon,authenticated;
grant select,insert on public.private_catalog_shipping_events to authenticated;
grant usage,select on sequence public.private_catalog_shipping_events_id_seq to authenticated;
create policy shipping_events_admin_only on public.private_catalog_shipping_events
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));

create or replace function public.catalogue_admin_record_supplier_delivery(
  p_request_id uuid,p_event text,p_reference text,
  p_carrier text default null,p_expected_delivery_date date default null
) returns void language plpgsql security invoker set search_path=''
as $$
declare
  v_req public.private_catalog_requests%rowtype;
  v_fulfillment public.private_catalog_supplier_fulfillment%rowtype;
  v_reference text:=nullif(trim(coalesce(p_reference,'')),'');
  v_carrier text:=nullif(trim(coalesce(p_carrier,'')),'');
begin
  if not (select private.has_global_role(array['super_admin']::text[])) then
    raise exception 'Accès réservé à TR1' using errcode='42501';
  end if;
  if p_event not in ('shipped','delivered') or
     length(coalesce(v_reference,''))<6 or length(v_reference)>500 or
     length(coalesce(v_carrier,''))>120 then
    raise exception 'Événement ou justificatif invalide (6 caractères minimum)' using errcode='22023';
  end if;

  select * into v_req from public.private_catalog_requests where id=p_request_id for update;
  if not found or v_req.request_kind<>'order' or v_req.status<>'confirmed' then
    raise exception 'Seules les commandes confirmées peuvent être suivies en livraison' using errcode='22023';
  end if;
  select * into v_fulfillment from public.private_catalog_supplier_fulfillment
    where request_id=p_request_id for update;
  if not found or v_fulfillment.confirmed_at is null then
    raise exception 'Confirmation fournisseur documentée manquante' using errcode='22023';
  end if;

  if p_event='shipped' then
    if v_fulfillment.shipped_at is not null then
      raise exception 'Expédition déjà enregistrée' using errcode='22023';
    end if;
    if p_expected_delivery_date is not null and p_expected_delivery_date<current_date then
      raise exception 'La date prévisionnelle de livraison est passée' using errcode='22023';
    end if;
    update public.private_catalog_supplier_fulfillment
      set shipped_at=now(),tracking_reference=v_reference,shipping_carrier=v_carrier,
          expected_delivery_date=p_expected_delivery_date,updated_at=now(),
          updated_by=(select auth.uid())
      where request_id=p_request_id;
  else
    if v_fulfillment.shipped_at is null or v_fulfillment.delivered_at is not null then
      raise exception 'La commande doit être expédiée et non encore livrée' using errcode='22023';
    end if;
    update public.private_catalog_supplier_fulfillment
      set delivered_at=now(),delivery_reference=v_reference,updated_at=now(),
          updated_by=(select auth.uid())
      where request_id=p_request_id;
    update public.private_catalog_requests set status='closed' where id=p_request_id;
    insert into public.private_catalog_request_events
      (request_id,previous_status,next_status,evidence_reference,changed_by)
      values (p_request_id,'confirmed','closed',v_reference,(select auth.uid()));
  end if;
  insert into public.private_catalog_shipping_events
    (request_id,event_kind,evidence_reference,changed_by)
  values (p_request_id,p_event,v_reference,(select auth.uid()));
end;
$$;
revoke all on function public.catalogue_admin_record_supplier_delivery(uuid,text,text,text,date)
  from public,anon,authenticated;
grant execute on function public.catalogue_admin_record_supplier_delivery(uuid,text,text,text,date)
  to authenticated;

-- Closing a confirmed order without a delivery proof would mislead the pharmacy.
create or replace function public.catalogue_admin_transition_supplier_request(
  p_request_id uuid,p_next_status text,p_reference text default null
) returns void language plpgsql security invoker set search_path = ''
as $$
declare
  v_previous text;
  v_reference text := nullif(trim(coalesce(p_reference,'')),'');
begin
  if not (select private.has_global_role(array['super_admin']::text[])) then
    raise exception 'Administrateur non autorisé' using errcode='42501';
  end if;
  if p_next_status not in ('verifying','forwarded','confirmed','declined') then
    raise exception 'Statut non autorisé : clôturez la commande avec une preuve de livraison'
      using errcode='22023';
  end if;
  select status into v_previous from public.private_catalog_requests
    where id=p_request_id for update;
  if not found then raise exception 'Demande inconnue' using errcode='22023'; end if;
  if not (
    (v_previous='received' and p_next_status in ('verifying','declined')) or
    (v_previous='verifying' and p_next_status in ('forwarded','declined')) or
    (v_previous='forwarded' and p_next_status in ('confirmed','declined'))
  ) then raise exception 'Transition interdite % -> %',v_previous,p_next_status using errcode='22023';
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
