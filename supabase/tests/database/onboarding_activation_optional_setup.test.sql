begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into public.organizations(
  id,
  name,
  slug,
  is_platform_owner,
  status
)
values(
  '22000000-0000-0000-0000-000000000001',
  'Activation Optional Test',
  'activation-optional-test',
  false,
  'draft'
);

insert into public.brands(
  id,
  organization_id,
  managed_by_organization_id,
  name,
  slug,
  status,
  is_active
)
values(
  '22000000-0000-0000-0000-000000000101',
  '22000000-0000-0000-0000-000000000001',
  (select id from public.organizations where is_platform_owner limit 1),
  'Activation Optional Test',
  'activation-optional-test',
  'draft',
  false
);

insert into public.brand_onboarding_sessions(
  id,
  organization_id,
  brand_id,
  status,
  current_step,
  step_statuses,
  created_by
)
values(
  '22000000-0000-0000-0000-000000000201',
  '22000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000101',
  'in_progress',
  'products',
  '{"organization":"completed","brand":"completed","settings":"completed","products":"not_started","pharmacies":"not_started","territories":"not_started","users":"not_started","orders":"not_started","verification":"not_started","activation":"not_started"}',
  '00000000-0000-0000-0000-0000000000a1'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select ok(
  (
    select completed and blocking
    from public.get_brand_activation_checklist(
      '22000000-0000-0000-0000-000000000101'
    )
    where check_key='organization'
  ),
  'organization remains required and complete'
);

select ok(
  (
    select completed and blocking
    from public.get_brand_activation_checklist(
      '22000000-0000-0000-0000-000000000101'
    )
    where check_key='settings'
  ),
  'settings remain required and complete'
);

select ok(
  (
    select not completed and not blocking
    from public.get_brand_activation_checklist(
      '22000000-0000-0000-0000-000000000101'
    )
    where check_key='administrator'
  ),
  'administrator is optional before activation'
);

select ok(
  (
    select not completed and not blocking
    from public.get_brand_activation_checklist(
      '22000000-0000-0000-0000-000000000101'
    )
    where check_key='products'
  ),
  'products are optional before activation'
);

select ok(
  (
    select not completed and not blocking
    from public.get_brand_activation_checklist(
      '22000000-0000-0000-0000-000000000101'
    )
    where check_key='pharmacies'
  ),
  'pharmacies are optional before activation'
);

select ok(
  (
    select not blocking
    from public.get_brand_activation_checklist(
      '22000000-0000-0000-0000-000000000101'
    )
    where check_key='imports'
  ),
  'imports are optional before activation'
);

select is(
  (
    select count(*)
    from public.get_brand_activation_checklist(
      '22000000-0000-0000-0000-000000000101'
    )
    where blocking and not completed
  ),
  0::bigint,
  'no optional setup item blocks activation'
);

select ok(
  public.activate_onboarded_brand(
    '22000000-0000-0000-0000-000000000101'
  ),
  'brand activates without admin, product or pharmacy'
);

select is(
  (
    select status
    from public.brands
    where id='22000000-0000-0000-0000-000000000101'
  ),
  'active',
  'brand becomes active'
);

select is(
  (
    select status
    from public.brand_onboarding_sessions
    where brand_id='22000000-0000-0000-0000-000000000101'
  ),
  'completed',
  'onboarding session completes'
);

select * from finish();
rollback;
