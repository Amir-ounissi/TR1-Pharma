begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000c7',
  'authenticated','authenticated','facilitator-animation@test.local','',now(),'{}','{}',now(),now(),'','','',''
);

insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
values (
  '00000000-0000-0000-0000-0000000000c7',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  (select id from public.roles where key='facilitator'),
  'active'
);

select plan(13);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);

select is(
  (select count(*) from public.get_animation_request_pharmacies('00000000-0000-0000-0000-000000000101')),
  1::bigint,
  'agent animation catalog contains only the active primary portfolio'
);

select is(
  (select brand_pharmacy_id from public.get_animation_request_pharmacies('00000000-0000-0000-0000-000000000101')),
  '00000000-0000-0000-0000-000000000411'::uuid,
  'agent animation catalog exposes the assigned pharmacy'
);

select lives_ok(
  $$select public.request_animation(
    '00000000-0000-0000-0000-000000000411',
    null,
    '{
      "title":"Animation demandée par agent",
      "objective":"Développer le sell-out",
      "scheduled_start_at":"2026-12-16T09:00:00Z",
      "scheduled_end_at":"2026-12-16T17:00:00Z",
      "provider_cost_ht":250,
      "travel_cost_ht":35,
      "execution_requirements":{
        "merch_plan_required":true,
        "merch_result_required":true,
        "cash_register_required":true,
        "sales_by_product_required":true
      }
    }',
    '[{"product_id":"00000000-0000-0000-0000-000000000601","target_quantity":18}]'
  )$$,
  'agent creates a governed animation request on an assigned pharmacy'
);

select is(
  (select status from public.missions where title='Animation demandée par agent'),
  'requested'::public.mission_status,
  'unassigned agent animation starts as requested'
);

select is(
  (select requested_by from public.missions where title='Animation demandée par agent'),
  '00000000-0000-0000-0000-0000000000a3'::uuid,
  'commercial requester is retained on the mission'
);

select is(
  (select execution_requirements->>'cash_register_required' from public.missions where title='Animation demandée par agent'),
  'true',
  'requested closeout requirements are persisted'
);

select throws_ok(
  $$select public.request_animation(
    '00000000-0000-0000-0000-000000000412',
    null,
    '{"title":"Animation hors portefeuille","objective":"Interdit","scheduled_start_at":"2026-12-17T09:00:00Z","scheduled_end_at":"2026-12-17T17:00:00Z"}',
    '[]'
  )$$,
  '42501',
  'Animation pharmacy unavailable',
  'agent cannot request an animation outside the active primary portfolio'
);

select lives_ok(
  $$select public.request_animation(
    '00000000-0000-0000-0000-000000000411',
    '00000000-0000-0000-0000-0000000000c7',
    '{
      "title":"Animation adressée à animateur",
      "objective":"Tester acceptation et planification",
      "scheduled_start_at":"2026-12-18T09:00:00Z",
      "scheduled_end_at":"2026-12-18T17:00:00Z",
      "provider_cost_ht":275,
      "travel_cost_ht":30
    }',
    '[]'
  )$$,
  'agent can address an animation directly to an active facilitator'
);

select is(
  (select status from public.missions where title='Animation adressée à animateur'),
  'assigned'::public.mission_status,
  'direct request awaits facilitator acceptance'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}',true);
select lives_ok(
  $$select public.change_mission_status(
    (select id from public.missions where title='Animation adressée à animateur'),
    'accepted',
    null
  )$$,
  'facilitator accepts directly addressed animation'
);

select is(
  (select status from public.missions where title='Animation adressée à animateur'),
  'accepted'::public.mission_status,
  'accepted animation stays pending scheduling'
);

select lives_ok(
  $$select public.schedule_my_animation(
    (select id from public.missions where title='Animation adressée à animateur'),
    '2026-12-18T10:00:00Z',
    '2026-12-18T18:00:00Z'
  )$$,
  'assigned facilitator confirms the definitive animation slot'
);

select is(
  (select status from public.missions where title='Animation adressée à animateur'),
  'scheduled'::public.mission_status,
  'self scheduling moves accepted animation to scheduled'
);

select * from finish();
rollback;
