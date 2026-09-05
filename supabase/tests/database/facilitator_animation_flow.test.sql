begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

select ok(
  (select count(*) > 0 from public.get_provider_mission_pharmacies_v2()),
  'facilitator can search pharmacies without selecting an active brand'
);

create temp table facilitator_animation_test_ids(id uuid) on commit drop;

with relations as (
  select brand_pharmacy_id, row_number() over () as rn
  from public.get_provider_mission_pharmacies_v2()
  limit 2
), payload as (
  select jsonb_agg(jsonb_build_object(
    'brand_pharmacy_id', brand_pharmacy_id,
    'scheduled_start_at', case rn when 1 then '2026-09-15T10:00:00+02:00' else '2026-09-16T10:00:00+02:00' end,
    'scheduled_end_at', case rn when 1 then '2026-09-15T18:00:00+02:00' else '2026-09-16T18:00:00+02:00' end
  )) as body
  from relations
)
insert into facilitator_animation_test_ids(id)
select unnest(public.propose_animation_batch((select body from payload)));

select is(
  (select count(*) from facilitator_animation_test_ids),
  2::bigint,
  'facilitator creates two animation proposals in one call'
);

select is(
  (select count(*) from public.missions m join facilitator_animation_test_ids t on t.id=m.id where m.mission_type='animation'),
  2::bigint,
  'batch contains animation missions only'
);

select is(
  (select count(*) from public.missions m join facilitator_animation_test_ids t on t.id=m.id where m.location_mode='in_pharmacy'),
  2::bigint,
  'animations are always in pharmacy'
);

select is(
  (select count(*) from public.missions m join facilitator_animation_test_ids t on t.id=m.id where m.budget_estimated_ht is null and m.cost_estimated_ht is null),
  2::bigint,
  'facilitator does not propose a budget or cost'
);

select is(
  (select count(*) from public.mission_products mp join facilitator_animation_test_ids t on t.id=mp.mission_id),
  0::bigint,
  'animation proposal does not select individual products'
);

select is(
  (select count(*) from public.missions m join facilitator_animation_test_ids t on t.id=m.id where m.proposal_review_status='pending'),
  2::bigint,
  'brand validation remains pending'
);

select is(
  (select count(*) from public.missions m join facilitator_animation_test_ids t on t.id=m.id where m.assigned_user_id='00000000-0000-0000-0000-0000000000a5'),
  2::bigint,
  'proposed animations stay assigned to the facilitator'
);

reset role;
select * from finish();
rollback;
