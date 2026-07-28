begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

select has_table('public','communication_channels','communication channels exist');
select has_table('public','whatsapp_link_tokens','link tokens exist');
select has_table('public','whatsapp_events','provider events exist');
select has_table('public','whatsapp_rate_limits','rate limits exist');
select has_table('public','whatsapp_audit_logs','private WhatsApp audit exists');
select ok((select relrowsecurity from pg_class where oid='public.communication_channels'::regclass),'channels enforce RLS');
select ok((select relrowsecurity from pg_class where oid='public.whatsapp_link_tokens'::regclass),'tokens enforce RLS');
select ok((select relrowsecurity from pg_class where oid='public.whatsapp_events'::regclass),'events enforce RLS');
select ok(
  not has_function_privilege('authenticated','public.claim_whatsapp_link(text,text)','EXECUTE'),
  'authenticated users cannot claim linking codes directly'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select lives_ok($$select public.start_whatsapp_link('00000000-0000-0000-0000-000000000101')$$,'agent starts linking');
select is((select count(*) from public.whatsapp_link_tokens),1::bigint,'agent sees own token only');
select ok((select expires_at <= now()+interval '11 minutes' from public.whatsapp_link_tokens),'token is short lived');
select throws_ok(
  $$select public.start_whatsapp_link('00000000-0000-0000-0000-000000000102')$$,
  '42501','WhatsApp linking forbidden','agent cannot link another brand'
);
select set_config('test.whatsapp_code',(select code from public.start_whatsapp_link('00000000-0000-0000-0000-000000000101')),true);

reset role;
set local role service_role;
select lives_ok(
  $$select public.claim_whatsapp_link(current_setting('test.whatsapp_code'),'+33612345678')$$,
  'service claims valid linking code'
);
select is((select count(*) from public.communication_channels where revoked_at is null),1::bigint,'one active channel is created');
select is((select user_id from public.communication_channels where revoked_at is null),'00000000-0000-0000-0000-0000000000a3'::uuid,'channel ownership comes from token');
select ok((select used_at is not null from public.whatsapp_link_tokens order by created_at desc limit 1),'linking token becomes single use');
select throws_ok(
  $$select public.claim_whatsapp_link(current_setting('test.whatsapp_code'),'+33612345679')$$,
  '22023','Invalid or expired linking code','used code cannot be claimed twice'
);
insert into public.whatsapp_link_tokens(organization_id,brand_id,user_id,code_hash,created_at,expires_at)
values(
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-0000000000a3',
  encode(extensions.digest('TR1-EXPIRE','sha256'),'hex'),
  now()-interval '20 minutes',
  now()-interval '10 minutes'
);
select throws_ok(
  $$select public.claim_whatsapp_link('TR1-EXPIRE','+33612345679')$$,
  '22023','Invalid or expired linking code','expired code cannot be claimed'
);
select is(
  (public.ingest_whatsapp_event('evt-1','wamid-1','+33612345678','message','text','Bonjour','{}')->>'duplicate')::boolean,
  false,'first provider message is accepted'
);
select is(
  (public.ingest_whatsapp_event('evt-1-copy','wamid-1','+33612345678','message','text','Bonjour','{}')->>'duplicate')::boolean,
  true,'duplicate provider message is idempotent'
);
select is((select count(*) from public.whatsapp_events where provider_message_id='wamid-1'),1::bigint,'duplicate stores one event');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}',true);
select is((select count(*) from public.communication_channels),0::bigint,'other tenant sees no channel');
select is((select count(*) from public.whatsapp_link_tokens),0::bigint,'other tenant sees no linking token');
select is((select count(*) from public.whatsapp_audit_logs),0::bigint,'other tenant sees no private audit');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select lives_ok(
  $$select public.revoke_whatsapp_channel((select id from public.communication_channels where revoked_at is null))$$,
  'owner revokes its channel'
);
select ok((select revoked_at is not null from public.communication_channels order by created_at desc limit 1),'revocation is persisted');

select * from finish();
rollback;
