begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

select has_table('public', 'sell_out_captures', 'Sell-out captures table exists');
select has_table('public', 'sell_out_lines', 'Sell-out lines table exists');
select has_table('public', 'sell_out_evidence', 'Sell-out evidence table exists');
select has_function(
  'public',
  'save_sell_out_capture',
  array['uuid','uuid','uuid','sell_out_capture_method','date','date','text','numeric','text','jsonb','uuid'],
  'Sell-out capture save RPC exists'
);
select has_function(
  'public',
  'save_sell_out_line',
  array['uuid','uuid','uuid','text','text','text','integer','numeric','integer','integer','integer','numeric'],
  'Sell-out line save RPC exists'
);
select has_function(
  'public',
  'add_sell_out_evidence',
  array['uuid','sell_out_evidence_kind','text','text','text','bigint','text','text'],
  'Sell-out evidence RPC exists'
);
select has_function('public', 'submit_sell_out_capture', array['uuid'], 'Sell-out submission RPC exists');
select has_function('public', 'validate_sell_out_capture', array['uuid','boolean','text'], 'Sell-out validation RPC exists');
select has_function('public', 'get_sell_out_overview', array['uuid','date','date'], 'Sell-out analytics RPC exists');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

create temp table _manual_capture as
select public.save_sell_out_capture(
  null::uuid,
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'manual'::public.sell_out_capture_method,
  '2026-09-01',
  '2026-09-05',
  'Déclaration pharmacien',
  0.85,
  null,
  null,
  null
) as id;

select is(
  (select quality::text from public.sell_out_captures where id = (select id from _manual_capture)),
  'declared',
  'manual capture is explicitly classified as declared'
);

select lives_ok(
  format(
    'select public.save_sell_out_line(null,%L::uuid,%L::uuid,null,%L,%L,12,120.00,null,null,null,0.90)',
    (select id from _manual_capture),
    '00000000-0000-0000-0000-000000000601',
    '3400000000001',
    'Dermacalm'
  ),
  'brand admin records a manual sell-out line'
);

select lives_ok(
  format('select public.submit_sell_out_capture(%L::uuid)', (select id from _manual_capture)),
  'manual capture can be submitted for human validation'
);

select lives_ok(
  format('select public.validate_sell_out_capture(%L::uuid,true,%L)', (select id from _manual_capture), 'Relu avec le relevé terrain'),
  'human validation finalizes a submitted capture'
);

select is(
  (select status::text from public.sell_out_captures where id = (select id from _manual_capture)),
  'validated',
  'approved capture becomes validated'
);

select is(
  (select quality::text from public.sell_out_captures where id = (select id from _manual_capture)),
  'declared',
  'validated manual capture keeps declared quality rather than becoming confirmed'
);

select is(
  (select sell_out_units from public.get_sell_out_overview(
    '00000000-0000-0000-0000-000000000101',
    '2026-09-01',
    '2026-09-30'
  )),
  12::bigint,
  'analytics count only the validated sell-out units'
);

create temp table _stock_capture as
select public.save_sell_out_capture(
  null::uuid,
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'stock_inference'::public.sell_out_capture_method,
  '2026-09-01',
  '2026-09-05',
  'Stock compté en visite',
  0.70,
  null,
  null,
  null
) as id;

select lives_ok(
  format(
    'select public.save_sell_out_line(null,%L::uuid,%L::uuid,null,null,%L,null,null,10,5,7,0.70)',
    (select id from _stock_capture),
    '00000000-0000-0000-0000-000000000601',
    'Dermacalm'
  ),
  'stock inference line computes theoretical sell-out'
);

select is(
  (select theoretical_units from public.sell_out_lines where capture_id = (select id from _stock_capture)),
  8,
  'theoretical sell-out equals previous stock plus deliveries minus current stock'
);

select throws_ok(
  $$select public.save_sell_out_capture(
    null,
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'document'::public.sell_out_capture_method,
    '2026-09-01',
    '2026-09-05',
    'Extraction test',
    0.92,
    'extractor-v1',
    '{"patient_name":"Jean Dupont","units":3}'::jsonb,
    null
  )$$,
  '22023',
  'Sell-out extraction must not contain patient or customer personal data',
  'raw extraction containing patient PII is rejected'
);

create temp table _document_capture as
select public.save_sell_out_capture(
  null::uuid,
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'document'::public.sell_out_capture_method,
  '2026-09-01',
  '2026-09-05',
  'Photo caisse',
  0.92,
  'extractor-v1',
  '{"rows":[{"ean":"3400000000001","units":4}]}'::jsonb,
  null
) as id;

perform public.save_sell_out_line(
  null,
  (select id from _document_capture),
  '00000000-0000-0000-0000-000000000601',
  null,
  '3400000000001',
  'Dermacalm',
  4,
  40.00,
  null,
  null,
  null,
  0.92
);

select throws_ok(
  format('select public.submit_sell_out_capture(%L::uuid)', (select id from _document_capture)),
  '22023',
  'Document sell-out requires evidence before review',
  'document extraction cannot be submitted without its evidence'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.save_sell_out_capture(
    null,
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000411',
    'manual'::public.sell_out_capture_method,
    '2026-09-05',
    '2026-09-05',
    'Déclaration terrain',
    0.80,
    null,
    null,
    null
  )$$,
  'assigned agent can capture sell-out for an assigned pharmacy'
);

select throws_ok(
  $$select public.save_sell_out_capture(
    null,
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000412',
    'manual'::public.sell_out_capture_method,
    '2026-09-05',
    '2026-09-05',
    'Déclaration terrain',
    0.80,
    null,
    null,
    null
  )$$,
  '42501',
  'Sell-out capture forbidden',
  'agent cannot capture sell-out outside assigned pharmacies'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_sell_out_overview(
    '00000000-0000-0000-0000-000000000101',
    '2026-09-01',
    '2026-09-30'
  )$$,
  '42501',
  'Sell-out analytics access forbidden',
  'another brand admin cannot read Dermavita sell-out analytics'
);

select * from finish();
rollback;
