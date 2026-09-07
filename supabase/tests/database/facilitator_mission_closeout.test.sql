begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000d1',
  'authenticated','authenticated','facilitator-closeout@test.local','',now(),'{}','{}',now(),now(),'','','',''
);

insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
values (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  (select id from public.roles where key='facilitator'),
  'active'
);

insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
select '00000000-0000-0000-0000-0000000000a1',b.organization_id,b.id,(select id from public.roles where key='tr1_manager'),'active'
from public.brands b
on conflict do nothing;

select plan(7);
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok(
  $$select public.create_mission(
    '00000000-0000-0000-0000-000000000411',
    '{
      "mission_type":"animation",
      "title":"Animation closeout preuve",
      "objective":"Tester la fin de mission",
      "scheduled_start_at":"2026-12-15T08:00:00Z",
      "scheduled_end_at":"2026-12-15T16:00:00Z"
    }',
    '[]'
  )$$,
  'manager creates closeout test mission'
);

select public.change_mission_status((select id from public.missions where title='Animation closeout preuve'),'to_assign',null);
select public.assign_mission(
  (select id from public.missions where title='Animation closeout preuve'),
  '00000000-0000-0000-0000-0000000000d1',
  null,
  null
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',true);
select public.change_mission_status((select id from public.missions where title='Animation closeout preuve'),'accepted',null);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select public.schedule_mission(
  (select id from public.missions where title='Animation closeout preuve'),
  '2026-12-15T08:00:00Z',
  '2026-12-15T16:00:00Z'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',true);
select public.change_mission_status((select id from public.missions where title='Animation closeout preuve'),'in_progress',null);

select lives_ok(
  $$select public.save_mission_report(
    (select id from public.missions where title='Animation closeout preuve'),
    '{"report_status":"draft","summary":"Brouillon","units_sold":4,"duration_minutes":360,"customer_contacts":22}'
  )$$,
  'facilitator can keep an incomplete closeout as draft'
);

select is(
  (select data_quality_status::text from public.mission_reports where mission_id=(select id from public.missions where title='Animation closeout preuve')),
  'incomplete',
  'draft facilitator report is marked incomplete'
);

select throws_ok(
  $$select public.save_mission_report(
    (select id from public.missions where title='Animation closeout preuve'),
    '{"report_status":"submitted","summary":"Animation réalisée","units_sold":4,"duration_minutes":360,"customer_contacts":22}'
  )$$,
  '23514',
  'Facilitator closeout requires merch plan evidence',
  'animation cannot be submitted without merch plan evidence'
);

insert into public.mission_attachments(
  mission_id,brand_id,object_path,original_name,mime_type,size_bytes,visibility,uploaded_by,evidence_kind,analysis_status
)
select id,brand_id,brand_id::text || '/' || id::text || '/merch-plan.jpg','merch-plan.jpg','image/jpeg',1024,'shared',
  '00000000-0000-0000-0000-0000000000d1','merch_plan','confirmed'
from public.missions where title='Animation closeout preuve';

select throws_ok(
  $$select public.save_mission_report(
    (select id from public.missions where title='Animation closeout preuve'),
    '{"report_status":"submitted","summary":"Animation réalisée","units_sold":4,"duration_minutes":360,"customer_contacts":22}'
  )$$,
  '23514',
  'Facilitator closeout requires merchandising result evidence',
  'animation cannot be submitted without merchandising result evidence'
);

insert into public.mission_attachments(
  mission_id,brand_id,object_path,original_name,mime_type,size_bytes,visibility,uploaded_by,evidence_kind,analysis_status
)
select id,brand_id,brand_id::text || '/' || id::text || '/merch-after.jpg','merch-after.jpg','image/jpeg',1024,'shared',
  '00000000-0000-0000-0000-0000000000d1','merch_after','confirmed'
from public.missions where title='Animation closeout preuve';

select lives_ok(
  $$select public.save_mission_report(
    (select id from public.missions where title='Animation closeout preuve'),
    '{"report_status":"submitted","summary":"Animation réalisée","units_sold":4,"duration_minutes":360,"customer_contacts":22}'
  )$$,
  'complete facilitator animation can be submitted'
);

select is(
  (select data_quality_status::text from public.mission_reports where mission_id=(select id from public.missions where title='Animation closeout preuve')),
  'complete',
  'submitted facilitator report is marked complete'
);

select is(
  (select status::text from public.missions where title='Animation closeout preuve'),
  'report_pending',
  'submitted closeout moves mission to report pending'
);

select * from finish();
rollback;
