
-- Brand installation terms are distinct from assortment status, order permissions and TR1 commissions.
create table public.brand_implantation_offers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null check(length(trim(title)) >= 4),
  offer_kind text not null default 'flexible' check(offer_kind in ('flexible','quantity_tier','fixed_pack')),
  summary text,
  min_distinct_references integer check(min_distinct_references is null or min_distinct_references between 1 and 300),
  min_units_per_reference integer check(min_units_per_reference is null or min_units_per_reference between 1 and 10000),
  free_units_per_reference integer not null default 0 check(free_units_per_reference between 0 and 5000),
  min_total_paid_units integer check(min_total_paid_units is null or min_total_paid_units between 1 and 200000),
  min_order_ht numeric(12,2) check(min_order_ht is null or min_order_ht >= 0),
  fixed_pack_ht numeric(12,2) check(fixed_pack_ht is null or fixed_pack_ht >= 0),
  discount_pct numeric(5,2) check(discount_pct is null or discount_pct between 0 and 100),
  offer_conditions text,
  plv_commitment text,
  training_commitment text,
  shipping_terms text,
  source_reference text,
  confirmation_reference text,
  verification_status text not null default 'draft'
    check(verification_status in('draft','verified')),
  pilot_visible boolean not null default false,
  published boolean not null default false,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_valid_dates check(valid_from is null or valid_until is null or valid_until >= valid_from),
  constraint offer_confirmed_requires_evidence check(verification_status <> 'verified'
    or (source_reference is not null and length(trim(source_reference))>=5
    and confirmation_reference is not null and length(trim(confirmation_reference))>=6)),
  constraint offer_published_requires_verified check(not published or verification_status='verified'),
  constraint offer_fixed_pack_price check(offer_kind='fixed_pack' or fixed_pack_ht is null)
);
create index brand_implantation_offers_brand_idx on public.brand_implantation_offers(brand_id,published,pilot_visible);
create table public.brand_implantation_offer_lines (
  offer_id uuid not null references public.brand_implantation_offers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  paid_units integer not null check(paid_units>=1 and paid_units<=10000),
  free_units integer not null default 0 check(free_units between 0 and 5000),
  line_note text,
  primary key (offer_id,product_id)
);
create or replace function private.validate_brand_implantation_line()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(
   select 1 from public.brand_implantation_offers o
   join public.products p on p.id=new.product_id
   where o.id=new.offer_id and o.brand_id=p.brand_id
 ) then raise exception 'La référence doit appartenir à la marque du pack'; end if;
 return new;
end;
$$;
create trigger check_brand_implantation_line
before insert or update on public.brand_implantation_offer_lines
for each row execute function private.validate_brand_implantation_line();

alter table public.brand_referencing_interests
 add column if not exists offer_id uuid references public.brand_implantation_offers(id) on delete set null;

alter table public.brand_implantation_offers enable row level security;
alter table public.brand_implantation_offer_lines enable row level security;
create policy bio_owner_full on public.brand_implantation_offers
for all to authenticated using(public.tr1_is_owner()) with check(public.tr1_is_owner());
create policy biol_owner_full on public.brand_implantation_offer_lines
for all to authenticated using(public.tr1_is_owner()) with check(public.tr1_is_owner());
revoke all on public.brand_implantation_offers,public.brand_implantation_offer_lines from anon;
grant select,insert,update,delete on public.brand_implantation_offers,public.brand_implantation_offer_lines to authenticated;

-- Only an authenticated pharmacy belonging to its own account sees approved terms or
-- pilot-preview terms for specific brands authorized to that account.
create or replace function private.pharmacy_implantation_offers()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_pharmacy uuid;v_result jsonb;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='pharmacy'
 ) then raise exception 'Compte pharmacie requis';end if;
 select m.pharmacy_id into v_pharmacy
 from public.pharmacy_memberships m
 where m.user_id=(select auth.uid()) and m.active
 order by m.created_at limit 1;
 if v_pharmacy is null then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',o.id,'brand_id',o.brand_id,
   'title',o.title,'offer_kind',o.offer_kind,'summary',o.summary,
   'min_distinct_references',o.min_distinct_references,
   'min_units_per_reference',o.min_units_per_reference,
   'free_units_per_reference',o.free_units_per_reference,
   'min_total_paid_units',o.min_total_paid_units,'min_order_ht',o.min_order_ht,
   'fixed_pack_ht',o.fixed_pack_ht,'discount_pct',o.discount_pct,
   'offer_conditions',o.offer_conditions,'plv_commitment',o.plv_commitment,
   'training_commitment',o.training_commitment,'shipping_terms',o.shipping_terms,
   'verification_status',o.verification_status,
   'valid_until',o.valid_until,
   'lines',coalesce((
     select jsonb_agg(jsonb_build_object(
        'product_name',p.name,'format',p.format,
        'paid_units',l.paid_units,'free_units',l.free_units,'line_note',l.line_note
      ) order by p.name)
     from public.brand_implantation_offer_lines l
     join public.products p on p.id=l.product_id
     where l.offer_id=o.id
       and not exists(select 1 from public.althesia_product_specs s
           where s.product_id=p.id and s.market_status='food_cbd_blocked')
   ),'[]'::jsonb)
 ) order by b.name,o.min_units_per_reference nulls last,o.title),'[]'::jsonb) into v_result
 from public.brand_implantation_offers o
 join public.brands b on b.id=o.brand_id
 join public.brand_discovery_directory d on d.brand_id=b.id and d.discoverable
 left join public.pharmacy_brand_relationships r on r.pharmacy_id=v_pharmacy and r.brand_id=b.id
 left join public.demo_catalogue_access da on da.pharmacy_id=v_pharmacy and da.brand_id=b.id
 where coalesce(r.status,'unconfirmed')<>'implanted'
   and (o.valid_from is null or o.valid_from<=current_date)
   and (o.valid_until is null or o.valid_until>=current_date)
   and ((o.published and o.verification_status='verified')
        or (o.pilot_visible and coalesce(da.active,false)))
   and not exists(
     select 1 from public.brand_implantation_offer_lines l
     join public.althesia_product_specs s on s.product_id=l.product_id
     where l.offer_id=o.id and s.market_status='food_cbd_blocked'
   );
 return v_result;
end;
$$;
revoke all on function private.pharmacy_implantation_offers() from public,anon;
grant execute on function private.pharmacy_implantation_offers() to authenticated;
create or replace function public.pharmacy_implantation_offers()
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.pharmacy_implantation_offers();
$$;
revoke all on function public.pharmacy_implantation_offers() from public,anon;
grant execute on function public.pharmacy_implantation_offers() to authenticated;

-- Record a pack preference as an agent lead, never as a supplier order.
create or replace function private.request_brand_implantation_offer(
  p_offer_id uuid,p_note text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_pharmacy uuid;v_brand uuid;v_offer boolean;v_interest uuid;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='pharmacy'
 ) then raise exception 'Compte pharmacie requis';end if;
 if length(coalesce(p_note,''))>800 then raise exception 'Message trop long';end if;
 select m.pharmacy_id into v_pharmacy
 from public.pharmacy_memberships m where m.user_id=(select auth.uid()) and m.active
 order by m.created_at limit 1;
 if v_pharmacy is null then raise exception 'Pharmacie non rattachée';end if;
 select o.brand_id into v_brand from public.brand_implantation_offers o where o.id=p_offer_id;
 if v_brand is null then raise exception 'Offre non trouvée';end if;
 select exists(
  select 1 from jsonb_array_elements(private.pharmacy_implantation_offers()) j
  where (j->>'id')::uuid=p_offer_id
 ) into v_offer;
 if not v_offer then raise exception 'Offre non autorisée';end if;
 insert into public.brand_referencing_interests(pharmacy_id,brand_id,requested_by,offer_id,note)
 values(v_pharmacy,v_brand,(select auth.uid()),p_offer_id,nullif(trim(coalesce(p_note,'')),''))
 on conflict(pharmacy_id,brand_id)
 do update set offer_id=excluded.offer_id,note=excluded.note,status='received',updated_at=now()
 returning id into v_interest;
 return v_interest;
end;
$$;
revoke all on function private.request_brand_implantation_offer(uuid,text) from public,anon;
grant execute on function private.request_brand_implantation_offer(uuid,text) to authenticated;
create or replace function public.request_brand_implantation_offer(
 p_offer_id uuid,p_note text default null
) returns uuid language sql security invoker set search_path='' as $$
 select private.request_brand_implantation_offer(p_offer_id,p_note);
$$;
revoke all on function public.request_brand_implantation_offer(uuid,text) from public,anon;
grant execute on function public.request_brand_implantation_offer(uuid,text) to authenticated;
