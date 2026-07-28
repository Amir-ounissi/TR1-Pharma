begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','animator@test.local','',now(),'{}','{}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c2','authenticated','authenticated','inactive-provider@test.local','',now(),'{}','{}',now(),now(),'','','','');
insert into public.memberships(user_id,organization_id,brand_id,role_id,status) values
('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from roles where key='facilitator'),'active'),
('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from roles where key='facilitator'),'suspended');
insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
select '00000000-0000-0000-0000-0000000000a1',b.organization_id,b.id,(select id from roles where key='tr1_manager'),'active' from brands b on conflict do nothing;

select plan(39);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);

select lives_ok($$select public.create_mission('00000000-0000-0000-0000-000000000411','{"mission_type":"animation","status":"assigned","title":"Animation été","objective":"Vendre et conseiller","assigned_user_id":"00000000-0000-0000-0000-0000000000c1","scheduled_start_at":"2026-08-10T08:00:00Z","scheduled_end_at":"2026-08-10T16:00:00Z","provider_cost_ht":"300","travel_cost_ht":"40"}','[{"product_id":"00000000-0000-0000-0000-000000000601","objective_type":"sell_out","target_quantity":20}]')$$,'valid mission is created');
select is((select count(*) from missions where title='Animation été'),1::bigint,'created mission exists');
select is((select cost_actual_ht from missions where title='Animation été'),340.00::numeric,'actual cost is server calculated');
select is((select count(*) from mission_status_history where mission_id=(select id from missions where title='Animation été')),1::bigint,'initial status is historized');
select is((select count(*) from mission_products where mission_id=(select id from missions where title='Animation été')),1::bigint,'mission product is linked');
select throws_ok($$select public.create_mission('00000000-0000-0000-0000-000000000411','{"mission_type":"bad_type","title":"Bad","objective":"Bad"}','[]')$$,'22P02',null,'unknown mission type is blocked');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select throws_ok($$select public.create_mission('00000000-0000-0000-0000-000000000413','{"mission_type":"animation","title":"Cross brand","objective":"Forbidden"}','[]')$$,'42501','Brand pharmacy unavailable','cross-brand pharmacy is blocked');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select throws_ok($$select public.create_mission('00000000-0000-0000-0000-000000000411','{"mission_type":"animation","status":"assigned","title":"Inactive","objective":"Forbidden","assigned_user_id":"00000000-0000-0000-0000-0000000000c2"}','[]')$$,'23514','Assigned user is not active for this brand','inactive provider is blocked');
select throws_ok($$select public.create_mission('00000000-0000-0000-0000-000000000411','{"mission_type":"animation","status":"assigned","title":"Overlap","objective":"Forbidden","assigned_user_id":"00000000-0000-0000-0000-0000000000c1","scheduled_start_at":"2026-08-10T10:00:00Z","scheduled_end_at":"2026-08-10T12:00:00Z"}','[]')$$,'23P01','Provider schedule overlap','simple overlap is blocked');
select throws_ok($$insert into mission_products(mission_id,brand_id,product_id) values ((select id from missions where title='Animation été'),'00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000602')$$,'23503',null,'cross-brand mission product is blocked');

select lives_ok($$select public.change_mission_status((select id from missions where title='Animation été'),'accepted',null)$$,'assigned mission can be accepted');
select lives_ok($$select public.change_mission_status((select id from missions where title='Animation été'),'scheduled',null)$$,'accepted mission can be scheduled');
select lives_ok($$select public.change_mission_status((select id from missions where title='Animation été'),'in_progress',null)$$,'scheduled mission can start');
select lives_ok($$select public.change_mission_status((select id from missions where title='Animation été'),'report_pending',null)$$,'mission can await report');
select throws_ok($$select public.change_mission_status((select id from missions where title='Animation été'),'accepted',null)$$,'23514','Invalid mission status transition','invalid transition is blocked');
select is((select count(*) from mission_status_history where mission_id=(select id from missions where title='Animation été')),5::bigint,'every transition is historized');

select lives_ok($$select public.save_mission_report((select id from missions where title='Animation été'),'{"report_status":"draft","summary":"Brouillon"}')$$,'draft report is saved');
select throws_ok($$select public.save_mission_report((select id from missions where title='Animation été'),'{"report_status":"submitted","summary":"Incomplet"}')$$,'23514','Animation results are incomplete','incomplete animation report is blocked');
select lives_ok($$select public.save_mission_report((select id from missions where title='Animation été'),'{"report_status":"submitted","summary":"Animation réalisée","units_sold":"12","duration_minutes":"360","customer_contacts":"50","net_sales_ttc":"420"}')$$,'complete animation report is submitted');
select is((select units_sold from mission_reports where mission_id=(select id from missions where title='Animation été')),12,'units sold are retained');
select is(round((select units_per_hour from mission_performance where mission_id=(select id from missions where title='Animation été')),2),2.00::numeric,'units per hour is calculated');
select is(round((select cost_per_unit from mission_performance where mission_id=(select id from missions where title='Animation été')),2),28.33::numeric,'cost per unit is calculated');
select is((select reported_sell_out_ttc from mission_performance where mission_id=(select id from missions where title='Animation été')),420.00::numeric,'reported sell-out is exposed');
select is((select roi_30d from mission_performance where mission_id=(select id from missions where title='Animation été')),null::numeric,'ROI is absent without margin');
select lives_ok($$select public.review_mission_report((select id from mission_reports where mission_id=(select id from missions where title='Animation été')),'needs_correction','Préciser les objections')$$,'correction can be requested');
select is((select status from missions where title='Animation été'),'report_pending'::mission_status,'correction keeps mission pending');
select lives_ok($$select public.save_mission_report((select id from missions where title='Animation été'),'{"report_status":"submitted","summary":"Animation corrigée","units_sold":"12","duration_minutes":"360","customer_contacts":"50","net_sales_ttc":"420"}')$$,'provider can resubmit correction');
select lives_ok($$select public.review_mission_report((select id from mission_reports where mission_id=(select id from missions where title='Animation été')),'validated',null)$$,'report is validated');
select is((select status from missions where title='Animation été'),'completed'::mission_status,'validation completes mission');
select is((select count(*) from interactions where subject='Mission terrain validée'),1::bigint,'validation adds timeline interaction');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
select is((select count(*) from missions),1::bigint,'animator sees only assigned mission');
select is((select count(*) from missions where brand_id='00000000-0000-0000-0000-000000000102'),0::bigint,'animator sees no cross-brand mission');
select is((select count(*) from mission_reports),1::bigint,'animator sees only own mission report');
with changed as(update missions set brand_id='00000000-0000-0000-0000-000000000102' where title='Animation été' returning 1) select is((select count(*) from changed),0::bigint,'provider cannot alter brand_id');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}',true);
select is((select count(*) from missions),0::bigint,'suspended provider sees no mission');

reset role;
select ok((select relrowsecurity from pg_class where oid='public.mission_attachments'::regclass),'attachment metadata has RLS');
select ok((select not public from storage.buckets where id='mission-evidence'),'mission bucket is private');
select is((select file_size_limit from storage.buckets where id='mission-evidence'),10485760::bigint,'bucket is limited to 10 MB');
select ok((select 'security_invoker=true'=any(reloptions) from pg_class where relname='mission_performance'),'performance view is security invoker');
select * from finish(); rollback;
