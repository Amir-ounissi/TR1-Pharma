create table public.commercial_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  professional_email text not null check (char_length(professional_email) between 5 and 254),
  company_name text not null check (char_length(company_name) between 2 and 160),
  status text not null default 'new' check (status in ('new','contacted','qualified','pilot_proposed','pilot_active','won','lost','archived')),
  source text not null default 'website' check (char_length(source) between 2 and 60),
  assigned_to uuid references public.users(id) on delete set null,
  next_action_at timestamptz,
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  deduplication_key text not null unique,
  rate_limit_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index commercial_leads_status_created_idx on public.commercial_leads(status, created_at desc);
create index commercial_leads_assigned_idx on public.commercial_leads(assigned_to, next_action_at) where archived_at is null;
create index commercial_leads_rate_limit_idx on public.commercial_leads(rate_limit_key, created_at desc);

create table public.pilot_projects (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.commercial_leads(id) on delete restrict,
  proposed_organization_name text not null check (char_length(proposed_organization_name) between 2 and 160),
  proposed_brand_name text not null check (char_length(proposed_brand_name) between 2 and 120),
  country_or_scope text check (country_or_scope is null or char_length(country_or_scope) <= 120),
  estimated_users integer check (estimated_users is null or estimated_users between 1 and 10000),
  proposed_start_date date,
  status text not null default 'draft' check (status in ('draft','approved','onboarding','active','completed','cancelled')),
  organization_id uuid references public.organizations(id) on delete restrict,
  brand_id uuid references public.brands(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id)
);

create table public.commercial_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.commercial_leads(id) on delete restrict,
  pilot_project_id uuid references public.pilot_projects(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null,
  event_name text not null check (event_name in ('lead_created','lead_assigned','lead_status_changed','next_action_changed','pilot_prepared','pilot_approved','pilot_onboarding_started','lead_archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index commercial_lead_events_lead_idx on public.commercial_lead_events(lead_id, created_at desc);

create trigger set_commercial_leads_updated_at before update on public.commercial_leads
for each row execute function private.set_updated_at();
create trigger set_pilot_projects_updated_at before update on public.pilot_projects
for each row execute function private.set_updated_at();

create or replace function private.validate_commercial_lead_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'new' and new.status in ('contacted','qualified','lost','archived')) or
    (old.status = 'contacted' and new.status in ('qualified','lost','archived')) or
    (old.status = 'qualified' and new.status in ('pilot_proposed','won','lost','archived')) or
    (old.status = 'pilot_proposed' and new.status in ('pilot_active','lost','archived')) or
    (old.status = 'pilot_active' and new.status in ('won','lost','archived')) or
    (old.status in ('won','lost') and new.status = 'archived')
  ) then
    raise exception 'Invalid commercial lead transition: % -> %', old.status, new.status using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validate_commercial_lead_transition before update of status on public.commercial_leads
for each row execute function private.validate_commercial_lead_transition();

create or replace function private.validate_pilot_project_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'draft' and new.status in ('approved','cancelled')) or
    (old.status = 'approved' and new.status in ('onboarding','cancelled')) or
    (old.status = 'onboarding' and new.status in ('active','cancelled')) or
    (old.status = 'active' and new.status in ('completed','cancelled'))
  ) then
    raise exception 'Invalid pilot transition: % -> %', old.status, new.status using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validate_pilot_project_transition before update of status on public.pilot_projects
for each row execute function private.validate_pilot_project_transition();

create or replace function private.log_commercial_lead_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.commercial_lead_events(lead_id,actor_user_id,event_name)
    values(new.id,(select auth.uid()),'lead_created');
    return new;
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.commercial_lead_events(lead_id,actor_user_id,event_name,metadata)
    values(new.id,(select auth.uid()),'lead_assigned',jsonb_build_object('assigned_to',new.assigned_to));
  end if;
  if new.status is distinct from old.status then
    insert into public.commercial_lead_events(lead_id,actor_user_id,event_name,metadata)
    values(new.id,(select auth.uid()),case when new.status='archived' then 'lead_archived' else 'lead_status_changed' end,
      jsonb_build_object('from',old.status,'to',new.status));
  end if;
  if new.next_action_at is distinct from old.next_action_at then
    insert into public.commercial_lead_events(lead_id,actor_user_id,event_name,metadata)
    values(new.id,(select auth.uid()),'next_action_changed',jsonb_build_object('next_action_at',new.next_action_at));
  end if;
  return new;
end;
$$;

create trigger log_commercial_lead_insert after insert on public.commercial_leads
for each row execute function private.log_commercial_lead_change();
create trigger log_commercial_lead_update after update on public.commercial_leads
for each row execute function private.log_commercial_lead_change();

create or replace function private.prevent_commercial_lead_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Commercial lead history is append-only' using errcode = '42501';
end;
$$;

create trigger commercial_lead_events_append_only before update or delete on public.commercial_lead_events
for each row execute function private.prevent_commercial_lead_event_mutation();

alter table public.commercial_leads enable row level security;
alter table public.pilot_projects enable row level security;
alter table public.commercial_lead_events enable row level security;

grant select on public.commercial_leads to anon;
grant select,update on public.commercial_leads to authenticated;
grant select,insert,update on public.pilot_projects to authenticated;
grant select,insert on public.commercial_lead_events to authenticated;
grant select,insert,update,delete on public.commercial_leads,public.pilot_projects,public.commercial_lead_events to service_role;

create policy commercial_leads_platform_select on public.commercial_leads
for select to authenticated using (private.has_global_role(array['super_admin']));
create policy commercial_leads_platform_update on public.commercial_leads
for update to authenticated using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

create policy pilot_projects_platform_select on public.pilot_projects
for select to authenticated using (private.has_global_role(array['super_admin']));
create policy pilot_projects_platform_insert on public.pilot_projects
for insert to authenticated with check (private.has_global_role(array['super_admin']) and created_by=(select auth.uid()));
create policy pilot_projects_platform_update on public.pilot_projects
for update to authenticated using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

create policy commercial_lead_events_platform_select on public.commercial_lead_events
for select to authenticated using (private.has_global_role(array['super_admin']));
create policy commercial_lead_events_platform_insert on public.commercial_lead_events
for insert to authenticated with check (private.has_global_role(array['super_admin']) and actor_user_id=(select auth.uid()));

create or replace function public.capture_commercial_lead(
  lead_full_name text,
  lead_email text,
  lead_company_name text,
  lead_source text,
  lead_deduplication_key text,
  lead_rate_limit_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare captured_id uuid;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'Lead capture forbidden' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lead_rate_limit_key,0));
  if (select count(*) from public.commercial_leads leads where leads.rate_limit_key=lead_rate_limit_key and leads.created_at > now()-interval '15 minutes') >= 5 then
    raise exception 'Lead capture rate limit exceeded' using errcode = 'P0001';
  end if;
  insert into public.commercial_leads(full_name,professional_email,company_name,source,deduplication_key,rate_limit_key)
  values(btrim(lead_full_name),lower(btrim(lead_email)),btrim(lead_company_name),btrim(lead_source),lead_deduplication_key,lead_rate_limit_key)
  on conflict(deduplication_key) do update set deduplication_key=excluded.deduplication_key
  returning id into captured_id;
  return captured_id;
end;
$$;

revoke all on function public.capture_commercial_lead(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.capture_commercial_lead(text,text,text,text,text,text) to service_role;

create or replace function public.prepare_pilot_project(
  target_lead_id uuid,
  proposed_organization_name text,
  proposed_brand_name text,
  country_or_scope text,
  estimated_users integer,
  proposed_start_date date,
  confirmation boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_pilot_id uuid;
begin
  if not private.has_global_role(array['super_admin']) or confirmation is not true then
    raise exception 'Pilot preparation forbidden' using errcode = '42501';
  end if;
  if not exists(select 1 from public.commercial_leads where id=target_lead_id and status='qualified' and archived_at is null) then
    raise exception 'Lead must be qualified' using errcode = '22023';
  end if;
  insert into public.pilot_projects(lead_id,proposed_organization_name,proposed_brand_name,country_or_scope,estimated_users,proposed_start_date,created_by)
  values(target_lead_id,btrim(proposed_organization_name),btrim(proposed_brand_name),nullif(upper(btrim(country_or_scope)),''),estimated_users,proposed_start_date,(select auth.uid()))
  returning id into created_pilot_id;
  update public.commercial_leads set status='pilot_proposed' where id=target_lead_id;
  insert into public.commercial_lead_events(lead_id,pilot_project_id,actor_user_id,event_name)
  values(target_lead_id,created_pilot_id,(select auth.uid()),'pilot_prepared');
  return created_pilot_id;
end;
$$;

revoke all on function public.prepare_pilot_project(uuid,text,text,text,integer,date,boolean) from public, anon;
grant execute on function public.prepare_pilot_project(uuid,text,text,text,integer,date,boolean) to authenticated;

create or replace function public.approve_pilot_project(target_pilot_id uuid, confirmation boolean)
returns table(organization_id uuid,brand_id uuid,onboarding_id uuid)
language plpgsql security definer set search_path = '' as $$
declare target public.pilot_projects;
declare onboarding record;
begin
  if not private.has_global_role(array['super_admin']) or confirmation is not true then
    raise exception 'Pilot approval forbidden' using errcode = '42501';
  end if;
  select * into target from public.pilot_projects where id=target_pilot_id for update;
  if target.id is null or target.status <> 'draft' then
    raise exception 'Pilot must be a draft' using errcode = '22023';
  end if;
  update public.pilot_projects set status='approved' where id=target.id;
  select * into onboarding from public.create_brand_onboarding(
    jsonb_build_object('legal_name',target.proposed_organization_name,'trade_name',target.proposed_organization_name,'country_code',coalesce(target.country_or_scope,'FR'),'currency_code','EUR','timezone','Europe/Paris','locale','fr-FR'),
    jsonb_build_object('name',target.proposed_brand_name,'code',upper(regexp_replace(target.proposed_brand_name,'[^a-zA-Z0-9]+','_','g')),'country_code',coalesce(target.country_or_scope,'FR'),'currency_code','EUR')
  );
  update public.pilot_projects set status='onboarding',organization_id=onboarding.organization_id,brand_id=onboarding.brand_id where id=target.id;
  update public.commercial_leads set status='pilot_active' where id=target.lead_id and status='pilot_proposed';
  insert into public.commercial_lead_events(lead_id,pilot_project_id,actor_user_id,event_name,metadata)
  values(target.lead_id,target.id,(select auth.uid()),'pilot_approved',jsonb_build_object('organization_id',onboarding.organization_id,'brand_id',onboarding.brand_id)),
        (target.lead_id,target.id,(select auth.uid()),'pilot_onboarding_started',jsonb_build_object('onboarding_id',onboarding.onboarding_id));
  return query select onboarding.organization_id,onboarding.brand_id,onboarding.onboarding_id;
end;
$$;

revoke all on function public.approve_pilot_project(uuid,boolean) from public, anon;
grant execute on function public.approve_pilot_project(uuid,boolean) to authenticated;
