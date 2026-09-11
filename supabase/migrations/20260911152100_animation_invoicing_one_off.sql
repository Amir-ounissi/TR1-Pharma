-- Allow any completed, dated facilitator animation to be invoiced, including
-- one-off animations that are not children of a monthly request.

create or replace function public.submit_animation_invoice(
  target_mission_id uuid,
  target_attachment_id uuid,
  target_invoice_number text,
  target_amount_ht numeric,
  target_vat_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  mission_record public.missions%rowtype;
  attachment_record public.mission_attachments%rowtype;
  invoice_record public.animation_invoices%rowtype;
  normalized_number text;
  normalized_ht numeric(12,2);
  normalized_vat numeric(12,2);
  invoice_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into mission_record
  from public.missions
  where id = target_mission_id
    and archived_at is null;

  if mission_record.id is null
     or mission_record.mission_type <> 'animation'::public.mission_type
     or mission_record.scheduled_start_at is null
     or mission_record.assigned_user_id is distinct from actor
  then
    raise exception 'Animation unavailable for invoicing' using errcode='42501';
  end if;

  if mission_record.status <> 'completed'::public.mission_status then
    raise exception 'Animation must be completed before invoicing' using errcode='23514';
  end if;

  if not exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = actor
      and membership.brand_id = mission_record.brand_id
      and membership.status = 'active'
      and role.key = 'facilitator'
  ) then
    raise exception 'Facilitator access required' using errcode='42501';
  end if;

  select * into attachment_record
  from public.mission_attachments
  where id = target_attachment_id
    and mission_id = mission_record.id
    and brand_id = mission_record.brand_id
    and uploaded_by = actor
    and archived_at is null;

  if attachment_record.id is null
     or attachment_record.evidence_kind <> 'invoice'
     or attachment_record.mime_type <> 'application/pdf'
  then
    raise exception 'A PDF invoice attachment is required' using errcode='23514';
  end if;

  normalized_number := btrim(coalesce(target_invoice_number,''));
  normalized_ht := round(coalesce(target_amount_ht,-1),2);
  normalized_vat := round(coalesce(target_vat_amount,0),2);

  if char_length(normalized_number) < 1 or char_length(normalized_number) > 100 then
    raise exception 'Invoice number is invalid' using errcode='23514';
  end if;
  if normalized_ht < 0 or normalized_vat < 0 then
    raise exception 'Invoice amounts are invalid' using errcode='23514';
  end if;

  select * into invoice_record
  from public.animation_invoices
  where mission_id = mission_record.id
  for update;

  if invoice_record.id is null then
    insert into public.animation_invoices(
      mission_id,brand_id,facilitator_user_id,attachment_id,invoice_number,
      amount_ht,vat_amount,amount_ttc,status,submitted_at
    ) values (
      mission_record.id,mission_record.brand_id,actor,attachment_record.id,normalized_number,
      normalized_ht,normalized_vat,round(normalized_ht + normalized_vat,2),'submitted',now()
    ) returning id into invoice_id;
  else
    if invoice_record.facilitator_user_id <> actor then
      raise exception 'Invoice owner mismatch' using errcode='42501';
    end if;
    if invoice_record.status <> 'rejected' then
      raise exception 'Only a rejected invoice can be resubmitted' using errcode='23514';
    end if;

    update public.animation_invoices
    set attachment_id = attachment_record.id,
        invoice_number = normalized_number,
        amount_ht = normalized_ht,
        vat_amount = normalized_vat,
        amount_ttc = round(normalized_ht + normalized_vat,2),
        status = 'submitted',
        review_note = null,
        submitted_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        paid_at = null,
        paid_by = null,
        updated_at = now()
    where id = invoice_record.id
    returning id into invoice_id;
  end if;

  return invoice_id;
end;
$$;

comment on function public.submit_animation_invoice(uuid,uuid,text,numeric,numeric) is
  'Submits or resubmits a facilitator PDF invoice for one completed, dated animation.';
