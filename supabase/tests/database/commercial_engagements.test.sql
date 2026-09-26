begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_table('public','commercial_engagements','commercial engagement contract layer exists');
select has_table('public','commercial_engagement_members','commercial engagement members exist');
select has_table('public','commercial_engagement_territories','commercial engagement territories exist');
select has_table('public','commercial_engagement_objectives','commercial engagement objectives exist');
select has_function('public','create_commercial_engagement',array['uuid','jsonb','jsonb'],'commercial engagement creation API exists');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select lives_ok(
  $$select public.create_commercial_engagement(
    '00000000-0000-0000-0000-000000000101',
    '{"name":"Dermavita — Développement PACA","scope_summary":"Prospection, implantation et suivi","territory_summary":"PACA","status":"active","start_date":"2026-10-01","end_date":"2027-03-31"}'::jsonb,
    '[{"metric_key":"revenue_ht","label":"CA sell-in","target_value":25000,"unit":"EUR HT","is_primary":true},{"metric_key":"implantations","label":"Implantations","target_value":80,"unit":"pharmacies"}]'::jsonb
  )$$,
  'platform admin can create a commercial engagement'
);

select is(
  (select provider_organization_id from public.commercial_engagements where name='Dermavita — Développement PACA'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'provider is derived from the brand manager'
);

select is(
  (select client_organization_id from public.commercial_engagements where name='Dermavita — Développement PACA'),
  '00000000-0000-0000-0000-000000000002'::uuid,
  'client is derived from the brand owner'
);

select is(
  (select count(*) from public.commercial_engagement_members member_row
   join public.commercial_engagements engagement on engagement.id=member_row.commercial_engagement_id
   where engagement.name='Dermavita — Développement PACA'
     and member_row.user_id='00000000-0000-0000-0000-0000000000a1'
     and member_row.role_key='lead'
     and member_row.is_primary),
  1::bigint,
  'creator becomes the primary engagement lead'
);

select is(
  (select count(*) from public.commercial_engagement_objectives objective
   join public.commercial_engagements engagement on engagement.id=objective.commercial_engagement_id
   where engagement.name='Dermavita — Développement PACA'),
  2::bigint,
  'engagement objectives are stored'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

select ok(
  (select count(*) from public.commercial_engagements where brand_id='00000000-0000-0000-0000-000000000101') >= 1,
  'brand admin can read the engagement for its brand'
);

select throws_ok(
  $$select public.create_commercial_engagement(
    '00000000-0000-0000-0000-000000000101',
    '{"name":"Unauthorized engagement","start_date":"2026-10-01"}'::jsonb,
    '[]'::jsonb
  )$$,
  '42501',
  'Platform administrator access is required',
  'brand admin cannot create the contract layer'
);

reset role;
select * from finish();
rollback;
