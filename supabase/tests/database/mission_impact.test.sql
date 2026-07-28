begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(35);

select has_view('public','mission_impact','central mission impact view exists');
select ok((select 'security_invoker=true'=any(reloptions) from pg_class where relname='mission_impact'),'mission impact uses caller RLS');
select has_view('public','mission_performance','legacy mission performance remains available');
select ok((select 'security_invoker=true'=any(reloptions) from pg_class where relname='mission_performance'),'legacy view keeps caller RLS');
select has_column('public','brand_settings','post_mission_followup_days','follow-up setting exists');
select col_default_is('public','brand_settings','post_mission_followup_days','7','follow-up defaults to seven days');
select has_index('public','missions','missions_completed_impact_idx','completed mission lookup is indexed');
select has_function('private','mission_observation_maturity',array['integer'],'maturity helper exists');
select has_function('private','mission_effectiveness',array['integer','numeric','numeric','integer','integer','boolean','boolean'],'effectiveness helper exists');
select has_function('public','get_mission_impact',array['uuid'],'mission impact RPC exists');
select has_function('public','get_recent_pharmacy_mission_impact',array['uuid','integer'],'pharmacy impact RPC exists');
select has_function('public','get_mission_impact_dashboard',array['uuid','integer','mission_type','uuid','uuid'],'manager dashboard RPC exists');
select has_function('public','get_mission_impacts',array['uuid','integer','mission_type','uuid','uuid','uuid'],'filtered mission list RPC exists');
select has_function('public','get_mission_impact_dashboard_filtered',array['uuid','integer','mission_type','uuid','uuid','uuid'],'filtered dashboard RPC exists');
select has_function('public','get_mission_type_impact',array['uuid','integer'],'type comparison RPC exists');
select has_function('public','get_mission_assignee_impact',array['uuid','integer'],'assignee comparison RPC exists');
select has_function('public','get_missions_to_review',array['uuid'],'review queue RPC exists');

select is(private.mission_observation_maturity(29),'early'::mission_observation_maturity,'J+29 is early');
select is(private.mission_observation_maturity(30),'30d_complete'::mission_observation_maturity,'J+30 is complete');
select is(private.mission_observation_maturity(60),'60d_complete'::mission_observation_maturity,'J+60 is complete');
select is(private.mission_observation_maturity(90),'mature'::mission_observation_maturity,'J+90 is mature');
select is(private.mission_effectiveness(29,100,500,1,1,true,true),'insufficient_data'::mission_effectiveness_status,'early observations remain insufficient');
select is(private.mission_effectiveness(30,100,121,1,1,false,false),'strong_positive'::mission_effectiveness_status,'growth above twenty percent is strong');
select is(private.mission_effectiveness(30,100,110,1,1,false,false),'positive'::mission_effectiveness_status,'growth above five percent is positive');
select is(private.mission_effectiveness(30,100,100,0,0,false,false),'neutral'::mission_effectiveness_status,'stable revenue is neutral');
select is(private.mission_effectiveness(60,0,0,0,0,false,false),'no_observable_result'::mission_effectiveness_status,'mature zero result is explicit');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok($$select public.get_mission_impact_dashboard('00000000-0000-0000-0000-000000000101',90,null,null,null)$$,'brand manager reads impact dashboard');
select lives_ok($$select public.get_mission_impact_dashboard_filtered('00000000-0000-0000-0000-000000000101',90,null,null,null,null)$$,'brand manager filters impact dashboard');
select lives_ok($$select public.get_mission_assignee_impact('00000000-0000-0000-0000-000000000101',180)$$,'brand manager reads contextual assignee metrics');
select is((select post_mission_followup_days from public.brand_settings where brand_id='00000000-0000-0000-0000-000000000101'),7,'seed brand inherits follow-up default');
select is((select count(*) from public.mission_impact where brand_id='00000000-0000-0000-0000-000000000102'),0::bigint,'brand manager sees no other tenant impact');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select throws_ok(
  $$select public.get_mission_impact_dashboard('00000000-0000-0000-0000-000000000101',90,null,null,null)$$,
  '42501','Mission impact dashboard forbidden','agent cannot read manager dashboard'
);
select throws_ok(
  $$select public.get_mission_type_impact('00000000-0000-0000-0000-000000000102',180)$$,
  '42501','Mission type impact forbidden','agent cannot compare another tenant'
);
select throws_ok(
  $$select public.get_mission_assignee_impact('00000000-0000-0000-0000-000000000101',180)$$,
  '42501','Mission assignee impact forbidden','agent cannot read assignee reporting'
);
select throws_ok(
  $$select public.get_mission_impacts('00000000-0000-0000-0000-000000000102',90,null,null,null,null)$$,
  '42501','Mission impacts forbidden','agent cannot query another tenant impact list'
);

select * from finish();
rollback;
