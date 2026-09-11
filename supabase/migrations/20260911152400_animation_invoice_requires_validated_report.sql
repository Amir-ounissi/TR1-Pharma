-- Invoicing starts only after the animation report has been reviewed and validated.

create or replace function private.validate_animation_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.missions mission
    where mission.id = new.mission_id
      and mission.brand_id = new.brand_id
      and mission.mission_type = 'animation'::public.mission_type
      and mission.status = 'completed'::public.mission_status
      and mission.scheduled_start_at is not null
      and mission.assigned_user_id = new.facilitator_user_id
      and exists (
        select 1
        from public.mission_reports report
        where report.mission_id = mission.id
          and report.archived_at is null
          and report.report_status = 'validated'::public.mission_report_status
      )
  ) then
    raise exception 'Animation invoice requires a completed mission with a validated report'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_animation_invoice()
from public, anon, authenticated;

drop trigger if exists validate_animation_invoice on public.animation_invoices;
create trigger validate_animation_invoice
before insert or update on public.animation_invoices
for each row execute function private.validate_animation_invoice();

comment on function private.validate_animation_invoice() is
  'Ensures animation invoices are attached to a completed, dated animation with a validated report and the same facilitator.';
