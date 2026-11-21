
-- Attribution vérifiée requise à la création d'une commission directe uniquement.
-- Un mandat expiré/une attribution ultérieurement désactivée ne doit pas empêcher
-- le règlement d'une commission déjà documentée et acquise.
create or replace function public.catalogue_guard_direct_commission_attribution()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if tg_op='INSERT' and new.origin='direct' and not exists (
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
