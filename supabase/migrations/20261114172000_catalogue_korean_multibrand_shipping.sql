-- Franco mutualisé 250 EUR HT remisé, Biodance + Beauty of Joseon + Dr. Althea.
-- Le prix définitif reste a confirmer pour les demandes de devis ; aucune
-- gratuité non vérifiée n'est inscrite comme acquise.
create table if not exists public.private_catalog_shipping_batches (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id),
  created_by uuid not null references auth.users(id),
  policy_code text not null default 'korean-multibrand-franco',
  threshold_ht numeric(12,2) not null default 250.00 check (threshold_ht=250.00),
  qualifying_total_ht numeric(14,2) null check (qualifying_total_ht>=0),
  free_shipping_eligible boolean null,
  created_at timestamptz not null default now()
);
create index if not exists private_catalog_shipping_batches_pharmacy_idx
  on public.private_catalog_shipping_batches(pharmacy_id,created_at desc);
alter table public.private_catalog_shipping_batches enable row level security;
revoke all on table public.private_catalog_shipping_batches from public,anon,authenticated;

alter table public.private_catalog_requests
  add column if not exists shipping_batch_id uuid null
    references public.private_catalog_shipping_batches(id);
create index if not exists private_catalog_requests_shipping_batch_idx
  on public.private_catalog_requests(shipping_batch_id)
  where shipping_batch_id is not null;

-- Un même lot de livraison regroupe les demandes des trois marques, même si
-- chacune conserve son circuit de traitement distinct.
create or replace function public.catalogue_submit_with_korean_franco(p_groups jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_user uuid := (select auth.uid());
  v_result jsonb;
  v_request jsonb;
  v_slug text;
  v_request_id uuid;
  v_batch uuid;
begin
  if v_user is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;

  -- Toute la validation des volumes, droits et commandes atomiques est
  -- faite par la fonction métier existante avant de créer le groupement.
  v_result := public.catalogue_submit_multibrand_request(p_groups);

  if exists (
    select 1 from jsonb_array_elements(v_result->'requests') r
    where r.value->>'brand_slug' in ('biodance','beauty-of-joseon','dr-althea')
  ) then
    insert into public.private_catalog_shipping_batches(
      pharmacy_id,created_by,threshold_ht,qualifying_total_ht,free_shipping_eligible
    ) values (v_pharmacy,v_user,250.00,null,null)
    returning id into v_batch;

    for v_request in select value from jsonb_array_elements(v_result->'requests') loop
      v_slug := v_request->>'brand_slug';
      if v_slug in ('biodance','beauty-of-joseon','dr-althea') then
        v_request_id := (v_request->'request'->>'id')::uuid;
        update public.private_catalog_requests req
          set shipping_batch_id=v_batch
          where req.id=v_request_id and req.pharmacy_id=v_pharmacy
            and req.created_by=v_user;
        if not found then
          raise exception 'Impossible de rattacher la commande au franco' using errcode='42501';
        end if;
      end if;
    end loop;
  end if;

  return v_result || jsonb_build_object(
    'shipping_batch_id',v_batch,
    'korean_franco_threshold_ht',case when v_batch is not null then 250.00 else null end,
    'shipping_eligibility','pending_final_pricing'
  );
end $$;
revoke all on function public.catalogue_submit_with_korean_franco(jsonb)
  from public,anon,authenticated;
grant execute on function public.catalogue_submit_with_korean_franco(jsonb)
  to authenticated;
