begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select has_function(
  'public',
  'apply_sell_out_document_preview',
  array['uuid','date','date','numeric','text','jsonb','jsonb'],
  'Agent document preview RPC exists'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.apply_sell_out_document_preview(uuid,date,date,numeric,text,jsonb,jsonb)'::regprocedure),
  'document preview RPC is security-definer'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

create temp table _capture as
select public.save_sell_out_capture(
  null,
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000411',
  'document'::public.sell_out_capture_method,
  '2026-09-05',
  '2026-09-05',
  'Document Agent pgTAP',
  null,
  null,
  null,
  null
) as id;

select is(
  public.apply_sell_out_document_preview(
    (select id from _capture),
    '2026-09-01',
    '2026-09-07',
    0.96,
    'agent-web-document-v1',
    '{"periodStart":"2026-09-01","periodEnd":"2026-09-07","personalDataDetected":false,"lines":[{"label":"Dermacalm","sourceProductCode":"DV-DC-50","ean":"3400000000001","unitsSold":7,"revenueHt":null,"revenueTtc":209.3,"unitPriceTtc":29.9,"taxRate":5.5,"confidence":0.96}],"totalUnits":7,"totalRevenueHt":null,"totalRevenueTtc":209.3,"confidence":0.96,"warnings":[]}'::jsonb,
    '[{"product_id":"00000000-0000-0000-0000-000000000601","source_product_code":"DV-DC-50","ean":"3400000000001","label":"Dermacalm","units_sold":7,"revenue_ht":198.39,"confidence":0.96}]'::jsonb
  ),
  1,
  'agent applies one reviewed document line'
);

select is(
  (select count(*)::integer from public.sell_out_lines where capture_id = (select id from _capture)),
  1,
  'one line is persisted'
);

select is(
  (select units_sold from public.sell_out_lines where capture_id = (select id from _capture)),
  7,
  'reviewed units are persisted'
);

select is(
  (select period_start from public.sell_out_captures where id = (select id from _capture)),
  '2026-09-01'::date,
  'document period is updated after human review'
);

select is(
  public.apply_sell_out_document_preview(
    (select id from _capture),
    '2026-09-01',
    '2026-09-07',
    0.96,
    'agent-web-document-v1',
    '{"periodStart":"2026-09-01","periodEnd":"2026-09-07","personalDataDetected":false,"lines":[{"label":"Dermacalm","sourceProductCode":"DV-DC-50","ean":"3400000000001","unitsSold":8,"revenueHt":null,"revenueTtc":239.2,"unitPriceTtc":29.9,"taxRate":5.5,"confidence":0.96}],"totalUnits":8,"totalRevenueHt":null,"totalRevenueTtc":239.2,"confidence":0.96,"warnings":[]}'::jsonb,
    '[{"product_id":"00000000-0000-0000-0000-000000000601","source_product_code":"DV-DC-50","ean":"3400000000001","label":"Dermacalm","units_sold":8,"revenue_ht":226.73,"confidence":0.96}]'::jsonb
  ),
  1,
  'retry replaces the reviewed preview instead of appending'
);

select is(
  (select count(*)::integer from public.sell_out_lines where capture_id = (select id from _capture)),
  1,
  'retry remains idempotent at capture-line level'
);

select is(
  (select units_sold from public.sell_out_lines where capture_id = (select id from _capture)),
  8,
  'retry keeps the latest human-reviewed value'
);

select throws_ok(
  format(
    $$select public.apply_sell_out_document_preview(
      %L::uuid,'2026-09-01','2026-09-07',0.9,'agent-web-document-v1',
      '{"patient_name":"Jean Dupont"}'::jsonb,
      '[{"product_id":"00000000-0000-0000-0000-000000000601","units_sold":1}]'::jsonb
    )$$,
    (select id from _capture)
  ),
  '22023',
  'Sell-out extraction must not contain patient or customer personal data',
  'PII extraction payload is rejected'
);

select throws_ok(
  format(
    $$select public.apply_sell_out_document_preview(
      %L::uuid,'2026-09-01','2026-09-07',0.9,'agent-web-document-v1',
      '{"personalDataDetected":false}'::jsonb,
      '[{"product_id":"00000000-0000-0000-0000-000000000602","units_sold":1}]'::jsonb
    )$$,
    (select id from _capture)
  ),
  '23514',
  'Sell-out product is outside active brand',
  'product from another brand is rejected'
);

select * from finish();
rollback;
