begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_table('public', 'trade_campaigns', 'Trade Marketing campaigns table exists');
select has_table('public', 'trade_campaign_targets', 'Trade Marketing targets table exists');
select has_table('public', 'trade_campaign_products', 'Trade Marketing products table exists');
select has_table('public', 'trade_campaign_missions', 'Trade Marketing mission links table exists');
select has_function(
  'public',
  'save_trade_campaign',
  array['uuid','uuid','text','text','trade_campaign_type','trade_campaign_status','text','date','date','numeric','text'],
  'Trade Marketing campaign save RPC exists'
);
select has_function(
  'public',
  'get_trade_campaign_overview',
  array['uuid','date','date'],
  'Trade Marketing overview RPC exists'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',
  true
);

create temp table _trade_campaign as
select public.save_trade_campaign(
  null::uuid,
  '00000000-0000-0000-0000-000000000101',
  'Activation rentrée',
  'TRADE-2026-01',
  'activation'::public.trade_campaign_type,
  'planned'::public.trade_campaign_status,
  'Accélérer sell-out et réassort sur les pharmacies ciblées',
  '2026-09-01',
  '2026-10-31',
  5000,
  'Campagne test'
) as id;

select is(
  (select status::text from public.trade_campaigns where id = (select id from _trade_campaign)),
  'planned',
  'brand admin creates a planned campaign'
);

select lives_ok(
  format(
    'select public.set_trade_campaign_target(%L::uuid,%L::uuid,true,%L)',
    (select id from _trade_campaign),
    '00000000-0000-0000-0000-000000000411',
    'Pharmacie stratégique'
  ),
  'brand admin adds a pharmacy target'
);

select is(
  (select count(*) from public.trade_campaign_targets where campaign_id = (select id from _trade_campaign)),
  1::bigint,
  'campaign target is persisted once'
);

select lives_ok(
  format(
    'select public.set_trade_campaign_product(%L::uuid,%L::uuid,true,120,75)',
    (select id from _trade_campaign),
    '00000000-0000-0000-0000-000000000601'
  ),
  'brand admin adds a campaign product objective'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_trade_campaign_overview(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31'
  )$$,
  '42501',
  'Trade Marketing access forbidden',
  'agent cannot read Trade Marketing analytics'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',
  true
);

select throws_ok(
  $$select * from public.get_trade_campaign_overview(
    '00000000-0000-0000-0000-000000000101',
    '2026-01-01',
    '2026-12-31'
  )$$,
  '42501',
  'Trade Marketing access forbidden',
  'another brand admin cannot read Dermavita Trade Marketing analytics'
);

select * from finish();
rollback;
