begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c3','authenticated','authenticated','agent-b@test.local','',now(),'{}','{"full_name":"Agent B"}',now(),now(),'','','','');

insert into public.memberships(user_id,organization_id,brand_id,role_id,status) values
('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from public.roles where key = 'agent'),'active');

select has_table('public', 'performance_objectives', 'performance objectives table exists');
select has_table('public', 'performance_objective_versions', 'performance objective history table exists');
select has_view('public', 'performance_order_facts', 'performance order facts view exists');
select has_function('public', 'get_objective_progress', array['uuid', 'date', 'date', 'performance_scope_type', 'uuid', 'uuid'], 'objective progress RPC exists');
select has_function('public', 'get_performance_overview', array['uuid', 'date', 'date', 'uuid', 'uuid'], 'performance overview RPC exists');
select has_function('public', 'get_performance_team', array['uuid', 'date', 'date', 'uuid'], 'performance team RPC exists');

insert into public.pharmacies(id, legal_name, trade_name, siret, postal_code, city) values
  ('00000000-0000-0000-0000-000000000470', 'Pharmacie Performance A', 'Performance A', '12345678900470', '75012', 'Paris');

insert into public.brand_pharmacies(
  id, brand_id, pharmacy_id, commercial_status, priority_level, potential_level, source,
  current_agent_user_id, territory_id, created_by
) values (
  '00000000-0000-0000-0000-000000000470',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000470',
  'active',
  'high',
  'high',
  'brand_existing_client',
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-0000000000a2'
);

insert into public.pharmacy_assignments(
  brand_id, brand_pharmacy_id, user_id, assignment_type, is_primary, starts_at, ends_at, assigned_by
) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000470', '00000000-0000-0000-0000-0000000000a3', 'commercial_agent', true, '2026-07-01', '2026-07-15', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000470', '00000000-0000-0000-0000-0000000000c3', 'commercial_agent', true, '2026-07-16', null, '00000000-0000-0000-0000-0000000000a2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select public.create_order(
  '00000000-0000-0000-0000-000000000470',
  jsonb_build_object('external_order_id', 'P13-A1', 'order_status', 'invoiced', 'order_type', 'initial', 'order_date', '2026-07-10T10:00:00Z'),
  jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000601', 'quantity', 1, 'unit_price_ht', 100, 'tax_rate', 20))
);
select public.create_order(
  '00000000-0000-0000-0000-000000000470',
  jsonb_build_object('external_order_id', 'P13-B1', 'order_status', 'delivered', 'order_type', 'reorder', 'order_date', '2026-07-20T10:00:00Z'),
  jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000601', 'quantity', 1, 'unit_price_ht', 200, 'tax_rate', 20))
);

select is(
  (select agent_user_id_at_order from public.performance_order_facts where order_id = (select id from public.orders where external_order_id = 'P13-A1')),
  '00000000-0000-0000-0000-0000000000a3'::uuid,
  'initial order keeps the first assigned agent'
);
select is(
  (select agent_user_id_at_order from public.performance_order_facts where order_id = (select id from public.orders where external_order_id = 'P13-B1')),
  '00000000-0000-0000-0000-0000000000c3'::uuid,
  'reorder after reassignment goes to the new agent'
);

select is(
  (select revenue_ht from public.get_performance_team('00000000-0000-0000-0000-000000000101', '2026-07-01', '2026-07-31', null) where user_id = '00000000-0000-0000-0000-0000000000a3'),
  100.00::numeric,
  'team performance attributes historical revenue to the former agent'
);
select is(
  (select revenue_ht from public.get_performance_team('00000000-0000-0000-0000-000000000101', '2026-07-01', '2026-07-31', null) where user_id = '00000000-0000-0000-0000-0000000000c3'),
  200.00::numeric,
  'team performance attributes later revenue to the current agent'
);

select lives_ok($$
  select public.save_performance_objective(
    null::uuid,
    '00000000-0000-0000-0000-000000000101',
    'agent'::public.performance_scope_type,
    'revenue_ht'::public.performance_metric,
    '2026-07-01',
    '2026-07-31',
    500,
    null,
    '00000000-0000-0000-0000-0000000000a3',
    'Objectif juillet agent A'
  )
$$, 'manager can create an agent objective');

select is(
  (select realized_value from public.get_objective_progress('00000000-0000-0000-0000-000000000101', '2026-07-01', '2026-07-31', 'agent', null, '00000000-0000-0000-0000-0000000000a3') where metric_key = 'revenue_ht' limit 1),
  100.00::numeric,
  'objective progress uses temporally attributed revenue'
);

select ok(
  (select count(*) = 1 from public.performance_objective_versions where brand_id = '00000000-0000-0000-0000-000000000101' and change_type = 'created'),
  'objective creation is historized'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);

select throws_ok(
  $$select public.get_objective_progress('00000000-0000-0000-0000-000000000101', '2026-07-01', '2026-07-31', 'agent', null, '00000000-0000-0000-0000-0000000000a3')$$,
  '42501',
  'Objective scope forbidden',
  'an agent cannot read another agent objective scope'
);

select is(
  (select count(*) from public.get_performance_network('00000000-0000-0000-0000-000000000101', '2026-07-01', '2026-07-31', null, '00000000-0000-0000-0000-0000000000c3')),
  1::bigint,
  'agent-scoped network only returns the current portfolio'
);

select * from finish();
rollback;
