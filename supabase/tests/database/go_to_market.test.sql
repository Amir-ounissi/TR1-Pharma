begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(32);

select has_table('public','commercial_leads','commercial leads exist');
select has_table('public','pilot_projects','pilot projects exist');
select has_table('public','commercial_lead_events','append-only lead history exists');
select has_function('public','capture_commercial_lead',array['text','text','text','text','text','text'],'secure lead capture RPC exists');
select has_function('public','prepare_pilot_project',array['uuid','text','text','text','integer','date','boolean'],'pilot preparation RPC exists');
select has_function('public','approve_pilot_project',array['uuid','boolean'],'pilot approval RPC exists');
select ok((select relrowsecurity from pg_class where oid='public.commercial_leads'::regclass),'lead RLS is enabled');
select ok((select relrowsecurity from pg_class where oid='public.pilot_projects'::regclass),'pilot RLS is enabled');
select ok((select relrowsecurity from pg_class where oid='public.commercial_lead_events'::regclass),'lead history RLS is enabled');

select ok(public.capture_commercial_lead('Marie Martin','MARIE@EXAMPLE.COM','Nova Santé','website','s12-dedupe','s12-rate') is not null,'server capture creates a lead');
select is(public.capture_commercial_lead('Marie Martin','marie@example.com','Nova Santé','website','s12-dedupe','s12-rate'),(select id from public.commercial_leads where deduplication_key='s12-dedupe'),'double submission is idempotent');

set local role anon;
select is((select count(*) from public.commercial_leads),0::bigint,'anonymous users cannot read leads');
select throws_ok(
  $$select public.capture_commercial_lead('Anon','anon@example.com','Anon Lab','website','anon-dedupe','anon-rate')$$,
  '42501',null,'anonymous users cannot call the capture RPC directly'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select is((select count(*) from public.commercial_leads),0::bigint,'brand administrators cannot read TR1 leads');
select is((select count(*) from public.pilot_projects),0::bigint,'brand administrators cannot read pilot projects');
select is((select count(*) from public.commercial_lead_events),0::bigint,'brand administrators cannot read lead history');
select throws_ok(
  $$insert into public.pilot_projects(lead_id,proposed_organization_name,proposed_brand_name,created_by)
    values('ffffffff-ffff-ffff-ffff-ffffffffffff','Forbidden','Forbidden','00000000-0000-0000-0000-0000000000a2')$$,
  '42501',null,'brand administrators cannot create pilot projects'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select is((select count(*) from public.commercial_leads),1::bigint,'TR1 super administrators can read leads');
select throws_ok(
  $$update public.commercial_leads set status='pilot_active' where deduplication_key='s12-dedupe'$$,
  '22023',null,'invalid lead transitions are rejected'
);
select lives_ok(
  $$update public.commercial_leads set status='qualified' where deduplication_key='s12-dedupe'$$,
  'qualification transition is accepted'
);
select ok(public.prepare_pilot_project((select id from public.commercial_leads where deduplication_key='s12-dedupe'),'Nova Santé SAS','Nova Santé','FR',12,'2026-09-01',true) is not null,'qualified lead creates a pilot draft');
select is((select count(*) from public.pilot_projects where status='draft'),1::bigint,'pilot remains a draft before approval');
select is((select status from public.commercial_leads where deduplication_key='s12-dedupe'),'pilot_proposed','pilot preparation updates lead status');
select is((select count(*) from public.commercial_lead_events where event_name='pilot_prepared'),1::bigint,'pilot preparation is journalized');
set local role postgres;
select throws_ok(
  $$update public.commercial_lead_events set metadata='{"forged":true}' where event_name='pilot_prepared'$$,
  '42501','Commercial lead history is append-only','lead history cannot be altered'
);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select throws_ok(
  $$select public.approve_pilot_project((select id from public.pilot_projects),false)$$,
  '42501','Pilot approval forbidden','pilot approval requires explicit confirmation'
);
select lives_ok(
  $$select public.approve_pilot_project((select id from public.pilot_projects),true)$$,
  'TR1 super administrator can approve a pilot'
);
select is((select count(*) from public.pilot_projects where status='onboarding' and organization_id is not null and brand_id is not null),1::bigint,'approved pilot links onboarding organization and brand');
select is((select count(*) from public.pilot_projects pp join public.organizations o on o.id=pp.organization_id join public.brands b on b.id=pp.brand_id where o.status='draft' and b.status='draft' and not b.is_active),1::bigint,'onboarding environment stays inactive');
select is((select status from public.commercial_leads where deduplication_key='s12-dedupe'),'pilot_active','approved pilot advances the lead');
select is((select count(*) from public.commercial_lead_events where event_name in ('pilot_approved','pilot_onboarding_started')),2::bigint,'pilot approval and onboarding are journalized');
select throws_ok(
  $$insert into public.pilot_projects(lead_id,proposed_organization_name,proposed_brand_name,created_by)
    values('ffffffff-ffff-ffff-ffff-ffffffffffff','Invalid','Invalid','00000000-0000-0000-0000-0000000000a1')$$,
  '23503',null,'pilot integrity requires an existing lead'
);

select * from finish();
rollback;
