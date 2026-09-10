begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

select has_column('public','tasks','action_code','tasks expose a semantic action code');
select has_column('public','tasks','triggered_at','tasks retain their business trigger date');
select has_column('public','tasks','dedupe_key','tasks support deterministic deduplication');
select has_column('public','tasks','completion_reason','tasks retain why an automatic action ended');
select has_function('private','sync_post_implantation_follow_up',array['uuid'],'post implantation lifecycle function exists');

insert into public.pharmacies(id,legal_name,trade_name,siret,postal_code,city) values
  ('00000000-0000-0000-0000-000000000490','Pharmacie Action Reorder','Pharmacie Action Reorder','12345678900490','75012','Paris'),
  ('00000000-0000-0000-0000-000000000491','Pharmacie Action Interaction','Pharmacie Action Interaction','12345678900491','75013','Paris');

insert into public.brand_pharmacies(
  id,brand_id,pharmacy_id,commercial_status,priority_level,potential_level,source,current_agent_user_id,territory_id,created_by
) values
  ('00000000-0000-0000-0000-000000000490','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000490','active','high','high','brand_existing_client','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000491','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000491','active','normal','medium','brand_existing_client','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-0000000000a2');

insert into public.pharmacy_assignments(brand_id,brand_pharmacy_id,user_id,assignment_type,is_primary,assigned_by) values
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000490','00000000-0000-0000-0000-0000000000a3','commercial_agent',true,'00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000491','00000000-0000-0000-0000-0000000000a3','commercial_agent',true,'00000000-0000-0000-0000-0000000000a2');

create temp table _action_orders(relation_id uuid, kind text, order_id uuid);
grant select, insert on table pg_temp._action_orders to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);

insert into _action_orders
select
  '00000000-0000-0000-0000-000000000490'::uuid,
  'first',
  public.create_order(
    '00000000-0000-0000-0000-000000000490',
    jsonb_build_object('external_order_id','ACTION-FIRST-490','order_status','confirmed','order_type','initial','order_date',now()-interval '20 days'),
    jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000601','quantity',1,'unit_price_ht',100,'tax_rate',20))
  );

select is(
  (select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000490' and action_code='post_implantation' and status='open'),
  1::bigint,
  'a first valid order creates one relevant post implantation action'
);

select ok(
  (select trigger_type='order' and trigger_id=(select order_id from _action_orders where relation_id='00000000-0000-0000-0000-000000000490' and kind='first') and rule_code='post_implantation_v2'
   from public.tasks
   where brand_pharmacy_id='00000000-0000-0000-0000-000000000490' and action_code='post_implantation' and status='open'),
  'post implantation action keeps its originating order and rule'
);

insert into _action_orders
select
  '00000000-0000-0000-0000-000000000490'::uuid,
  'reorder',
  public.create_order(
    '00000000-0000-0000-0000-000000000490',
    jsonb_build_object('external_order_id','ACTION-REORDER-490','order_status','confirmed','order_type','reorder','order_date',now()-interval '2 days'),
    jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000601','quantity',1,'unit_price_ht',80,'tax_rate',20))
  );

select is(
  (select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000490' and action_code='post_implantation' and status in ('open','in_progress')),
  0::bigint,
  'a later valid order removes the obsolete post implantation action'
);
select is(
  (select completion_reason from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000490' and action_code='post_implantation' order by created_at desc limit 1),
  'reorder_received',
  'automatic completion explains that a reorder made the action obsolete'
);

insert into _action_orders
select
  '00000000-0000-0000-0000-000000000491'::uuid,
  'first',
  public.create_order(
    '00000000-0000-0000-0000-000000000491',
    jsonb_build_object('external_order_id','ACTION-FIRST-491','order_status','confirmed','order_type','initial','order_date',now()-interval '20 days'),
    jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000601','quantity',1,'unit_price_ht',100,'tax_rate',20))
  );

reset role;
insert into public.interactions(
  brand_id,brand_pharmacy_id,created_by,interaction_type,subject,outcome,occurred_at,visibility
) values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000491',
  '00000000-0000-0000-0000-0000000000a3',
  'visit',
  'Suivi implantation terrain',
  'completed',
  now()-interval '2 days',
  'shared'
);

select is(
  (select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000491' and action_code='post_implantation' and status in ('open','in_progress')),
  0::bigint,
  'a meaningful commercial interaction completes post implantation follow up'
);
select is(
  (select completion_reason from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000491' and action_code='post_implantation' order by created_at desc limit 1),
  'commercial_follow_up_recorded',
  'interaction completion reason is explicit'
);

select private.ensure_activity_follow_up('00000000-0000-0000-0000-000000000491','watch','00000000-0000-0000-0000-0000000000a2');
select private.ensure_activity_follow_up('00000000-0000-0000-0000-000000000491','at_risk','00000000-0000-0000-0000-0000000000a2');

select is(
  (select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000491' and left(coalesce(action_code,''),9)='activity_' and status in ('open','in_progress')),
  1::bigint,
  'only one activity action remains open after a health state change'
);
select is(
  (select action_code from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000491' and left(coalesce(action_code,''),9)='activity_' and status in ('open','in_progress') limit 1),
  'activity_at_risk',
  'the open activity action matches the current requested state'
);
select is(
  (select completion_reason from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000491' and action_code='activity_watch' order by created_at desc limit 1),
  'activity_status_changed',
  'the superseded activity action records why it closed'
);

select private.ensure_activity_follow_up('00000000-0000-0000-0000-000000000491','active','00000000-0000-0000-0000-0000000000a2');
select is(
  (select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000491' and left(coalesce(action_code,''),9)='activity_' and status in ('open','in_progress')),
  0::bigint,
  'return to active clears activity recovery actions'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select public.create_agent_task(
  '00000000-0000-0000-0000-000000000490',
  'call',
  'Action moteur aujourd’hui',
  date_trunc('day', now()),
  'high',
  'Test du moteur de priorité'
);

select is(
  (select item->>'due_state'
   from jsonb_array_elements(public.get_agent_today_multibrand(current_date,null)->'tasks') item
   where item->>'title'='Action moteur aujourd’hui' limit 1),
  'today',
  'a task due today is classified as today, not overdue at midnight'
);
select is(
  (select (item->>'is_overdue')::boolean
   from jsonb_array_elements(public.get_agent_today_multibrand(current_date,null)->'tasks') item
   where item->>'title'='Action moteur aujourd’hui' limit 1),
  false,
  'date-level overdue semantics do not mark a task late during its due day'
);
select is(
  (select item->>'action_code'
   from jsonb_array_elements(public.get_agent_today_multibrand(current_date,null)->'tasks') item
   where item->>'title'='Action moteur aujourd’hui' limit 1),
  'manual_call',
  'manual actions receive a semantic action code automatically'
);
select ok(
  (select (item->>'action_score')::integer > 0
     and (item->'priority_reasons') ? 'Action planifiée par le commercial'
   from jsonb_array_elements(public.get_agent_today_multibrand(current_date,null)->'tasks') item
   where item->>'title'='Action moteur aujourd’hui' limit 1),
  'cockpit returns a deterministic score and an explainable priority reason'
);

select * from finish();
rollback;
