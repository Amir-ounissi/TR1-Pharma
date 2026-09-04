create or replace function public.change_mission_status(
  target_mission_id uuid,
  target_status public.mission_status,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.missions%rowtype;
  actor uuid := (select auth.uid());
  is_tr1 boolean;
  is_brand_admin boolean;
  is_assigned boolean;
  allowed boolean := false;
  clean_reason text := nullif(btrim(reason), '');
begin
  select * into target from public.missions where id = target_mission_id for update;

  if target.id is null or not private.can_access_mission(target.id) then
    raise exception 'Mission unavailable' using errcode='42501';
  end if;

  is_tr1 := private.user_is_tr1_for_brand(target.brand_id);
  is_brand_admin := private.has_brand_role(target.brand_id, array['brand_admin']);
  is_assigned := target.assigned_user_id = actor;

  if target_status = 'cancelled' then
    allowed := (
      is_tr1
      and target.status not in ('completed','cancelled','rejected','no_show')
    ) or (
      is_brand_admin
      and target.status in ('requested','to_assign')
    );
  elsif target.status = 'draft' and target_status = 'requested' then
    allowed := is_tr1 or is_brand_admin;
  elsif target.status = 'requested' and target_status = 'to_assign' then
    allowed := is_tr1;
  elsif target.status = 'assigned' and target_status in ('accepted','rejected') then
    allowed := is_assigned;
  elsif target.status = 'accepted' and target_status = 'scheduled' then
    allowed := is_tr1;
  elsif target.status = 'scheduled' and target_status in ('in_progress','no_show') then
    allowed := is_assigned;
  end if;

  if not allowed then
    raise exception 'Invalid mission status transition for this actor' using errcode='42501';
  end if;

  if target_status in ('cancelled','rejected','no_show') and clean_reason is null then
    raise exception 'A reason is required' using errcode='23514';
  end if;

  if target_status = 'scheduled' and target.scheduled_start_at is null then
    raise exception 'A start date is required before scheduling' using errcode='23514';
  end if;

  update public.missions
  set status = target_status,
      managed_by = case when is_tr1 then actor else managed_by end,
      cancellation_reason = case when target_status='cancelled' then clean_reason else cancellation_reason end,
      rejection_reason = case when target_status='rejected' then clean_reason else rejection_reason end,
      no_show_reason = case when target_status='no_show' then clean_reason else no_show_reason end,
      actual_start_at = case when target_status='in_progress' then coalesce(actual_start_at,now()) else actual_start_at end,
      actual_end_at = case when target_status='no_show' then coalesce(actual_end_at,now()) else actual_end_at end
  where id = target_mission_id;

  update public.mission_status_history history
  set reason = coalesce(history.reason, clean_reason),
      source = (case when is_assigned then 'provider' else 'manual' end)::public.mission_history_source
  where history.id = (
    select max(id) from public.mission_status_history where mission_id = target_mission_id
  );
end;
$$;;
