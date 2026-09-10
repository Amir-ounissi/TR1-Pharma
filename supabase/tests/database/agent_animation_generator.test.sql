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
      "days_per_month":2,
      "start_month":"2026-12-01",
      "remuneration_model":"fixed",
      "remuneration_config":{"fixed_amount_ht":250},
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
  'agent creates a governed monthly animation request on an assigned pharmacy'
);

select is(
  (select status from public.missions where title='Animation demandée par agent'),
  'requested'::public.mission_status,
  'unassigned agent animation request starts as requested'
);

select is(
  (select requested_by from public.missions where title='Animation demandée par agent'),
  '00000000-0000-0000-0000-0000000000a3'::uuid,
  'commercial requester is retained on the animation request'
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
    '{
      "title":"Animation hors portefeuille",
      "objective":"Interdit",
      "days_per_month":1,
      "start_month":"2026-12-01",
      "remuneration_model":"fixed",
      "remuneration_config":{"fixed_amount_ht":200}
    }',
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
      "days_per_month":2,
      "start_month":"2026-12-01",
      "remuneration_model":"fixed",
      "remuneration_config":{"fixed_amount_ht":275},
      "travel_cost_ht":30
    }',
    '[]'
  )$$,
  'agent can address a monthly animation request directly to an active facilitator'
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
  'facilitator accepts directly addressed animation request'
);

select is(
  (select status from public.missions where title='Animation adressée à animateur'),
  'accepted'::public.mission_status,
  'accepted animation request stays pending day scheduling'
);

select lives_ok(
  $$select public.schedule_animation_request_day(
    (select id from public.missions where title='Animation adressée à animateur' and animation_parent_request_id is null),
    '2026-12-18T10:00:00Z',
    '2026-12-18T18:00:00Z'
  )$$,
  'assigned facilitator positions one concrete animation day'
);

select is(
  (
    select status
    from public.missions
    where animation_parent_request_id = (
      select id
      from public.missions
      where title='Animation adressée à animateur'
        and animation_parent_request_id is null
    )
    order by created_at desc
    limit 1
  ),
  'scheduled'::public.mission_status,
  'planning creates a scheduled child animation day'
);

select * from finish();
rollback;
