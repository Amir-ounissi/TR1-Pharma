-- Distinguish the merchandising plan photo from before/after execution photos.

alter table public.mission_attachments
  drop constraint if exists mission_attachments_evidence_kind_check;

alter table public.mission_attachments
  add constraint mission_attachments_evidence_kind_check
  check (
    evidence_kind is null
    or evidence_kind in ('merch_plan','merch_before','merch_after','merch_detail','merch_plv','cash_register')
  );

alter table public.personal_field_mission_evidence
  drop constraint if exists personal_field_mission_evidence_evidence_kind_check;

alter table public.personal_field_mission_evidence
  add constraint personal_field_mission_evidence_evidence_kind_check
  check (evidence_kind in ('merch_plan','merch_before','merch_after','merch_detail','merch_plv','cash_register'));

comment on column public.mission_attachments.evidence_kind is
  'Semantic proof collected during a TR1 mission: merchandising plan, before/after/detail/PLV, or cash-register sell-out evidence.';

comment on column public.personal_field_mission_evidence.evidence_kind is
  'Private mission evidence owned by the facilitator: merchandising plan, before/after/detail/PLV, or cash-register proof.';
