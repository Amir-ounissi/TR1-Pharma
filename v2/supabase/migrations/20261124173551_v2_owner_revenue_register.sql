create table public.tr1_revenue_entries (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete restrict,
 pharmacy_id uuid references public.pharmacies(id) on delete restrict,
 kind text not null check (kind in ('commission','implantation','animation','formation','forfait','other')),
 title text not null check (length(trim(title)) between 3 and 180),
 source_ref text not null check (length(trim(source_ref)) between 3 and 300),
 event_date date not null,
 amount_ht numeric(12,2) not null check (amount_ht>0),
 status text not null default 'estimated' check (status in ('estimated','acquired','invoiced','paid','cancelled')),
 acquired_on date, acquisition_ref text,
 invoiced_on date, invoice_ref text,
 paid_on date, payment_ref text,
 cancelled_ref text,
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (brand_id,kind,source_ref),
 check (status not in ('acquired','invoiced','paid') or (acquired_on>=event_date and nullif(trim(acquisition_ref),'') is not null and acquired_on is not null)),
 check (status not in ('invoiced','paid') or (invoiced_on>=acquired_on and nullif(trim(invoice_ref),'') is not null and invoiced_on is not null)),
 check (status<>'paid' or (paid_on>=invoiced_on and nullif(trim(payment_ref),'') is not null and paid_on is not null)),
 check (status<>'cancelled' or nullif(trim(cancelled_ref),'') is not null)
);
create index tr1_revenue_entries_brand_date on public.tr1_revenue_entries(brand_id,event_date desc);
create index tr1_revenue_entries_pharmacy on public.tr1_revenue_entries(pharmacy_id);
create index tr1_revenue_entries_creator on public.tr1_revenue_entries(created_by);
alter table public.tr1_revenue_entries enable row level security;
revoke all on public.tr1_revenue_entries from public,anon,authenticated;
grant select on public.tr1_revenue_entries to authenticated;
grant insert (brand_id,pharmacy_id,kind,title,source_ref,event_date,amount_ht) on public.tr1_revenue_entries to authenticated;
grant update (status,acquired_on,acquisition_ref,invoiced_on,invoice_ref,paid_on,payment_ref,cancelled_ref) on public.tr1_revenue_entries to authenticated;
create policy revenue_owner_select on public.tr1_revenue_entries for select to authenticated using ((select public.tr1_is_owner()));
create policy revenue_owner_insert on public.tr1_revenue_entries for insert to authenticated with check ((select public.tr1_is_owner()) and created_by=(select auth.uid()) and status='estimated');
create policy revenue_owner_update on public.tr1_revenue_entries for update to authenticated using ((select public.tr1_is_owner())) with check ((select public.tr1_is_owner()));
create function public.tr1_revenue_transition() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if not ((old.status='estimated' and new.status in ('acquired','cancelled')) or (old.status='acquired' and new.status='invoiced') or (old.status='invoiced' and new.status='paid')) then
   raise exception 'Transition financière interdite';
 end if;
 if new.status<>'acquired' and (new.acquired_on is distinct from old.acquired_on or new.acquisition_ref is distinct from old.acquisition_ref) then raise exception 'Justificatif acquisition immuable'; end if;
 if new.status<>'invoiced' and (new.invoiced_on is distinct from old.invoiced_on or new.invoice_ref is distinct from old.invoice_ref) then raise exception 'Justificatif facture immuable'; end if;
 if new.status<>'paid' and (new.paid_on is distinct from old.paid_on or new.payment_ref is distinct from old.payment_ref) then raise exception 'Justificatif paiement immuable'; end if;
 if new.status<>'cancelled' and new.cancelled_ref is distinct from old.cancelled_ref then raise exception 'Annulation interdite'; end if;
 if (new.acquired_on is not null and new.acquired_on>current_date) or (new.invoiced_on is not null and new.invoiced_on>current_date) or (new.paid_on is not null and new.paid_on>current_date) then raise exception 'Événement futur non acquis'; end if;
 new.updated_at=now();
 return new;
end $$;
revoke execute on function public.tr1_revenue_transition() from public,anon,authenticated;
create trigger tr1_revenue_transition_guard before update on public.tr1_revenue_entries for each row execute function public.tr1_revenue_transition();
