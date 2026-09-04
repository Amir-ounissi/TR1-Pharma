begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
) values
('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','facilitator-active@test.local','',now(),'{}','{}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c2','authenticated','authenticated','facilitator-suspended@test.local','',now(),'{}','{}',now(),now(),'','','','');

insert into public.memberships(user_id,organization_id,brand_id,role_id,status) values
('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from roles where key='facilitator'),'active'),
('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from roles where key='facilitator'),'suspended');

insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
select '00000000-0000-0000-0000-0000000000a1',b.organization_id,b.id,(select id from roles where key='tr1_manager'),'active'
from brands b
on conflict do nothing;

select plan(39);
set local role authenticated;

-- TR1 creates a request only. Assignment and schedule are separate workflow steps.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);

select lives_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000411',
    '{
      "mission_type":"animation",
      "title":"Animation été",
      "objective":"Vendre et conseiller",
      "scheduled_start_at":"2026-08-10T08:00:00Z",
      "scheduled_end_at":"2026-08-10T16:00:00Z",
      "provider_cost_ht":"300",
      "travel_cost_ht":"40"
    }',
    '[{
      "product_id":"00000000-0000-0000-0000-000000000601",
      "objective_type":"sell_out",
      "target_quantity":20
    }]'
  )$$,
  'valid mission request is created'
);

select is(
  (select status from missions where title='Animation été'),
  'requested'::mission_status,
  'new mission starts requested without silently assigning a provider'
);

select is(
  (select cost_actual_ht from missions where title='Animation été'),
  340.00::numeric,
  'actual cost is server calculated'
);

select is(
  (select count(*) from mission_status_history where mission_id=(select id from missions where title='Animation été')),
  1::bigint,
  'initial requested status is historized'
);

select is(
  (select count(*) from mission_products where mission_id=(select id from missions where title='Animation été')),
  1::bigint,
  'mission product is linked'
);

select throws_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000411',
    '{"mission_type":"bad_type","title":"Bad","objective":"Bad"}',
    '[]'
  )$$,
  '22P02',
  null,
  'unknown mission type is blocked'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select throws_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000413',
    '{"mission_type":"animation","title":"Cross brand","objective":"Forbidden"}',
    '[]'
  )$$,
  '42501',
  'Brand pharmacy unavailable',
  'cross-brand pharmacy is blocked'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);

select lives_ok(
  $$select public.change_mission_status(
    (select id from missions where title='Animation été'),
    'to_assign',
    null
  )$$,
  'TR1 moves the request to assignment'
);

select lives_ok(
  $$select public.assign_mission(
    (select id from missions where title='Animation été'),
    '00000000-0000-0000-0000-0000000000c1',
    null,
    null
  )$$,
  'TR1 assigns the active facilitator'
);

select lives_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000411',
    '{"mission_type":"animation","title":"Inactive","objective":"Forbidden"}',
    '[]'
  )$$,
  'inactive-provider scenario is created unassigned'
);

select lives_ok(
  $$select public.change_mission_status(
    (select id from missions where title='Inactive'),
    'to_assign',
    null
  )$$,
  'inactive-provider scenario reaches assignment'
);

select throws_ok(
  $$select public.assign_mission(
    (select id from missions where title='Inactive'),
    '00000000-0000-0000-0000-0000000000c2',
    null,
    null
  )$$,
  '23514',
  'Assigned user role is incompatible with this mission',
  'suspended provider cannot be assigned'
);

-- Acceptance belongs to the assigned provider.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
select lives_ok(
  $$select public.change_mission_status(
    (select id from missions where title='Animation été'),
    'accepted',
    null
  )$$,
  'assigned provider accepts the mission'
);

-- Scheduling belongs to TR1, not to the provider.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.schedule_mission(
    (select id from missions where title='Animation été'),
    '2026-08-10T08:00:00Z',
    '2026-08-10T16:00:00Z'
  )$$,
  'TR1 schedules an accepted mission'
);

-- Execution starts only through the assigned provider.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
select lives_ok(
  $$select public.change_mission_status(
    (select id from missions where title='Animation été'),
    'in_progress',
    null
  )$$,
  'assigned provider starts the scheduled mission'
);

-- Overlap is checked when TR1 attempts the second assignment with a time slot.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000411',
    '{"mission_type":"animation","title":"Overlap","objective":"Forbidden"}',
    '[]'
  )$$,
  'overlap scenario is created unassigned'
);

select lives_ok(
  $$select public.change_mission_status(
    (select id from missions where title='Overlap'),
    'to_assign',
    null
  )$$,
  'overlap scenario reaches assignment'
);

select throws_ok(
  $$select public.assign_mission(
    (select id from missions where title='Overlap'),
    '00000000-0000-0000-0000-0000000000c1',
    '2026-08-10T10:00:00Z',
    '2026-08-10T12:00:00Z'
  )$$,
  '23P01',
  'Provider schedule overlap',
  'provider schedule overlap remains blocked'
);

select throws_ok(
  $$insert into mission_products(mission_id,brand_id,product_id)
    values (
      (select id from missions where title='Animation été'),
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000602'
    )$$,
  '23503',
  null,
  'cross-brand mission product is blocked'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
select throws_ok(
  $$select public.change_mission_status(
    (select id from missions where title='Animation été'),
    'accepted',
    null
  )$$,
  '42501',
  'Invalid mission status transition for this actor',
  'provider cannot jump backward in the mission lifecycle'
);

select ok(
  (select count(*) >= 6 from mission_status_history where mission_id=(select id from missions where title='Animation été')),
  'workflow transitions are historized'
);

select lives_ok(
  $$select public.save_mission_report(
    (select id from missions where title='Animation été'),
    '{"report_status":"draft","summary":"Brouillon"}'
  )$$,
  'provider can save a draft report while mission is in progress'
);

select throws_ok(
  $$select public.save_mission_report(
    (select id from missions where title='Animation été'),
    '{"report_status":"submitted","summary":"Incomplet"}'
  )$$,
  '23514',
  'Animation results are incomplete',
  'incomplete animation report is blocked'
);

select lives_ok(
  $$select public.save_mission_report(
    (select id from missions where title='Animation été'),
    '{
      "report_status":"submitted",
      "summary":"Animation réalisée",
      "units_sold":"12",
      "duration_minutes":"360",
      "customer_contacts":"50",
      "net_sales_ttc":"420"
    }'
  )$$,
  'complete animation report is submitted'
);

select is(
  (select status from missions where title='Animation été'),
  'report_pending'::mission_status,
  'report submission moves mission to report_pending'
);

select is(
  (select units_sold from mission_reports where mission_id=(select id from missions where title='Animation été')),
  12,
  'units sold are retained'
);

select is(
  round((select units_per_hour from mission_performance where mission_id=(select id from missions where title='Animation été')),2),
  2.00::numeric,
  'units per hour is calculated'
);

select is(
  round((select cost_per_unit from mission_performance where mission_id=(select id from missions where title='Animation été')),2),
  28.33::numeric,
  'cost per unit is calculated'
);

select is(
  (select reported_sell_out_ttc from mission_performance where mission_id=(select id from missions where title='Animation été')),
  420.00::numeric,
  'reported sell-out is exposed'
);

select is(
  (select roi_30d from mission_performance where mission_id=(select id from missions where title='Animation été')),
  null::numeric,
  'ROI is absent without margin'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.review_mission_report(
    (select id from mission_reports where mission_id=(select id from missions where title='Animation été')),
    'needs_correction',
    'Préciser les objections'
  )$$,
  'TR1 can request a correction'
);

select is(
  (select status from missions where title='Animation été'),
  'report_pending'::mission_status,
  'correction keeps mission pending'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
select lives_ok(
  $$select public.save_mission_report(
    (select id from missions where title='Animation été'),
    '{
      "report_status":"submitted",
      "summary":"Animation corrigée",
      "units_sold":"12",
      "duration_minutes":"360",
      "customer_contacts":"50",
      "net_sales_ttc":"420"
    }'
  )$$,
  'provider can resubmit a requested correction'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.review_mission_report(
    (select id from mission_reports where mission_id=(select id from missions where title='Animation été')),
    'validated',
    null
  )$$,
  'TR1 validates the submitted report'
);

select is(
  (select status from missions where title='Animation été'),
  'completed'::mission_status,
  'validated report completes mission'
);

select is(
  (select count(*) from interactions where subject='Mission terrain validée'),
  1::bigint,
  'validation adds the shared timeline interaction'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
select is(
  (select count(*) from missions),
  1::bigint,
  'facilitator sees only the mission assigned to them'
);

select is(
  (select count(*) from missions where brand_id='00000000-0000-0000-0000-000000000102'),
  0::bigint,
  'facilitator sees no cross-brand mission'
);

select is(
  (select count(*) from mission_reports),
  1::bigint,
  'facilitator sees only their mission report'
);

select * from finish();
rollback;
