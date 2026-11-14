-- Favoris propres a chaque compte pharmacie et ajout au brouillon depuis la fiche produit.
-- Autorisations verifiees cote base et prix d'achat jamais exposes.
create table if not exists public.private_catalog_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  product_id uuid not null references public.private_catalog_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists private_catalog_favorites_pharmacy_idx
  on public.private_catalog_favorites(pharmacy_id);
alter table public.private_catalog_favorites enable row level security;
revoke all on table public.private_catalog_favorites from public, anon, authenticated;

create or replace function public.catalogue_my_favorites()
returns uuid[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_user uuid := (select auth.uid());
  v_ids uuid[];
begin
  if v_user is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;
  select coalesce(array_agg(f.product_id order by f.created_at desc),array[]::uuid[])
    into v_ids
  from public.private_catalog_favorites f
  join public.private_catalog_products p on p.id=f.product_id and p.active
  join public.private_catalog_brands b on b.id=p.brand_id and b.active
  join public.private_catalog_access a on a.brand_id=b.id
    and a.pharmacy_id=v_pharmacy and a.active
  where f.user_id=v_user and f.pharmacy_id=v_pharmacy;
  return v_ids;
end $$;
revoke all on function public.catalogue_my_favorites() from public,anon,authenticated;
grant execute on function public.catalogue_my_favorites() to authenticated;

create or replace function public.catalogue_set_favorite(
  p_product_id uuid,p_saved boolean
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_user uuid := (select auth.uid());
begin
  if v_user is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;
  if p_product_id is null or p_saved is null then
    raise exception 'Favori invalide' using errcode='22023';
  end if;
  if p_saved then
    if not exists(
      select 1 from public.private_catalog_products p
      join public.private_catalog_brands b on b.id=p.brand_id and b.active
      join public.private_catalog_access a on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
      where p.id=p_product_id and p.active
    ) then raise exception 'Reference non autorisee' using errcode='42501'; end if;
    insert into public.private_catalog_favorites(user_id,pharmacy_id,product_id)
      values(v_user,v_pharmacy,p_product_id)
      on conflict(user_id,product_id) do update set pharmacy_id=excluded.pharmacy_id;
  else
    delete from public.private_catalog_favorites
      where user_id=v_user and pharmacy_id=v_pharmacy and product_id=p_product_id;
  end if;
  return true;
end $$;
revoke all on function public.catalogue_set_favorite(uuid,boolean) from public,anon,authenticated;
grant execute on function public.catalogue_set_favorite(uuid,boolean) to authenticated;

-- Ajoute une reference au brouillon sans ecraser les autres lignes.
-- Le verrouillage sur la ligne du panier evite de perdre un ajout concurrent.
create or replace function public.catalogue_add_cart_line(p_product_id uuid,p_quantity integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_user uuid := (select auth.uid());
  v_lines jsonb := '[]'::jsonb;
  v_remaining jsonb;
  v_previous integer := 0;
  v_new integer;
begin
  if v_user is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;
  if p_product_id is null or p_quantity is null or p_quantity<1 or p_quantity>5000 then
    raise exception 'Quantite invalide' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.private_catalog_products p
    join public.private_catalog_brands b on b.id=p.brand_id and b.active
    join public.private_catalog_access a on a.brand_id=b.id and a.active and a.pharmacy_id=v_pharmacy
    where p.id=p_product_id and p.active
  ) then raise exception 'Reference indisponible' using errcode='42501'; end if;

  -- Une ligne de panier est creee une seule fois par utilisateur.
  insert into public.private_catalog_cart_drafts(user_id,pharmacy_id,lines)
    values(v_user,v_pharmacy,'[]'::jsonb)
    on conflict (user_id) do nothing;
  select c.lines into v_lines from public.private_catalog_cart_drafts c
    where c.user_id=v_user and c.pharmacy_id=v_pharmacy for update;
  if v_lines is null then raise exception 'Panier indisponible' using errcode='42501'; end if;
  select coalesce(sum((x.value->>'quantity')::integer),0)::integer
    into v_previous from jsonb_array_elements(v_lines) x
    where x.value->>'product_id'=p_product_id::text;
  v_new:=v_previous+p_quantity;
  if v_new>5000 then raise exception 'Maximum 5000 unites' using errcode='22023'; end if;
  select coalesce(jsonb_agg(x.value),'[]'::jsonb)
    into v_remaining from jsonb_array_elements(v_lines) x
    where x.value->>'product_id'<>p_product_id::text;
  if jsonb_array_length(v_remaining)>=40 and v_previous=0 then
    raise exception 'Maximum 40 references' using errcode='22023';
  end if;
  update public.private_catalog_cart_drafts c
    set lines=v_remaining||jsonb_build_array(jsonb_build_object('product_id',p_product_id,'quantity',v_new)),
        updated_at=now()
    where c.user_id=v_user and c.pharmacy_id=v_pharmacy;
  return jsonb_build_object('saved',true,'quantity',v_new);
end $$;
revoke all on function public.catalogue_add_cart_line(uuid,integer) from public,anon,authenticated;
grant execute on function public.catalogue_add_cart_line(uuid,integer) to authenticated;
