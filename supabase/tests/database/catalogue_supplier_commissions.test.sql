begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

select plan(10);

select ok(not has_table_privilege('anon','public.private_catalog_agent_mandates','SELECT'),
 'anonymous callers cannot access mandate rates');
select ok(not has_table_privilege('anon','public.private_catalog_agent_commissions','SELECT'),
 'anonymous callers cannot access commissions');
select ok(not has_table_privilege('anon','public.private_catalog_supplier_fulfillment','SELECT'),
 'anonymous callers cannot access supplier proofs');
select ok(not has_function_privilege('anon',
 'public.catalogue_admin_record_supplier_invoice(uuid,uuid,uuid,text,text,text,date,numeric,text)','EXECUTE'),
 'anonymous callers cannot record invoices');
select ok(not has_function_privilege('anon',
 'public.catalogue_admin_transition_supplier_request(uuid,text,text)','EXECUTE'),
 'anonymous callers cannot advance supplier orders');
select ok(has_function_privilege('authenticated',
 'public.catalogue_admin_record_supplier_invoice(uuid,uuid,uuid,text,text,text,date,numeric,text)','EXECUTE'),
 'authenticated admins can reach guarded commission function');

insert into public.private_catalog_brands(id,slug,name,active)
values ('b34a0000-0000-4000-8000-000000000001','test-agent-commission','Marque fictive',false);
insert into public.private_catalog_pharmacies(id,name,city)
values ('b34a0000-0000-4000-8000-000000000002','Officine de test','Istres');
insert into public.private_catalog_agent_mandates(
 brand_id,commission_rate,verified,verified_at,contract_reference,first_order,repeat_order,direct_repeat
) values ('b34a0000-0000-4000-8000-000000000001',18,true,now(),'Contrat fictif test de pgTAP',true,true,true);
select throws_ok(
 $case$insert into public.private_catalog_agent_commissions(
 brand_id,pharmacy_id,origin,sale_kind,supplier_invoice_reference,
 supplier_invoice_date,supplier_invoiced_ht,commission_rate_snapshot,supporting_evidence
 ) values (
 'b34a0000-0000-4000-8000-000000000001',
 'b34a0000-0000-4000-8000-000000000002',
 'direct','reorder','INV-NON-ATTRIBUEE',current_date,300,18,'Relevé fictif non attribué'
 )$case$,
 '22023',null,'unattributed direct reorders cannot create a commission');

insert into public.private_catalog_agent_accounts(
 brand_id,pharmacy_id,attribution_reference,verified,verified_at
) values (
 'b34a0000-0000-4000-8000-000000000001',
 'b34a0000-0000-4000-8000-000000000002',
 'Test attribution pharmacie validée',true,now()
);
insert into public.private_catalog_agent_commissions(
 id,brand_id,pharmacy_id,origin,sale_kind,supplier_invoice_reference,
 supplier_invoice_date,supplier_invoiced_ht,commission_rate_snapshot,supporting_evidence
) values (
 'b34a0000-0000-4000-8000-000000000003',
 'b34a0000-0000-4000-8000-000000000001',
 'b34a0000-0000-4000-8000-000000000002',
 'direct','reorder','INV-TEST-001',current_date,300,18,'Facture fictive test 001'
);

select is((select commission_ht from public.private_catalog_agent_commissions
 where id='b34a0000-0000-4000-8000-000000000003'),54.00::numeric,
 '18 percent of 300 euros HT computes exactly to 54 euros');

select throws_ok(
 $$update public.private_catalog_agent_commissions set status='paid'
  where id='b34a0000-0000-4000-8000-000000000003'$$,
 '23514',null,
 'paid status is rejected without TR1 invoice and payment references');

select throws_ok(
 $$insert into public.private_catalog_agent_commissions(
 brand_id,pharmacy_id,origin,sale_kind,supplier_invoice_reference,supplier_invoice_date,
 supplier_invoiced_ht,commission_rate_snapshot,supporting_evidence
 ) values (
 'b34a0000-0000-4000-8000-000000000001','b34a0000-0000-4000-8000-000000000002',
 'direct','reorder','INV-TEST-001',current_date,300,18,'Seconde saisie fictive'
 )$$,
 '23505',null,'duplicate supplier invoice cannot generate a second commission');

select * from finish();
rollback;
