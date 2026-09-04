begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

insert into public.memberships(user_id,organization_id,brand_id,role_id,status) values
('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000102',(select id from roles where key='agent'),'active'),
('00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from roles where key='brand_user'),'active');
insert into public.pharmacy_assignments(brand_id,brand_pharmacy_id,user_id,assignment_type,is_primary,assigned_by) values
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000414','00000000-0000-0000-0000-0000000000a3','commercial_agent',true,'00000000-0000-0000-0000-0000000000a4'),
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000413','00000000-0000-0000-0000-0000000000a3','temporary_backup',false,'00000000-0000-0000-0000-0000000000a4');

select plan(15);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}',true);
select lives_ok($$select public.propose_mission('00000000-0000-0000-0000-000000000411','{"mission_type":"animation","title":"Proposition Emma","objective":"Conseiller","scheduled_start_at":"2030-06-10T08:00:00Z","scheduled_end_at":"2030-06-10T12:00:00Z","budget_estimated_ht":"250"}','[]')$$,'facilitator can propose an animation');
select is((select proposal_review_status from missions where title='Proposition Emma'),'pending'::mission_proposal_review_status,'provider proposal remains pending');
select throws_ok($$select public.propose_mission('00000000-0000-0000-0000-000000000411','{"mission_type":"commercial_visit","title":"Bad role","objective":"No","scheduled_start_at":"2030-06-11T08:00:00Z","scheduled_end_at":"2030-06-11T09:00:00Z"}','[]')$$,'42501','Mission type is incompatible with provider role','facilitator cannot propose a commercial visit');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is((select count(*) from public.get_my_field_agenda('2030-06-10','2030-06-10',null) where ownership='pharmacy_activity'),0::bigint,'pending provider proposal is hidden from responsible agent');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}',true);
select throws_ok($$select public.review_provider_mission_proposal((select id from missions where title='Proposition Emma'),'approved',null,null,null,null,null,null)$$,'42501','Proposal unavailable','read-only brand user cannot approve');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok($$select public.review_provider_mission_proposal((select id from missions where title='Proposition Emma'),'approved',null,null,null,null,null,null)$$,'brand admin can approve');
select is((select status from missions where title='Proposition Emma'),'scheduled'::mission_status,'approved proposal becomes scheduled directly');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}',true);
select is((select count(*) from public.get_my_field_agenda('2030-06-10','2030-06-10',null) where source_id=(select id from missions where title='Proposition Emma') and ownership='mine'),1::bigint,'approved mission is visible in provider agenda');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is((select count(*) from public.get_my_field_agenda('2030-06-10','2030-06-10',null) where source_id=(select id from missions where title='Proposition Emma') and ownership='pharmacy_activity'),1::bigint,'approved mission is visible as pharmacy activity to responsible agent');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}',true);
select is((select count(*) from public.get_my_field_agenda('2030-06-10','2030-06-10',null) where source_id=(select id from missions where title='Proposition Emma')),0::bigint,'unrelated agent cannot see pharmacy activity');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select lives_ok($$select public.create_field_visit('00000000-0000-0000-0000-000000000401','{"visit_kind":"client_visit","title":"Visite multimarque","scheduled_start_at":"2030-06-12T12:00:00Z","scheduled_end_at":"2030-06-12T12:45:00Z"}',array['00000000-0000-0000-0000-000000000411'::uuid,'00000000-0000-0000-0000-000000000414'::uuid])$$,'one visit can link two brands for the same pharmacy');
select is((select count(*) from field_visits where title='Visite multimarque'),1::bigint,'multibrand visit is not duplicated');
select is((select count(*) from field_visit_brands where visit_id=(select id from field_visits where title='Visite multimarque')),2::bigint,'both brand relations are linked');
select throws_ok($$select public.create_field_visit('00000000-0000-0000-0000-000000000401','{"visit_kind":"client_visit","title":"Mauvais mélange","scheduled_start_at":"2030-06-13T12:00:00Z","scheduled_end_at":"2030-06-13T12:45:00Z"}',array['00000000-0000-0000-0000-000000000411'::uuid,'00000000-0000-0000-0000-000000000413'::uuid])$$,'42501','Brand pharmacy unavailable for this visit','different physical pharmacies cannot be mixed');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}',true);
select throws_ok($$select public.reschedule_field_visit((select id from field_visits where title='Visite multimarque'),'2030-06-12T13:00:00Z')$$,'42501','Visit unavailable','user cannot move another user visit');

select * from finish();
rollback;
