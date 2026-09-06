begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select has_function(
  'public',
  'get_next_best_actions',
  array['uuid','integer','uuid'],
  'Next Best Action RPC exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from public.get_next_best_actions(
    '00000000-0000-0000-0000-000000000101',
    50,
    null
  )$$,
  'brand admin can read deterministic next best actions'
);

create temp table _nba as
select * from public.get_next_best_actions(
  '00000000-0000-0000-0000-000000000101',
  50,
  null
);

select ok(
  (select count(*) > 0 from _nba),
  'seeded brand exposes at least one actionable recommendation'
);

select ok(
  (select bool_and(coalesce(array_length(rationale, 1), 0) > 0) from _nba),
  'every recommendation explains its rationale'
);

select ok(
  (select bool_and(jsonb_typeof(evidence) = 'object') from _nba),
  'every recommendation exposes observable evidence'
);

select ok(
  (select bool_and(action_type in (
    'reactivate_account','recover_at_risk','secure_first_reorder','recover_reorder',
    'prepare_reorder','follow_up_mission','schedule_follow_up'
  )) from _nba),
  'only documented deterministic action types are returned'
);

create temp table _task_count_before as
select count(*)::bigint as value from public.tasks;

perform * from public.get_next_best_actions(
  '00000000-0000-0000-0000-000000000101',
  50,
  null
);

select is(
  (select count(*)::bigint from public.tasks),
  (select value from _task_count_before),
  'reading recommendations never creates a task'
);

select ok(
  not exists (
    select 1
    from public.get_next_best_actions(
      '00000000-0000-0000-0000-000000000101',
      50,
      (select brand_pharmacy_id from _nba order by action_score desc limit 1)
    ) scoped
    where scoped.brand_pharmacy_id <> (select brand_pharmacy_id from _nba order by action_score desc limit 1)
  ),
  'exact pharmacy filtering cannot leak another account'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_next_best_actions(
    '00000000-0000-0000-0000-000000000101',
    50,
    null
  )$$,
  '42501',
  'Next best action forbidden',
  'agent cannot read the brand-wide recommendation layer'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_next_best_actions(
    '00000000-0000-0000-0000-000000000101',
    50,
    null
  )$$,
  '42501',
  'Next best action forbidden',
  'another brand admin cannot read Dermavita recommendations'
);

select * from finish();
rollback;
