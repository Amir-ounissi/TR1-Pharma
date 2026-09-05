create type public.trade_campaign_type as enum (
  'activation',
  'launch',
  'animation',
  'training',
  'merchandising',
  'visibility',
  'sell_out',
  'sampling',
  'promotion',
  'other'
);

create type public.trade_campaign_status as enum (
  'draft',
  'planned',
  'active',
  'completed',
  'cancelled'
);

create table public.trade_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  code text,
  campaign_type public.trade_campaign_type not null default 'other',
  status public.trade_campaign_status not null default 'draft',
  objective text,
  starts_on date not null,
  ends_on date not null,
  budget_planned_ht numeric(14,2) not null default 0 check (budget_planned_ht >= 0),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_campaigns_dates_check check (ends_on >= starts_on),
  constraint trade_campaigns_name_check check (char_length(btrim(name)) between 2 and 160),
  constraint trade_campaigns_code_check check (code is null or char_length(btrim(code)) between 1 and 64),
  constraint trade_campaigns_objective_check check (objective is null or char_length(objective) <= 2000),
  constraint trade_campaigns_notes_check check (notes is null or char_length(notes) <= 5000)
);

create unique index trade_campaigns_brand_code_active_idx
  on public.trade_campaigns(brand_id, upper(btrim(code)))
  where code is not null and btrim(code) <> '' and archived_at is null;
create index trade_campaigns_brand_period_idx
  on public.trade_campaigns(brand_id, starts_on, ends_on)
  where archived_at is null;

create table public.trade_campaign_targets (
  campaign_id uuid not null references public.trade_campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null references public.brand_pharmacies(id) on delete cascade,
  target_reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, brand_pharmacy_id),
  constraint trade_campaign_targets_reason_check check (target_reason is null or char_length(target_reason) <= 1000)
);
create index trade_campaign_targets_brand_idx on public.trade_campaign_targets(brand_id, brand_pharmacy_id);

create table public.trade_campaign_products (
  campaign_id uuid not null references public.trade_campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  target_units integer check (target_units is null or target_units >= 0),
  target_distribution_rate numeric(5,2) check (target_distribution_rate is null or target_distribution_rate between 0 and 100),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, product_id)
);
create index trade_campaign_products_brand_idx on public.trade_campaign_products(brand_id, product_id);

create table public.trade_campaign_missions (
  campaign_id uuid not null references public.trade_campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  linked_by uuid references public.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key (campaign_id, mission_id),
  unique (mission_id)
);
create index trade_campaign_missions_brand_idx on public.trade_campaign_missions(brand_id, campaign_id);

create table public.trade_campaign_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.trade_campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  event_name text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint trade_campaign_events_name_check check (event_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint trade_campaign_events_metadata_check check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384)
);
create index trade_campaign_events_campaign_idx on public.trade_campaign_events(campaign_id, created_at desc);

create trigger trade_campaigns_updated_at
before update on public.trade_campaigns
for each row execute function private.set_updated_at();

create or replace function private.can_read_trade_marketing(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    private.has_global_role(array['super_admin'])
    or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin','brand_user'])
  )
  and public.has_brand_capability(target_brand_id, 'trade_marketing');
$$;

create or replace function private.can_manage_trade_marketing(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    private.has_global_role(array['super_admin'])
    or private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin'])
  )
  and public.has_brand_capability(target_brand_id, 'trade_marketing');
$$;

revoke all on function private.can_read_trade_marketing(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_trade_marketing(uuid) from public, anon, authenticated;

alter table public.trade_campaigns enable row level security;
alter table public.trade_campaign_targets enable row level security;
alter table public.trade_campaign_products enable row level security;
alter table public.trade_campaign_missions enable row level security;
alter table public.trade_campaign_events enable row level security;

create policy trade_campaigns_select on public.trade_campaigns
for select to authenticated using (private.can_read_trade_marketing(brand_id));
create policy trade_campaign_targets_select on public.trade_campaign_targets
for select to authenticated using (private.can_read_trade_marketing(brand_id));
create policy trade_campaign_products_select on public.trade_campaign_products
for select to authenticated using (private.can_read_trade_marketing(brand_id));
create policy trade_campaign_missions_select on public.trade_campaign_missions
for select to authenticated using (private.can_read_trade_marketing(brand_id));
create policy trade_campaign_events_select on public.trade_campaign_events
for select to authenticated using (private.can_read_trade_marketing(brand_id));

revoke all on public.trade_campaigns, public.trade_campaign_targets, public.trade_campaign_products,
  public.trade_campaign_missions, public.trade_campaign_events from anon, authenticated;
grant select on public.trade_campaigns, public.trade_campaign_targets, public.trade_campaign_products,
  public.trade_campaign_missions, public.trade_campaign_events to authenticated;
grant all on public.trade_campaigns, public.trade_campaign_targets, public.trade_campaign_products,
  public.trade_campaign_missions, public.trade_campaign_events to service_role;
grant usage, select on sequence public.trade_campaign_events_id_seq to service_role;

create or replace function private.trade_campaign_brand(target_campaign_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select campaign.brand_id
  from public.trade_campaigns campaign
  where campaign.id = target_campaign_id
    and campaign.archived_at is null;
$$;
revoke all on function private.trade_campaign_brand(uuid) from public, anon, authenticated;

create or replace function public.save_trade_campaign(
  target_campaign_id uuid,
  target_brand_id uuid,
  target_name text,
  target_code text,
  target_campaign_type public.trade_campaign_type,
  target_status public.trade_campaign_status,
  target_objective text,
  target_starts_on date,
  target_ends_on date,
  target_budget_planned_ht numeric,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid := coalesce(target_campaign_id, gen_random_uuid());
  organization_uuid uuid;
  existing_brand_id uuid;
begin
  if not private.can_manage_trade_marketing(target_brand_id) then
    raise exception 'Trade Marketing campaign update forbidden' using errcode = '42501';
  end if;
  if target_starts_on is null or target_ends_on is null or target_ends_on < target_starts_on then
    raise exception 'Invalid campaign period' using errcode = '22023';
  end if;
  if target_budget_planned_ht is null or target_budget_planned_ht < 0 then
    raise exception 'Invalid campaign budget' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(target_name,''))) < 2 then
    raise exception 'Campaign name is required' using errcode = '22023';
  end if;

  select organization_id into organization_uuid from public.brands where id = target_brand_id;
  if organization_uuid is null then
    raise exception 'Unknown brand' using errcode = '22023';
  end if;

  if target_campaign_id is not null then
    select brand_id into existing_brand_id from public.trade_campaigns where id = target_campaign_id;
    if existing_brand_id is null then
      raise exception 'Campaign not found' using errcode = 'P0002';
    end if;
    if existing_brand_id <> target_brand_id then
      raise exception 'Campaign brand cannot be changed' using errcode = '42501';
    end if;
  end if;

  insert into public.trade_campaigns(
    id, organization_id, brand_id, name, code, campaign_type, status, objective,
    starts_on, ends_on, budget_planned_ht, notes, created_by, updated_by
  ) values (
    result_id, organization_uuid, target_brand_id, btrim(target_name), nullif(btrim(target_code),''),
    target_campaign_type, target_status, nullif(btrim(target_objective),''), target_starts_on,
    target_ends_on, target_budget_planned_ht, nullif(btrim(target_notes),''),
    (select auth.uid()), (select auth.uid())
  )
  on conflict (id) do update set
    name = excluded.name,
    code = excluded.code,
    campaign_type = excluded.campaign_type,
    status = excluded.status,
    objective = excluded.objective,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    budget_planned_ht = excluded.budget_planned_ht,
    notes = excluded.notes,
    updated_by = (select auth.uid()),
    archived_at = null;

  insert into public.trade_campaign_events(campaign_id, brand_id, event_name, actor_user_id, metadata)
  values(
    result_id,
    target_brand_id,
    case when target_campaign_id is null then 'campaign_created' else 'campaign_updated' end,
    (select auth.uid()),
    jsonb_build_object('status', target_status::text, 'budget_planned_ht', target_budget_planned_ht)
  );

  return result_id;
end;
$$;

create or replace function public.archive_trade_campaign(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_brand_id uuid := private.trade_campaign_brand(target_campaign_id);
begin
  if target_brand_id is null then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_trade_marketing(target_brand_id) then
    raise exception 'Trade Marketing campaign archive forbidden' using errcode = '42501';
  end if;
  update public.trade_campaigns
  set archived_at = now(), status = 'cancelled', updated_by = (select auth.uid())
  where id = target_campaign_id;
  insert into public.trade_campaign_events(campaign_id, brand_id, event_name, actor_user_id)
  values(target_campaign_id, target_brand_id, 'campaign_archived', (select auth.uid()));
end;
$$;

create or replace function public.set_trade_campaign_target(
  target_campaign_id uuid,
  target_brand_pharmacy_id uuid,
  target_included boolean,
  target_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_brand_id uuid := private.trade_campaign_brand(target_campaign_id);
begin
  if target_brand_id is null then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_trade_marketing(target_brand_id) then
    raise exception 'Trade Marketing target update forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.brand_pharmacies relation
    where relation.id = target_brand_pharmacy_id
      and relation.brand_id = target_brand_id
      and relation.archived_at is null
  ) then
    raise exception 'Target pharmacy is outside campaign brand' using errcode = '23514';
  end if;

  if target_included then
    insert into public.trade_campaign_targets(campaign_id, brand_id, brand_pharmacy_id, target_reason, created_by)
    values(target_campaign_id, target_brand_id, target_brand_pharmacy_id, nullif(btrim(target_reason),''), (select auth.uid()))
    on conflict (campaign_id, brand_pharmacy_id) do update set target_reason = excluded.target_reason;
  else
    delete from public.trade_campaign_targets
    where campaign_id = target_campaign_id and brand_pharmacy_id = target_brand_pharmacy_id;
  end if;

  insert into public.trade_campaign_events(campaign_id, brand_id, event_name, actor_user_id, metadata)
  values(target_campaign_id, target_brand_id, case when target_included then 'target_added' else 'target_removed' end,
    (select auth.uid()), jsonb_build_object('brand_pharmacy_id', target_brand_pharmacy_id));
end;
$$;

create or replace function public.set_trade_campaign_product(
  target_campaign_id uuid,
  target_product_id uuid,
  target_included boolean,
  target_units integer default null,
  target_distribution_rate numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_brand_id uuid := private.trade_campaign_brand(target_campaign_id);
begin
  if target_brand_id is null then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_trade_marketing(target_brand_id) then
    raise exception 'Trade Marketing product update forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.products product
    where product.id = target_product_id and product.brand_id = target_brand_id and product.is_active
  ) then
    raise exception 'Campaign product is outside campaign brand' using errcode = '23514';
  end if;
  if target_units is not null and target_units < 0 then
    raise exception 'Invalid target units' using errcode = '22023';
  end if;
  if target_distribution_rate is not null and (target_distribution_rate < 0 or target_distribution_rate > 100) then
    raise exception 'Invalid target distribution rate' using errcode = '22023';
  end if;

  if target_included then
    insert into public.trade_campaign_products(campaign_id, brand_id, product_id, target_units, target_distribution_rate, created_by)
    values(target_campaign_id, target_brand_id, target_product_id, target_units, target_distribution_rate, (select auth.uid()))
    on conflict (campaign_id, product_id) do update set
      target_units = excluded.target_units,
      target_distribution_rate = excluded.target_distribution_rate;
  else
    delete from public.trade_campaign_products
    where campaign_id = target_campaign_id and product_id = target_product_id;
  end if;

  insert into public.trade_campaign_events(campaign_id, brand_id, event_name, actor_user_id, metadata)
  values(target_campaign_id, target_brand_id, case when target_included then 'product_added' else 'product_removed' end,
    (select auth.uid()), jsonb_build_object('product_id', target_product_id));
end;
$$;

create or replace function public.set_trade_campaign_mission(
  target_campaign_id uuid,
  target_mission_id uuid,
  target_linked boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_brand_id uuid := private.trade_campaign_brand(target_campaign_id);
begin
  if target_brand_id is null then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_trade_marketing(target_brand_id) then
    raise exception 'Trade Marketing mission update forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.missions mission
    where mission.id = target_mission_id
      and mission.brand_id = target_brand_id
      and mission.archived_at is null
  ) then
    raise exception 'Mission is outside campaign brand' using errcode = '23514';
  end if;

  if target_linked then
    insert into public.trade_campaign_missions(campaign_id, brand_id, mission_id, linked_by)
    values(target_campaign_id, target_brand_id, target_mission_id, (select auth.uid()));
  else
    delete from public.trade_campaign_missions
    where campaign_id = target_campaign_id and mission_id = target_mission_id;
  end if;

  insert into public.trade_campaign_events(campaign_id, brand_id, event_name, actor_user_id, metadata)
  values(target_campaign_id, target_brand_id, case when target_linked then 'mission_linked' else 'mission_unlinked' end,
    (select auth.uid()), jsonb_build_object('mission_id', target_mission_id));
exception
  when unique_violation then
    raise exception 'Mission is already linked to a Trade Marketing campaign' using errcode = '23505';
end;
$$;

create or replace function public.get_trade_campaign_overview(
  target_brand_id uuid,
  target_period_start date,
  target_period_end date
)
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_code text,
  campaign_type text,
  campaign_status text,
  starts_on date,
  ends_on date,
  budget_planned_ht numeric,
  target_pharmacies integer,
  executed_pharmacies integer,
  coverage_rate numeric,
  linked_missions integer,
  completed_missions integer,
  animations_completed integer,
  trainings_completed integer,
  actual_cost_ht numeric,
  sell_out_units numeric,
  eligible_observations integer,
  baseline_revenue_30d numeric,
  post_revenue_30d numeric,
  observed_incremental_revenue_ht numeric,
  gross_margin_rate numeric,
  estimated_incremental_margin_ht numeric,
  observed_roi_percent numeric,
  roi_reliability text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid Trade Marketing period' using errcode = '22023';
  end if;
  if not private.can_read_trade_marketing(target_brand_id) then
    raise exception 'Trade Marketing access forbidden' using errcode = '42501';
  end if;

  return query
  with campaigns as (
    select campaign.*
    from public.trade_campaigns campaign
    where campaign.brand_id = target_brand_id
      and campaign.archived_at is null
      and campaign.ends_on >= target_period_start
      and campaign.starts_on <= target_period_end
  ), target_metrics as (
    select
      target.campaign_id,
      count(*)::integer as target_pharmacies
    from public.trade_campaign_targets target
    join campaigns campaign on campaign.id = target.campaign_id
    group by target.campaign_id
  ), linked as (
    select
      link.campaign_id,
      mission.id as mission_id,
      mission.brand_pharmacy_id,
      mission.mission_type,
      mission.status,
      mission.cost_actual_ht,
      impact.sell_out_units,
      impact.revenue_30d_before,
      impact.revenue_30d_after,
      impact.observation_maturity,
      impact.impact_data_quality,
      impact.overlapping_missions
    from public.trade_campaign_missions link
    join campaigns campaign on campaign.id = link.campaign_id
    join public.missions mission on mission.id = link.mission_id and mission.archived_at is null
    left join public.mission_impact impact on impact.mission_id = mission.id
  ), mission_metrics as (
    select
      linked.campaign_id,
      count(*)::integer as linked_missions,
      count(*) filter (where linked.status = 'completed'::public.mission_status)::integer as completed_missions,
      count(*) filter (where linked.status = 'completed'::public.mission_status and linked.mission_type = 'animation'::public.mission_type)::integer as animations_completed,
      count(*) filter (where linked.status = 'completed'::public.mission_status and linked.mission_type = 'training'::public.mission_type)::integer as trainings_completed,
      coalesce(sum(linked.cost_actual_ht) filter (where linked.status = 'completed'::public.mission_status), 0)::numeric as actual_cost_ht,
      coalesce(sum(linked.sell_out_units) filter (where linked.status = 'completed'::public.mission_status), 0)::numeric as sell_out_units,
      count(*) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.observation_maturity <> 'early'::public.mission_observation_maturity
          and linked.impact_data_quality <> 'insufficient'::public.mission_impact_data_quality
          and not coalesce(linked.overlapping_missions, false)
      )::integer as eligible_observations,
      coalesce(sum(linked.revenue_30d_before) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.observation_maturity <> 'early'::public.mission_observation_maturity
          and linked.impact_data_quality <> 'insufficient'::public.mission_impact_data_quality
          and not coalesce(linked.overlapping_missions, false)
      ), 0)::numeric as baseline_revenue_30d,
      coalesce(sum(linked.revenue_30d_after) filter (
        where linked.status = 'completed'::public.mission_status
          and linked.observation_maturity <> 'early'::public.mission_observation_maturity
          and linked.impact_data_quality <> 'insufficient'::public.mission_impact_data_quality
          and not coalesce(linked.overlapping_missions, false)
      ), 0)::numeric as post_revenue_30d,
      count(distinct linked.brand_pharmacy_id) filter (where linked.status = 'completed'::public.mission_status)::integer as executed_pharmacies
    from linked
    group by linked.campaign_id
  ), settings as (
    select gross_margin_rate
    from public.brand_settings
    where brand_id = target_brand_id
  )
  select
    campaign.id,
    campaign.name,
    campaign.code,
    campaign.campaign_type::text,
    campaign.status::text,
    campaign.starts_on,
    campaign.ends_on,
    campaign.budget_planned_ht,
    coalesce(target_metrics.target_pharmacies, 0),
    coalesce(mission_metrics.executed_pharmacies, 0),
    case
      when coalesce(target_metrics.target_pharmacies, 0) = 0 then 0::numeric
      else round(coalesce(mission_metrics.executed_pharmacies, 0)::numeric / target_metrics.target_pharmacies::numeric * 100, 1)
    end,
    coalesce(mission_metrics.linked_missions, 0),
    coalesce(mission_metrics.completed_missions, 0),
    coalesce(mission_metrics.animations_completed, 0),
    coalesce(mission_metrics.trainings_completed, 0),
    coalesce(mission_metrics.actual_cost_ht, 0),
    coalesce(mission_metrics.sell_out_units, 0),
    coalesce(mission_metrics.eligible_observations, 0),
    coalesce(mission_metrics.baseline_revenue_30d, 0),
    coalesce(mission_metrics.post_revenue_30d, 0),
    (coalesce(mission_metrics.post_revenue_30d, 0) - coalesce(mission_metrics.baseline_revenue_30d, 0))::numeric,
    settings.gross_margin_rate,
    case
      when settings.gross_margin_rate is null or coalesce(mission_metrics.eligible_observations, 0) = 0 then null
      else round((coalesce(mission_metrics.post_revenue_30d, 0) - coalesce(mission_metrics.baseline_revenue_30d, 0)) * settings.gross_margin_rate / 100, 2)
    end,
    case
      when settings.gross_margin_rate is null
        or coalesce(mission_metrics.eligible_observations, 0) = 0
        or coalesce(mission_metrics.actual_cost_ht, 0) <= 0
        then null
      else round((
        ((coalesce(mission_metrics.post_revenue_30d, 0) - coalesce(mission_metrics.baseline_revenue_30d, 0)) * settings.gross_margin_rate / 100)
        - mission_metrics.actual_cost_ht
      ) / mission_metrics.actual_cost_ht * 100, 1)
    end,
    case
      when coalesce(mission_metrics.completed_missions, 0) = 0 then 'insufficient'
      when settings.gross_margin_rate is null or coalesce(mission_metrics.eligible_observations, 0) = 0 then 'insufficient'
      when mission_metrics.eligible_observations < mission_metrics.completed_missions then 'partial'
      else 'observed'
    end::text
  from campaigns campaign
  left join target_metrics on target_metrics.campaign_id = campaign.id
  left join mission_metrics on mission_metrics.campaign_id = campaign.id
  left join settings on true
  order by campaign.starts_on desc, campaign.name;
end;
$$;

revoke all on function public.save_trade_campaign(uuid,uuid,text,text,public.trade_campaign_type,public.trade_campaign_status,text,date,date,numeric,text) from public, anon;
revoke all on function public.archive_trade_campaign(uuid) from public, anon;
revoke all on function public.set_trade_campaign_target(uuid,uuid,boolean,text) from public, anon;
revoke all on function public.set_trade_campaign_product(uuid,uuid,boolean,integer,numeric) from public, anon;
revoke all on function public.set_trade_campaign_mission(uuid,uuid,boolean) from public, anon;
revoke all on function public.get_trade_campaign_overview(uuid,date,date) from public, anon;

grant execute on function public.save_trade_campaign(uuid,uuid,text,text,public.trade_campaign_type,public.trade_campaign_status,text,date,date,numeric,text) to authenticated, service_role;
grant execute on function public.archive_trade_campaign(uuid) to authenticated, service_role;
grant execute on function public.set_trade_campaign_target(uuid,uuid,boolean,text) to authenticated, service_role;
grant execute on function public.set_trade_campaign_product(uuid,uuid,boolean,integer,numeric) to authenticated, service_role;
grant execute on function public.set_trade_campaign_mission(uuid,uuid,boolean) to authenticated, service_role;
grant execute on function public.get_trade_campaign_overview(uuid,date,date) to authenticated, service_role;
