begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

-- Verify authorization equivalence for every fixture user, including assignments
-- without an active membership, plus a previously unseen authenticated identity.
select lives_ok($verify$
do $check$
declare v_user uuid; mismatches integer;
begin
  for v_user in
    select distinct user_id from (
      select user_id from public.memberships
      union all select user_id from public.pharmacy_assignments
      union all select '00000000-0000-0000-0000-0000000000ff'::uuid
    ) as users where user_id is not null
  loop
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object('sub',v_user,'role','authenticated')::text,
      true
    );
    select count(*) into mismatches from public.brand_pharmacies bp
    where (
      private.has_elevated_brand_access(bp.brand_id)
      or (bp.archived_at is null and private.user_is_assigned_to_relation(v_user,bp.id))
    ) is distinct from (
      bp.brand_id in (select private.tr1_read_elevated_brand_ids())
      or (bp.archived_at is null and bp.id in (select private.tr1_read_assigned_relation_ids()))
    );
    if mismatches <> 0 then
      raise exception 'brand pharmacy visibility changed for a fixture user';
    end if;
    select count(*) into mismatches from public.pharmacies p
    where private.can_access_pharmacy(p.id) is distinct from (
      private.has_global_role(array['super_admin'])
      or p.id in (select private.tr1_read_visible_pharmacy_ids())
    );
    if mismatches <> 0 then
      raise exception 'pharmacy visibility changed for a fixture user';
    end if;
  end loop;
end;
$check$;
$verify$, 'new set-based rules are equivalent to previous permissions for fixture users');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select is((select count(*) from public.brand_pharmacies where id = '00000000-0000-0000-0000-000000000411'),1::bigint,'agent sees an assigned brand-pharmacy relation');
select is((select count(*) from public.brand_pharmacies where id = '00000000-0000-0000-0000-000000000412'),0::bigint,'agent cannot read an unassigned relation');
select is((select count(*) from public.pharmacies where id = '00000000-0000-0000-0000-000000000401'),1::bigint,'agent sees the assigned pharmacy');
select is((select count(*) from public.pharmacies where id = '00000000-0000-0000-0000-000000000402'),0::bigint,'agent cannot read the unassigned pharmacy');
select ok(
  public.get_agent_today_multibrand(current_date, null::uuid) ?& array['tasks','missions','reports','follow_ups'],
  'multibrand cockpit keeps its complete JSON shape'
);

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select is((select count(*) from public.brand_pharmacies where id in ('00000000-0000-0000-0000-000000000411','00000000-0000-0000-0000-000000000412')),2::bigint,'brand admin sees both relations of its brand');
select is((select count(*) from public.pharmacies where id in ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000402')),2::bigint,'brand admin sees both pharmacies of its brand');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select ok((select count(*) from public.pharmacies) >= 2,'global admin retains global pharmacy access');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}',true);
select is((select count(*) from public.brand_pharmacies),0::bigint,'authenticated user with no memberships or assignments sees no relations');
select is((select count(*) from public.pharmacies),0::bigint,'authenticated user with no memberships or assignments sees no pharmacies');

select * from finish();
rollback;
