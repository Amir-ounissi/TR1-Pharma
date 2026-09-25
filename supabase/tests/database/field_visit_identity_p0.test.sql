begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

insert into public.memberships(user_id,organization_id,brand_id,role_id,status) values
('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000102',(select id from roles where key='agent'),'active');

insert into public.pharmacy_assignments(brand_id,brand_pharmacy_id,user_id,assignment_type,is_primary,assigned_by) values
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000414','00000000-0000-0000-0000-0000000000a3','commercial_agent',true,'00000000-0000-0000-0000-0000000000a4');

select plan(4);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);

select lives_ok(
  $$select public.create_field_visit(
    '00000000-0000-0000-0000-000000000401',
    '{"visit_kind":"client_visit","title":"P0 idempotence","objective":"Suivi commercial","scheduled_start_at":"2031-06-12T12:00:00Z","scheduled_end_at":"2031-06-12T12:45:00Z"}',
    array['00000000-0000-0000-0000-000000000411'::uuid]
  )$$,
  'first local visit creation succeeds'
);

select lives_ok(
  $$select public.create_field_visit(
    '00000000-0000-0000-0000-000000000401',
    '{"visit_kind":"client_visit","title":"P0 idempotence","objective":"Suivi commercial","scheduled_start_at":"2031-06-12T12:00:00Z","scheduled_end_at":"2031-06-12T12:45:00Z"}',
    array['00000000-0000-0000-0000-000000000411'::uuid,'00000000-0000-0000-0000-000000000414'::uuid]
  )$$,
  'retry reuses the visit and extends its brand scope'
);

select is(
  (select count(*) from public.field_visits where title='P0 idempotence'),
  1::bigint,
  'retry keeps one physical visit'
);

select is(
  (select count(*) from public.field_visit_brands where visit_id=(select id from public.field_visits where title='P0 idempotence')),
  2::bigint,
  'retry links both brands to the same visit'
);

select * from finish();
rollback;
