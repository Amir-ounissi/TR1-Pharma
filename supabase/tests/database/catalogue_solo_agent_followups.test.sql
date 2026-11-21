begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(6);

select ok(
  not has_table_privilege('anon','public.private_catalog_agent_followups','SELECT'),
  'anonymous users cannot view private agent follow-ups'
);
select ok(
  not has_table_privilege('anon','public.private_catalog_agent_followups','INSERT'),
  'anonymous users cannot plan follow-ups'
);
select ok(
  has_table_privilege('authenticated','public.private_catalog_agent_followups','SELECT'),
  'authenticated administrators have a RLS-protected read permission'
);

insert into public.private_catalog_pharmacies(id,name,city)
values('d6a80000-0000-4000-8000-000000000011','Test solo agent','Istres');
insert into public.private_catalog_agent_followups
  (id,pharmacy_id,action_kind,next_action_date,note)
values('d6a80000-0000-4000-8000-000000000012',
       'd6a80000-0000-4000-8000-000000000011','visit',current_date,'Visite fictive');

select is(
 (select status from public.private_catalog_agent_followups
    where id='d6a80000-0000-4000-8000-000000000012'),
 'todo','a new field follow-up starts pending'
);

select throws_ok(
 $$update public.private_catalog_agent_followups
   set status='done' where id='d6a80000-0000-4000-8000-000000000012'$$,
 '23514',null,'a completed follow-up requires a completion timestamp'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','d6a80000-0000-4000-8000-000000000013',true);
select is(
 (select count(*) from public.private_catalog_agent_followups),
 0::bigint,'unprivileged authenticated user cannot read agent follow-ups'
);
reset role;

select * from finish();
rollback;
