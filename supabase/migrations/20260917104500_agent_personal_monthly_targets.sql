-- Personal monthly revenue targets for field agents.
-- These targets are intentionally separate from performance_objectives:
-- official objectives remain governed by brand managers, while an agent can
-- keep a private fallback target for their own cockpit when no official target exists.

create table public.agent_personal_monthly_targets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  month_start date not null,
  revenue_target_ht numeric(14,2) not null check (revenue_target_ht > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_personal_monthly_targets_month_start_check
    check (month_start = date_trunc('month', month_start::timestamp)::date),
  constraint agent_personal_monthly_targets_unique_month
    unique (brand_id, user_id, month_start)
);

create index agent_personal_monthly_targets_user_month_idx
  on public.agent_personal_monthly_targets(user_id, month_start desc);

alter table public.agent_personal_monthly_targets enable row level security;

revoke all on public.agent_personal_monthly_targets from public, anon;
grant select, insert, update, delete on public.agent_personal_monthly_targets to authenticated;
grant all on public.agent_personal_monthly_targets to service_role;

create policy agent_personal_monthly_targets_select
on public.agent_personal_monthly_targets
for select to authenticated
using (
  user_id = (select auth.uid())
  and private.has_brand_role(brand_id, array['agent'])
);

create policy agent_personal_monthly_targets_insert
on public.agent_personal_monthly_targets
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.has_brand_role(brand_id, array['agent'])
);

create policy agent_personal_monthly_targets_update
on public.agent_personal_monthly_targets
for update to authenticated
using (
  user_id = (select auth.uid())
  and private.has_brand_role(brand_id, array['agent'])
)
with check (
  user_id = (select auth.uid())
  and private.has_brand_role(brand_id, array['agent'])
);

create policy agent_personal_monthly_targets_delete
on public.agent_personal_monthly_targets
for delete to authenticated
using (
  user_id = (select auth.uid())
  and private.has_brand_role(brand_id, array['agent'])
);

create trigger set_agent_personal_monthly_targets_updated_at
before update on public.agent_personal_monthly_targets
for each row execute function private.set_updated_at();

comment on table public.agent_personal_monthly_targets is
  'Private fallback monthly revenue targets owned by an agent. Official performance_objectives always take precedence in the UI.';
