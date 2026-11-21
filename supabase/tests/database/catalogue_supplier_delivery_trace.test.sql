begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(9);

select ok(
 not has_table_privilege('anon','public.private_catalog_supplier_contacts','SELECT'),
 'anonymous users cannot inspect laboratory contacts'
);
select ok(
 not has_table_privilege('anon','public.private_catalog_supplier_contacts','INSERT'),
 'anonymous users cannot create laboratory contacts'
);
select ok(
 not has_table_privilege('anon','public.private_catalog_shipping_events','SELECT'),
 'anonymous users cannot inspect shipping evidence'
);
select ok(
 not has_function_privilege('anon',
  'public.catalogue_admin_record_supplier_delivery(uuid,text,text,text,date)','EXECUTE'),
 'anonymous users cannot complete a delivery'
);
select ok(
 has_function_privilege('authenticated',
  'public.catalogue_admin_record_supplier_delivery(uuid,text,text,text,date)','EXECUTE'),
 'authenticated agent may invoke the admin-guarded delivery RPC'
);
select ok(
 (select relrowsecurity from pg_class
  where oid='public.private_catalog_supplier_contacts'::regclass),
 'laboratory contacts are row-level secured'
);
select ok(
 (select relrowsecurity from pg_class
  where oid='public.private_catalog_shipping_events'::regclass),
 'shipping evidence is row-level secured'
);
select has_column('public','private_catalog_supplier_fulfillment','delivered_at',
 'delivery confirmation field exists');

set local role authenticated;
select set_config('request.jwt.claim.sub','acb00000-0000-4000-8000-000000000000',true);
select throws_ok(
 $case$select public.catalogue_admin_record_supplier_delivery(
   'acb00000-0000-4000-8000-000000000001'::uuid,
   'shipped','BORDEREAU-01234',null,null)$case$,
 '42501',null,'non-admin users cannot mark a shipment delivered'
);
reset role;

select * from finish();
rollback;
