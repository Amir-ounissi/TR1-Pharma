begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(63);

select has_table('public','brand_onboarding_sessions','onboarding sessions exist');
select has_table('public','import_mutations','import mutations exist');
select has_table('public','import_templates','import templates exist');
select has_table('public','onboarding_audit_logs','onboarding audit exists');
select has_column('public','organizations','legal_name','organizations expose a legal name');
select has_column('public','brands','code','brands expose an internal code');
select has_column('public','import_batches','lifecycle_status','import jobs expose a lifecycle');
select has_column('public','import_rows','deduplication_key','import rows expose a stable deduplication key');
select has_column('public','memberships','territory_id','imported users can be attached to a territory');
select has_column('public','territories','manager_user_id','territories can reference their manager');
select has_index('public','import_batches','import_batches_tenant_status_idx','tenant job lookup is indexed');
select has_index('public','import_rows','import_rows_batch_status_idx','job row lookup is indexed');
select has_index('public','brand_pharmacies','brand_pharmacies_external_id_unique','brand pharmacy external ids are tenant scoped');
select has_function('public','create_brand_onboarding',array['jsonb','jsonb'],'onboarding creation RPC exists');
select has_function('public','execute_onboarding_import',array['uuid'],'transactional import RPC exists');
select has_function('public','rollback_onboarding_import',array['uuid'],'controlled rollback RPC exists');
select has_function('public','activate_onboarded_brand',array['uuid'],'explicit activation RPC exists');
select ok((select prosecdef from pg_proc where oid='public.execute_onboarding_import(uuid)'::regprocedure),'import execution is security definer');
select is((select proconfig[1] from pg_proc where oid='public.execute_onboarding_import(uuid)'::regprocedure),'search_path=""','security definer search path is pinned');
select is((select count(*) from storage.buckets where id='onboarding-imports'),1::bigint,'private import bucket exists');
select is((select public from storage.buckets where id='onboarding-imports'),false,'import bucket is not public');
select is((select file_size_limit from storage.buckets where id='onboarding-imports'),5242880::bigint,'import bucket is limited to five MiB');
select ok((select 'text/csv'=any(allowed_mime_types) from storage.buckets where id='onboarding-imports'),'CSV MIME type is allowed');
select is((select count(*) from public.import_templates where is_active),5::bigint,'five import templates are available');
select is((select count(*) from public.import_templates where import_type='users' and csv_header like 'email;%'),1::bigint,'user template starts with email');

insert into public.brand_onboarding_sessions(
  id,organization_id,brand_id,status,current_step,step_statuses,created_by
) values (
  '11000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  'in_progress','products',
  '{"organization":"completed","brand":"completed","settings":"completed","products":"not_started","pharmacies":"not_started","territories":"not_started","users":"not_started","orders":"not_started","verification":"not_started","activation":"not_started"}',
  '00000000-0000-0000-0000-0000000000a1'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select is((select count(*) from public.brand_onboarding_sessions),1::bigint,'brand admin reads its onboarding');
select is((select count(*) from public.brand_onboarding_sessions where brand_id='00000000-0000-0000-0000-000000000102'),0::bigint,'brand admin reads no other tenant onboarding');
select is((select count(*) from public.import_batches where brand_id='00000000-0000-0000-0000-000000000102'),0::bigint,'brand admin reads no other tenant import job');
select throws_ok(
  $$insert into public.import_batches(brand_id,entity_type,strategy,file_name,created_by,organization_id)
    values('00000000-0000-0000-0000-000000000102','products','create_only','forbidden.csv','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000003')$$,
  '42501',null,'brand admin cannot forge another brand id'
);
select lives_ok(
  $$insert into storage.objects(bucket_id,name,owner_id)
    values('onboarding-imports','00000000-0000-0000-0000-000000000101/job/source.csv','00000000-0000-0000-0000-0000000000a2')$$,
  'brand admin can stage a private file in its brand path'
);
select throws_ok(
  $$insert into storage.objects(bucket_id,name,owner_id)
    values('onboarding-imports','00000000-0000-0000-0000-000000000102/job/source.csv','00000000-0000-0000-0000-0000000000a2')$$,
  '42501',null,'brand admin cannot replace the path with another tenant'
);
select throws_ok(
  $$delete from storage.objects where bucket_id='onboarding-imports' and name='00000000-0000-0000-0000-000000000101/job/source.csv'$$,
  '42501',null,'brand admin cannot delete source evidence'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',true);
select is((select count(*) from public.brand_onboarding_sessions),0::bigint,'other brand admin sees no onboarding');
select is((select count(*) from public.import_rows),0::bigint,'other brand admin sees no staged rows');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is((select count(*) from public.brand_onboarding_sessions),0::bigint,'agent cannot access onboarding');
select is((select count(*) from public.import_batches),0::bigint,'agent cannot access import jobs');
select throws_ok(
  $$insert into public.import_batches(brand_id,entity_type,strategy,file_name,created_by)
    values('00000000-0000-0000-0000-000000000101','products','create_only','agent.csv','00000000-0000-0000-0000-0000000000a3')$$,
  '42501',null,'agent cannot create an import job'
);
select throws_ok(
  $$insert into storage.objects(bucket_id,name,owner_id)
    values('onboarding-imports','00000000-0000-0000-0000-000000000101/agent/source.csv','00000000-0000-0000-0000-0000000000a3')$$,
  '42501',null,'agent cannot upload an onboarding file'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
insert into public.import_batches(
  id,brand_id,entity_type,strategy,file_name,valid_rows,total_rows,created_by,
  lifecycle_status,import_mode,status
) values (
  '11000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101',
  'products','create_only','products-s11.csv',1,1,'00000000-0000-0000-0000-0000000000a2',
  'ready','create_only','preview'
);
insert into public.import_rows(batch_id,line_number,payload,normalized_payload,is_valid,status,deduplication_key)
values(
  '11000000-0000-0000-0000-000000000101',2,'{}',
  '{"sku":"S11-PROD","name":"Produit Sprint 11","description":"Référence onboarding","category":"Test","product_family":"Soin","format":"50 ml","wholesale_price_ht":25,"retail_price_ttc":39.9,"tax_rate":5.5,"units_per_case":6,"minimum_order_quantity":2,"strategic_priority":"strategic","counts_for_distribution":true,"is_active":true}',
  true,'valid','product:s11-prod'
);
select is((select processed from public.execute_onboarding_import('11000000-0000-0000-0000-000000000101')),1,'product import processes one row');
select is((select count(*) from public.products where brand_id='00000000-0000-0000-0000-000000000101' and sku='S11-PROD'),1::bigint,'product import creates the canonical product');
select is((select tax_rate from public.products where brand_id='00000000-0000-0000-0000-000000000101' and sku='S11-PROD'),5.5::numeric,'product import stores configurable VAT');
select is((select units_per_case from public.products where brand_id='00000000-0000-0000-0000-000000000101' and sku='S11-PROD'),6,'product import stores packaging');
select is((select minimum_order_quantity from public.products where brand_id='00000000-0000-0000-0000-000000000101' and sku='S11-PROD'),2,'product import stores MOQ');
select is((select count(*) from public.import_batches where id='11000000-0000-0000-0000-000000000101' and lifecycle_status='completed' and status='confirmed'),1::bigint,'completed job is finalized');
select is((select count(*) from public.import_mutations where import_batch_id='11000000-0000-0000-0000-000000000101' and target_table='products'),1::bigint,'created product is journalized for rollback');
select throws_ok(
  $$select public.execute_onboarding_import('11000000-0000-0000-0000-000000000101')$$,
  '23514','Import must be ready and contain no invalid row','double execution is impossible'
);

insert into public.import_batches(
  id,brand_id,entity_type,strategy,file_name,valid_rows,total_rows,created_by,
  lifecycle_status,import_mode,status
) values (
  '11000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000101',
  'pharmacies','create_only','pharmacies-s11.csv',1,1,'00000000-0000-0000-0000-0000000000a2',
  'ready','create_only','preview'
);
insert into public.import_rows(batch_id,line_number,payload,normalized_payload,is_valid,status,deduplication_key)
values(
  '11000000-0000-0000-0000-000000000102',2,'{}',
  '{"external_id":"S11-PHA","pharmacy_name":"Pharmacie Sprint 11","address_line_1":"11 rue du Test","postal_code":"75011","city":"Paris","country":"FR","territory_code":"75-C","potential":"high","strategic":true}',
  true,'valid','pharmacy:s11-pha'
);
select is((select processed from public.execute_onboarding_import('11000000-0000-0000-0000-000000000102')),1,'pharmacy import processes one row');
select is((select count(*) from public.brand_pharmacies where brand_id='00000000-0000-0000-0000-000000000101' and external_id='S11-PHA' and territory_id='00000000-0000-0000-0000-000000000201'),1::bigint,'pharmacy import attaches tenant external id and territory');

insert into public.import_batches(
  id,brand_id,entity_type,strategy,file_name,valid_rows,total_rows,created_by,
  lifecycle_status,import_mode,status
) values (
  '11000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000101',
  'orders','create_only','orders-s11.csv',1,1,'00000000-0000-0000-0000-0000000000a2',
  'ready','append_only','preview'
);
insert into public.import_rows(batch_id,line_number,payload,normalized_payload,is_valid,status,deduplication_key)
values(
  '11000000-0000-0000-0000-000000000103',2,'{}',
  '{"external_order_id":"S11-ORDER","pharmacy_external_id":"S11-PHA","order_date":"2026-06-01","status":"invoiced","total_ht":100,"currency":"EUR","product_code":"S11-PROD","quantity":4,"salesperson_email":"admin@dermavita.local"}',
  true,'valid','order:s11-order'
);
select is((select processed from public.execute_onboarding_import('11000000-0000-0000-0000-000000000103')),1,'historical order import processes one row');
select is((select count(*) from public.orders where brand_id='00000000-0000-0000-0000-000000000101' and external_order_id='S11-ORDER' and source='import' and net_amount_ht=100),1::bigint,'historical order is imported with its exact revenue');
select is((select count(*) from public.brand_pharmacy_order_performance where brand_pharmacy_id=(select id from public.brand_pharmacies where external_id='S11-PHA')),1::bigint,'historical order feeds commercial performance');

insert into public.import_batches(
  id,brand_id,entity_type,strategy,file_name,valid_rows,total_rows,created_by,
  lifecycle_status,import_mode,status
) values (
  '11000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000101',
  'orders','create_only','orders-s11-duplicate.csv',1,1,'00000000-0000-0000-0000-0000000000a2',
  'ready','append_only','preview'
);
insert into public.import_rows(batch_id,line_number,payload,normalized_payload,is_valid,status,deduplication_key)
select '11000000-0000-0000-0000-000000000104',2,'{}',normalized_payload,true,'valid','order:s11-order'
from public.import_rows where batch_id='11000000-0000-0000-0000-000000000103';
select is((select skipped from public.execute_onboarding_import('11000000-0000-0000-0000-000000000104')),1,'duplicate historical order is skipped idempotently');
select is((select count(*) from public.orders where brand_id='00000000-0000-0000-0000-000000000101' and external_order_id='S11-ORDER'),1::bigint,'duplicate execution creates no second order');

insert into public.import_batches(
  id,brand_id,entity_type,strategy,file_name,valid_rows,total_rows,created_by,
  lifecycle_status,import_mode,status
) values (
  '11000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000101',
  'territories','create_only','territories-s11.csv',1,1,'00000000-0000-0000-0000-0000000000a2',
  'ready','create_only','preview'
);
insert into public.import_rows(batch_id,line_number,payload,normalized_payload,is_valid,status,deduplication_key)
values(
  '11000000-0000-0000-0000-000000000105',2,'{}',
  '{"territory_code":"S11-T","territory_name":"Territoire Sprint 11","country":"FR","department_or_region":"IDF","manager_email":"admin@dermavita.local"}',
  true,'valid','territory:s11-t'
);
select is((select processed from public.execute_onboarding_import('11000000-0000-0000-0000-000000000105')),1,'territory import processes one row');
select is((select manager_user_id from public.territories where brand_id='00000000-0000-0000-0000-000000000101' and code='S11-T'),'00000000-0000-0000-0000-0000000000a2'::uuid,'territory manager is attached by normalized email');
select throws_ok(
  $$select public.rollback_onboarding_import('11000000-0000-0000-0000-000000000105')$$,
  '42501','Rollback forbidden','brand admin cannot rollback an onboarding import'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select is((select rolled_back from public.rollback_onboarding_import('11000000-0000-0000-0000-000000000105')),1,'super admin rolls back created territory');
select is((select count(*) from public.territories where brand_id='00000000-0000-0000-0000-000000000101' and code='S11-T'),0::bigint,'rollback removes only the created territory');
select throws_ok(
  $$delete from storage.objects where bucket_id='onboarding-imports' and name='00000000-0000-0000-0000-000000000101/job/source.csv'$$,
  '42501','Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'even super admin must use the controlled Storage API'
);
select is((select count(*) from public.get_brand_activation_checklist('00000000-0000-0000-0000-000000000101') where blocking and not completed),0::bigint,'activation checklist has no blocking item');
select ok(public.activate_onboarded_brand('00000000-0000-0000-0000-000000000101'),'super admin explicitly activates the ready brand');
select is((select status from public.brand_onboarding_sessions where brand_id='00000000-0000-0000-0000-000000000101'),'completed','onboarding session is completed');
select is((select count(*) from public.brands where id='00000000-0000-0000-0000-000000000101' and status='active' and activated_at is not null),1::bigint,'brand activation is persisted');

select * from finish();
rollback;
