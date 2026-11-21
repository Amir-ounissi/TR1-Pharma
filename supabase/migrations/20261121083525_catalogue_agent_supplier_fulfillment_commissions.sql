
-- TR1 PHARMA: traçabilité des commandes fournisseurs et commissions des agents.
-- Schéma privé dans public + RLS superadministrateur, aucune donnée publiée aux officines.

create table if not exists public.private_catalog_agent_mandates (
  brand_id uuid primary key references public.private_catalog_brands(id) on delete cascade,
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  first_order boolean not null default true,
  repeat_order boolean not null default true,
  direct_repeat boolean not null default false,
  contract_reference text not null default '',
  verified boolean not null default false,
  verified_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint mandate_verified_requires_source check (
    not verified or (length(trim(contract_reference)) >= 8 and verified_at is not null)
  )
);

create table if not exists public.private_catalog_supplier_fulfillment (
  request_id uuid primary key references public.private_catalog_requests(id) on delete cascade,
  dispatch_reference text,
  dispatched_at timestamptz,
  confirmation_reference text,
  confirmed_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_catalog_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.private_catalog_requests(id) on delete cascade,
  previous_status text not null,
  next_status text not null,
  evidence_reference text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create index if not exists private_catalog_request_events_request_idx on public.private_catalog_request_events(request_id,changed_at desc);

create table if not exists public.private_catalog_agent_commissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.private_catalog_requests(id) on delete restrict,
  brand_id uuid not null references public.private_catalog_brands(id) on delete restrict,
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete restrict,
  origin text not null check (origin in ('catalogue','direct')),
  sale_kind text not null check (sale_kind in ('initial','reorder')),
  supplier_invoice_reference text not null check (length(trim(supplier_invoice_reference)) between 4 and 120),
  supplier_invoice_date date not null,
  supplier_invoiced_ht numeric(14,2) not null check (supplier_invoiced_ht > 0 and supplier_invoiced_ht <= 100000000),
  commission_rate_snapshot numeric(5,2) not null check (commission_rate_snapshot between 0 and 100),
  commission_ht numeric(14,2) generated always as (round(supplier_invoiced_ht * commission_rate_snapshot / 100,2)) stored,
  supporting_evidence text not null check (length(trim(supporting_evidence)) between 8 and 500),
  status text not null default 'earned' check (status in ('earned','billed','paid')),
  tr1_invoice_reference text,
  payment_reference text,
  paid_at timestamptz,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_commission_origin_request check (
    (origin = 'catalogue' and request_id is not null) or
    (origin = 'direct' and request_id is null)
  ),
  constraint catalogue_commission_billing_evidence check (
    (status = 'earned' and tr1_invoice_reference is null and payment_reference is null and paid_at is null)
    or (status = 'billed' and length(trim(coalesce(tr1_invoice_reference,''))) >= 4 and payment_reference is null and paid_at is null)
    or (status = 'paid' and length(trim(coalesce(tr1_invoice_reference,''))) >= 4 and length(trim(coalesce(payment_reference,''))) >= 4 and paid_at is not null)
  )
);
create unique index if not exists private_catalog_commission_invoice_unique on public.private_catalog_agent_commissions(brand_id,pharmacy_id,lower(trim(supplier_invoice_reference)));
create index if not exists private_catalog_commissions_brand_status_idx on public.private_catalog_agent_commissions(brand_id,status,created_at desc);
create index if not exists private_catalog_commissions_pharmacy_idx on public.private_catalog_agent_commissions(pharmacy_id,created_at desc);

alter table public.private_catalog_agent_mandates enable row level security;
alter table public.private_catalog_supplier_fulfillment enable row level security;
alter table public.private_catalog_request_events enable row level security;
alter table public.private_catalog_agent_commissions enable row level security;

revoke all on public.private_catalog_agent_mandates,public.private_catalog_supplier_fulfillment,public.private_catalog_request_events,public.private_catalog_agent_commissions from public,anon,authenticated;
grant select,insert,update on public.private_catalog_agent_mandates to authenticated;
grant select,insert,update on public.private_catalog_supplier_fulfillment to authenticated;
grant select,insert on public.private_catalog_request_events to authenticated;
grant select,insert,update on public.private_catalog_agent_commissions to authenticated;
grant usage,select on sequence public.private_catalog_request_events_id_seq to authenticated;

create policy mandate_admin_only on public.private_catalog_agent_mandates
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
create policy fulfillment_admin_only on public.private_catalog_supplier_fulfillment
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
create policy events_admin_only on public.private_catalog_request_events
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
create policy commissions_admin_only on public.private_catalog_agent_commissions
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));

-- État client et preuve fournisseur mis à jour atomiquement, sans envoyer d'email.
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
  if p_next_status not in ('verifying','forwarded','confirmed','closed','declined') then
    raise exception 'Statut non autorisé' using errcode='22023';
  end if;
  select status into v_previous from public.private_catalog_requests
    where id=p_request_id for update;
  if not found then raise exception 'Demande inconnue' using errcode='22023'; end if;
  if not (
    (v_previous='received' and p_next_status in ('verifying','declined')) or
    (v_previous='verifying' and p_next_status in ('forwarded','declined')) or
    (v_previous='forwarded' and p_next_status in ('confirmed','declined')) or
    (v_previous='confirmed' and p_next_status='closed')
  ) then raise exception 'Transition interdite % -> %',v_previous,p_next_status using errcode='22023';
  end if;
  if p_next_status in ('forwarded','confirmed') and length(coalesce(v_reference,'')) < 6 then
    raise exception 'Référence fournisseur ou preuve requise (6 caractères minimum)' using errcode='22023';
  end if;
  update public.private_catalog_requests set status=p_next_status where id=p_request_id;
  if p_next_status='forwarded' then
    insert into public.private_catalog_supplier_fulfillment(request_id,dispatch_reference,dispatched_at,updated_by)
      values (p_request_id,v_reference,now(),(select auth.uid()))
      on conflict(request_id) do update set
        dispatch_reference=excluded.dispatch_reference,
        dispatched_at=excluded.dispatched_at,updated_by=excluded.updated_by,updated_at=now();
  elsif p_next_status='confirmed' then
    update public.private_catalog_supplier_fulfillment set
      confirmation_reference=v_reference,confirmed_at=now(),
      updated_by=(select auth.uid()),updated_at=now()
      where request_id=p_request_id and dispatched_at is not null;
    if not found then raise exception 'Transmission fournisseur non tracée' using errcode='22023'; end if;
  end if;
  insert into public.private_catalog_request_events
    (request_id,previous_status,next_status,evidence_reference,changed_by)
    values (p_request_id,v_previous,p_next_status,v_reference,(select auth.uid()));
end;
$$;
revoke all on function public.catalogue_admin_transition_supplier_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.catalogue_admin_transition_supplier_request(uuid,text,text) to authenticated;

-- Taux figé à chaque facture fournisseur : interdit les commissions sur devis ou commandes non confirmées.
create or replace function public.catalogue_admin_record_supplier_invoice(
  p_brand_id uuid,p_pharmacy_id uuid,p_request_id uuid,p_origin text,p_sale_kind text,
  p_invoice_ref text,p_invoice_date date,p_amount_ht numeric,p_evidence text
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v_mandate public.private_catalog_agent_mandates%rowtype;
  v_request public.private_catalog_requests%rowtype;
  v_commission uuid;
begin
  if not (select private.has_global_role(array['super_admin']::text[])) then
    raise exception 'Administrateur non autorisé' using errcode='42501';
  end if;
  if p_origin not in ('catalogue','direct') or p_sale_kind not in ('initial','reorder') then
    raise exception 'Origine ou nature de vente invalide' using errcode='22023';
  end if;
  if p_invoice_ref is null or length(trim(p_invoice_ref)) < 4 or
     p_evidence is null or length(trim(p_evidence)) < 8 or
     p_amount_ht is null or p_amount_ht <= 0 or p_amount_ht > 100000000 or
     p_invoice_date is null or p_invoice_date > current_date then
    raise exception 'Preuve, date et montant facturé requis' using errcode='22023';
  end if;
  select * into v_mandate from public.private_catalog_agent_mandates
    where brand_id=p_brand_id and verified;
  if not found then raise exception 'Mandat commercial non vérifié' using errcode='22023'; end if;
  if (p_sale_kind='initial' and not v_mandate.first_order) or
     (p_sale_kind='reorder' and not v_mandate.repeat_order) or
     (p_origin='direct' and not v_mandate.direct_repeat) then
    raise exception 'Vente non commissionnable selon le mandat' using errcode='22023';
  end if;
  if p_origin='catalogue' then
    if p_request_id is null then raise exception 'Demande catalogue requise' using errcode='22023'; end if;
    select * into v_request from public.private_catalog_requests where id=p_request_id;
    if not found or v_request.brand_id<>p_brand_id or v_request.pharmacy_id<>p_pharmacy_id
       or v_request.request_kind<>'order' or v_request.status not in ('confirmed','closed') then
      raise exception 'Commande catalogue non confirmée ou incohérente' using errcode='22023';
    end if;
  elsif p_request_id is not null or p_sale_kind<>'reorder' then
    raise exception 'Les ventes directes sont des réassorts sans demande catalogue' using errcode='22023';
  end if;
  insert into public.private_catalog_agent_commissions
   (request_id,brand_id,pharmacy_id,origin,sale_kind,supplier_invoice_reference,supplier_invoice_date,
    supplier_invoiced_ht,commission_rate_snapshot,supporting_evidence,recorded_by)
  values
   (p_request_id,p_brand_id,p_pharmacy_id,p_origin,p_sale_kind,trim(p_invoice_ref),
    p_invoice_date,round(p_amount_ht,2),v_mandate.commission_rate,trim(p_evidence),(select auth.uid()))
  returning id into v_commission;
  return v_commission;
end;
$$;
revoke all on function public.catalogue_admin_record_supplier_invoice(uuid,uuid,uuid,text,text,text,date,numeric,text) from public,anon,authenticated;
grant execute on function public.catalogue_admin_record_supplier_invoice(uuid,uuid,uuid,text,text,text,date,numeric,text) to authenticated;

create or replace function public.catalogue_admin_set_commission_status(
  p_commission_id uuid,p_next_status text,p_reference text
) returns void language plpgsql security invoker set search_path = ''
as $$
declare v_previous text; v_reference text := trim(coalesce(p_reference,''));
begin
  if not (select private.has_global_role(array['super_admin']::text[])) then
    raise exception 'Administrateur non autorisé' using errcode='42501';
  end if;
  if length(v_reference)<4 then raise exception 'Référence justificative obligatoire' using errcode='22023'; end if;
  select status into v_previous from public.private_catalog_agent_commissions where id=p_commission_id for update;
  if not found then raise exception 'Commission inconnue' using errcode='22023'; end if;
  if v_previous='earned' and p_next_status='billed' then
    update public.private_catalog_agent_commissions set status='billed',
      tr1_invoice_reference=v_reference,updated_at=now() where id=p_commission_id;
  elsif v_previous='billed' and p_next_status='paid' then
    update public.private_catalog_agent_commissions set status='paid',
      payment_reference=v_reference,paid_at=now(),updated_at=now() where id=p_commission_id;
  else raise exception 'Transition de règlement invalide' using errcode='22023';
  end if;
end;
$$;
revoke all on function public.catalogue_admin_set_commission_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.catalogue_admin_set_commission_status(uuid,text,text) to authenticated;

-- Vitalora : taux annoncé par l'agent, mais mandat non vérifié jusqu'à saisie d'une preuve contractuelle.
insert into public.private_catalog_agent_mandates
 (brand_id,commission_rate,first_order,repeat_order,direct_repeat,contract_reference,verified)
select id,18,true,true,true,'Déclaration agent du 21/11/2026 — justificatif de mandat à joindre',false
from public.private_catalog_brands where slug='vitalora'
on conflict (brand_id) do nothing;
