create or replace function public.schedule_my_animation(
  target_mission_id uuid,
  target_scheduled_start_at timestamptz,
  target_scheduled_end_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.missions%rowtype;
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into target
  from public.missions
  where id = target_mission_id
  for update;

  if target.id is null
     or target.assigned_user_id is distinct from actor
     or target.mission_type <> 'animation'::public.mission_type
     or not exists (
       select 1
       from public.memberships membership
       join public.roles role on role.id = membership.role_id
       where membership.user_id = actor
         and membership.brand_id = target.brand_id
         and membership.status = 'active'
         and role.key = 'facilitator'
     )
  then
    raise exception 'Animation unavailable for self scheduling' using errcode='42501';
  end if;

  if target.status <> 'accepted'::public.mission_status then
    raise exception 'Animation must be accepted before scheduling' using errcode='23514';
  end if;

  if target_scheduled_start_at is null
     or target_scheduled_end_at is null
     or target_scheduled_end_at <= target_scheduled_start_at
  then
    raise exception 'Animation schedule is invalid' using errcode='23514';
  end if;

  update public.missions
  set scheduled_start_at = target_scheduled_start_at,
      scheduled_end_at = target_scheduled_end_at,
      status = 'scheduled'
  where id = target_mission_id;

  update public.mission_status_history history
  set source = 'provider'::public.mission_history_source
  where history.id = (
    select max(id)
    from public.mission_status_history
    where mission_id = target_mission_id
  );
end;
$$;

revoke all on function public.schedule_my_animation(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.schedule_my_animation(uuid,timestamptz,timestamptz) to authenticated;

comment on function public.schedule_my_animation(uuid,timestamptz,timestamptz) is
  'Allows the assigned active facilitator to choose the definitive slot of an accepted animation.';
