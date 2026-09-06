begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 'saas.seat.one@test.local', '', now(), '{}', '{"full_name":"SaaS Seat One"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated', 'saas.seat.two@test.local', '', now(), '{}', '{"full_name":"SaaS Seat Two"}', now(), now(), '', '', '', '');

select plan(52);

select has_table('public','saas_quota_definitions','quota catalog exists');
select has_table('public','saas_plan_quotas','plan quotas exist');
select has_table('public','brand_saas_quota_overrides','brand quota overrides exist');
select has_table('public','brand_billing_accounts','billing readiness table exists');
select has_function('public','get_brand_saas_subscription',array['uuid'],'tenant SaaS subscription RPC exists');
select has_function('public','get_brand_saas_usage',array['uuid'],'tenant SaaS usage RPC exists');
select has_function('public','set_saas_plan_quota',array['text','text','bigint'],'plan quota administration RPC exists');
select has_function('public','record_brand_saas_usage',array['uuid','text','bigint','text'],'trusted usage metering RPC exists');
select is((select count(*) from public.saas_quota_definitions where is_active),4::bigint,'four initial measurable quota definitions are seeded');
select is((select count(*) from public.saas_plan_quotas),16::bigint,'every foundation plan receives every quota slot');
select is(
  (select count(*) from public.saas_plan_quotas quota join public.saas_plans plan on plan.id=quota.plan_id where plan.key='legacy_full' and quota.limit_value is null),
  4::bigint,
  'legacy_full remains unlimited by default'
);
select ok(not has_function_privilege('authenticated','public.record_brand_saas_usage(uuid,text,bigint,text)','EXECUTE'),'authenticated users cannot write usage counters');
select ok(has_function_privilege('service_role','public.record_brand_saas_usage(uuid,text,bigint,text)','EXECUTE'),'service role can use the trusted metering RPC');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);

select lives_ok(
  $$select public.set_brand_saas_plan('00000000-0000-0000-0000-000000000101','growth','active',7)$$,
  'platform admin can set a finite seat limit'
);
select is(
  (select plan_key from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')),
  'growth',
  'subscription overview exposes the commercial plan'
);
select is(
  (select seats_used from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')),
  6::bigint,
  'seat usage counts distinct invited and active users'
);
select is(
  (select seat_limit from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')),
  7,
  'subscription overview exposes the seat limit'
);

reset role;
select lives_ok(
  $$insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
    values(
      '00000000-0000-0000-0000-0000000000e1',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000101',
      (select id from public.roles where key='brand_user'),
      'invited'
    )$$,
  'one remaining seat can be reserved by an invitation'
);
select throws_ok(
  $$insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
    values(
      '00000000-0000-0000-0000-0000000000e2',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000101',
      (select id from public.roles where key='brand_user'),
      'invited'
    )$$,
  '23514',
  'SaaS seat limit reached for this brand',
  'a new distinct user cannot exceed the seat limit'
);
select lives_ok(
  $$insert into public.memberships(user_id,organization_id,brand_id,role_id,status)
    values(
      '00000000-0000-0000-0000-0000000000e1',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000101',
      (select id from public.roles where key='facilitator'),
      'active'
    )$$,
  'a second role for the same user does not consume another seat'
);
select is(
  (select count(distinct user_id) from public.memberships where brand_id='00000000-0000-0000-0000-000000000101' and status in ('invited','active')),
  7::bigint,
  'seat counting is user-based rather than membership-row based'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select throws_ok(
  $$select public.set_brand_saas_plan('00000000-0000-0000-0000-000000000101','growth','active',6)$$,
  '23514',
  'Seat limit cannot be below current seat usage (7)',
  'platform admin cannot configure a seat limit below current usage'
);
select lives_ok(
  $$select public.set_saas_plan_quota('growth','pdf_orders_monthly',2)$$,
  'platform admin can configure a plan quota without redeploying'
);
select is(
  (select limit_value from public.get_brand_saas_usage('00000000-0000-0000-0000-000000000101') where quota_key='pdf_orders_monthly'),
  2::bigint,
  'tenant usage resolves the plan quota'
);
select is(
  (select source from public.get_brand_saas_usage('00000000-0000-0000-0000-000000000101') where quota_key='pdf_orders_monthly'),
  'plan',
  'quota provenance remains explainable'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select throws_ok(
  $$select * from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')$$,
  '42501',
  'Brand SaaS commercial access is required',
  'agent cannot read subscription commercial terms'
);
select throws_ok(
  $$select * from public.get_brand_saas_usage('00000000-0000-0000-0000-000000000101')$$,
  '42501',
  'Brand SaaS commercial access is required',
  'agent cannot read quota commercial terms'
);
select throws_ok(
  $$select public.set_saas_plan_quota('growth','pdf_orders_monthly',3)$$,
  '42501',
  'Platform administrator access is required',
  'agent cannot change a plan quota'
);
select is(
  (select count(*) from public.saas_quota_definitions),
  0::bigint,
  'agent cannot bypass the RPC by reading the quota catalog directly'
);
select is(
  (select count(*) from public.saas_plan_quotas),
  0::bigint,
  'agent cannot read commercial plan quota values directly'
);
select is(
  (select count(*) from public.brand_saas_entitlements where brand_id='00000000-0000-0000-0000-000000000101'),
  0::bigint,
  'agent cannot read its brand plan and seat limit directly'
);

set local role service_role;
select is(
  public.record_brand_saas_usage('00000000-0000-0000-0000-000000000101','pdf_orders_monthly',1,'pgtap-pdf-1'),
  1::bigint,
  'trusted metering records the first unit'
);
select is(
  public.record_brand_saas_usage('00000000-0000-0000-0000-000000000101','pdf_orders_monthly',1,'pgtap-pdf-1'),
  1::bigint,
  'replayed idempotency key does not double count'
);
select throws_ok(
  $$select public.record_brand_saas_usage('00000000-0000-0000-0000-000000000101','pdf_orders_monthly',2,'pgtap-pdf-1')$$,
  '23514',
  'SaaS usage idempotency key reused with a different quantity',
  'an idempotency key cannot be replayed with a different metered quantity'
);
select is(
  public.record_brand_saas_usage('00000000-0000-0000-0000-000000000101','pdf_orders_monthly',1,'pgtap-pdf-2'),
  2::bigint,
  'a distinct usage event increments the counter'
);
select throws_ok(
  $$select public.record_brand_saas_usage('00000000-0000-0000-0000-000000000101','pdf_orders_monthly',1,'pgtap-pdf-3')$$,
  '23514',
  'SaaS quota exceeded for pdf_orders_monthly',
  'metering blocks consumption above a finite quota'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select is(
  (select used_value from public.get_brand_saas_usage('00000000-0000-0000-0000-000000000101') where quota_key='pdf_orders_monthly'),
  2::bigint,
  'tenant usage exposes trusted consumption'
);
select is(
  (select remaining_value from public.get_brand_saas_usage('00000000-0000-0000-0000-000000000101') where quota_key='pdf_orders_monthly'),
  0::bigint,
  'remaining quota is calculated deterministically'
);
select lives_ok(
  $$select public.set_brand_saas_quota_override('00000000-0000-0000-0000-000000000101','pdf_orders_monthly',5,'Pilote contrôlé',null)$$,
  'platform admin can override one tenant quota'
);
select is(
  (select limit_value from public.get_brand_saas_usage('00000000-0000-0000-0000-000000000101') where quota_key='pdf_orders_monthly'),
  5::bigint,
  'live tenant override wins over the plan quota'
);
select is(
  (select source from public.get_brand_saas_usage('00000000-0000-0000-0000-000000000101') where quota_key='pdf_orders_monthly'),
  'override',
  'tenant quota override provenance is explicit'
);
select lives_ok(
  $$select public.set_brand_billing_account('00000000-0000-0000-0000-000000000101','manual',null,null,null,'billing@dermavita.test')$$,
  'platform admin can mark a tenant as manually billed without a provider'
);
select is(
  (select billing_mode from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')),
  'manual',
  'tenant sees provider-neutral manual billing mode'
);
select ok(
  (select billing_ready from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')),
  'manual billing can be commercially ready without Stripe'
);
select lives_ok(
  $$select public.set_brand_billing_account('00000000-0000-0000-0000-000000000101','external','test_provider','customer-101','subscription-101','billing@dermavita.test')$$,
  'platform admin can attach generic external billing references'
);
select is(
  (select billing_mode from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')),
  'external',
  'tenant overview stays provider agnostic'
);
select ok(
  (select billing_ready from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')),
  'complete external references are billing ready'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok(
  $$select * from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')$$,
  'brand admin can read its own commercial SaaS status'
);
select is(
  (select count(*) from public.brand_saas_entitlements where brand_id='00000000-0000-0000-0000-000000000101'),
  1::bigint,
  'brand admin retains direct access to its own entitlement for administration'
);
select is(
  (select count(*) from public.saas_quota_definitions),
  0::bigint,
  'brand admin reads effective usage through the RPC rather than the platform quota catalog'
);
select throws_ok(
  $$select public.set_brand_saas_quota_override('00000000-0000-0000-0000-000000000101','pdf_orders_monthly',10,null,null)$$,
  '42501',
  'Platform administrator access is required',
  'brand admin cannot grant itself more quota'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',true);
select throws_ok(
  $$select * from public.get_brand_saas_subscription('00000000-0000-0000-0000-000000000101')$$,
  '42501',
  'Brand SaaS commercial access is required',
  'another brand administrator cannot read Dermavita commercial terms'
);

reset role;
select * from finish();
rollback;
