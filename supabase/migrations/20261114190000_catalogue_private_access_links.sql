-- Acces prive au catalogue sans compte, avec demandes de commande rattachees a l'officine.
-- Les jetons sont aleatoires, seuls leurs SHA-256 sont stockes en base.
create table if not exists public.private_catalog_access_links (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  active boolean not null default true,
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists private_catalog_access_links_one_active_per_pharmacy
  on public.private_catalog_access_links(pharmacy_id) where active;
create index if not exists private_catalog_access_links_expiry_idx
  on public.private_catalog_access_links(expires_at) where active;

alter table public.private_catalog_access_links enable row level security;
revoke all on public.private_catalog_access_links from public, anon, authenticated;
grant all on public.private_catalog_access_links to service_role;
grant usage on schema private to service_role;

alter table public.private_catalog_requests
  alter column created_by drop not null,
  add column if not exists requester_name text,
  add column if not exists requester_email text,
  add column if not exists access_link_id uuid references public.private_catalog_access_links(id);
do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='private_catalog_requests_requester_identity_check'
      and conrelid='public.private_catalog_requests'::regclass
  ) then
    alter table public.private_catalog_requests
      add constraint private_catalog_requests_requester_identity_check check (
    (created_by is not null and access_link_id is null
      and requester_name is null and requester_email is null)
    or
    (created_by is null and access_link_id is not null
      and length(trim(coalesce(requester_name,''))) between 2 and 120
      and requester_email is not null
      and requester_email = lower(trim(requester_email))
      and length(requester_email) between 5 and 254
      and position('@' in requester_email) > 1)
    );
  end if;
end
$constraint$;
create index if not exists private_catalog_requests_access_link_idx
  on public.private_catalog_requests(access_link_id,created_at desc)
  where access_link_id is not null;

alter table public.private_catalog_shipping_batches
  alter column created_by drop not null,
  add column if not exists access_link_id uuid references public.private_catalog_access_links(id);

-- Rotation atomique : un seul lien actif par pharmacie, validite de 90 jours.
-- Appele exclusivement depuis une action serveur apres verification super-admin.
create or replace function public.catalogue_rotate_private_access_link(
  p_pharmacy_id uuid,
  p_token_hash text,
  p_created_by uuid
) returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_expires_at timestamptz := now() + interval '90 days';
begin
  if p_pharmacy_id is null or p_created_by is null
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Parametres de lien invalides' using errcode='22023';
  end if;
  if not exists(select 1 from public.private_catalog_pharmacies p where p.id=p_pharmacy_id) then
    raise exception 'Pharmacie inconnue' using errcode='22023';
  end if;
  update public.private_catalog_access_links
    set active=false
    where pharmacy_id=p_pharmacy_id and active;
  insert into public.private_catalog_access_links(
    pharmacy_id,token_hash,active,expires_at,created_by
  ) values(p_pharmacy_id,p_token_hash,true,v_expires_at,p_created_by);
  return v_expires_at;
end;
$function$;
revoke all on function public.catalogue_rotate_private_access_link(uuid,text,uuid)
  from public,anon,authenticated;
grant execute on function public.catalogue_rotate_private_access_link(uuid,text,uuid)
  to service_role;

-- Lecture du catalogue et des demandes pour un lien actif. La fonction n'est
-- executable que par le serveur avec sa cle secrete, jamais par le navigateur.
create or replace function public.catalogue_private_link_my_data(
  p_token_hash text,
  p_slug text default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_pharmacy_id uuid;
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
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  select l.pharmacy_id into v_pharmacy_id
    from public.private_catalog_access_links l
    where l.token_hash=p_token_hash and l.active and l.expires_at>now();
  if v_pharmacy_id is null then return null; end if;

  select jsonb_build_object('id',p.id,'name',p.name,'city',p.city)
    into v_pharmacy from public.private_catalog_pharmacies p where p.id=v_pharmacy_id;
  if v_pharmacy is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'slug',b.slug,'name',b.name,'description',b.description,'logo_url',b.logo_url
  ) order by b.name),'[]'::jsonb) into v_brands
  from public.private_catalog_access a
  join public.private_catalog_brands b on b.id=a.brand_id
  where a.pharmacy_id=v_pharmacy_id and a.active and b.active;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'brand_id',r.brand_id,'total_ht',r.total_ht,
    'request_kind',r.request_kind,'status',r.status,'created_at',r.created_at,
    'shipping_batch_id',r.shipping_batch_id,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id',i.product_id,'name',i.product_name,'quantity',i.quantity
      ) order by i.id)
      from public.private_catalog_request_items i where i.request_id=r.id
    ),'[]'::jsonb)
  ) order by r.created_at desc),'[]'::jsonb) into v_requests
  from (
    select req.* from public.private_catalog_requests req
    where req.pharmacy_id=v_pharmacy_id
    order by req.created_at desc limit 50
  ) r;

  if p_slug is not null then
    select b.id,b.slug,b.name,b.description,b.logo_url,a.pricing_mode
      into v_brand
      from public.private_catalog_access a
      join public.private_catalog_brands b on b.id=a.brand_id
      where a.pharmacy_id=v_pharmacy_id and a.active and b.active
        and b.slug=p_slug limit 1;
    if not found then return null; end if;
    v_brand_json:=jsonb_build_object(
      'id',v_brand.id,'slug',v_brand.slug,'name',v_brand.name,
      'description',v_brand.description,'logo_url',v_brand.logo_url
    );

    for v_prod in
      select p.id,p.brand_id,p.sku,p.ean,p.name,p.description,p.format,
        p.image_url,p.vat_rate,p.min_quantity,p.quantity_step
      from public.private_catalog_products p
      where p.brand_id=v_brand.id and p.active order by p.name
    loop
      select coalesce(jsonb_agg(jsonb_build_object(
        'min_quantity',i.min_quantity,'price_min_ht',i.price_min_ht,'price_max_ht',i.price_max_ht
      ) order by i.min_quantity),'[]'::jsonb)
      into v_indicative
      from public.private_catalog_indicative_tiers i where i.product_id=v_prod.id;

      v_contract:='[]'::jsonb;
      if v_brand.pricing_mode='contractual' then
        select coalesce(jsonb_agg(jsonb_build_object(
          'min_quantity',r.min_quantity,'price_ht',r.price_ht
        ) order by r.min_quantity),'[]'::jsonb)
        into v_contract
        from (
          select v_prod.min_quantity as min_quantity,flat.price_ht
          from public.private_catalog_prices flat
          where flat.pharmacy_id=v_pharmacy_id and flat.product_id=v_prod.id
            and not exists (
              select 1 from public.private_catalog_contract_tiers ct
              where ct.pharmacy_id=v_pharmacy_id and ct.product_id=v_prod.id
                and ct.min_quantity=v_prod.min_quantity
            )
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
      v_products:=v_products||jsonb_build_array(jsonb_build_object(
        'id',v_prod.id,'brand_id',v_prod.brand_id,'sku',v_prod.sku,
        'ean',v_prod.ean,'name',v_prod.name,'description',v_prod.description,
        'format',v_prod.format,'image_url',v_prod.image_url,'vat_rate',v_prod.vat_rate,
        'min_quantity',v_prod.min_quantity,'quantity_step',v_prod.quantity_step,
        'pricing',v_pricing
      ));
    end loop;
  end if;

  return jsonb_build_object(
    'pharmacy',v_pharmacy,'brands',v_brands,'requests',v_requests,
    'brand',v_brand_json,'products',v_products
  );
end;
$function$;
revoke all on function public.catalogue_private_link_my_data(text,text)
  from public,anon,authenticated;
grant execute on function public.catalogue_private_link_my_data(text,text)
  to service_role;

create or replace function public.catalogue_commercial_context_for_private_link(
  p_token_hash text
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_pharmacy uuid;
  v_groups jsonb;
  v_suppliers jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  select l.pharmacy_id into v_pharmacy
    from public.private_catalog_access_links l
    where l.token_hash=p_token_hash and l.active and l.expires_at>now();
  if v_pharmacy is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'brand_slug',b.slug,'name',g.name,
    'minimum_total_units',g.minimum_total_units,
    'quantity_multiple',g.quantity_multiple,
    'product_ids',(
      select coalesce(jsonb_agg(gp.product_id),'[]'::jsonb)
      from public.private_catalog_quantity_group_products gp
      join public.private_catalog_products p on p.id=gp.product_id and p.active
      where gp.group_id=g.id
    )
  ) order by b.slug,g.name),'[]'::jsonb)
  into v_groups
  from public.private_catalog_quantity_groups g
  join public.private_catalog_brands b on b.id=g.brand_id and b.active
  join public.private_catalog_access a
    on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
  where g.active;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.display_name,
    'brand_slugs',(
      select coalesce(jsonb_agg(b.slug order by b.name),'[]'::jsonb)
      from public.private_catalog_supplier_brands sb
      join public.private_catalog_brands b on b.id=sb.brand_id and b.active
      join public.private_catalog_access a
        on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
      where sb.supplier_id=s.id
    ),
    'minimum_order_units',t.minimum_order_units,
    'minimum_order_ht',t.minimum_order_ht,
    'shipping_fee_ht',t.shipping_fee_ht,
    'free_shipping_from_ht',t.free_shipping_from_ht,
    'gift_rules',coalesce(t.gift_rules,'[]'::jsonb),
    'conditions_verified',coalesce(t.active and t.verified_at is not null,false)
  ) order by s.display_name),'[]'::jsonb)
  into v_suppliers
  from public.private_catalog_suppliers s
  left join public.private_catalog_supplier_terms t
    on t.supplier_id=s.id and t.active and t.verified_at is not null
  where s.active and exists (
    select 1 from public.private_catalog_supplier_brands sb
    join public.private_catalog_brands b on b.id=sb.brand_id and b.active
    join public.private_catalog_access a
      on a.brand_id=b.id and a.pharmacy_id=v_pharmacy and a.active
    where sb.supplier_id=s.id
  );

  return jsonb_build_object('quantity_groups',v_groups,'suppliers',v_suppliers);
end;
$function$;
revoke all on function public.catalogue_commercial_context_for_private_link(text)
  from public,anon,authenticated;
grant execute on function public.catalogue_commercial_context_for_private_link(text)
  to service_role;

-- Validation des seuils fournisseurs pour une pharmacie identifiee par son lien.
create or replace function private.catalogue_validate_supplier_minimums_for_pharmacy(
  p_pharmacy uuid,
  p_groups jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_supplier record;
  v_line record;
  v_total_units integer;
  v_total_ht numeric := 0;
  v_all_priced boolean;
  v_unit_price numeric;
  v_pricing_qty integer;
  v_group_id uuid;
begin
  if p_pharmacy is null or p_groups is null
    or jsonb_typeof(p_groups)<>'array' or jsonb_array_length(p_groups)>20 then
    raise exception 'Panier invalide' using errcode='22023';
  end if;

  for v_supplier in
    select s.id,s.display_name,t.minimum_order_units,t.minimum_order_ht
    from public.private_catalog_suppliers s
    join public.private_catalog_supplier_terms t on t.supplier_id=s.id
    where s.active and t.active and t.verified_at is not null
  loop
    v_total_units:=0;v_total_ht:=0;v_all_priced:=true;
    for v_line in
      select p.id as product_id,p.min_quantity,p.brand_id,
        a.pricing_mode,(l.value->>'quantity')::integer as quantity
      from jsonb_array_elements(p_groups) g
      join public.private_catalog_brands b on b.slug=g.value->>'slug' and b.active
      join public.private_catalog_supplier_brands sb
        on sb.brand_id=b.id and sb.supplier_id=v_supplier.id
      join public.private_catalog_access a
        on a.brand_id=b.id and a.pharmacy_id=p_pharmacy and a.active
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(g.value->'lines')='array' then g.value->'lines'
        else '[]'::jsonb end
      ) l
      join public.private_catalog_products p
        on p.id::text=l.value->>'product_id' and p.brand_id=b.id and p.active
      where (l.value->>'quantity') ~ '^[0-9]{1,5}$'
    loop
      v_total_units:=v_total_units+v_line.quantity;
      if v_line.pricing_mode<>'contractual' then
        v_all_priced:=false;
        continue;
      end if;

      select gp.group_id into v_group_id
      from public.private_catalog_quantity_group_products gp
      join public.private_catalog_quantity_groups q on q.id=gp.group_id and q.active
      where gp.product_id=v_line.product_id;
      v_pricing_qty:=v_line.quantity;
      if v_group_id is not null then
        select coalesce(sum((l.value->>'quantity')::integer),0)::integer
          into v_pricing_qty
        from jsonb_array_elements(p_groups) g
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(g.value->'lines')='array'
            then g.value->'lines' else '[]'::jsonb end
        ) l
        join public.private_catalog_quantity_group_products gp
          on gp.group_id=v_group_id and gp.product_id::text=l.value->>'product_id'
        where (l.value->>'quantity') ~ '^[0-9]{1,5}$';
      end if;

      select c.price_ht into v_unit_price
      from public.private_catalog_contract_tiers c
      where c.pharmacy_id=p_pharmacy and c.product_id=v_line.product_id
        and c.min_quantity<=v_pricing_qty
      order by c.min_quantity desc limit 1;
      if v_unit_price is null then
        select f.price_ht into v_unit_price
        from public.private_catalog_prices f
        where f.pharmacy_id=p_pharmacy and f.product_id=v_line.product_id;
      end if;
      if v_unit_price is null then v_all_priced:=false;
      else v_total_ht:=v_total_ht+v_unit_price*v_line.quantity; end if;
      v_unit_price:=null;
    end loop;

    if v_total_units>0 then
      if v_supplier.minimum_order_units is not null
        and v_total_units<v_supplier.minimum_order_units then
        raise exception 'Minimum fournisseur % : % unites',
          v_supplier.display_name,v_supplier.minimum_order_units
          using errcode='22023';
      end if;
      if v_supplier.minimum_order_ht is not null and v_all_priced
        and v_total_ht<v_supplier.minimum_order_ht then
        raise exception 'Minimum fournisseur % : % EUR HT',
          v_supplier.display_name,v_supplier.minimum_order_ht
          using errcode='22023';
      end if;
    end if;
  end loop;
end;
$function$;
revoke all on function private.catalogue_validate_supplier_minimums_for_pharmacy(uuid,jsonb)
  from public,anon,authenticated;
grant execute on function private.catalogue_validate_supplier_minimums_for_pharmacy(uuid,jsonb)
  to service_role;

-- Soumission d'une demande par lien : mêmes validations produits, quantités,
-- paliers contractuels et devis que le parcours authentifie.
create or replace function private.catalogue_submit_request_for_pharmacy(
  p_pharmacy uuid,
  p_access_link_id uuid,
  p_requester_name text,
  p_requester_email text,
  p_slug text,
  p_lines jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
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
  v_group record;
  v_group_qty integer;
  v_group_totals jsonb := '{}'::jsonb;
  v_group_id uuid;
  v_pricing_quantity integer;
begin
  if p_pharmacy is null or p_access_link_id is null
    or length(trim(coalesce(p_requester_name,''))) not between 2 and 120
    or lower(trim(coalesce(p_requester_email,''))) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Coordonnees du demandeur invalides' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.private_catalog_access_links l
    where l.id=p_access_link_id and l.pharmacy_id=p_pharmacy
      and l.active and l.expires_at>now()
  ) then
    raise exception 'Lien catalogue non autorise' using errcode='42501';
  end if;
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
  where a.pharmacy_id=p_pharmacy and a.active and b.active and b.slug=p_slug;
  if not found then raise exception 'Marque non autorisee' using errcode='42501'; end if;

  if (select count(*) from public.private_catalog_requests r
    where r.access_link_id=p_access_link_id
      and r.created_at>now()-interval '1 hour')>=20 then
    raise exception 'Trop de demandes. Reessayez plus tard.' using errcode='22023';
  end if;

  for v_group in
    select q.id,q.minimum_total_units,q.quantity_multiple,q.name
    from public.private_catalog_quantity_groups q
    where q.brand_id=v_brand and q.active
  loop
    select coalesce(sum(case
      when jsonb_typeof(x.value->'quantity')='number'
        and (x.value->>'quantity') ~ '^[0-9]{1,5}$'
      then (x.value->>'quantity')::integer else 0 end),0)::integer
    into v_group_qty
    from jsonb_array_elements(p_lines) x
    join public.private_catalog_quantity_group_products gp
      on gp.group_id=v_group.id and gp.product_id::text=x.value->>'product_id';

    if v_group_qty>0 then
      if v_group_qty<v_group.minimum_total_units
        or mod(v_group_qty,v_group.quantity_multiple)<>0 then
        raise exception 'Conditions %: minimum total % unites, par multiples de %',
          v_group.name,v_group.minimum_total_units,v_group.quantity_multiple
          using errcode='22023';
      end if;
      v_group_totals:=v_group_totals||jsonb_build_object(v_group.id::text,v_group_qty);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_item)<>'object'
      or jsonb_typeof(v_item->'product_id')<>'string'
      or jsonb_typeof(v_item->'quantity')<>'number'
      or (v_item->>'quantity') !~ '^[0-9]{1,5}$'
      or coalesce(v_item->>'product_id','') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'Ligne invalide' using errcode='22023';
    end if;
    select * into v_product
    from public.private_catalog_products p
    where p.id=(v_item->>'product_id')::uuid
      and p.brand_id=v_brand and p.active;
    if not found then raise exception 'Reference indisponible' using errcode='22023'; end if;
    if v_product.id=any(v_seen) then
      raise exception 'References en doublon' using errcode='22023';
    end if;
    v_seen:=array_append(v_seen,v_product.id);
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty>5000 or v_qty<v_product.min_quantity
      or mod(v_qty,v_product.quantity_step)<>0 then
      raise exception 'Minimum % unites; commandes par multiples de % unites pour %',
        v_product.min_quantity,v_product.quantity_step,v_product.name
        using errcode='22023';
    end if;

    select gp.group_id into v_group_id
    from public.private_catalog_quantity_group_products gp
    join public.private_catalog_quantity_groups q on q.id=gp.group_id and q.active
    where gp.product_id=v_product.id;
    v_pricing_quantity:=coalesce((v_group_totals->>v_group_id::text)::integer,v_qty);
    v_unit:=null;
    if v_mode='contractual' then
      select t.price_ht into v_unit from (
        select c.min_quantity,c.price_ht
        from public.private_catalog_contract_tiers c
        where c.product_id=v_product.id and c.pharmacy_id=p_pharmacy
        union all
        select v_product.min_quantity,f.price_ht
        from public.private_catalog_prices f
        where f.product_id=v_product.id and f.pharmacy_id=p_pharmacy
          and not exists (
            select 1 from public.private_catalog_contract_tiers c
            where c.product_id=v_product.id and c.pharmacy_id=p_pharmacy
              and c.min_quantity=v_product.min_quantity
          )
      ) t
      where t.min_quantity<=v_pricing_quantity
      order by t.min_quantity desc limit 1;
    end if;
    if v_unit is null then v_firm:=false;
    else v_total:=v_total+v_unit*v_qty; end if;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'product_id',v_product.id,'product_name',v_product.name,
      'sku',v_product.sku,'quantity',v_qty,'vat_rate',v_product.vat_rate,
      'unit_price_ht',v_unit
    ));
  end loop;

  if v_total>100000000 then
    raise exception 'Montant superieur a la limite autorisee' using errcode='22023';
  end if;
  insert into public.private_catalog_requests(
    pharmacy_id,brand_id,created_by,request_kind,total_ht,status,
    requester_name,requester_email,access_link_id
  ) values(
    p_pharmacy,v_brand,null,
    case when v_firm then 'order' else 'quote' end,
    case when v_firm then v_total else null end,'received',
    trim(p_requester_name),lower(trim(p_requester_email)),p_access_link_id
  ) returning id into v_request;

  for v_item in select value from jsonb_array_elements(v_lines) loop
    insert into public.private_catalog_request_items(
      request_id,product_id,product_name,sku,quantity,unit_price_ht,vat_rate,line_total_ht
    ) values(
      v_request,(v_item->>'product_id')::uuid,v_item->>'product_name',
      v_item->>'sku',(v_item->>'quantity')::integer,
      case when v_firm then (v_item->>'unit_price_ht')::numeric else null end,
      (v_item->>'vat_rate')::numeric,
      case when v_firm then
        (v_item->>'unit_price_ht')::numeric*(v_item->>'quantity')::integer else null end
    );
  end loop;

  return jsonb_build_object('id',v_request,'request_kind',
    case when v_firm then 'order' else 'quote' end);
end;
$function$;
revoke all on function private.catalogue_submit_request_for_pharmacy(uuid,uuid,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function private.catalogue_submit_request_for_pharmacy(uuid,uuid,text,text,text,jsonb)
  to service_role;

-- Soumission atomique multimarque et rattachement au lot de franco coreen.
create or replace function public.catalogue_submit_with_korean_franco_for_private_link(
  p_token_hash text,
  p_groups jsonb,
  p_requester_name text,
  p_requester_email text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_pharmacy uuid;
  v_link_id uuid;
  v_group jsonb;
  v_slug text;
  v_lines jsonb;
  v_result jsonb;
  v_request jsonb;
  v_results jsonb := '[]'::jsonb;
  v_seen_slugs text[] := array[]::text[];
  v_line_count integer:=0;
  v_request_id uuid;
  v_batch uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Lien catalogue non autorise' using errcode='42501';
  end if;
  if length(trim(coalesce(p_requester_name,''))) not between 2 and 120
    or lower(trim(coalesce(p_requester_email,''))) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Coordonnees du demandeur invalides' using errcode='22023';
  end if;
  select l.id,l.pharmacy_id into v_link_id,v_pharmacy
  from public.private_catalog_access_links l
  where l.token_hash=p_token_hash and l.active and l.expires_at>now()
  for update;
  if v_link_id is null or v_pharmacy is null then
    raise exception 'Lien catalogue expire ou revoque' using errcode='42501';
  end if;
  if p_groups is null or jsonb_typeof(p_groups)<>'array'
    or jsonb_array_length(p_groups) not between 1 and 20 then
    raise exception 'Selection multimarque invalide' using errcode='22023';
  end if;

  perform private.catalogue_validate_supplier_minimums_for_pharmacy(v_pharmacy,p_groups);

  for v_group in select value from jsonb_array_elements(p_groups) loop
    if jsonb_typeof(v_group)<>'object'
      or jsonb_typeof(v_group->'slug')<>'string'
      or jsonb_typeof(v_group->'lines')<>'array' then
      raise exception 'Groupe fournisseur invalide' using errcode='22023';
    end if;
    v_slug:=v_group->>'slug';
    v_lines:=v_group->'lines';
    if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'Marque invalide' using errcode='22023';
    end if;
    if v_slug=any(v_seen_slugs) then
      raise exception 'Marque en doublon' using errcode='22023';
    end if;
    v_seen_slugs:=array_append(v_seen_slugs,v_slug);
    if jsonb_array_length(v_lines) not between 1 and 40 then
      raise exception 'Selection invalide pour une marque' using errcode='22023';
    end if;
    v_line_count:=v_line_count+jsonb_array_length(v_lines);
    if v_line_count>40 then
      raise exception 'Une demande ne peut pas depasser 40 references' using errcode='22023';
    end if;
    v_result:=private.catalogue_submit_request_for_pharmacy(
      v_pharmacy,v_link_id,p_requester_name,p_requester_email,v_slug,v_lines
    );
    v_results:=v_results||jsonb_build_array(
      jsonb_build_object('brand_slug',v_slug,'request',v_result)
    );
  end loop;

  if exists(
    select 1 from jsonb_array_elements(v_results) r
    where r.value->>'brand_slug' in ('biodance','beauty-of-joseon','dr-althea')
  ) then
    insert into public.private_catalog_shipping_batches(
      pharmacy_id,created_by,access_link_id,threshold_ht,qualifying_total_ht,free_shipping_eligible
    ) values(v_pharmacy,null,v_link_id,250.00,null,null)
    returning id into v_batch;

    for v_request in select value from jsonb_array_elements(v_results) loop
      v_slug:=v_request->>'brand_slug';
      if v_slug in ('biodance','beauty-of-joseon','dr-althea') then
        v_request_id:=(v_request->'request'->>'id')::uuid;
        update public.private_catalog_requests req
          set shipping_batch_id=v_batch
          where req.id=v_request_id and req.pharmacy_id=v_pharmacy
            and req.access_link_id=v_link_id;
        if not found then
          raise exception 'Impossible de rattacher la demande au franco' using errcode='42501';
        end if;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'request_count',jsonb_array_length(v_results),
    'requests',v_results,
    'shipping_batch_id',v_batch,
    'korean_franco_threshold_ht',case when v_batch is not null then 250.00 else null end,
    'shipping_eligibility','pending_final_pricing'
  );
end;
$function$;
revoke all on function public.catalogue_submit_with_korean_franco_for_private_link(text,jsonb,text,text)
  from public,anon,authenticated;
grant execute on function public.catalogue_submit_with_korean_franco_for_private_link(text,jsonb,text,text)
  to service_role;
