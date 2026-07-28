begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(30);

select has_view('public','commercial_account_health','commercial health view exists');
select ok(
  (select 'security_invoker=true'=any(reloptions) from pg_class where relname='commercial_account_health'),
  'commercial health view uses caller RLS'
);
select has_function('public','get_commercial_priorities',array['uuid','text','integer'],'priority read RPC exists');
select has_function('public','get_commercial_dashboard',array['uuid','integer','uuid','uuid','commercial_status'],'manager dashboard RPC exists');
select has_function('public','update_commercial_health_settings',array['uuid','integer','integer','integer','numeric','numeric','integer'],'settings RPC exists');
select has_index('public','missions','missions_health_relation_idx','completed mission lookup is indexed');
select is((select default_reorder_interval_days from public.brand_settings where brand_id='00000000-0000-0000-0000-000000000101'),60,'brand fallback defaults to 60 days');
select is((select first_reorder_target_days from public.brand_settings where brand_id='00000000-0000-0000-0000-000000000101'),60,'first reorder target defaults to 60 days');

insert into public.pharmacies(id,legal_name,trade_name,siret,postal_code,city) values
  ('00000000-0000-0000-0000-000000000430','Pharmacie Santé S9','Pharmacie Santé S9','12345678900430','75010','Paris'),
  ('00000000-0000-0000-0000-000000000431','Pharmacie Manager S9','Pharmacie Manager S9','12345678900431','75011','Paris'),
  ('00000000-0000-0000-0000-000000000432','Pharmacie Tenant S9','Pharmacie Tenant S9','12345678900432','69003','Lyon');
insert into public.brand_pharmacies(
  id,brand_id,pharmacy_id,commercial_status,priority_level,potential_level,source,current_agent_user_id,territory_id,created_by
) values
  ('00000000-0000-0000-0000-000000000430','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000430','active','strategic','very_high','brand_existing_client','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000431','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000431','active','normal','medium','brand_existing_client',null,'00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000432','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000432','active','high','high','brand_existing_client',null,'00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-0000000000a4');
insert into public.pharmacy_assignments(brand_id,brand_pharmacy_id,user_id,assignment_type,is_primary,assigned_by)
values('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000430','00000000-0000-0000-0000-0000000000a3','commercial_agent',true,'00000000-0000-0000-0000-0000000000a2');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select public.create_order(
  '00000000-0000-0000-0000-000000000430',
  jsonb_build_object('external_order_id','S9-INITIAL','order_status','invoiced','order_type','initial','order_date',now()-interval '90 days'),
  jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000601','quantity',1,'unit_price_ht',100,'tax_rate',20))
);
select public.create_order(
  '00000000-0000-0000-0000-000000000430',
  jsonb_build_object('external_order_id','S9-DRAFT','order_status','draft','order_date',now()-interval '20 days'),
  jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000601','quantity',1,'unit_price_ht',999,'tax_rate',20))
);
select public.create_order(
  '00000000-0000-0000-0000-000000000430',
  jsonb_build_object('external_order_id','S9-CANCELLED','order_status','cancelled','order_type','other','order_date',now()-interval '10 days','cancellation_reason','Test exclusion'),
  jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000601','quantity',1,'unit_price_ht',999,'tax_rate',20))
);

reset role;
delete from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000430';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);

select is((select orders_count from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),1,'draft and cancelled orders are excluded');
select is((select total_revenue from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),100.00::numeric,'revenue uses finalized orders only');
select is((select expected_interval_days from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),60,'insufficient history uses brand fallback');
select is((select interval_source from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),'brand_fallback','fallback source is explicit');
select is((select health_status from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),'at_risk'::public.commercial_health_status,'late first reorder becomes at risk');
select ok((select priority_score >= 65 from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),'priority combines risk, no action, strategic and potential');
select ok((select priority_reasons ? 'Aucun suivi programmé' from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),'priority reasons explain missing next action');
select is((select recommendation from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),'Contacter la pharmacie','risk recommendation is deterministic');
select is((select count(*) from public.get_commercial_priorities('00000000-0000-0000-0000-000000000101','first_reorder',100) where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),1::bigint,'implantation appears in conversion list');
select lives_ok($$select public.get_commercial_dashboard('00000000-0000-0000-0000-000000000101',90,null,null,null)$$,'manager reads aggregated dashboard');
select lives_ok($$select public.update_commercial_health_settings('00000000-0000-0000-0000-000000000101',55,60,7,1.35,2,30)$$,'brand admin updates reorder settings');
select is((select default_reorder_interval_days from public.brand_settings where brand_id='00000000-0000-0000-0000-000000000101'),55,'settings update is persisted');

select public.create_order(
  '00000000-0000-0000-0000-000000000430',
  jsonb_build_object('external_order_id','S9-REORDER','order_status','delivered','order_type','reorder','order_date',now()-interval '10 days'),
  jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000601','quantity',1,'unit_price_ht',50,'tax_rate',20))
);
select is((select orders_count from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),2,'second finalized order becomes first reorder');
select is((select reorder_count from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),1,'reorder count is calculated');
select is((select days_to_first_reorder from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),80,'days to first reorder is retained');
select is((select count(*) from public.get_commercial_priorities('00000000-0000-0000-0000-000000000101','first_reorder',100) where brand_pharmacy_id='00000000-0000-0000-0000-000000000430'),0::bigint,'converted implantation leaves first reorder list');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is((select count(*) from public.get_commercial_priorities('00000000-0000-0000-0000-000000000101',null,100) where brand_pharmacy_id='00000000-0000-0000-0000-000000000431'),0::bigint,'agent sees no unassigned priority');
select is((select count(*) from public.get_commercial_health('00000000-0000-0000-0000-000000000431')),0::bigint,'agent cannot read unassigned commercial health');
select is((select count(*) from public.get_commercial_priorities('00000000-0000-0000-0000-000000000102',null,100)),0::bigint,'agent sees no other brand priority');
select throws_ok(
  $$select public.get_commercial_dashboard('00000000-0000-0000-0000-000000000101',90,null,null,null)$$,
  '42501','Commercial dashboard forbidden','agent cannot access manager KPI'
);
select throws_ok(
  $$select public.update_commercial_health_settings('00000000-0000-0000-0000-000000000101',60,60,7,1.35,2,30)$$,
  '42501','Commercial settings forbidden','agent cannot modify brand rules'
);
select ok(
  (select count(*) <= 5 from public.get_agent_reorder_opportunities('00000000-0000-0000-0000-000000000101',5)),
  'agent opportunities are capped at five'
);

select * from finish();
rollback;
