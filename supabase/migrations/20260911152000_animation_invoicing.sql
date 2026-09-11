-- Facilitator invoicing for completed, dated animation missions.
-- TR1 tracks invoice receipt / approval / payment status only; it does not execute payments.

alter table public.mission_attachments
  drop constraint if exists mission_attachments_evidence_kind_check;

alter table public.mission_attachments
  add constraint mission_attachments_evidence_kind_check
  check (
    evidence_kind is null
    or evidence_kind in (
      'merch_plan','merch_before','merch_after','merch_detail','merch_plv','cash_register','invoice'
    )
  );

create table public.animation_invoices (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  facilitator_user_id uuid not null references public.users(id) on delete restrict,
  attachment_id uuid not null references public.mission_attachments(id) on delete restrict,
  invoice_number text not null check (char_length(btrim(invoice_number)) between 1 and 100),
  amount_ht numeric(12,2) not null check (amount_ht >= 0),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
  amount_ttc numeric(12,2) not null check (amount_ttc >= 0),
  status text not null default 'submitted'
    check (status in ('submitted','approved','rejected','paid')),
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_ttc = round(amount_ht + vat_amount, 2)),
  check ((status = 'paid' and paid_at is not null) or status <> 'paid')
);

create index animation_invoices_brand_status_idx
  on public.animation_invoices(brand_id, status, submitted_at desc);
create index animation_invoices_facilitator_idx
  on public.animation_invoices(facilitator_user_id, submitted_at desc);

alter table public.animation_invoices enable row level security;

create policy animation_invoices_select on public.animation_invoices
for select to authenticated
using (
  facilitator_user_id = (select auth.uid())
  or private.user_is_tr1_for_brand(brand_id)
  or private.has_brand_role(brand_id, array['brand_admin'])
  or exists (
    select 1
    from public.missions mission
    where mission.id = mission_id
      and mission.brand_id = brand_id
      and (
        mission.requested_by = (select auth.uid())
        or mission.managed_by = (select auth.uid())
      )
  )
);

revoke all on public.animation_invoices from anon;
grant select on public.animation_invoices to authenticated;
grant all on public.animation_invoices to service_role;

create or replace function private.animation_invoice_actor_can_review(
  target_mission public.missions,
  actor uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    actor is not null
    and (
      private.user_is_tr1_for_brand(target_mission.brand_id)
      or private.has_brand_role(target_mission.brand_id, array['brand_admin'])
      or target_mission.requested_by = actor
      or target_mission.managed_by = actor
    );
$$;

revoke all on function private.animation_invoice_actor_can_review(public.missions,uuid)
from public, anon, authenticated;

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
     or mission_record.animation_parent_request_id is null
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

revoke all on function public.submit_animation_invoice(uuid,uuid,text,numeric,numeric) from public, anon;
grant execute on function public.submit_animation_invoice(uuid,uuid,text,numeric,numeric) to authenticated;

create or replace function public.review_animation_invoice(
  target_invoice_id uuid,
  target_decision text,
  target_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invoice_record public.animation_invoices%rowtype;
  mission_record public.missions%rowtype;
  normalized_note text := nullif(btrim(coalesce(target_review_note,'')),'');
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if target_decision not in ('approved','rejected') then
    raise exception 'Invoice decision is invalid' using errcode='23514';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'Review note is too long' using errcode='23514';
  end if;
  if target_decision = 'rejected' and normalized_note is null then
    raise exception 'A rejection reason is required' using errcode='23514';
  end if;

  select * into invoice_record
  from public.animation_invoices
  where id = target_invoice_id
  for update;

  if invoice_record.id is null or invoice_record.status <> 'submitted' then
    raise exception 'Submitted invoice unavailable' using errcode='23514';
  end if;

  select * into mission_record
  from public.missions
  where id = invoice_record.mission_id;

  if mission_record.id is null
     or not private.animation_invoice_actor_can_review(mission_record,actor)
     or actor = invoice_record.facilitator_user_id
  then
    raise exception 'Invoice review unavailable' using errcode='42501';
  end if;

  update public.animation_invoices
  set status = target_decision,
      review_note = normalized_note,
      reviewed_at = now(),
      reviewed_by = actor,
      updated_at = now()
  where id = invoice_record.id;
end;
$$;

revoke all on function public.review_animation_invoice(uuid,text,text) from public, anon;
grant execute on function public.review_animation_invoice(uuid,text,text) to authenticated;

create or replace function public.mark_animation_invoice_paid(target_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invoice_record public.animation_invoices%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into invoice_record
  from public.animation_invoices
  where id = target_invoice_id
  for update;

  if invoice_record.id is null or invoice_record.status <> 'approved' then
    raise exception 'Approved invoice unavailable' using errcode='23514';
  end if;

  if not (
    private.user_is_tr1_for_brand(invoice_record.brand_id)
    or private.has_brand_role(invoice_record.brand_id,array['brand_admin'])
  ) then
    raise exception 'Invoice payment status unavailable' using errcode='42501';
  end if;

  if actor = invoice_record.facilitator_user_id then
    raise exception 'Facilitator cannot mark own invoice paid' using errcode='42501';
  end if;

  update public.animation_invoices
  set status = 'paid',
      paid_at = now(),
      paid_by = actor,
      updated_at = now()
  where id = invoice_record.id;
end;
$$;

revoke all on function public.mark_animation_invoice_paid(uuid) from public, anon;
grant execute on function public.mark_animation_invoice_paid(uuid) to authenticated;

comment on table public.animation_invoices is
  'Invoice tracking for completed facilitator animation days. TR1 records approval/payment status but does not execute payments.';
comment on function public.submit_animation_invoice(uuid,uuid,text,numeric,numeric) is
  'Submits or resubmits a facilitator PDF invoice for one completed dated animation.';
comment on function public.review_animation_invoice(uuid,text,text) is
  'Allows the animation requester/manager, brand admin or TR1 to approve or reject a submitted invoice.';
comment on function public.mark_animation_invoice_paid(uuid) is
  'Allows brand admins or TR1 to record an approved animation invoice as paid.';
