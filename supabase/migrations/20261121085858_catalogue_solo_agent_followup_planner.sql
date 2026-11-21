-- TR1 solo agent: personal daily follow-up actions, without multi-agent/team hierarchy.
-- Private superadmin-only. Nothing is sent to pharmacies or laboratories.
create table if not exists public.private_catalog_agent_followups (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.private_catalog_pharmacies(id) on delete cascade,
  brand_id uuid references public.private_catalog_brands(id) on delete set null,
  action_kind text not null check (action_kind in ('visit','call','email','reorder','animation')),
  next_action_date date not null,
  note text not null default '' check (length(note)<=500),
  status text not null default 'todo' check (status in ('todo','done')),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint followup_completed_consistency check (
    (status='todo' and completed_at is null) or (status='done' and completed_at is not null)
  )
);
create index if not exists private_catalog_agent_followups_due_idx
  on public.private_catalog_agent_followups(status,next_action_date,pharmacy_id);
alter table public.private_catalog_agent_followups enable row level security;
revoke all on public.private_catalog_agent_followups from public,anon,authenticated;
grant select,insert,update on public.private_catalog_agent_followups to authenticated;
create policy solo_agent_admin_followups on public.private_catalog_agent_followups
  for all to authenticated
  using ((select private.has_global_role(array['super_admin']::text[])))
  with check ((select private.has_global_role(array['super_admin']::text[])));
