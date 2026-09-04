begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

create temp table benchmark_brands (
  sequence integer primary key,
  organization_id uuid not null,
  brand_id uuid not null
) on commit drop;

create temp table benchmark_pharmacies (
  sequence integer primary key,
  pharmacy_id uuid not null,
  brand_id uuid not null,
  organization_id uuid not null,
  brand_pharmacy_id uuid
) on commit drop;

do $$
declare
  tenant_sequence integer;
  benchmark_organization_id uuid;
  benchmark_brand_id uuid;
begin
  for tenant_sequence in 1..4 loop
    insert into public.organizations(name,slug,legal_name,trade_name,status)
    values(
      'Benchmark tenant ' || tenant_sequence,
      'benchmark-tenant-' || tenant_sequence || '-' || txid_current(),
      'Benchmark tenant ' || tenant_sequence,
      'Benchmark tenant ' || tenant_sequence,
      'active'
    )
    returning id into benchmark_organization_id;

    insert into public.brands(
      organization_id,managed_by_organization_id,name,slug,code,is_active,status,activated_at
    )
    values(
      benchmark_organization_id,
      benchmark_organization_id,
      'Benchmark brand ' || tenant_sequence,
      'benchmark-brand-' || tenant_sequence || '-' || txid_current(),
      'BENCH_' || tenant_sequence || '_' || txid_current(),
      true,
      'active',
      now()
    )
    returning id into benchmark_brand_id;

    insert into benchmark_brands values(
      tenant_sequence,
      benchmark_organization_id,
      benchmark_brand_id
    );
  end loop;
end;
$$;

with inserted as (
  insert into public.pharmacies(
    legal_name,trade_name,address_line_1,postal_code,city,country_code,external_id
  )
  select
    'Pharmacie benchmark ' || source.sequence,
    'Pharmacie benchmark ' || source.sequence,
    source.sequence || ' rue du benchmark',
    lpad((source.sequence % 99999)::text,5,'0'),
    'Ville ' || (source.sequence % 200),
    'FR',
    'BENCH-PH-' || txid_current() || '-' || source.sequence
  from generate_series(1,4000) source(sequence)
  returning id,external_id
)
insert into benchmark_pharmacies(sequence,pharmacy_id,brand_id,organization_id)
select
  split_part(inserted.external_id,'-',4)::integer,
  inserted.id,
  benchmark_brands.brand_id,
  benchmark_brands.organization_id
from inserted
join benchmark_brands
  on benchmark_brands.sequence = 1 + ((split_part(inserted.external_id,'-',4)::integer - 1) % 4);

with inserted as (
  insert into public.brand_pharmacies(
    brand_id,pharmacy_id,commercial_status,activity_status,priority_level,potential_level,source,external_id
  )
  select
    brand_id,
    pharmacy_id,
    'active',
    'active',
    case when sequence % 10 = 0 then 'strategic'::public.priority_level else 'normal'::public.priority_level end,
    'high',
    'import',
    'BENCH-REL-' || txid_current() || '-' || sequence
  from benchmark_pharmacies
  returning id,external_id
)
update benchmark_pharmacies benchmark
set brand_pharmacy_id = inserted.id
from inserted
where benchmark.sequence = split_part(inserted.external_id,'-',4)::integer;

insert into public.orders(
  organization_id,brand_id,pharmacy_id,brand_pharmacy_id,created_by,order_status,
  order_date,total_ttc,external_order_id,order_type,source,subtotal_ht,net_amount_ht
)
select
  benchmark.organization_id,
  benchmark.brand_id,
  benchmark.pharmacy_id,
  benchmark.brand_pharmacy_id,
  seed_user.id,
  'confirmed',
  now() - make_interval(days => benchmark.sequence % 180),
  120,
  'BENCH-ORDER-' || txid_current() || '-' || benchmark.sequence,
  'other',
  'import',
  100,
  100
from benchmark_pharmacies benchmark
cross join lateral (select id from public.users order by created_at limit 1) seed_user;

insert into public.missions(
  organization_id,brand_id,pharmacy_id,brand_pharmacy_id,title,objective,status,
  mission_type,scheduled_start_at,scheduled_end_at,
  managed_by,created_by,source,cost_actual_ht
)
select
  benchmark.organization_id,
  benchmark.brand_id,
  benchmark.pharmacy_id,
  benchmark.brand_pharmacy_id,
  'Mission benchmark ' || benchmark.sequence,
  'Mesurer la performance',
  'requested',
  'animation',
  now() - make_interval(days => 30 + benchmark.sequence % 180),
  now() - make_interval(days => 30 + benchmark.sequence % 180) + interval '2 hours',
  seed_user.id,
  seed_user.id,
  'import',
  80
from benchmark_pharmacies benchmark
cross join lateral (select id from public.users order by created_at limit 1) seed_user;

analyze public.pharmacies;
analyze public.brand_pharmacies;
analyze public.orders;
analyze public.missions;

select is((select count(*) from benchmark_brands),4::bigint,'benchmark uses four isolated tenants');
select is((select count(*) from benchmark_pharmacies),4000::bigint,'benchmark loads four thousand pharmacies');
select is((select count(*) from public.orders where external_order_id like 'BENCH-ORDER-' || txid_current() || '-%'),4000::bigint,'benchmark loads four thousand orders');
select is((select count(*) from public.missions where title like 'Mission benchmark %' and created_at >= transaction_timestamp()),4000::bigint,'benchmark loads four thousand missions');

do $$
declare
  started_at timestamptz;
  commercial_duration_ms numeric;
  mission_duration_ms numeric;
  priority_duration_ms numeric;
  benchmark_brand_id uuid;
  result_count bigint;
begin
  select brand_id into benchmark_brand_id from benchmark_brands where sequence=1;

  started_at := clock_timestamp();
  select count(*) into result_count
  from public.commercial_account_health
  where brand_id=benchmark_brand_id;
  commercial_duration_ms := extract(epoch from clock_timestamp()-started_at)*1000;

  started_at := clock_timestamp();
  select count(*) into result_count
  from public.mission_impact
  where brand_id=benchmark_brand_id;
  mission_duration_ms := extract(epoch from clock_timestamp()-started_at)*1000;

  started_at := clock_timestamp();
  select count(*) into result_count
  from public.commercial_account_health
  where brand_id=benchmark_brand_id
    and health_status in ('reorder_overdue','at_risk','dormant');
  priority_duration_ms := extract(epoch from clock_timestamp()-started_at)*1000;

  perform diag(format(
    'SPRINT11_SQL_BENCHMARK commercial_ms=%s mission_ms=%s priorities_ms=%s',
    round(commercial_duration_ms,2),
    round(mission_duration_ms,2),
    round(priority_duration_ms,2)
  ));
  raise notice 'SPRINT11_SQL_BENCHMARK commercial_ms=% mission_ms=% priorities_ms=%',
    round(commercial_duration_ms,2),
    round(mission_duration_ms,2),
    round(priority_duration_ms,2);

  if commercial_duration_ms > 10000 or mission_duration_ms > 10000 or priority_duration_ms > 10000 then
    raise exception 'Sprint 11 SQL benchmark exceeded 10 seconds';
  end if;
end;
$$;

select pass('manager queries complete without timeout');
select * from finish();
rollback;
