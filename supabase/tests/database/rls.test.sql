begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'nomembership@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'suspended@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated', 'multibrand@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b4', 'authenticated', 'authenticated', 'facilitator@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b6', 'authenticated', 'authenticated', 'otheragent@test.local', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.memberships (user_id, organization_id, brand_id, role_id, status) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'brand_user'), 'suspended'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'brand_user'), 'active'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', (select id from public.roles where key = 'brand_user'), 'active'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'facilitator'), 'active'),
  ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'agent'), 'active');

insert into public.pharmacies (id, legal_name, trade_name, siret, postal_code, city, archived_at) values
  ('00000000-0000-0000-0000-00000000e404', 'Pharmacie archivée', 'Pharmacie archivée', '12345678999044', '75010', 'Paris', now()),
  ('00000000-0000-0000-0000-00000000e405', 'Pharmacie autre agent', 'Pharmacie autre agent', '12345678999052', '75011', 'Paris', null),
  ('00000000-0000-0000-0000-00000000e406', 'Pharmacie contraintes', 'Pharmacie contraintes', '12345678999060', '75012', 'Paris', null);
insert into public.brand_pharmacies (id, brand_id, pharmacy_id, current_agent_user_id, source) values
  ('00000000-0000-0000-0000-00000000e415', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-00000000e405', '00000000-0000-0000-0000-0000000000b6', 'agent');
insert into public.orders (id, organization_id, brand_id, pharmacy_id, brand_pharmacy_id, created_by)
values ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-0000000000a4');
insert into public.missions (id, organization_id, brand_id, pharmacy_id, brand_pharmacy_id, assigned_user_id, managed_by, created_by, mission_type, title, objective, scheduled_start_at) values
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'animation', 'Mission animateur', 'Animation Dermavita', now()),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000413', null, '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'training', 'Mission autre marque', 'Formation Nutrilab', now());

create temp table rls_expected_counts as
select
  count(*) filter (where brand_id = '00000000-0000-0000-0000-000000000101' and archived_at is null) as brand_101_relations,
  count(distinct pharmacy_id) filter (where brand_id = '00000000-0000-0000-0000-000000000101' and archived_at is null) as brand_101_pharmacies,
  count(*) filter (where brand_id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102') and archived_at is null) as both_brand_relations,
  count(distinct pharmacy_id) filter (where brand_id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102') and archived_at is null) as both_brand_pharmacies,
  count(*) filter (where archived_at is null) as all_active_relations
from public.brand_pharmacies;
grant select on rls_expected_counts to authenticated;

select plan(62);

select is((select count(*) from public.brand_pharmacies where pharmacy_id = '00000000-0000-0000-0000-000000000401' and archived_at is null), 2::bigint, 'one physical pharmacy can have two brand relations');
select throws_ok($$insert into public.brand_pharmacies (brand_id, pharmacy_id) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000401')$$, '23505', null, 'duplicate active brand relation is rejected');
select throws_ok($$insert into public.pharmacies (legal_name, siret) values ('Doublon SIRET','12345678900011')$$, '23505', null, 'duplicate SIRET is rejected');
select throws_ok($$insert into public.pharmacies (legal_name, cip_code) values ('Doublon CIP','7500001')$$, '23505', null, 'duplicate CIP is rejected');
select throws_ok($$insert into public.pharmacies (legal_name, finess_code) values ('Doublon FINESS','750100001')$$, '23505', null, 'duplicate FINESS is rejected');
select throws_ok($$insert into public.pharmacy_contacts (pharmacy_id, first_name, last_name, is_primary) values ('00000000-0000-0000-0000-000000000401','Autre','Titulaire',true)$$, '23505', null, 'only one active primary contact is allowed');
select throws_ok($$insert into public.brand_pharmacies (brand_id, pharmacy_id) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-00000000e404')$$, '23514', 'An archived pharmacy cannot receive an active brand relation', 'archived pharmacy cannot receive a new active relation');
select throws_ok($$insert into public.brand_pharmacy_products (brand_pharmacy_id, product_id) values ('00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000602')$$, '23514', 'Product and brand pharmacy must belong to the same brand', 'cross-brand product association is rejected');
select throws_ok($$update public.brand_pharmacies set current_agent_user_id = '00000000-0000-0000-0000-0000000000b1' where id = '00000000-0000-0000-0000-000000000412'$$, '23514', 'Assigned users must have active access to the brand', 'user without brand access cannot be assigned');
select throws_ok($$insert into public.brand_pharmacies (brand_id, pharmacy_id, territory_id) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-00000000e406','00000000-0000-0000-0000-000000000202')$$, '23514', 'Territory is outside the brand scope', 'territory from another brand is rejected');
select throws_ok($$insert into public.products (brand_id,name,sku) values ('00000000-0000-0000-0000-000000000101','Doublon SKU','DV-DC-50')$$, '23505', null, 'SKU is unique within a brand');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), (select brand_101_relations from rls_expected_counts), 'brand admin sees only its brand relations');
select is((select count(*) from public.pharmacies), (select brand_101_pharmacies from rls_expected_counts), 'brand admin sees only physical pharmacies connected to its brand');
select is((select count(*) from public.pharmacy_groups where id = '00000000-0000-0000-0000-000000000301'), 1::bigint, 'brand admin sees a group attached to an accessible pharmacy');
select is((select count(*) from public.pharmacy_groups where id = '00000000-0000-0000-0000-000000000302'), 0::bigint, 'brand admin cannot see a group outside its pharmacy scope');
select is((select count(*) from public.brand_pharmacies where brand_id = '00000000-0000-0000-0000-000000000102'), 0::bigint, 'brand admin cannot read another brand relation');
with changed as (update public.brand_pharmacies set notes = 'Hacked' where id = '00000000-0000-0000-0000-000000000413' returning 1)
select is((select count(*) from changed), 0::bigint, 'brand admin cannot update another brand relation');
select throws_ok($$insert into public.brand_pharmacies (brand_id, pharmacy_id) values ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000402')$$, '42501', null, 'brand admin cannot insert with another brand_id');
select throws_ok($$insert into public.memberships (user_id, organization_id, brand_id, role_id, status) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from public.roles where key = 'super_admin'),'active')$$, '42501', null, 'brand admin cannot create a user with a superior role');
select is((select count(*) from public.products where brand_id = '00000000-0000-0000-0000-000000000102'), 0::bigint, 'brand admin cannot read products from another brand');
select is((select count(*) from public.products), 1::bigint, 'brand admin reads its own product catalog');
select is((select count(*) from public.orders where brand_id = '00000000-0000-0000-0000-000000000102'), 0::bigint, 'brand admin cannot access an order from another brand');
select is((select count(*) from public.missions where brand_id = '00000000-0000-0000-0000-000000000102'), 0::bigint, 'brand admin cannot access a mission from another brand');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), 1::bigint, 'agent sees only assigned brand pharmacies');
select is((select count(*) from public.pharmacies), 1::bigint, 'agent sees only assigned physical pharmacies');
select is((select count(*) from public.pharmacy_groups where id = '00000000-0000-0000-0000-000000000301'), 1::bigint, 'agent sees the group of an assigned pharmacy');
select is((select count(*) from public.brand_pharmacies where id = '00000000-0000-0000-0000-000000000412'), 0::bigint, 'agent cannot read an unassigned pharmacy');
with changed as (update public.brand_pharmacies set notes = 'Compte rendu agent' where id = '00000000-0000-0000-0000-000000000411' returning 1)
select is((select count(*) from changed), 1::bigint, 'agent can update notes on its assigned pharmacy');
select throws_ok($$update public.brand_pharmacies set current_agent_user_id = null where id = '00000000-0000-0000-0000-000000000411'$$, '42501', 'Agent update scope exceeded', 'agent cannot alter its own assignment');
select throws_ok($$insert into public.brand_pharmacies (brand_id, pharmacy_id) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-00000000e406')$$, '42501', null, 'agent cannot create a brand relation');
select is((select count(*) from public.brand_pharmacies where id = '00000000-0000-0000-0000-00000000e415'), 0::bigint, 'agent cannot access another agent pharmacy');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), 0::bigint, 'facilitator has no general referential access');
select is((select count(*) from public.pharmacies), 0::bigint, 'facilitator cannot read physical pharmacies');
select is((select count(*) from public.pharmacy_groups), 0::bigint, 'facilitator cannot read groups without pharmacy access');
select is((select count(*) from public.missions), 1::bigint, 'facilitator sees only assigned missions');
select is((select count(*) from public.missions where id = '00000000-0000-0000-0000-000000000903'), 0::bigint, 'facilitator cannot read another intervenor mission');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), 0::bigint, 'user without membership sees no relation');
select is((select count(*) from public.pharmacies), 0::bigint, 'user without membership sees no pharmacy');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), 0::bigint, 'suspended membership sees no relation');
select is((select count(*) from public.pharmacies), 0::bigint, 'suspended membership sees no pharmacy');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), (select both_brand_relations from rls_expected_counts), 'multi-brand user sees both authorized brand scopes');
select is((select count(*) from public.pharmacies), (select both_brand_pharmacies from rls_expected_counts), 'multi-brand user sees shared physical pharmacy only once');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.pharmacy_groups), 2::bigint, 'TR1 super admin keeps global group visibility');
update public.memberships set role_id = (select id from public.roles where key = 'agent') where user_id = '00000000-0000-0000-0000-0000000000b3';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), 0::bigint, 'role change is applied immediately by RLS');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.brand_pharmacies), (select all_active_relations from rls_expected_counts), 'TR1 super admin sees every active brand relation');
select is((select count(*) from public.find_pharmacy_duplicates('12345678900011',null,null,null,null,null)), 1::bigint, 'duplicate search detects identical SIRET');
select is((select count(*) from public.find_pharmacy_duplicates(null,null,null,'Pharmacie Republique','75003',null)), 1::bigint, 'duplicate search warns on normalized name and postal code');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
insert into public.import_batches (id, brand_id, entity_type, strategy, file_name, valid_rows, created_by)
values ('00000000-0000-0000-0000-000000000a01','00000000-0000-0000-0000-000000000101','products','create_only','products.csv',1,'00000000-0000-0000-0000-0000000000a2');
insert into public.import_rows (batch_id,line_number,payload,normalized_payload,is_valid)
values ('00000000-0000-0000-0000-000000000a01',2,'{"name":"Nouveau","sku":"DV-NEW"}','{"name":"Nouveau","sku":"DV-NEW","wholesale_price_ht":"10.5"}',true);
select is((select count(*) from public.import_batches where status = 'preview'), 1::bigint, 'CSV preview creates a staging batch');
select is((select count(*) from public.products), 1::bigint, 'CSV preview writes no business data');
select is((select processed from public.confirm_reference_import('00000000-0000-0000-0000-000000000a01')), 1, 'CSV confirmation processes the valid row atomically');
select is((select count(*) from public.products), 2::bigint, 'CSV confirmation creates the product');
select is((select count(*) from public.import_batches where id = '00000000-0000-0000-0000-000000000a01' and status = 'confirmed'), 1::bigint, 'confirmed batch is immutable and marked confirmed');
select is((select count(*) from public.activity_logs where action = 'import.confirm' and entity_id = '00000000-0000-0000-0000-000000000a01'), 1::bigint, 'CSV confirmation is journalized');

select lives_ok($$update public.brand_pharmacies set archived_at = now() where id = '00000000-0000-0000-0000-000000000412'$$, 'brand relation is logically archived');
select is((select count(*) from public.brand_pharmacies where archived_at is null), (select brand_101_relations - 1 from rls_expected_counts), 'archived relation disappears from the active relation scope');
select ok(private.is_active_pharmacy('00000000-0000-0000-0000-000000000402'), 'logical relation archive preserves physical pharmacy data');
select lives_ok($$select public.create_brand_pharmacy('00000000-0000-0000-0000-000000000101','{}','{}','00000000-0000-0000-0000-000000000402')$$, 'new active relation can be created after archive');
select lives_ok($$select public.create_brand_pharmacy('00000000-0000-0000-0000-000000000101','{"legal_name":"Pharmacie RPC RLS","siret":"12345678900999"}','{}',null)$$, 'brand admin can atomically create a physical pharmacy and its brand relation under RLS');

reset role;
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname = any(array[
  'organizations','brands','users','user_profiles','roles','memberships','pharmacy_groups','territories','pharmacies','pharmacy_contacts','products','product_references','agents','agent_brand_assignments','pharmacy_assignments','interactions','tasks','orders','order_items','missions','mission_reports','activity_logs','brand_pharmacies','brand_pharmacy_products','import_batches','import_rows'
]) and c.relrowsecurity), 26::bigint, 'RLS is enabled on all public application tables');
select ok((select 'security_invoker=true' = any(reloptions) from pg_class where relname = 'brand_pharmacy_directory'), 'directory view uses security_invoker');
select has_index('public','brand_pharmacies','brand_pharmacies_one_active_relation','active brand relation unique index exists');
select has_index('public','pharmacy_contacts','pharmacy_contacts_one_primary_active','active primary contact unique index exists');

select * from finish();
rollback;
