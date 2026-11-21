
-- La commission sur un réassort direct exige un compte apporté / attribué et documenté.
create table if not exists public.private_catalog_agent_accounts (
  brand_id uuid not null references public.private_catalog_brands(id) on delete cascade,
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  attribution_reference text not null default '',
  verified boolean not null default false,
  verified_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (brand_id,pharmacy_id),
  constraint verified_attribution_requires_proof check (
    not verified or (length(trim(attribution_reference))>=8 and verified_at is not null)
  )
);
alter table public.private_catalog_agent_accounts enable row level security;
revoke all on public.private_catalog_agent_accounts from public,anon,authenticated;
grant select,insert,update on public.private_catalog_agent_accounts to authenticated;
create policy agent_account_admin_only on public.private_catalog_agent_accounts
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));

create or replace function public.catalogue_guard_direct_commission_attribution()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if new.origin='direct' and not exists (
    select 1 from public.private_catalog_agent_accounts a
      where a.brand_id=new.brand_id and a.pharmacy_id=new.pharmacy_id and a.verified
  ) then
    raise exception 'Compte pharmacie non attribué à TR1 pour cette marque'
      using errcode='22023';
  end if;
  if tg_op='UPDATE' and (
      new.brand_id is distinct from old.brand_id
      or new.pharmacy_id is distinct from old.pharmacy_id
      or new.request_id is distinct from old.request_id
      or new.origin is distinct from old.origin
      or new.sale_kind is distinct from old.sale_kind
      or new.supplier_invoice_reference is distinct from old.supplier_invoice_reference
      or new.supplier_invoice_date is distinct from old.supplier_invoice_date
      or new.supplier_invoiced_ht is distinct from old.supplier_invoiced_ht
      or new.commission_rate_snapshot is distinct from old.commission_rate_snapshot
      or new.supporting_evidence is distinct from old.supporting_evidence
    ) then
    raise exception 'Facture et taux figés : créer une régularisation documentée'
      using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function public.catalogue_guard_direct_commission_attribution() from public,anon,authenticated;
drop trigger if exists trg_catalogue_guard_direct_attribution on public.private_catalog_agent_commissions;
create trigger trg_catalogue_guard_direct_attribution
  before insert or update on public.private_catalog_agent_commissions
  for each row execute function public.catalogue_guard_direct_commission_attribution();
