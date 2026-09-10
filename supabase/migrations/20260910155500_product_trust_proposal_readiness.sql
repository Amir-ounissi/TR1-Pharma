-- Product Trust P0: an approved provider proposal must be operationally complete.
create or replace function public.review_provider_mission_proposal(
  target_mission_id uuid,
  target_decision public.mission_proposal_review_status,
  review_note text default null,
  target_start_at timestamptz default null,
  target_end_at timestamptz default null,
  target_budget_ht numeric default null,
  target_objective text default null,
  target_briefing text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target public.missions%rowtype;
  actor uuid := (select auth.uid());
  clean_note text := nullif(btrim(review_note), '');
  final_start timestamptz;
  final_end timestamptz;
  final_budget numeric;
  final_objective text;
  final_briefing text;
  proposal_product_count integer;
begin
  select *
  into target
  from public.missions
  where id = target_mission_id
  for update;

  if target.id is null
     or target.proposal_source <> 'provider'
     or target.proposal_review_status <> 'pending'
     or not (
       private.user_is_tr1_for_brand(target.brand_id)
       or private.has_brand_role(target.brand_id, array['brand_admin'])
     ) then
    raise exception 'Proposal unavailable' using errcode = '42501';
  end if;

  if target_decision not in ('approved', 'needs_correction', 'rejected') then
    raise exception 'Invalid proposal decision' using errcode = '23514';
  end if;

  if target_decision in ('needs_correction', 'rejected') and clean_note is null then
    raise exception 'Review note is required' using errcode = '23514';
  end if;

  final_start := coalesce(target_start_at, target.scheduled_start_at);
  final_end := coalesce(target_end_at, target.scheduled_end_at);
  final_budget := case
    when target_budget_ht is not null then target_budget_ht
    else coalesce(target.budget_estimated_ht, 0)
  end;
  final_objective := case
    when target_objective is not null then nullif(btrim(target_objective), '')
    else nullif(btrim(target.objective), '')
  end;
  final_briefing := case
    when target_briefing is not null then nullif(btrim(target_briefing), '')
    else nullif(btrim(target.briefing), '')
  end;

  if final_budget < 0 then
    raise exception 'Mission budget must be non-negative' using errcode = '23514';
  end if;

  if target_decision = 'approved' then
    select count(*)::integer
    into proposal_product_count
    from public.mission_products
    where mission_id = target_mission_id;

    if target.assigned_user_id is null then
      raise exception 'Mission assignee is required before approval' using errcode = '23514';
    end if;

    if final_start is null or final_end is null or final_end <= final_start then
      raise exception 'Mission end date must follow start date' using errcode = '23514';
    end if;

    if final_budget <= 0 then
      raise exception 'Mission budget must be greater than zero before approval' using errcode = '23514';
    end if;

    if final_objective is null then
      raise exception 'Mission objective is required before approval' using errcode = '23514';
    end if;

    if final_briefing is null then
      raise exception 'Mission briefing is required before approval' using errcode = '23514';
    end if;

    if proposal_product_count = 0 then
      raise exception 'At least one mission product is required before approval' using errcode = '23514';
    end if;
  end if;

  update public.missions
  set proposal_review_status = target_decision,
      proposal_reviewed_by_user_id = actor,
      proposal_reviewed_at = now(),
      proposal_review_note = clean_note,
      scheduled_start_at = final_start,
      scheduled_end_at = final_end,
      budget_estimated_ht = final_budget,
      cost_estimated_ht = final_budget,
      objective = coalesce(final_objective, objective),
      briefing = case when target_briefing is not null then final_briefing else briefing end,
      managed_by = actor,
      status = case
        when target_decision = 'approved' then 'scheduled'::public.mission_status
        when target_decision = 'rejected' then 'rejected'::public.mission_status
        else status
      end,
      rejection_reason = case
        when target_decision = 'rejected' then clean_note
        else rejection_reason
      end
  where id = target_mission_id;
end;
$function$;
