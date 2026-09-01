begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select extensions.plan(20);

set local role authenticated;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select extensions.lives_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000411',
    '{
      "mission_type":"animation",
      "status":"assigned",
      "title":"Smoke Dermavita Mission",
      "objective":"Tenant smoke",
      "assigned_user_id":"00000000-0000-0000-0000-0000000000a5",
      "scheduled_start_at":"2026-08-10T08:00:00Z",
      "scheduled_end_at":"2026-08-10T12:00:00Z",
      "provider_cost_ht":"100",
      "travel_cost_ht":"20"
    }'::jsonb,
    '[]'::jsonb
  )$$,
  'TR1 creates Dermavita smoke mission'
);
select extensions.lives_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000413',
    '{
      "mission_type":"training",
      "status":"assigned",
      "title":"Smoke Nutrilab Mission",
      "objective":"Tenant smoke",
      "assigned_user_id":"00000000-0000-0000-0000-0000000000a4",
      "scheduled_start_at":"2026-08-10T13:00:00Z",
      "scheduled_end_at":"2026-08-10T15:00:00Z"
    }'::jsonb,
    '[]'::jsonb
  )$$,
  'TR1 creates Nutrilab smoke mission'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}',true);
select extensions.is(
  (select count(*) from public.missions where title = 'Smoke Dermavita Mission'),
  1::bigint,
  'facilitator reads authorized mission'
);
select extensions.is(
  (select count(*) from public.missions where title = 'Smoke Nutrilab Mission'),
  0::bigint,
  'facilitator cannot read other tenant mission'
);
select extensions.lives_ok(
  $$select public.change_mission_status(
    (select id from public.missions where title = 'Smoke Dermavita Mission'),
    'accepted',
    null
  )$$,
  'facilitator accepts authorized mission'
);
select extensions.throws_ok(
  $$select public.change_mission_status(
    (select id from public.missions where title = 'Smoke Dermavita Mission'),
    'scheduled',
    null
  )$$,
  '42501',
  'Provider cannot perform this transition',
  'facilitator cannot schedule mission'
);
select extensions.throws_ok(
  $$select public.change_mission_status(
    (select id from public.missions where title = 'Smoke Nutrilab Mission'),
    'accepted',
    null
  )$$,
  '42501',
  'Mission unavailable',
  'facilitator cannot change other tenant mission'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select extensions.is(
  (select count(*) from public.brands where id = '00000000-0000-0000-0000-000000000101'),
  1::bigint,
  'brand admin reads own brand only'
);
select extensions.is(
  (select count(*) from public.brands where id = '00000000-0000-0000-0000-000000000102'),
  0::bigint,
  'brand admin cannot read other brand'
);
with changed as (
  update public.brand_pharmacies
  set notes = 'Smoke admin update'
  where id = '00000000-0000-0000-0000-000000000411'
  returning 1
)
select extensions.is((select count(*) from changed), 1::bigint, 'brand admin updates own brand pharmacy');
select extensions.throws_ok(
  $$insert into public.brand_pharmacies (brand_id, pharmacy_id)
    values ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000402')$$,
  '42501',
  null,
  'brand admin cannot insert other brand relation'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select extensions.is(
  (select count(*) from public.brand_pharmacies where id = '00000000-0000-0000-0000-000000000411'),
  1::bigint,
  'agent reads assigned brand pharmacy'
);
select extensions.is(
  (select count(*) from public.brand_pharmacies where id = '00000000-0000-0000-0000-000000000412'),
  0::bigint,
  'agent cannot read unassigned brand pharmacy'
);
select extensions.is(
  (select count(*) from public.brand_pharmacies where id = '00000000-0000-0000-0000-000000000413'),
  0::bigint,
  'agent cannot read other tenant brand pharmacy'
);
select extensions.lives_ok(
  $$insert into public.tasks (
      brand_id, brand_pharmacy_id, task_type, title, description, priority, due_at, assigned_to, created_by, source
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000411',
      'follow_up',
      'Agent smoke allowed',
      'Allowed task on assigned account',
      'normal',
      now() + interval '1 day',
      '00000000-0000-0000-0000-0000000000a3',
      '00000000-0000-0000-0000-0000000000a3',
      'manual'
    )$$,
  'agent can create task on assigned account'
);
select extensions.throws_ok(
  $$insert into public.tasks (
      brand_id, brand_pharmacy_id, task_type, title, description, priority, due_at, assigned_to, created_by, source
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000412',
      'follow_up',
      'Agent smoke forbidden',
      'Forbidden task on unassigned account',
      'normal',
      now() + interval '1 day',
      '00000000-0000-0000-0000-0000000000a3',
      '00000000-0000-0000-0000-0000000000a3',
      'manual'
    )$$,
  '23514',
  'Agent is not assigned to this pharmacy',
  'agent cannot create task on unassigned account'
);
select extensions.lives_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'task',
    '{"task_type":"call","title":"Assistant smoke task","due_at":"2026-08-11T09:00:00Z"}',
    0.95
  )$$,
  'assistant creates draft on assigned account'
);
select extensions.throws_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000412',
    'task',
    '{"task_type":"call","title":"Assistant forbidden task","due_at":"2026-08-11T09:00:00Z"}',
    0.95
  )$$,
  '42501',
  'Assistant pharmacy forbidden',
  'assistant cannot target unassigned account'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select extensions.throws_ok(
  $$select public.confirm_assistant_draft(
    (select id from public.assistant_action_drafts where payload ->> 'title' = 'Assistant smoke task' order by created_at desc limit 1)
  )$$,
  '42501',
  'Assistant draft forbidden',
  'assistant confirm wrong owner refused'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select extensions.is((select count(*) from public.brands), 2::bigint, 'super admin reads all brands');
select extensions.is((select count(*) from public.brand_pharmacies where archived_at is null), 4::bigint, 'super admin reads all brand pharmacies');
select extensions.is((select count(*) from public.pharmacies), 3::bigint, 'super admin reads all pharmacies');

select * from extensions.finish();
rollback;
