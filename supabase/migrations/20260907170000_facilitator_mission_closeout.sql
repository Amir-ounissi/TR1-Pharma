-- Enforce facilitator closeout evidence at the database boundary.
-- This complements the generic mission report validation without changing other field roles.

create or replace function private.enforce_facilitator_mission_closeout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_mission public.missions%rowtype;
  assigned_is_facilitator boolean := false;
  has_merch_plan boolean := false;
  has_merch_result boolean := false;
  cash_evidence_count integer := 0;
  untreated_cash_count integer := 0;
begin
  select * into target_mission
  from public.missions
  where id = new.mission_id;

  if target_mission.id is null or target_mission.assigned_user_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = target_mission.assigned_user_id
      and membership.brand_id = target_mission.brand_id
      and membership.status = 'active'
      and role.key = 'facilitator'
  ) into assigned_is_facilitator;

  if not assigned_is_facilitator then
    return new;
  end if;

  if new.report_status in ('draft','needs_correction','rejected') then
    new.data_quality_status := 'incomplete';
    return new;
  end if;

  if new.report_status not in ('submitted','validated') then
    return new;
  end if;

  if target_mission.mission_type in ('animation','merchandising') then
    select exists (
      select 1
      from public.mission_attachments attachment
      where attachment.mission_id = target_mission.id
        and attachment.uploaded_by = target_mission.assigned_user_id
        and attachment.archived_at is null
        and attachment.evidence_kind = 'merch_plan'
    ) into has_merch_plan;

    if not has_merch_plan then
      raise exception 'Facilitator closeout requires merch plan evidence' using errcode = '23514';
    end if;

    select exists (
      select 1
      from public.mission_attachments attachment
      where attachment.mission_id = target_mission.id
        and attachment.uploaded_by = target_mission.assigned_user_id
        and attachment.archived_at is null
        and attachment.evidence_kind in ('merch_after','merch_detail','merch_plv')
    ) into has_merch_result;

    if not has_merch_result then
      raise exception 'Facilitator closeout requires merchandising result evidence' using errcode = '23514';
    end if;
  end if;

  select count(*)::integer into cash_evidence_count
  from public.mission_attachments attachment
  where attachment.mission_id = target_mission.id
    and attachment.uploaded_by = target_mission.assigned_user_id
    and attachment.archived_at is null
    and attachment.evidence_kind = 'cash_register';

  if cash_evidence_count > 0 then
    select count(*)::integer into untreated_cash_count
    from public.mission_attachments attachment
    where attachment.mission_id = target_mission.id
      and attachment.uploaded_by = target_mission.assigned_user_id
      and attachment.archived_at is null
      and attachment.evidence_kind = 'cash_register'
      and not exists (
        select 1
        from public.sell_out_captures capture
        where capture.source_mission_attachment_id = attachment.id
          and capture.archived_at is null
          and capture.status in ('review_required','validated')
      );

    if untreated_cash_count > 0 then
      raise exception 'Cash-register evidence requires sell-out review before report submission' using errcode = '23514';
    end if;
  end if;

  new.data_quality_status := 'complete';
  return new;
end;
$$;

revoke all on function private.enforce_facilitator_mission_closeout() from public, anon, authenticated;

drop trigger if exists enforce_facilitator_mission_closeout on public.mission_reports;
create trigger enforce_facilitator_mission_closeout
before insert or update of report_status on public.mission_reports
for each row execute function private.enforce_facilitator_mission_closeout();

comment on function private.enforce_facilitator_mission_closeout() is
  'Requires facilitator merch-plan/result evidence and review of any uploaded cash-register proof before a mission report can be submitted.';