create schema if not exists private;

create table public.public_catalogue_leads (
  id uuid primary key default gen_random_uuid(),
  pharmacy_name text not null check (length(trim(pharmacy_name)) between 2 and 180),
  contact_name text not null check (length(trim(contact_name)) between 2 and 120),
  email text not null check (length(trim(email)) between 5 and 254),
  phone text,
  city text not null check (length(trim(city)) between 2 and 120),
  postal_code text,
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  note text,
  matched_pharmacy_id uuid references public.pharmacies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  source text not null default 'public_catalogue',
  created_at timestamptz not null default now()
);

create table public.public_catalogue_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.public_catalogue_leads(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete restrict,
  status text not null default 'received'
    check (status in ('received','verifying','forwarded','confirmed','closed','declined')),
  total_ht numeric(12,2) not null default 0 check (total_ht >= 0),
  admin_note text,
  forwarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.public_catalogue_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.public_catalogue_requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete restrict,
  product_name text not null,
  brand_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0 and quantity <= 5000),
  unit_price_ht numeric(12,2) not null check (unit_price_ht >= 0),
  line_total_ht numeric(12,2) not null check (line_total_ht >= 0),
  vat_rate numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),
  created_at timestamptz not null default now(),
  unique (request_id, product_id)
);

create index public_catalogue_leads_email_created_idx on public.public_catalogue_leads (lower(email), created_at desc);
create index public_catalogue_leads_siret_idx on public.public_catalogue_leads (siret) where siret is not null;
create index public_catalogue_requests_status_created_idx on public.public_catalogue_requests (status, created_at desc);
create index public_catalogue_requests_lead_idx on public.public_catalogue_requests (lead_id);
create index public_catalogue_request_items_request_idx on public.public_catalogue_request_items (request_id);

alter table public.public_catalogue_leads enable row level security;
alter table public.public_catalogue_requests enable row level security;
alter table public.public_catalogue_request_items enable row level security;

revoke all on public.public_catalogue_leads, public.public_catalogue_requests, public.public_catalogue_request_items from anon, authenticated;
grant select, update on public.public_catalogue_leads to authenticated;
grant select, update on public.public_catalogue_requests to authenticated;
grant select on public.public_catalogue_request_items to authenticated;

create policy public_catalogue_leads_owner_read on public.public_catalogue_leads
for select to authenticated using (public.tr1_is_owner());
create policy public_catalogue_leads_owner_update on public.public_catalogue_leads
for update to authenticated using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy public_catalogue_requests_owner_read on public.public_catalogue_requests
for select to authenticated using (public.tr1_is_owner());
create policy public_catalogue_requests_owner_update on public.public_catalogue_requests
for update to authenticated using (public.tr1_is_owner()) with check (public.tr1_is_owner());
create policy public_catalogue_request_items_owner_read on public.public_catalogue_request_items
for select to authenticated using (public.tr1_is_owner());

create or replace function private.public_catalogue_data()
returns jsonb language sql stable security definer set search_path = ''
as $function$
with eligible as (
  select p.id, p.brand_id, b.name as brand_name, b.slug as brand_slug,
    p.name, p.sku, p.ean, p.description, p.format, p.category, p.image_url,
    p.price_ht, p.vat_rate, p.min_qty, p.qty_step, p.benefits, p.actives,
    p.inci, p.usage_advice, p.precautions, s.source_retail_ttc as retail_ttc
  from public.products p
  join public.brands b on b.id = p.brand_id
  left join public.althesia_product_specs s on s.product_id = p.id
  where b.active and p.published and not p.requires_review and p.price_verified
    and p.price_ht > 0 and p.fr_market_checked and p.fr_label_checked
    and nullif(trim(p.fr_market_document), '') is not null
    and nullif(trim(p.ean), '') is not null
    and nullif(trim(p.description), '') is not null
    and length(trim(p.description)) >= 10
    and p.image_url ~ '^https://'
    and coalesce(p.source_active, true)
    and (s.product_id is null or s.market_status = 'verified')
    and not exists (
      select 1 from public.product_discontinuations d
      where d.brand_id = p.brand_id and d.ean = p.ean
    )
),
brand_rows as (
  select jsonb_agg(jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug,
    'short_description', d.short_description, 'catalogue_note', d.catalogue_note,
    'terms', case when t.verified then jsonb_build_object(
      'minimum_order_units', t.minimum_order_units,
      'minimum_order_ht', t.minimum_order_ht,
      'shipping_fee_ht', t.shipping_fee_ht,
      'free_shipping_from_ht', t.free_shipping_from_ht
    ) else null end,
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'title', o.title, 'offer_kind', o.offer_kind, 'summary', o.summary,
        'min_distinct_references', o.min_distinct_references,
        'min_units_per_reference', o.min_units_per_reference,
        'free_units_per_reference', o.free_units_per_reference,
        'min_total_paid_units', o.min_total_paid_units,
        'min_order_ht', o.min_order_ht, 'fixed_pack_ht', o.fixed_pack_ht,
        'discount_pct', o.discount_pct, 'offer_conditions', o.offer_conditions,
        'plv_commitment', o.plv_commitment, 'training_commitment', o.training_commitment,
        'shipping_terms', o.shipping_terms, 'valid_from', o.valid_from, 'valid_until', o.valid_until,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_id', p.id, 'product_name', p.name,
            'paid_units', l.paid_units, 'free_units', l.free_units, 'line_note', l.line_note
          ) order by p.name)
          from public.brand_implantation_offer_lines l
          join public.products p on p.id = l.product_id
          where l.offer_id = o.id
        ), '[]'::jsonb)
      ) order by o.title)
      from public.brand_implantation_offers o
      where o.brand_id = b.id and o.published and o.verification_status = 'verified'
        and (o.valid_from is null or o.valid_from <= current_date)
        and (o.valid_until is null or o.valid_until >= current_date)
        and not exists (
          select 1 from public.brand_implantation_offer_lines l
          left join eligible e on e.id = l.product_id
          where l.offer_id = o.id and e.id is null
        )
    ), '[]'::jsonb)
  ) order by b.name) as value
  from public.brands b
  left join public.brand_discovery_directory d on d.brand_id = b.id
  left join public.brand_trade_terms t on t.brand_id = b.id
  where b.active and exists (select 1 from eligible e where e.brand_id = b.id)
),
product_rows as (
  select jsonb_agg(jsonb_build_object(
    'id', e.id, 'brand_id', e.brand_id, 'brand', e.brand_name, 'brand_slug', e.brand_slug,
    'name', e.name, 'sku', e.sku, 'ean', e.ean, 'description', e.description,
    'format', e.format, 'category', e.category, 'image_url', e.image_url,
    'price_ht', e.price_ht, 'vat_rate', e.vat_rate, 'min_qty', e.min_qty, 'qty_step', e.qty_step,
    'benefits', e.benefits, 'actives', e.actives, 'inci', e.inci,
    'usage_advice', e.usage_advice, 'precautions', e.precautions, 'retail_ttc', e.retail_ttc,
    'tiers', coalesce((
      select jsonb_agg(jsonb_build_object('min_qty', q.min_qty, 'price_ht', q.price_ht) order by q.min_qty)
      from public.product_quantity_tiers q where q.product_id = e.id and q.verified
    ), '[]'::jsonb)
  ) order by e.brand_name, e.name) as value
  from eligible e
)
select jsonb_build_object(
  'brands', coalesce((select value from brand_rows), '[]'::jsonb),
  'products', coalesce((select value from product_rows), '[]'::jsonb)
);
$function$;

revoke all on function private.public_catalogue_data() from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.public_catalogue_data() to anon, authenticated;

create or replace function public.public_catalogue_data()
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.public_catalogue_data(); $function$;
revoke all on function public.public_catalogue_data() from public;
grant execute on function public.public_catalogue_data() to anon, authenticated;

create or replace function private.submit_public_catalogue_request(
  p_contact_name text, p_pharmacy_name text, p_email text, p_phone text,
  p_city text, p_postal_code text, p_siret text, p_note text,
  p_items jsonb, p_honeypot text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_lead_id uuid;
  v_matched_pharmacy_id uuid;
  v_item_count integer;
  v_unique_count integer;
  v_brand record;
  v_request_id uuid;
  v_item record;
  v_recent_count integer;
  v_siret text := nullif(trim(coalesce(p_siret, '')), '');
begin
  if nullif(trim(coalesce(p_honeypot, '')), '') is not null then raise exception 'Demande invalide'; end if;
  if length(trim(coalesce(p_contact_name, ''))) not between 2 and 120
     or length(trim(coalesce(p_pharmacy_name, ''))) not between 2 and 180
     or length(trim(coalesce(p_city, ''))) not between 2 and 120 then
    raise exception 'Coordonnées professionnelles incomplètes';
  end if;
  if length(trim(coalesce(p_email, ''))) not between 5 and 254
     or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if length(coalesce(p_phone, '')) > 30 or length(coalesce(p_postal_code, '')) > 12
     or length(coalesce(p_siret, '')) > 14
     or (v_siret is not null and v_siret !~ '^[0-9]{14}$')
     or length(coalesce(p_note, '')) > 1500 then
    raise exception 'Coordonnées invalides';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Panier vide ou trop volumineux';
  end if;
  select count(*)::integer, count(distinct x.product_id)::integer
    into v_item_count, v_unique_count
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer);
  if v_item_count <> jsonb_array_length(p_items) or v_unique_count <> v_item_count then
    raise exception 'Panier invalide ou références en double';
  end if;
  if auth.uid() is not null and not exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('owner','pharmacy')
  ) then raise exception 'Compte non autorisé'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    left join public.products p on p.id = x.product_id
    left join public.brands b on b.id = p.brand_id
    left join public.althesia_product_specs s on s.product_id = p.id
    where p.id is null or x.quantity is null
      or x.quantity < p.min_qty or x.quantity > 5000
      or mod(x.quantity - p.min_qty, p.qty_step) <> 0
      or not p.published or p.requires_review or not p.price_verified or p.price_ht <= 0
      or not p.fr_market_checked or not p.fr_label_checked
      or nullif(trim(p.fr_market_document), '') is null
      or nullif(trim(p.ean), '') is null
      or nullif(trim(p.description), '') is null
      or length(trim(p.description)) < 10
      or p.image_url is null or p.image_url !~ '^https://'
      or not coalesce(p.source_active, true) or not coalesce(b.active, false)
      or (s.product_id is not null and s.market_status <> 'verified')
      or exists (
        select 1 from public.product_discontinuations d
        where d.brand_id = p.brand_id and d.ean = p.ean
      )
  ) then
    raise exception 'Une référence n’est plus disponible dans le catalogue public ou ses conditions ont changé';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_email)), 0));
  select count(*)::integer into v_recent_count
  from public.public_catalogue_leads l
  where lower(l.email) = lower(trim(p_email))
    and l.created_at > now() - interval '15 minutes';
  if v_recent_count >= 3 then raise exception 'Trop de demandes récentes pour cette adresse e-mail'; end if;

  if v_siret is not null then
    select ph.id into v_matched_pharmacy_id from public.pharmacies ph where ph.siret = v_siret limit 1;
  end if;

  insert into public.public_catalogue_leads (
    pharmacy_name, contact_name, email, phone, city, postal_code, siret,
    note, matched_pharmacy_id, created_by
  ) values (
    trim(p_pharmacy_name), trim(p_contact_name), lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''), trim(p_city),
    nullif(trim(coalesce(p_postal_code, '')), ''), v_siret,
    nullif(trim(coalesce(p_note, '')), ''), v_matched_pharmacy_id, auth.uid()
  ) returning id into v_lead_id;

  for v_brand in
    select b.id as brand_id, round(sum(x.quantity * coalesce(tier.price_ht, p.price_ht)), 2) as total_ht
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    join public.products p on p.id = x.product_id
    join public.brands b on b.id = p.brand_id
    left join lateral (
      select q.price_ht from public.product_quantity_tiers q
      where q.product_id = p.id and q.verified and q.min_qty <= x.quantity
      order by q.min_qty desc limit 1
    ) tier on true
    group by b.id order by b.id
  loop
    insert into public.public_catalogue_requests (lead_id, brand_id, total_ht)
    values (v_lead_id, v_brand.brand_id, v_brand.total_ht)
    returning id into v_request_id;

    for v_item in
      select p.id as product_id, b.id as brand_id, p.name as product_name,
        b.name as brand_name, p.sku, x.quantity,
        coalesce(tier.price_ht, p.price_ht) as unit_price_ht, p.vat_rate
      from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
      join public.products p on p.id = x.product_id
      join public.brands b on b.id = p.brand_id
      left join lateral (
        select q.price_ht from public.product_quantity_tiers q
        where q.product_id = p.id and q.verified and q.min_qty <= x.quantity
        order by q.min_qty desc limit 1
      ) tier on true
      where b.id = v_brand.brand_id
    loop
      insert into public.public_catalogue_request_items (
        request_id, product_id, brand_id, product_name, brand_name, sku,
        quantity, unit_price_ht, line_total_ht, vat_rate
      ) values (
        v_request_id, v_item.product_id, v_item.brand_id, v_item.product_name,
        v_item.brand_name, v_item.sku, v_item.quantity, v_item.unit_price_ht,
        round(v_item.quantity * v_item.unit_price_ht, 2), v_item.vat_rate
      );
    end loop;
  end loop;
  return v_lead_id;
end;
$function$;

revoke all on function private.submit_public_catalogue_request(text,text,text,text,text,text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function private.submit_public_catalogue_request(text,text,text,text,text,text,text,text,jsonb,text) to anon, authenticated;

create or replace function public.submit_public_catalogue_request(
  p_contact_name text, p_pharmacy_name text, p_email text, p_phone text,
  p_city text, p_postal_code text, p_siret text, p_note text,
  p_items jsonb, p_honeypot text default null
)
returns uuid language sql security invoker set search_path = ''
as $function$
  select private.submit_public_catalogue_request(
    p_contact_name, p_pharmacy_name, p_email, p_phone, p_city,
    p_postal_code, p_siret, p_note, p_items, p_honeypot
  );
$function$;
revoke all on function public.submit_public_catalogue_request(text,text,text,text,text,text,text,text,jsonb,text) from public;
grant execute on function public.submit_public_catalogue_request(text,text,text,text,text,text,text,text,jsonb,text) to anon, authenticated;
