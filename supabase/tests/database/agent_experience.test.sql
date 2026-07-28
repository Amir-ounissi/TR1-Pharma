begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is(
  (select count(*) from public.search_authorized_pharmacies('00000000-0000-0000-0000-000000000101', null, 20)),
  1::bigint,
  'agent search returns only assigned pharmacies'
);
select is(
  (select brand_pharmacy_id from public.search_authorized_pharmacies('00000000-0000-0000-0000-000000000101', 'République', 20)),
  '00000000-0000-0000-0000-000000000411'::uuid,
  'authorized search supports a normalized business query'
);
select is(
  (select count(*) from public.search_authorized_pharmacies('00000000-0000-0000-0000-000000000101', 'Monge', 20)),
  0::bigint,
  'agent cannot search an unassigned pharmacy'
);
select throws_ok(
  $$select public.get_field_pharmacy_summary('00000000-0000-0000-0000-000000000412')$$,
  '42501', 'Pharmacy summary forbidden',
  'agent cannot request another territory summary by id'
);
select is(
  public.get_field_pharmacy_summary('00000000-0000-0000-0000-000000000411')->>'name',
  'Pharmacie République',
  'agent obtains the assigned field summary'
);
select is(
  public.get_next_agent_visit('00000000-0000-0000-0000-000000000101')->>'brand_pharmacy_id',
  '00000000-0000-0000-0000-000000000411',
  'next visit is restricted to the agent portfolio'
);
select ok(
  jsonb_array_length(public.get_agent_today('00000000-0000-0000-0000-000000000101', current_date + 5)->'tasks') >= 1,
  'daily agenda returns assigned tasks'
);
select is(
  jsonb_array_length(public.get_agent_today('00000000-0000-0000-0000-000000000101', current_date)->'follow_ups'),
  0,
  'daily agenda does not flag an account that already has a next action'
);
select lives_ok(
  $$select public.create_agent_task('00000000-0000-0000-0000-000000000411','call','Appeler demain',now()+interval '1 day','high','Test terrain')$$,
  'agent creates a task through the secured RPC'
);
select is(
  (select count(*) from public.tasks where title = 'Appeler demain' and assigned_to = '00000000-0000-0000-0000-0000000000a3'),
  1::bigint,
  'secured task RPC always assigns the current agent'
);
select throws_ok(
  $$select public.create_agent_task('00000000-0000-0000-0000-000000000412','call','Intrusion',now(),'normal',null)$$,
  '42501', 'Agent task forbidden',
  'agent cannot create a task on an unassigned pharmacy'
);
select throws_ok(
  $$insert into public.product_events(organization_id,brand_id,user_id,event_name,source) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-0000000000a3','agent_dashboard_viewed','direct')$$,
  '42501', null,
  'authenticated users cannot write instrumentation directly'
);
select lives_ok(
  $$select public.track_product_event('pharmacy_opened','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000401','agent_day','{"origin":"test"}')$$,
  'agent records an event on an assigned pharmacy'
);
select throws_ok(
  $$select public.track_product_event('pharmacy_opened','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000402','agent_day','{}')$$,
  '42501', 'Product event pharmacy forbidden',
  'agent cannot instrument another assigned territory'
);
select throws_ok(
  $$select public.track_product_event('agent_dashboard_viewed','00000000-0000-0000-0000-000000000102',null,'agent_day','{}')$$,
  '42501', 'Product event forbidden',
  'agent cannot forge another brand id'
);
select throws_ok(
  $$select public.track_product_event('agent_dashboard_viewed','00000000-0000-0000-0000-000000000101',null,'agent_day',jsonb_build_object('payload',repeat('x',5000)))$$,
  '22023', 'Product event metadata invalid',
  'instrumentation metadata is size limited'
);
select is(
  (select count(*) from public.product_events),
  1::bigint,
  'agent reads only its own recorded event'
);
select is(
  (select organization_id from public.product_events limit 1),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'event organization is derived from the authorized brand'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok(
  $$select public.track_product_event('agent_dashboard_viewed','00000000-0000-0000-0000-000000000101',null,'agent_day','{}')$$,
  'brand administrator records an event in its brand'
);
select is(
  (select count(*) from public.product_events where brand_id = '00000000-0000-0000-0000-000000000101'),
  2::bigint,
  'brand administrator reads all events from its brand'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',true);
select is(
  (select count(*) from public.product_events),
  0::bigint,
  'another brand cannot read instrumentation'
);
select throws_ok(
  $$select public.get_agent_today('00000000-0000-0000-0000-000000000101',current_date)$$,
  '42501', 'Agent agenda forbidden',
  'another brand cannot forge the agenda brand id'
);

reset role;
update public.memberships set status = 'suspended'
where user_id = '00000000-0000-0000-0000-0000000000a3'
  and brand_id = '00000000-0000-0000-0000-000000000101';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is(
  (select count(*) from public.product_events),
  0::bigint,
  'suspended agent immediately loses access to previous product events'
);

select * from finish();
rollback;
