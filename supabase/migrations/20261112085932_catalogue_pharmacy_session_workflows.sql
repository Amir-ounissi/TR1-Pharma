-- Candidate prod TR1: parcours pharmacie sans cle service-role.
-- Les fonctions publiques sont accessibles uniquement aux comptes authentifies
-- et revalident en base l'identite, l'email confirme, l'adhesion et les marques.
create table public.private_catalog_invitations (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and length(email) between 5 and 254),
  invited_by uuid not null references auth.users(id),
  active boolean not null default true,
  expires_at timestamptz not null default (now() + interval '30 days'),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index private_catalog_invitations_pending_email
  on public.private_catalog_invitations(lower(email))
  where active and claimed_at is null;
create index private_catalog_invitations_pharmacy_idx on public.private_catalog_invitations(pharmacy_id);
alter table public.private_catalog_invitations enable row level security;
revoke all on public.private_catalog_invitations from public,anon,authenticated;
grant select,insert,update,delete on public.private_catalog_invitations to authenticated,service_role;
create policy platform_superadmin_only on public.private_catalog_invitations
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));

create or replace function private.catalogue_current_pharmacy_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.pharmacy_id
  from public.private_catalog_memberships m
  join auth.users u on u.id=m.user_id
  where m.user_id=(select auth.uid())
    and m.active
    and u.email_confirmed_at is not null
    and u.email is not null
    and lower(trim(u.email))=lower(trim(m.invited_email))
  limit 1
$$;
revoke all on function private.catalogue_current_pharmacy_id() from public,anon,authenticated;

create or replace function public.catalogue_claim_invitation()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_inv public.private_catalog_invitations%rowtype;
begin
  if (select auth.uid()) is null then return false; end if;
  select lower(trim(u.email)) into v_email
    from auth.users u
    where u.id=(select auth.uid()) and u.email_confirmed_at is not null;
  if v_email is null then return false; end if;
  if exists (select 1 from public.private_catalog_memberships m where m.user_id=(select auth.uid())
     and m.active and lower(trim(m.invited_email))=v_email) then return true; end if;
  select * into v_inv from public.private_catalog_invitations
    where email=v_email and active and claimed_at is null and expires_at>now()
    order by created_at desc limit 1 for update;
  if not found then return false; end if;
  insert into public.private_catalog_memberships(user_id,pharmacy_id,invited_email,role,active)
    values ((select auth.uid()),v_inv.pharmacy_id,v_email,'pharmacien',true)
    on conflict (user_id) do nothing;
  if not exists(select 1 from public.private_catalog_memberships m
      where m.user_id=(select auth.uid()) and m.pharmacy_id=v_inv.pharmacy_id and m.active
      and lower(trim(m.invited_email))=v_email) then return false; end if;
  update public.private_catalog_invitations
    set claimed_at=now(),active=false where id=v_inv.id;
  return true;
end $$;
revoke all on function public.catalogue_claim_invitation() from public,anon,authenticated;
grant execute on function public.catalogue_claim_invitation() to authenticated;

create or replace function public.catalogue_my_data(p_slug text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pharmacy_id uuid := private.catalogue_current_pharmacy_id();
  v_pharmacy jsonb;
  v_brands jsonb;
  v_requests jsonb;
  v_brand record;
  v_brand_json jsonb := null;
  v_products jsonb := '[]'::jsonb;
  v_prod record;
  v_indicative jsonb;
  v_contract jsonb;
  v_pricing jsonb;
begin
  if v_pharmacy_id is null then return null; end if;
  select jsonb_build_object('id',p.id,'name',p.name,'city',p.city)
    into v_pharmacy from public.private_catalog_pharmacies p where p.id=v_pharmacy_id;
  if v_pharmacy is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'slug',b.slug,'name',b.name,'description',b.description,'logo_url',b.logo_url
  ) order by b.name), '[]'::jsonb) into v_brands
    from public.private_catalog_access a
    join public.private_catalog_brands b on b.id=a.brand_id
    where a.pharmacy_id=v_pharmacy_id and a.active and b.active;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'brand_id',r.brand_id,'total_ht',r.total_ht,
    'request_kind',r.request_kind,'status',r.status,'created_at',r.created_at
  ) order by r.created_at desc), '[]'::jsonb) into v_requests
    from public.private_catalog_requests r where r.pharmacy_id=v_pharmacy_id;

  if p_slug is not null then
    select b.id,b.slug,b.name,b.description,b.logo_url,a.pricing_mode
      into v_brand
      from public.private_catalog_access a
      join public.private_catalog_brands b on b.id=a.brand_id
      where a.pharmacy_id=v_pharmacy_id and a.active and b.active
        and b.slug=p_slug limit 1;
    if not found then return null; end if;
    v_brand_json := jsonb_build_object('id',v_brand.id,'slug',v_brand.slug,
      'name',v_brand.name,'description',v_brand.description,'logo_url',v_brand.logo_url);

    for v_prod in select p.id,p.brand_id,p.sku,p.ean,p.name,p.description,
            p.format,p.image_url,p.vat_rate,p.min_quantity,p.quantity_step
        from public.private_catalog_products p
        where p.brand_id=v_brand.id and p.active order by p.name
    loop
      select coalesce(jsonb_agg(jsonb_build_object('min_quantity',i.min_quantity,
        'price_min_ht',i.price_min_ht,'price_max_ht',i.price_max_ht)
        order by i.min_quantity), '[]'::jsonb) into v_indicative
        from public.private_catalog_indicative_tiers i where i.product_id=v_prod.id;

      v_contract := '[]'::jsonb;
      if v_brand.pricing_mode='contractual' then
        select coalesce(jsonb_agg(jsonb_build_object('min_quantity',r.min_quantity,'price_ht',r.price_ht)
            order by r.min_quantity), '[]'::jsonb) into v_contract
        from (
          select v_prod.min_quantity as min_quantity,flat.price_ht
            from public.private_catalog_prices flat
            where flat.pharmacy_id=v_pharmacy_id and flat.product_id=v_prod.id
              and not exists (select 1 from public.private_catalog_contract_tiers ct
                  where ct.pharmacy_id=v_pharmacy_id and ct.product_id=v_prod.id
                    and ct.min_quantity=v_prod.min_quantity)
          union all
          select t.min_quantity,t.price_ht
            from public.private_catalog_contract_tiers t
            where t.pharmacy_id=v_pharmacy_id and t.product_id=v_prod.id
        ) r;
      end if;

      if jsonb_array_length(v_contract)>0 then
        v_pricing:=jsonb_build_object('mode','contractual','tiers',v_contract);
      else
        v_pricing:=jsonb_build_object('mode','indicative','tiers',v_indicative);
      end if;
      v_products:=v_products || jsonb_build_array(jsonb_build_object(
        'id',v_prod.id,'brand_id',v_prod.brand_id,'sku',v_prod.sku,
        'ean',v_prod.ean,'name',v_prod.name,'description',v_prod.description,
        'format',v_prod.format,'image_url',v_prod.image_url,'vat_rate',v_prod.vat_rate,
        'min_quantity',v_prod.min_quantity,'quantity_step',v_prod.quantity_step,
        'pricing',v_pricing));
    end loop;
  end if;
  return jsonb_build_object('pharmacy',v_pharmacy,'brands',v_brands,
    'requests',v_requests,'brand',v_brand_json,'products',v_products);
end $$;
revoke all on function public.catalogue_my_data(text) from public,anon,authenticated;
grant execute on function public.catalogue_my_data(text) to authenticated;

create or replace function public.catalogue_submit_request(p_slug text,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_brand uuid;
  v_mode text;
  v_item jsonb;
  v_product public.private_catalog_products%rowtype;
  v_qty integer;
  v_unit numeric(12,2);
  v_request uuid;
  v_lines jsonb := '[]'::jsonb;
  v_firm boolean := true;
  v_total numeric(14,2) := 0;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_pharmacy is null then raise exception 'Catalogue non autorise' using errcode='42501'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Marque invalide' using errcode='22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array'
    or jsonb_array_length(p_lines) not between 1 and 40 then
    raise exception 'Selection invalide' using errcode='22023';
  end if;
  select b.id,a.pricing_mode into v_brand,v_mode
    from public.private_catalog_access a
    join public.private_catalog_brands b on b.id=a.brand_id
    where a.pharmacy_id=v_pharmacy and a.active and b.active and b.slug=p_slug;
  if not found then raise exception 'Marque non autorisee' using errcode='42501'; end if;
  if (select count(*) from public.private_catalog_requests r
    where r.created_by=(select auth.uid())
      and r.created_at>now()-interval '1 hour') >= 20 then
    raise exception 'Trop de demandes. Reessayez plus tard.' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_item)<>'object'
      or jsonb_typeof(v_item->'product_id')<>'string'
      or jsonb_typeof(v_item->'quantity')<>'number'
      or (v_item->>'quantity') !~ '^[0-9]{1,4}$' then
      raise exception 'Ligne invalide' using errcode='22023';
    end if;
    select * into v_product from public.private_catalog_products p
      where p.id=(v_item->>'product_id')::uuid and p.brand_id=v_brand and p.active;
    if not found then raise exception 'Reference indisponible' using errcode='22023'; end if;
    if v_product.id = any(v_seen) then
      raise exception 'References en doublon' using errcode='22023'; end if;
    v_seen:=array_append(v_seen,v_product.id);
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty>5000 or v_qty<v_product.min_quantity or
       (v_qty-v_product.min_quantity) % v_product.quantity_step<>0 then
       raise exception 'Conditionnement invalide' using errcode='22023';
    end if;
    v_unit:=null;
    if v_mode='contractual' then
      select t.price_ht into v_unit from (
        select c.min_quantity,c.price_ht from public.private_catalog_contract_tiers c
          where c.product_id=v_product.id and c.pharmacy_id=v_pharmacy
        union all
        select v_product.min_quantity,f.price_ht
          from public.private_catalog_prices f where f.product_id=v_product.id
            and f.pharmacy_id=v_pharmacy
            and not exists(select 1 from public.private_catalog_contract_tiers c
              where c.product_id=v_product.id and c.pharmacy_id=v_pharmacy
                and c.min_quantity=v_product.min_quantity)
      ) t where t.min_quantity<=v_qty
        order by t.min_quantity desc limit 1;
    end if;
    if v_unit is null then v_firm:=false;
    else v_total:=v_total+v_unit*v_qty; end if;
    v_lines:=v_lines || jsonb_build_array(jsonb_build_object(
      'product_id',v_product.id,'product_name',v_product.name,
      'sku',v_product.sku,'quantity',v_qty,'vat_rate',v_product.vat_rate,
      'unit_price_ht',v_unit));
  end loop;
  if v_total>100000000 then
    raise exception 'Montant superieur a la limite autorisee' using errcode='22023';
  end if;
  insert into public.private_catalog_requests
    (pharmacy_id,brand_id,created_by,request_kind,total_ht,status)
    values(v_pharmacy,v_brand,(select auth.uid()),
      case when v_firm then 'order' else 'quote' end,
      case when v_firm then v_total else null end,'received')
    returning id into v_request;
  for v_item in select value from jsonb_array_elements(v_lines) loop
    insert into public.private_catalog_request_items(
      request_id,product_id,product_name,sku,quantity,unit_price_ht,vat_rate,line_total_ht)
    values(v_request,(v_item->>'product_id')::uuid,v_item->>'product_name',
      v_item->>'sku',(v_item->>'quantity')::integer,
      case when v_firm then (v_item->>'unit_price_ht')::numeric else null end,
      (v_item->>'vat_rate')::numeric,
      case when v_firm then
        (v_item->>'unit_price_ht')::numeric*(v_item->>'quantity')::integer else null end);
  end loop;
  return jsonb_build_object('id',v_request,'request_kind',
    case when v_firm then 'order' else 'quote' end);
end $$;
revoke all on function public.catalogue_submit_request(text,jsonb) from public,anon,authenticated;
grant execute on function public.catalogue_submit_request(text,jsonb) to authenticated;
