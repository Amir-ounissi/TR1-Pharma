begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select has_table('public', 'personal_field_missions', 'private facilitator missions table exists');
select has_table('public', 'personal_field_mission_evidence', 'private facilitator evidence table exists');

select ok(
  exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid = constraint_row.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'mission_attachments'
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) like '%merch_plan%'
  ),
  'TR1 mission evidence accepts the explicit merch plan photo kind'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation on relation.oid = constraint_row.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'personal_field_mission_evidence'
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) like '%merch_plan%'
  ),
  'private mission evidence accepts the explicit merch plan photo kind'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.personal_field_missions(
    id, user_id, mission_type, status, title, brand_name, pharmacy_name,
    scheduled_start_at, scheduled_end_at
  ) values (
    'f1000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a5',
    'animation', 'planned', 'Animation marque externe', 'Marque externe', 'Pharmacie privée',
    '2026-09-20T09:00:00+02:00', '2026-09-20T17:00:00+02:00'
  )$$,
  'facilitator can create a private mission owned by their account'
);

select is(
  (select count(*) from public.personal_field_missions where id = 'f1000000-0000-0000-0000-000000000001'),
  1::bigint,
  'facilitator can read their private mission'
);

select lives_ok(
  $$insert into public.personal_field_mission_evidence(
    id, user_id, personal_mission_id, evidence_kind, bucket_id, object_path,
    original_name, mime_type, size_bytes, analysis_status
  ) values (
    'f2000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a5',
    'f1000000-0000-0000-0000-000000000001',
    'merch_plan', 'personal-field-evidence',
    '00000000-0000-0000-0000-0000000000a5/f1000000-0000-0000-0000-000000000001/plan-merch.jpg',
    'plan-merch.jpg', 'image/jpeg', 2048, 'confirmed'
  )$$,
  'facilitator can store the merch plan evidence on their private mission'
);

select is(
  (select count(*) from public.personal_field_mission_evidence where id = 'f2000000-0000-0000-0000-000000000001'),
  1::bigint,
  'facilitator can read their private merch plan evidence'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.personal_field_missions where id = 'f1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'another user cannot read the private mission'
);

select is(
  (select count(*) from public.personal_field_mission_evidence where id = 'f2000000-0000-0000-0000-000000000001'),
  0::bigint,
  'another user cannot read private mission evidence'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.personal_field_missions where id = 'f1000000-0000-0000-0000-000000000001'),
  0::bigint,
  'a TR1 brand administrator cannot read the facilitator private mission'
);

reset role;
select * from finish();
rollback;
