begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','commercial-none@test.local','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c2','authenticated','authenticated','commercial-suspended@test.local','',now(),'{}','{}',now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000c3','authenticated','authenticated','commercial-agent2@test.local','',now(),'{}','{}',now(),now(),'','','','');
insert into public.memberships (user_id, organization_id, brand_id, role_id, status) values
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from public.roles where key='agent'),'suspended'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from public.roles where key='agent'),'active');

select plan(43);
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok($$select public.change_brand_pharmacy_status('00000000-0000-0000-0000-000000000412','qualified',null)$$,'standard status transition succeeds');
select is((select count(*) from public.brand_pharmacy_status_history where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and previous_status='targeted' and new_status='qualified'),1::bigint,'standard transition creates history');
select throws_ok($$select public.change_brand_pharmacy_status('00000000-0000-0000-0000-000000000412','offer_sent',null)$$,'23514','A reason is required for a non-standard status transition','non-standard transition without reason is blocked');
select lives_ok($$select public.change_brand_pharmacy_status('00000000-0000-0000-0000-000000000412','offer_sent','Opportunité déjà avancée')$$,'non-standard transition with reason succeeds');
select is((select change_reason from public.brand_pharmacy_status_history where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and new_status='offer_sent' limit 1),'Opportunité déjà avancée','transition reason is retained');
select throws_ok($$select public.change_brand_pharmacy_status('00000000-0000-0000-0000-000000000413','active','intrusion')$$,'42501','Brand pharmacy unavailable','cross-brand status change is blocked');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select throws_ok($$select public.change_brand_pharmacy_status('00000000-0000-0000-0000-000000000411','qualified','agent')$$,'42501','Status change forbidden','agent cannot change status when brand setting forbids it');
select lives_ok($$select public.create_commercial_interaction('00000000-0000-0000-0000-000000000411','call','interested','Appel test','Compte rendu','shared','00000000-0000-0000-0000-000000000421',now(),10,null,null,null)$$,'assigned agent creates a valid interaction');
select throws_ok($$select public.create_commercial_interaction('00000000-0000-0000-0000-000000000411','call','completed','Mauvais contact',null,'shared','00000000-0000-0000-0000-000000000422',now(),null,null,null,null)$$,'23514','Contact does not belong to the pharmacy','contact from another pharmacy is blocked');
select throws_ok($$select public.create_commercial_interaction('00000000-0000-0000-0000-000000000412','call','completed','Compte non affecté',null,'shared',null,now(),null,null,null,null)$$,'42501','Interaction forbidden','agent outside assignment is blocked');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select lives_ok($$select public.create_commercial_interaction('00000000-0000-0000-0000-000000000411','internal_note','completed','Note TR1','Confidentiel','tr1_internal',null,now(),null,null,null,null)$$,'TR1 internal interaction is created');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select is((select count(*) from public.interactions where subject='Note TR1'),0::bigint,'TR1 internal note is invisible to brand admin');
select lives_ok($$select public.create_commercial_interaction('00000000-0000-0000-0000-000000000411','internal_note','completed','Note marque','Interne marque','brand_internal',null,now(),null,null,null,null)$$,'brand internal interaction is created');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is((select count(*) from public.interactions where subject='Note marque'),0::bigint,'brand internal note is invisible to agent');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
update public.interactions set archived_at=now() where subject='Note marque';
select is((select count(*) from public.interactions where subject='Note marque' and archived_at is null),0::bigint,'logical interaction archive removes the row from active scope');

select lives_ok($$insert into public.tasks (brand_id,brand_pharmacy_id,task_type,title,assigned_to,created_by,due_at) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000412','call','Tâche valide','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a2',now()+interval '1 day')$$,'valid task is created');
select throws_ok($$insert into public.tasks (brand_id,brand_pharmacy_id,task_type,title,assigned_to,created_by) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000412','call','Sans membership','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2')$$,'23514','Task owner has no active brand membership','task owner without membership is blocked');
select throws_ok($$insert into public.tasks (brand_id,brand_pharmacy_id,task_type,title,assigned_to,created_by) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000412','call','Agent autre compte','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a2')$$,'23514','Agent is not assigned to this pharmacy','agent assigned elsewhere is blocked');
update public.tasks set status='completed' where title='Tâche valide';
select ok((select completed_at is not null and completed_by='00000000-0000-0000-0000-0000000000a2' from public.tasks where title='Tâche valide'),'completed task retains completion history');
select throws_ok($$update public.tasks set status='cancelled' where id='00000000-0000-0000-0000-000000000711'$$,'23514','Cancellation reason is required','task cancellation without reason is blocked');
insert into public.tasks (brand_id,brand_pharmacy_id,task_type,title,assigned_to,created_by,due_at) values ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000412','follow_up','Tâche en retard','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a2',now()-interval '1 day');
select is((select effective_status from public.commercial_tasks where title='Tâche en retard'),'overdue'::public.commercial_task_status,'overdue state is derived dynamically');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',true);
select is((select count(*) from public.accounts_without_next_action where id='00000000-0000-0000-0000-000000000414'),1::bigint,'account without next action is detected');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);

select lives_ok($$select public.assign_brand_pharmacy('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-0000000000a3','commercial_agent',true,'Première attribution')$$,'primary assignment succeeds');
select is((select count(*) from public.pharmacy_assignments where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and assignment_type='commercial_agent' and is_primary and ends_at is null),1::bigint,'only one active primary commercial assignment exists');
select lives_ok($$select public.assign_brand_pharmacy('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-0000000000c3','commercial_agent',true,'Réattribution')$$,'new primary assignment closes the previous one');
select is((select count(*) from public.pharmacy_assignments where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),2::bigint,'assignment history is retained');
select is((select current_agent_user_id from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),'00000000-0000-0000-0000-0000000000c3'::uuid,'current agent is synchronized from assignment history');
select throws_ok($$select public.assign_brand_pharmacy('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-0000000000c1','commercial_agent',true,'Sans membership')$$,'23514','Assigned user has no active brand membership','assignment without membership is blocked');
select throws_ok($$select public.assign_brand_pharmacy('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-0000000000c2','commercial_agent',true,'Suspendu')$$,'23514','Assigned user has no active brand membership','suspended user assignment is blocked');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select throws_ok($$select public.assign_brand_pharmacy('00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-0000000000a3','commercial_agent',true,'Auto attribution')$$,'42501','Assignment forbidden','agent cannot self-assign an account');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',true);
select is((select count(*) from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),1::bigint,'new agent receives access immediately');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
update public.pharmacy_assignments set ends_at=current_date,ended_reason='Fin de portefeuille' where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and user_id='00000000-0000-0000-0000-0000000000c3' and ends_at is null;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}',true);
select is((select count(*) from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),0::bigint,'access is removed immediately when assignment ends');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
select is((select count(*) from public.tasks),0::bigint,'user without membership reads no commercial task');
select is((select count(*) from public.interactions),0::bigint,'user without membership reads no interaction');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}',true);
select is((select count(*) from public.tasks),0::bigint,'suspended membership reads no commercial task');
select is((select count(*) from public.interactions),0::bigint,'suspended membership reads no interaction');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select lives_ok($$select public.create_commercial_interaction('00000000-0000-0000-0000-000000000411','email','information_sent','Interaction avec suite',null,'shared',null,now(),null,'follow_up',now()+interval '3 days','00000000-0000-0000-0000-0000000000a3')$$,'interaction with next action succeeds');
select is((select count(*) from public.tasks where related_interaction_id is not null and source='interaction'),1::bigint,'interaction automatically creates a linked task');
select ok((select related_task_id is not null from public.interactions where subject='Interaction avec suite'),'interaction stores the generated task link');
select is((select next_action_type from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000411'),'follow_up','brand pharmacy next action is synchronized from tasks');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select ok((select count(*) > 0 from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and source='status_change'),'status change creates a configurable follow-up task');
select is((select count(*) from public.interactions where brand_id='00000000-0000-0000-0000-000000000102'),0::bigint,'cross-brand interactions remain invisible');
select is((select count(*) from public.tasks where brand_id='00000000-0000-0000-0000-000000000102'),0::bigint,'cross-brand tasks remain invisible');

select * from finish();
rollback;
