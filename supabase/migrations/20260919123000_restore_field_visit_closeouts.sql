-- Restore the canonical visit-closeout table on environments where the
-- historical migration ledger advanced without creating the relation.
-- This migration is intentionally additive and safe on staging where the
-- table already exists.

create table if not exists public.field_visit_closeouts (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.field_visits(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  outcome text not null check (outcome in ('order_taken','no_order','follow_up','information','other')),
  summary text not null check (nullif(btrim(summary),'') is not null),
  input_mode text not null default 'manual' check (input_mode in ('manual','dictation','assistant')),
  structured_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_payload) = 'object'),
  next_visit_id uuid references public.field_visits(id) on delete set null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists field_visit_closeouts_completed_idx
  on public.field_visit_closeouts(completed_at desc);

alter table public.field_visit_closeouts enable row level security;

revoke all on public.field_visit_closeouts from public, anon;
grant select on public.field_visit_closeouts to authenticated;
grant all on public.field_visit_closeouts to service_role;

drop policy if exists field_visit_closeouts_select on public.field_visit_closeouts;
create policy field_visit_closeouts_select on public.field_visit_closeouts
for select to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1
    from public.field_visit_brands fvb
    where fvb.visit_id = field_visit_closeouts.visit_id
      and private.can_access_brand_pharmacy(fvb.brand_pharmacy_id)
  )
);

comment on table public.field_visit_closeouts is
  'Visit-level closeout contract designed for manual input today and dictation/assistant prefill later without changing the business workflow.';
comment on column public.field_visit_closeouts.structured_payload is
  'Structured assistant output. The human-readable summary remains the source of truth shown to users.';
