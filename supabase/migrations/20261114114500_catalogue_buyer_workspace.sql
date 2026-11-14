-- Staging TR1 PHARMA : panier persistant et reapprovisionnement depuis les demandes passees.
-- Toutes les lectures/ecritures sont reservees a l'officine authentifiee et autorisee.
create table if not exists public.private_catalog_cart_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  updated_at timestamptz not null default now()
);
create index if not exists private_catalog_cart_drafts_pharmacy_idx
  on public.private_catalog_cart_drafts(pharmacy_id);
alter table public.private_catalog_cart_drafts enable row level security;
revoke all on table public.private_catalog_cart_drafts from public, anon, authenticated;

-- Ne renvoie jamais les prix internes. Limite l'historique a cette officine
-- et aux references toujours actives et accessibles pour un nouveau reapprovisionnement.
create or replace function public.catalogue_buyer_workspace()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_user uuid := (select auth.uid());
  v_lines jsonb := '[]'::jsonb;
  v_history jsonb := '[]'::jsonb;
begin
  if v_user is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;

  select c.lines into v_lines
    from public.private_catalog_cart_drafts c
    where c.user_id=v_user and c.pharmacy_id=v_pharmacy;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',r.id,'created_at',r.created_at,'brand_name',b.name,
      'request_kind',r.request_kind,'status',r.status,
      'items',r.items
    ) order by r.created_at desc
  ),'[]'::jsonb) into v_history
  from (
    select r.id,r.created_at,r.brand_id,r.request_kind,r.status,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id',i.product_id,'quantity',i.quantity,'name',p.name
        ) order by i.id)
        from public.private_catalog_request_items i
        join public.private_catalog_products p
          on p.id=i.product_id and p.active
        join public.private_catalog_access a
          on a.brand_id=p.brand_id and a.pharmacy_id=v_pharmacy and a.active
        join public.private_catalog_brands ab
          on ab.id=a.brand_id and ab.active
        where i.request_id=r.id
      ), '[]'::jsonb) as items
    from public.private_catalog_requests r
    where r.pharmacy_id=v_pharmacy
    order by r.created_at desc
    limit 12
  ) r
  join public.private_catalog_brands b on b.id=r.brand_id
  where jsonb_array_length(r.items)>0;

  return jsonb_build_object(
    'lines',coalesce(v_lines,'[]'::jsonb),
    'recent_requests',coalesce(v_history,'[]'::jsonb)
  );
end $$;
revoke all on function public.catalogue_buyer_workspace() from public, anon, authenticated;
grant execute on function public.catalogue_buyer_workspace() to authenticated;

create or replace function public.catalogue_save_cart(p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_user uuid := (select auth.uid());
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_min integer;
  v_seen uuid[] := array[]::uuid[];
  v_normalised jsonb := '[]'::jsonb;
begin
  if v_user is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array'
    or jsonb_array_length(p_lines)>40
    or length(p_lines::text)>12000 then
    raise exception 'Panier invalide' using errcode='22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_item)<>'object'
      or jsonb_typeof(v_item->'product_id')<>'string'
      or jsonb_typeof(v_item->'quantity')<>'number'
      or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,5}$'
      or coalesce(v_item->>'product_id','') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'Ligne de panier invalide' using errcode='22023';
    end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_product_id = any(v_seen) then
      raise exception 'Produit en doublon' using errcode='22023';
    end if;
    v_seen := array_append(v_seen,v_product_id);

    select p.min_quantity into v_min
      from public.private_catalog_products p
      join public.private_catalog_brands b on b.id=p.brand_id and b.active
      join public.private_catalog_access a
        on a.brand_id=p.brand_id and a.pharmacy_id=v_pharmacy and a.active
      where p.id=v_product_id and p.active;
    if not found then
      raise exception 'Reference indisponible' using errcode='22023';
    end if;
    -- Le brouillon accepte une quantite intermediaire pour ne pas interrompre
    -- la saisie, mais les controles de minimum restent obligatoires a l'envoi.
    if v_quantity<1 or v_quantity>5000 then
      raise exception 'Quantite invalide' using errcode='22023';
    end if;
    v_normalised := v_normalised || jsonb_build_array(jsonb_build_object(
      'product_id',v_product_id,'quantity',v_quantity
    ));
  end loop;

  if jsonb_array_length(v_normalised)=0 then
    delete from public.private_catalog_cart_drafts
      where user_id=v_user and pharmacy_id=v_pharmacy;
  else
    insert into public.private_catalog_cart_drafts(user_id,pharmacy_id,lines,updated_at)
      values(v_user,v_pharmacy,v_normalised,now())
    on conflict(user_id) do update set
      pharmacy_id=excluded.pharmacy_id,
      lines=excluded.lines,
      updated_at=now();
  end if;
  return jsonb_build_object('saved',true,'count',jsonb_array_length(v_normalised));
end $$;
revoke all on function public.catalogue_save_cart(jsonb) from public, anon, authenticated;
grant execute on function public.catalogue_save_cart(jsonb) to authenticated;
