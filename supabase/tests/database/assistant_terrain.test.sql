begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

select has_table('public', 'assistant_action_drafts', 'assistant drafts table exists');
select has_table('public', 'assistant_contexts', 'assistant contexts table exists');
select has_table('public', 'assistant_audit_logs', 'assistant private audit table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.assistant_action_drafts'::regclass), 'assistant drafts enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.assistant_contexts'::regclass), 'assistant contexts enforce RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.assistant_audit_logs'::regclass), 'assistant audit enforces RLS');

insert into public.assistant_action_drafts (
  id, organization_id, brand_id, user_id, pharmacy_id, brand_pharmacy_id,
  action_type, payload, status, created_at, updated_at, expires_at
) values
  (
    '10000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000411',
    'task',
    '{"task_type":"call","title":"Admin only","due_at":"2026-08-04T07:00:00Z","priority":"normal"}',
    'pending', now(), now(),
    now() + interval '30 minutes'
  ),
  (
    '10000000-0000-0000-0000-000000000702',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000411',
    'task',
    '{"task_type":"call","title":"Expired assistant task","due_at":"2026-08-04T07:00:00Z","priority":"normal"}',
    'pending', now() - interval '1 hour', now() - interval '1 hour',
    now() - interval '1 minute'
  );

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);

select throws_ok(
  $$insert into public.assistant_action_drafts (
    organization_id, brand_id, user_id, action_type, payload, expires_at
  ) values (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-0000000000a3',
    'task', '{}', now() + interval '30 minutes'
  )$$,
  '42501', null,
  'authenticated users cannot insert drafts directly'
);

select lives_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'interaction_with_next_action',
    '{"interaction_type":"visit","outcome":"completed","subject":"Compte rendu assistant","notes":"Intérêt DREAM","occurred_at":"2026-07-27T08:00:00Z","next_action_type":"call","next_action_at":"2026-08-04T07:00:00Z","brand_id":"00000000-0000-0000-0000-000000000102"}',
    0.96
  )$$,
  'agent creates a pending assistant draft through the secured RPC'
);
select is(
  (select count(*) from public.assistant_action_drafts),
  2::bigint,
  'agent reads only its own drafts'
);
select is(
  (select organization_id from public.assistant_action_drafts where payload ->> 'subject' = 'Compte rendu assistant'),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'draft organization is derived from the authorized brand'
);
select is(
  (select payload ->> 'brand_id' from public.assistant_action_drafts where payload ->> 'subject' = 'Compte rendu assistant'),
  '00000000-0000-0000-0000-000000000101',
  'forged brand id is overwritten with the trusted brand'
);
select throws_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000412',
    'task',
    '{"task_type":"call","title":"Intrusion","due_at":"2026-08-04T07:00:00Z"}',
    0.9
  )$$,
  '42501', 'Assistant pharmacy forbidden',
  'agent cannot prepare a draft for an unassigned pharmacy'
);
select throws_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000413',
    'task',
    '{"task_type":"call","title":"Other brand","due_at":"2026-08-04T07:00:00Z"}',
    0.9
  )$$,
  '42501', 'Assistant draft forbidden',
  'agent cannot forge another brand id'
);
select is(
  (select count(*) from public.assistant_action_drafts where id = '10000000-0000-0000-0000-000000000701'),
  0::bigint,
  'agent cannot read another user draft'
);
select throws_ok(
  $$select public.confirm_assistant_draft('10000000-0000-0000-0000-000000000701')$$,
  '42501', 'Assistant draft forbidden',
  'agent cannot confirm another user draft'
);
select throws_ok(
  $$select public.update_assistant_draft(
    '10000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000411',
    '{"task_type":"call","title":"Changed","due_at":"2026-08-04T07:00:00Z"}'
  )$$,
  '42501', 'Assistant draft forbidden',
  'agent cannot modify another user draft'
);
select is(
  public.confirm_assistant_draft('10000000-0000-0000-0000-000000000702') ->> 'status',
  'expired',
  'expired draft cannot be confirmed'
);
select is(
  (select status::text from public.assistant_action_drafts where id = '10000000-0000-0000-0000-000000000702'),
  'expired',
  'expired draft is persisted as expired'
);

select lives_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'task',
    '{"task_type":"call","title":"Assistant idempotent task","description":"Test confirmation","due_at":"2026-08-04T07:00:00Z","priority":"high"}',
    0.95
  )$$,
  'agent prepares a task draft'
);
select is(
  (public.confirm_assistant_draft((
    select id from public.assistant_action_drafts where payload ->> 'title' = 'Assistant idempotent task'
  )) ->> 'status'),
  'confirmed',
  'pending task draft is confirmed'
);
select is(
  (select count(*) from public.tasks where title = 'Assistant idempotent task'),
  1::bigint,
  'confirmation creates exactly one final task'
);
select is(
  (public.confirm_assistant_draft((
    select id from public.assistant_action_drafts where payload ->> 'title' = 'Assistant idempotent task'
  )) ->> 'already_confirmed')::boolean,
  true,
  'double confirmation is idempotent'
);
select is(
  (select count(*) from public.tasks where title = 'Assistant idempotent task'),
  1::bigint,
  'double confirmation creates no duplicate'
);

select lives_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'interaction',
    '{"interaction_type":"visit","outcome":"other","subject":"Cancelled assistant interaction","notes":"Do not create","occurred_at":"2026-07-27T08:00:00Z"}',
    0.84
  )$$,
  'agent prepares a cancellable interaction draft'
);
select is(
  (public.cancel_assistant_draft((
    select id from public.assistant_action_drafts where payload ->> 'subject' = 'Cancelled assistant interaction'
  ))).status::text,
  'cancelled',
  'pending draft can be cancelled'
);
select is(
  (select count(*) from public.interactions where subject = 'Cancelled assistant interaction'),
  0::bigint,
  'cancellation creates no business interaction'
);

select lives_ok(
  $$select public.create_assistant_draft(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'interaction',
    '{"interaction_type":"visit","outcome":"other","subject":"Editable assistant interaction","notes":"Initial note","occurred_at":"2026-07-27T08:00:00Z"}',
    0.84
  )$$,
  'agent prepares an editable interaction draft'
);
select is(
  (public.update_assistant_draft(
    (select id from public.assistant_action_drafts where payload ->> 'subject' = 'Editable assistant interaction'),
    '00000000-0000-0000-0000-000000000411',
    '{"interaction_type":"visit","outcome":"interested","subject":"Editable assistant interaction","notes":"Corrected note","occurred_at":"2026-07-27T08:00:00Z"}'
  )).payload ->> 'notes',
  'Corrected note',
  'pending draft accepts a validated modification'
);
select throws_ok(
  $$select public.update_assistant_draft(
    (select id from public.assistant_action_drafts where payload ->> 'subject' = 'Editable assistant interaction'),
    '00000000-0000-0000-0000-000000000412',
    '{"interaction_type":"visit","outcome":"interested","subject":"Editable assistant interaction","notes":"Forged pharmacy","occurred_at":"2026-07-27T08:00:00Z"}'
  )$$,
  '42501', 'Assistant pharmacy forbidden',
  'draft modification cannot switch to an unauthorized pharmacy'
);

select lives_ok(
  $$select public.set_assistant_context(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'prepare_interaction',
    (select id from public.assistant_action_drafts where payload ->> 'subject' = 'Editable assistant interaction')
  )$$,
  'agent stores an isolated expiring context'
);
select is(
  (select active_brand_pharmacy_id from public.assistant_contexts),
  '00000000-0000-0000-0000-000000000411'::uuid,
  'agent reads its own active context'
);
select lives_ok(
  $$select public.record_assistant_audit(
    '00000000-0000-0000-0000-000000000101',
    'tool_called',
    '00000000-0000-0000-0000-000000000401',
    null,
    '{"tool":"get_pharmacy_summary"}'
  )$$,
  'agent records private assistant audit through the RPC'
);
select ok(
  (select count(*) from public.assistant_audit_logs) >= 1,
  'agent can read only its own audit trail'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',true);
select is((select count(*) from public.assistant_action_drafts), 0::bigint, 'another brand sees no assistant drafts');
select is((select count(*) from public.assistant_contexts), 0::bigint, 'another brand sees no assistant context');
select is((select count(*) from public.assistant_audit_logs), 0::bigint, 'another brand sees no assistant audit');
select throws_ok(
  $$select public.confirm_assistant_draft((
    select id from public.assistant_action_drafts where payload ->> 'title' = 'Assistant idempotent task'
  ))$$,
  '42501', 'Assistant draft forbidden',
  'another brand cannot confirm a hidden draft id'
);

reset role;
update public.memberships set status = 'suspended'
where user_id = '00000000-0000-0000-0000-0000000000a3'
  and brand_id = '00000000-0000-0000-0000-000000000101';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is(
  (select count(*) from public.assistant_action_drafts),
  0::bigint,
  'suspended membership immediately loses assistant draft access'
);

select * from finish();
rollback;
