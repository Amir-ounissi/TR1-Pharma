create table public.saas_capabilities (
  key text primary key,
  label text not null,
  description text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_capabilities_key_check check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint saas_capabilities_category_check check (category ~ '^[a-z][a-z0-9_]{1,31}$')
);

create table public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  is_public boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_plans_key_check check (key ~ '^[a-z][a-z0-9_]{1,63}$')
);

create table public.saas_plan_capabilities (
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  capability_key text not null references public.saas_capabilities(key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (plan_id, capability_key)
);

create table public.brand_saas_entitlements (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id) on delete restrict,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  seat_limit integer,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_saas_entitlements_status_check check (status in ('trialing','active','suspended')),
  constraint brand_saas_entitlements_dates_check check (ends_at is null or ends_at >= starts_at),
  constraint brand_saas_entitlements_seat_limit_check check (seat_limit is null or seat_limit > 0)
);

create table public.brand_capability_overrides (
  brand_id uuid not null references public.brands(id) on delete cascade,
  capability_key text not null references public.saas_capabilities(key) on delete cascade,
  enabled boolean not null,
  reason text,
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, capability_key),
  constraint brand_capability_overrides_reason_check check (reason is null or char_length(reason) <= 500)
);

create table public.brand_saas_settings (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  terminology jsonb not null default '{"field_rep_singular":"Commercial","field_rep_plural":"Commerciaux","manager_singular":"Manager","manager_plural":"Managers","pharmacy_singular":"Pharmacie","pharmacy_plural":"Pharmacies","customer_singular":"Client","customer_plural":"Clients","initial_order":"Implantation","reorder":"Réassort","mission_singular":"Mission","mission_plural":"Missions"}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_saas_settings_terminology_object check (jsonb_typeof(terminology) = 'object'),
  constraint brand_saas_settings_configuration_object check (jsonb_typeof(configuration) = 'object'),
  constraint brand_saas_settings_terminology_size check (octet_length(terminology::text) <= 8192),
  constraint brand_saas_settings_configuration_size check (octet_length(configuration::text) <= 32768)
);

insert into public.saas_capabilities(key,label,description,category) values
  ('core_crm','CRM terrain','Pharmacies, relations commerciales et actions de base.','core'),
  ('orders','Commandes','Création et suivi des commandes.','core'),
  ('agent_day','Ma journée','Expérience quotidienne du commercial terrain.','core'),
  ('missions','Missions','Missions terrain, comptes rendus et preuves.','core'),
  ('performance','Performance','Indicateurs et objectifs commerciaux.','pilotage'),
  ('distribution','Distribution','Distribution numérique et assortiment.','pilotage'),
  ('assistant_terrain','Assistant Terrain','Assistant contextuel pour la préparation et le suivi terrain.','intelligence'),
  ('whatsapp','WhatsApp','Connecteur WhatsApp Business.','connectors'),
  ('pdf_order_import','Import commande PDF','Extraction et validation de commandes PDF.','data'),
  ('data_mapping','Data Mapping Studio','Mapping de sources externes vers le modèle canonique TR1.','data'),
  ('autonomous_onboarding','Onboarding autonome','Configuration autonome d’une nouvelle marque.','platform'),
  ('executive_cockpit','Executive Cockpit','Cockpit synthétique de direction.','direction'),
  ('kam_groups','KAM Groupements','Pilotage des groupements, réseaux et potentiel.','pilotage'),
  ('trade_marketing','Trade Marketing','Campagnes, animations, coûts, résultats et ROI.','trade'),
  ('sell_out','Sell-out','Collecte et analyse du sell-out et des stocks.','data'),
  ('forecast','Forecast','Atterrissage et projection commerciale explicables.','intelligence'),
  ('next_best_action','Next Best Action','Recommandations commerciales déterministes et explicables.','intelligence'),
  ('pharma_360','Pharma 360','Vue consolidée business, terrain, assortiment et opportunités.','pilotage'),
  ('direction_workspace','Espace Direction','Parcours distinct pour les décideurs.','direction'),
  ('connectors','Connecteurs','Connecteurs CRM, ERP et sources externes.','connectors'),
  ('multi_provider','Multi-intervenants','Intervenants externes et multicartes en environnement multimarque.','field'),
  ('advanced_audit','Audit avancé','Traçabilité et gouvernance avancées.','platform'),
  ('api_access','API','Accès API pour intégrations clientes.','platform'),
  ('sso','SSO','Authentification entreprise et fédération d’identité.','platform'),
  ('custom_roles','Rôles personnalisés','Rôles et permissions personnalisables.','platform')
on conflict (key) do update set
  label=excluded.label,
  description=excluded.description,
  category=excluded.category,
  is_active=true;

insert into public.saas_plans(key,name,description,is_public,sort_order) values
  ('core','Core','Socle d’exécution commerciale terrain.',true,10),
  ('growth','Growth','Pilotage et intelligence commerciale avancés.',true,20),
  ('enterprise','Enterprise','Données, intégrations et gouvernance entreprise.',true,30),
  ('legacy_full','Legacy Full','Plan de compatibilité des marques déjà présentes avant le découpage SaaS.',false,999)
on conflict (key) do update set
  name=excluded.name,
  description=excluded.description,
  is_public=excluded.is_public,
  sort_order=excluded.sort_order,
  is_active=true;

insert into public.saas_plan_capabilities(plan_id,capability_key,enabled)
select plan.id, capability.key, true
from public.saas_plans plan
join public.saas_capabilities capability on capability.key in (
  'core_crm','orders','agent_day','missions','performance','distribution'
)
where plan.key='core'
on conflict (plan_id,capability_key) do update set enabled=excluded.enabled;

insert into public.saas_plan_capabilities(plan_id,capability_key,enabled)
select plan.id, capability.key, true
from public.saas_plans plan
join public.saas_capabilities capability on capability.key in (
  'core_crm','orders','agent_day','missions','performance','distribution',
  'assistant_terrain','pdf_order_import','data_mapping','autonomous_onboarding',
  'kam_groups','trade_marketing','next_best_action'
)
where plan.key='growth'
on conflict (plan_id,capability_key) do update set enabled=excluded.enabled;

insert into public.saas_plan_capabilities(plan_id,capability_key,enabled)
select plan.id, capability.key, true
from public.saas_plans plan
cross join public.saas_capabilities capability
where plan.key='enterprise' and capability.is_active
on conflict (plan_id,capability_key) do update set enabled=excluded.enabled;

insert into public.brand_saas_entitlements(brand_id,plan_id,status)
select brand.id, plan.id, 'active'
from public.brands brand
cross join public.saas_plans plan
where plan.key='legacy_full'
on conflict (brand_id) do nothing;

insert into public.brand_saas_settings(brand_id)
select id from public.brands
on conflict (brand_id) do nothing;

create or replace function private.initialize_brand_saas()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.brand_saas_settings(brand_id) values(new.id)
  on conflict (brand_id) do nothing;

  -- Compatibility first: Lot 3 will explicitly choose a commercial plan for self-service onboardings.
  insert into public.brand_saas_entitlements(brand_id,plan_id,status)
  select new.id, plan.id, 'active'
  from public.saas_plans plan
  where plan.key='legacy_full'
  on conflict (brand_id) do nothing;
  return new;
end;
$$;

create trigger brands_initialize_saas
after insert on public.brands
for each row execute function private.initialize_brand_saas();

create trigger saas_capabilities_updated_at
before update on public.saas_capabilities
for each row execute function private.set_updated_at();
create trigger saas_plans_updated_at
before update on public.saas_plans
for each row execute function private.set_updated_at();
create trigger brand_saas_entitlements_updated_at
before update on public.brand_saas_entitlements
for each row execute function private.set_updated_at();
create trigger brand_capability_overrides_updated_at
before update on public.brand_capability_overrides
for each row execute function private.set_updated_at();
create trigger brand_saas_settings_updated_at
before update on public.brand_saas_settings
for each row execute function private.set_updated_at();

alter table public.saas_capabilities enable row level security;
alter table public.saas_plans enable row level security;
alter table public.saas_plan_capabilities enable row level security;
alter table public.brand_saas_entitlements enable row level security;
alter table public.brand_capability_overrides enable row level security;
alter table public.brand_saas_settings enable row level security;

create policy saas_capabilities_select on public.saas_capabilities
for select to authenticated using (true);
create policy saas_plans_select on public.saas_plans
for select to authenticated using (is_public or private.has_global_role(array['super_admin']));
create policy saas_plan_capabilities_select on public.saas_plan_capabilities
for select to authenticated using (true);
create policy brand_saas_entitlements_select on public.brand_saas_entitlements
for select to authenticated using (private.can_access_brand(brand_id) or private.has_global_role(array['super_admin']));
create policy brand_capability_overrides_select on public.brand_capability_overrides
for select to authenticated using (private.can_access_brand(brand_id) or private.has_global_role(array['super_admin']));
create policy brand_saas_settings_select on public.brand_saas_settings
for select to authenticated using (private.can_access_brand(brand_id) or private.has_global_role(array['super_admin']));

revoke all on public.saas_capabilities,public.saas_plans,public.saas_plan_capabilities,public.brand_saas_entitlements,public.brand_capability_overrides,public.brand_saas_settings from anon,authenticated;
grant select on public.saas_capabilities,public.saas_plans,public.saas_plan_capabilities,public.brand_saas_entitlements,public.brand_capability_overrides,public.brand_saas_settings to authenticated;
grant all on public.saas_capabilities,public.saas_plans,public.saas_plan_capabilities,public.brand_saas_entitlements,public.brand_capability_overrides,public.brand_saas_settings to service_role;

create or replace function public.get_my_brand_capabilities(target_brand_id uuid)
returns table(capability_key text,enabled boolean,source text)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not (private.can_access_brand(target_brand_id) or private.has_global_role(array['super_admin'])) then
    return;
  end if;

  return query
  with entitlement as (
    select plan.id as plan_id, plan.key as plan_key, entitlement.status,
      entitlement.status in ('trialing','active')
      and (entitlement.ends_at is null or entitlement.ends_at > now()) as entitlement_active
    from public.brand_saas_entitlements entitlement
    join public.saas_plans plan on plan.id=entitlement.plan_id and plan.is_active
    where entitlement.brand_id=target_brand_id
  )
  select capability.key,
    case
      when coalesce(entitlement.entitlement_active,false)=false then false
      when override_row.capability_key is not null then override_row.enabled
      when entitlement.plan_key='legacy_full' then true
      else coalesce(plan_capability.enabled,false)
    end as enabled,
    case
      when coalesce(entitlement.entitlement_active,false)=false then 'none'
      when override_row.capability_key is not null then 'override'
      when entitlement.plan_key='legacy_full' then 'legacy_full'
      when coalesce(plan_capability.enabled,false) then 'plan'
      else 'none'
    end::text as source
  from public.saas_capabilities capability
  left join entitlement on true
  left join public.saas_plan_capabilities plan_capability
    on plan_capability.plan_id=entitlement.plan_id
   and plan_capability.capability_key=capability.key
  left join public.brand_capability_overrides override_row
    on override_row.brand_id=target_brand_id
   and override_row.capability_key=capability.key
   and (override_row.expires_at is null or override_row.expires_at > now())
  where capability.is_active
  order by capability.key;
end;
$$;

create or replace function public.has_brand_capability(target_brand_id uuid,target_capability_key text)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select coalesce((
    select capability.enabled
    from public.get_my_brand_capabilities(target_brand_id) capability
    where capability.capability_key=target_capability_key
  ),false);
$$;

create or replace function public.set_brand_saas_plan(
  target_brand_id uuid,
  target_plan_key text,
  target_status text default 'active',
  target_seat_limit integer default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  selected_plan_id uuid;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;
  if target_status not in ('trialing','active','suspended') then
    raise exception 'Invalid SaaS entitlement status' using errcode='22023';
  end if;
  if target_seat_limit is not null and target_seat_limit <= 0 then
    raise exception 'Seat limit must be positive' using errcode='22023';
  end if;
  select id into selected_plan_id from public.saas_plans where key=target_plan_key and is_active;
  if selected_plan_id is null then
    raise exception 'Unknown SaaS plan' using errcode='22023';
  end if;
  if not exists(select 1 from public.brands where id=target_brand_id) then
    raise exception 'Unknown brand' using errcode='22023';
  end if;

  insert into public.brand_saas_entitlements(
    brand_id,plan_id,status,seat_limit,created_by,updated_by
  ) values(
    target_brand_id,selected_plan_id,target_status,target_seat_limit,(select auth.uid()),(select auth.uid())
  )
  on conflict (brand_id) do update set
    plan_id=excluded.plan_id,
    status=excluded.status,
    seat_limit=excluded.seat_limit,
    starts_at=case when public.brand_saas_entitlements.plan_id<>excluded.plan_id then now() else public.brand_saas_entitlements.starts_at end,
    ends_at=null,
    updated_by=(select auth.uid());
end;
$$;

create or replace function public.set_brand_capability_override(
  target_brand_id uuid,
  target_capability_key text,
  target_enabled boolean,
  target_reason text default null,
  target_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;
  if not exists(select 1 from public.brands where id=target_brand_id) then
    raise exception 'Unknown brand' using errcode='22023';
  end if;
  if not exists(select 1 from public.saas_capabilities where key=target_capability_key and is_active) then
    raise exception 'Unknown SaaS capability' using errcode='22023';
  end if;
  if target_expires_at is not null and target_expires_at <= now() then
    raise exception 'Override expiry must be in the future' using errcode='22023';
  end if;

  insert into public.brand_capability_overrides(
    brand_id,capability_key,enabled,reason,expires_at,created_by,updated_by
  ) values(
    target_brand_id,target_capability_key,target_enabled,nullif(btrim(target_reason),''),target_expires_at,(select auth.uid()),(select auth.uid())
  )
  on conflict (brand_id,capability_key) do update set
    enabled=excluded.enabled,
    reason=excluded.reason,
    expires_at=excluded.expires_at,
    updated_by=(select auth.uid());
end;
$$;

create or replace function public.clear_brand_capability_override(
  target_brand_id uuid,
  target_capability_key text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Platform administrator access is required' using errcode='42501';
  end if;
  delete from public.brand_capability_overrides
  where brand_id=target_brand_id and capability_key=target_capability_key;
end;
$$;

create or replace function public.update_brand_saas_settings(
  target_brand_id uuid,
  terminology_patch jsonb default null,
  configuration_patch jsonb default null
)
returns public.brand_saas_settings
language plpgsql
security definer
set search_path=''
as $$
declare
  result public.brand_saas_settings;
begin
  if not (
    private.has_global_role(array['super_admin'])
    or private.has_brand_role(target_brand_id,array['tr1_manager','brand_admin'])
  ) then
    raise exception 'Brand SaaS settings update forbidden' using errcode='42501';
  end if;
  if terminology_patch is not null and jsonb_typeof(terminology_patch)<>'object' then
    raise exception 'Terminology patch must be an object' using errcode='22023';
  end if;
  if configuration_patch is not null and jsonb_typeof(configuration_patch)<>'object' then
    raise exception 'Configuration patch must be an object' using errcode='22023';
  end if;
  if not exists(select 1 from public.brands where id=target_brand_id) then
    raise exception 'Unknown brand' using errcode='22023';
  end if;

  insert into public.brand_saas_settings(brand_id,terminology,configuration,updated_by)
  values(
    target_brand_id,
    jsonb_strip_nulls('{"field_rep_singular":"Commercial","field_rep_plural":"Commerciaux","manager_singular":"Manager","manager_plural":"Managers","pharmacy_singular":"Pharmacie","pharmacy_plural":"Pharmacies","customer_singular":"Client","customer_plural":"Clients","initial_order":"Implantation","reorder":"Réassort","mission_singular":"Mission","mission_plural":"Missions"}'::jsonb || coalesce(terminology_patch,'{}'::jsonb)),
    jsonb_strip_nulls(coalesce(configuration_patch,'{}'::jsonb)),
    (select auth.uid())
  )
  on conflict (brand_id) do update set
    terminology=jsonb_strip_nulls(public.brand_saas_settings.terminology || coalesce(terminology_patch,'{}'::jsonb)),
    configuration=jsonb_strip_nulls(public.brand_saas_settings.configuration || coalesce(configuration_patch,'{}'::jsonb)),
    updated_by=(select auth.uid())
  returning * into result;

  return result;
end;
$$;

revoke all on function public.get_my_brand_capabilities(uuid),public.has_brand_capability(uuid,text),public.set_brand_saas_plan(uuid,text,text,integer),public.set_brand_capability_override(uuid,text,boolean,text,timestamptz),public.clear_brand_capability_override(uuid,text),public.update_brand_saas_settings(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.get_my_brand_capabilities(uuid),public.has_brand_capability(uuid,text),public.set_brand_saas_plan(uuid,text,text,integer),public.set_brand_capability_override(uuid,text,boolean,text,timestamptz),public.clear_brand_capability_override(uuid,text),public.update_brand_saas_settings(uuid,jsonb,jsonb) to authenticated,service_role;

comment on table public.saas_capabilities is 'Canonical product capabilities. Business modules must depend on these keys, never on a specific brand name.';
comment on table public.brand_saas_entitlements is 'Current plan entitlement for one brand. Billing is intentionally outside this foundation.';
comment on table public.brand_capability_overrides is 'Explicit per-brand capability exceptions. A live override wins over the plan.';
comment on table public.brand_saas_settings is 'Brand-level terminology and extensible SaaS configuration, separated from commercial business rules.';
comment on function public.get_my_brand_capabilities(uuid) is 'Returns effective capabilities for an accessible brand, with plan/override provenance.';
