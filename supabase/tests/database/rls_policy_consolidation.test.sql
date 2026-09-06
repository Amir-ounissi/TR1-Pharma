begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

select plan(7);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname='public'
      and tablename in ('access_requests','brand_settings','brands','organizations','performance_objectives')
      and cmd='SELECT'
      and permissive='PERMISSIVE'
      and 'authenticated' = any(roles)
  ),
  5::bigint,
  'each cleaned table has exactly one authenticated permissive SELECT policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname='public'
      and tablename='access_requests'
      and cmd='SELECT'
      and permissive='PERMISSIVE'
      and 'authenticated' = any(roles)
  ),
  1::bigint,
  'access requests use one authenticated SELECT policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname='public'
      and tablename='brands'
      and cmd='SELECT'
      and permissive='PERMISSIVE'
      and 'authenticated' = any(roles)
  ),
  1::bigint,
  'brands use one authenticated SELECT policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname='public'
      and tablename='organizations'
      and cmd='SELECT'
      and permissive='PERMISSIVE'
      and 'authenticated' = any(roles)
  ),
  1::bigint,
  'organizations use one authenticated SELECT policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname='public'
      and tablename='brand_settings'
      and cmd='SELECT'
      and permissive='PERMISSIVE'
      and 'authenticated' = any(roles)
  ),
  1::bigint,
  'brand settings use one authenticated SELECT policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname='public'
      and tablename='performance_objectives'
      and cmd='SELECT'
      and permissive='PERMISSIVE'
      and 'authenticated' = any(roles)
  ),
  1::bigint,
  'performance objectives use one authenticated SELECT policy'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname='public'
      and (
        (tablename='access_requests' and policyname in ('access_requests_insert_platform','access_requests_update_platform','access_requests_delete_platform'))
        or (tablename='performance_objectives' and policyname in ('performance_objectives_insert_manage','performance_objectives_update_manage','performance_objectives_delete_manage'))
      )
      and 'authenticated' = any(roles)
  ),
  6::bigint,
  'management permissions remain explicitly represented by non-SELECT policies'
);

select * from finish();
rollback;
