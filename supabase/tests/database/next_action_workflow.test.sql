begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  null::text,
  'fixture starts without next action'
);

insert into public.field_visits(
  id, owner_user_id, pharmacy_id, visit_kind, status, title, objective,
  scheduled_start_at, scheduled_end_at, source, created_by
) values (
  '00000000-0000-0000-0000-00000000f901',
  '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-000000000402',
  'prospecting',
  'planned',
  'Visite P1',
  'Prospection',
  now() + interval '2 days',
  now() + interval '2 days 45 minutes',
  'manual',
  '00000000-0000-0000-0000-0000000000a2'
);

insert into public.field_visit_brands(
  visit_id, brand_id, brand_pharmacy_id, objective, is_primary
) values (
  '00000000-0000-0000-0000-00000000f901',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000412',
  'Prospection',
  true
);

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  'prospecting_visit',
  'planned field visit becomes next action'
);

select ok(
  (select has_next_action from public.commercial_account_health where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),
  'commercial health sees planned field visit'
);

insert into public.tasks(
  id, brand_id, brand_pharmacy_id, task_type, title, due_at,
  status, assigned_to, created_by, source
) values (
  '00000000-0000-0000-0000-00000000f902',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000412',
  'call',
  'Appel P1',
  now() + interval '1 day',
  'open',
  '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a2',
  'manual'
);

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  'call',
  'earlier open task wins over later visit'
);

update public.tasks
set status='completed',
    completed_at=now(),
    completed_by='00000000-0000-0000-0000-0000000000a2'
where id='00000000-0000-0000-0000-00000000f902';

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  'prospecting_visit',
  'visit resumes after earlier task completion'
);

update public.field_visits
set status='cancelled'
where id='00000000-0000-0000-0000-00000000f901';

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  null::text,
  'cancelled visit is removed from next action'
);

insert into public.field_visits(
  id, owner_user_id, pharmacy_id, visit_kind, status, title, objective,
  scheduled_start_at, scheduled_end_at, source, created_by
) values (
  '00000000-0000-0000-0000-00000000f904',
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-000000000402',
  'prospecting',
  'planned',
  'Visite P1 dépassée',
  'Prospection',
  now() - interval '1 day',
  now() - interval '23 hours 15 minutes',
  'manual',
  '00000000-0000-0000-0000-0000000000a2'
);

insert into public.field_visit_brands(
  visit_id, brand_id, brand_pharmacy_id, objective, is_primary
) values (
  '00000000-0000-0000-0000-00000000f904',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000412',
  'Prospection',
  true
);

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  'visit_overdue',
  'past planned visit is surfaced as an overdue visit'
);

update public.field_visits
set status='cancelled'
where id='00000000-0000-0000-0000-00000000f904';

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  null::text,
  'resolved overdue visit no longer blocks the next action'
);

insert into public.missions(
  id, organization_id, brand_id, pharmacy_id, brand_pharmacy_id,
  assigned_user_id, title, scheduled_start_at, scheduled_end_at,
  status, mission_type, objective, managed_by, created_by
) values (
  '00000000-0000-0000-0000-00000000f903',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000412',
  '00000000-0000-0000-0000-0000000000a3',
  'Animation P1',
  now() + interval '300 days',
  now() + interval '300 days 4 hours',
  'scheduled',
  'animation',
  'Animation officine',
  '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a2'
);

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  'animation',
  'scheduled mission becomes next action'
);

update public.missions
set status='cancelled',
    cancelled_at=now(),
    cancellation_reason='Test'
where id='00000000-0000-0000-0000-00000000f903';

select is(
  (select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),
  null::text,
  'cancelled mission is removed from next action'
);

select * from finish();
rollback;
