-- Optimize authenticated cockpit reads without changing row-level permissions.
-- Previously each candidate row called SECURITY DEFINER membership/assignment checks.
-- These set-returning helpers resolve the *current* JWT subject once per statement.
-- No arbitrary user-id argument is exposed. Functions remain in the private schema.
--
-- Semantics preserved:
-- brand_pharmacies: elevated brand access (including archived) OR
--   a current, unarchived assignment to an unarchived relation.
-- pharmacies: global super admin OR at least one unarchived, accessible brand relation.

create or replace function private.tr1_read_elevated_brand_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select b.id
  from public.brands b
  where private.has_elevated_brand_access(b.id);
$function$;

create or replace function private.tr1_read_assigned_relation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select distinct pa.brand_pharmacy_id
  from public.pharmacy_assignments pa
  where pa.user_id = (select auth.uid())
    and pa.starts_at <= current_date
    and (pa.ends_at is null or pa.ends_at > current_date)
    and pa.archived_at is null;
$function$;

create or replace function private.tr1_read_visible_pharmacy_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select distinct bp.pharmacy_id
  from public.brand_pharmacies bp
  where bp.archived_at is null
    and (
      bp.brand_id in (select private.tr1_read_elevated_brand_ids())
      or bp.id in (select private.tr1_read_assigned_relation_ids())
    );
$function$;

revoke all on function private.tr1_read_elevated_brand_ids() from public, anon;
revoke all on function private.tr1_read_assigned_relation_ids() from public, anon;
revoke all on function private.tr1_read_visible_pharmacy_ids() from public, anon;

grant execute on function private.tr1_read_elevated_brand_ids() to authenticated, service_role;
grant execute on function private.tr1_read_assigned_relation_ids() to authenticated, service_role;
grant execute on function private.tr1_read_visible_pharmacy_ids() to authenticated, service_role;

-- Preserve existing policy names, TO authenticated, and all write policies.
alter policy brand_pharmacies_select on public.brand_pharmacies using (
  brand_id in (select private.tr1_read_elevated_brand_ids())
  or (
    archived_at is null
    and id in (select private.tr1_read_assigned_relation_ids())
  )
);

alter policy pharmacies_select on public.pharmacies using (
  (select private.has_global_role(array['super_admin']))
  or id in (select private.tr1_read_visible_pharmacy_ids())
);
