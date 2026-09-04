create or replace function private.validate_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.brand_pharmacies bp
    where bp.id = new.brand_pharmacy_id
      and bp.brand_id = new.brand_id
      and bp.archived_at is null
  ) then
    raise exception 'Assignment brand scope mismatch' using errcode = '23514';
  end if;

  if not private.user_has_active_brand_membership(new.user_id, new.brand_id) then
    raise exception 'Assigned user has no active brand membership' using errcode = '23514';
  end if;

  if new.user_id = (select auth.uid())
     and not private.has_brand_role(new.brand_id, array['tr1_manager','brand_admin']) then
    if not (
      new.assigned_by = (select auth.uid())
      and new.assignment_type = 'commercial_agent'
      and new.is_primary is true
      and exists (
        select 1
        from public.brand_pharmacies bp
        where bp.id = new.brand_pharmacy_id
          and bp.brand_id = new.brand_id
          and bp.archived_at is null
          and bp.current_agent_user_id = (select auth.uid())
          and bp.created_by = (select auth.uid())
          and bp.source = 'agent'
          and not exists (
            select 1
            from public.pharmacy_assignments existing_assignment
            where existing_assignment.brand_pharmacy_id = bp.id
              and existing_assignment.archived_at is null
          )
      )
    ) then
      raise exception 'Self assignment is forbidden' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;;
