create type public.interaction_type as enum ('call','email','visit','video_call','message','linkedin','event','internal_note','other');
create type public.interaction_outcome as enum ('no_answer','callback_requested','information_sent','appointment_booked','offer_requested','offer_sent','interested','not_interested','decision_pending','order_expected','completed','other');
create type public.interaction_visibility as enum ('shared','tr1_internal','brand_internal');
create type public.commercial_task_type as enum ('call','email','visit','appointment','send_offer','follow_up','qualify','update_contact','check_stock','request_order','internal_review','other');
create type public.commercial_task_status as enum ('open','in_progress','completed','cancelled','overdue');
create type public.task_priority as enum ('low','normal','high','urgent');
create type public.commercial_source as enum ('manual','interaction','status_change','import','automation','system');
create type public.assignment_type as enum ('commercial_agent','tr1_manager','brand_manager','temporary_backup');
create type public.status_change_source as enum ('manual','import','automation','system');

alter type public.interaction_kind rename to interaction_kind_legacy;
alter type public.task_status rename to task_status_legacy;

drop policy if exists interactions_select on public.interactions;
drop policy if exists interactions_insert on public.interactions;
drop policy if exists interactions_update on public.interactions;
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists pharmacy_assignments_select on public.pharmacy_assignments;
drop policy if exists pharmacy_assignments_manage on public.pharmacy_assignments;
drop policy if exists brand_pharmacies_select on public.brand_pharmacies;

alter table public.brand_pharmacies add constraint brand_pharmacies_id_brand_unique unique (id, brand_id);

alter table public.interactions
  drop constraint if exists interactions_brand_organization_fk,
  drop constraint if exists interactions_pharmacy_brand_fk,
  drop constraint if exists interactions_brand_pharmacy_fk;
alter table public.interactions
  rename column user_id to created_by;
alter table public.interactions rename column summary to subject;
alter table public.interactions rename column details to notes;
alter table public.interactions alter column kind type public.interaction_type using (
  case kind::text when 'meeting' then 'video_call' when 'note' then 'internal_note' else kind::text end
)::public.interaction_type;
alter table public.interactions rename column kind to interaction_type;
alter table public.interactions
  add column pharmacy_contact_id uuid references public.pharmacy_contacts(id) on delete set null,
  add column outcome public.interaction_outcome not null default 'other',
  add column duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  add column assigned_user_id uuid references public.users(id) on delete set null,
  add column related_task_id uuid,
  add column next_action_type public.commercial_task_type,
  add column next_action_at timestamptz,
  add column next_action_owner_id uuid references public.users(id) on delete set null,
  add column visibility public.interaction_visibility not null default 'shared',
  add column archived_at timestamptz;
alter table public.interactions drop column organization_id, drop column pharmacy_id;
alter table public.interactions add constraint interactions_brand_relation_fk
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete cascade;

alter table public.tasks
  drop constraint if exists tasks_brand_organization_fk,
  drop constraint if exists tasks_pharmacy_brand_fk,
  drop constraint if exists tasks_brand_pharmacy_fk;
alter table public.tasks rename column assigned_to_user_id to assigned_to;
alter table public.tasks rename column created_by_user_id to created_by;
alter table public.tasks alter column status drop default;
alter table public.tasks alter column status type public.commercial_task_status using (
  case status::text when 'todo' then 'open' when 'done' then 'completed' else status::text end
)::public.commercial_task_status;
alter table public.tasks alter column status set default 'open';
alter table public.tasks
  add column pharmacy_contact_id uuid references public.pharmacy_contacts(id) on delete set null,
  add column task_type public.commercial_task_type not null default 'other',
  add column priority public.task_priority not null default 'normal',
  add column completed_at timestamptz,
  add column completed_by uuid references public.users(id) on delete set null,
  add column cancellation_reason text,
  add column source public.commercial_source not null default 'manual',
  add column related_interaction_id uuid,
  add column archived_at timestamptz;
alter table public.tasks drop column organization_id, drop column pharmacy_id;
alter table public.tasks add constraint tasks_brand_relation_fk
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete cascade;
alter table public.interactions add constraint interactions_related_task_fk foreign key (related_task_id) references public.tasks(id) on delete set null;
alter table public.tasks add constraint tasks_related_interaction_fk foreign key (related_interaction_id) references public.interactions(id) on delete set null;

alter table public.pharmacy_assignments
  drop constraint if exists pharmacy_assignments_pharmacy_brand_fk,
  drop constraint if exists pharmacy_assignments_brand_pharmacy_fk,
  drop constraint if exists pharmacy_assignments_pharmacy_id_agent_id_starts_at_key;
alter table public.pharmacy_assignments add column user_id uuid references public.users(id) on delete restrict;
update public.pharmacy_assignments pa set user_id = a.user_id from public.agents a where a.id = pa.agent_id;
alter table public.pharmacy_assignments alter column user_id set not null;
alter table public.pharmacy_assignments
  add column assignment_type public.assignment_type not null default 'commercial_agent',
  add column is_primary boolean not null default true,
  add column assignment_reason text,
  add column ended_reason text,
  add column archived_at timestamptz,
  add column updated_at timestamptz not null default now();
alter table public.pharmacy_assignments drop column pharmacy_id, drop column agent_id;
alter table public.pharmacy_assignments add constraint pharmacy_assignments_brand_relation_fk
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete cascade;
create unique index pharmacy_assignments_primary_commercial_active
  on public.pharmacy_assignments(brand_pharmacy_id, assignment_type)
  where is_primary and assignment_type = 'commercial_agent' and ends_at is null and archived_at is null;
create unique index pharmacy_assignments_primary_tr1_active
  on public.pharmacy_assignments(brand_pharmacy_id, assignment_type)
  where is_primary and assignment_type = 'tr1_manager' and ends_at is null and archived_at is null;

create table public.brand_pharmacy_status_history (
  id bigint generated always as identity primary key,
  brand_pharmacy_id uuid not null,
  brand_id uuid not null,
  previous_status public.commercial_status,
  new_status public.commercial_status not null,
  change_reason text,
  changed_by uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  source public.status_change_source not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete cascade
);

create table public.brand_settings (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  default_follow_up_delay_days integer not null default 7 check (default_follow_up_delay_days between 1 and 365),
  offer_follow_up_delay_days integer not null default 5 check (offer_follow_up_delay_days between 1 and 365),
  pending_order_follow_up_delay_days integer not null default 3 check (pending_order_follow_up_delay_days between 1 and 365),
  appointment_reminder_delay_hours integer not null default 24 check (appointment_reminder_delay_hours between 1 and 720),
  require_next_action boolean not null default true,
  allow_agents_to_change_status boolean not null default false,
  allow_agents_to_create_contacts boolean not null default true,
  allow_agents_to_edit_potential boolean not null default true,
  allowed_status_transitions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.brand_settings (brand_id) select id from public.brands on conflict do nothing;

create index interactions_relation_occurred_idx on public.interactions(brand_pharmacy_id, occurred_at desc) where archived_at is null;
create index interactions_brand_visibility_idx on public.interactions(brand_id, visibility, occurred_at desc) where archived_at is null;
create index tasks_relation_due_idx on public.tasks(brand_pharmacy_id, due_at) where archived_at is null and status in ('open','in_progress');
create index tasks_assigned_status_due_idx on public.tasks(assigned_to, status, due_at) where archived_at is null;
create index assignments_user_active_idx on public.pharmacy_assignments(user_id, brand_id) where ends_at is null and archived_at is null;
create index status_history_relation_changed_idx on public.brand_pharmacy_status_history(brand_pharmacy_id, changed_at desc);
create index memberships_user_status_brand_idx on public.memberships(user_id, status, brand_id);

create or replace function private.user_has_active_brand_membership(target_user_id uuid, target_brand_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = target_user_id and m.status = 'active'
      and (m.brand_id = target_brand_id or m.brand_id is null)
  );
$$;

create or replace function private.user_is_assigned_to_relation(target_user_id uuid, target_brand_pharmacy_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pharmacy_assignments pa
    where pa.user_id = target_user_id and pa.brand_pharmacy_id = target_brand_pharmacy_id
      and pa.starts_at <= current_date and (pa.ends_at is null or pa.ends_at > current_date)
      and pa.archived_at is null
  );
$$;

create or replace function private.can_access_brand_pharmacy(target_brand_pharmacy_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.brand_pharmacies bp
    where bp.id = target_brand_pharmacy_id and bp.archived_at is null and (
      private.has_elevated_brand_access(bp.brand_id) or
      private.user_is_assigned_to_relation((select auth.uid()), bp.id)
    )
  );
$$;

create or replace function private.validate_commercial_interaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_pharmacy_id uuid;
begin
  select bp.pharmacy_id into target_pharmacy_id from public.brand_pharmacies bp
  where bp.id = new.brand_pharmacy_id and bp.brand_id = new.brand_id and bp.archived_at is null;
  if target_pharmacy_id is null then raise exception 'Interaction brand scope mismatch' using errcode = '23514'; end if;
  if new.pharmacy_contact_id is not null and not exists (
    select 1 from public.pharmacy_contacts c where c.id = new.pharmacy_contact_id and c.pharmacy_id = target_pharmacy_id and c.archived_at is null
  ) then raise exception 'Contact does not belong to the pharmacy' using errcode = '23514'; end if;
  if not private.user_has_active_brand_membership(new.created_by, new.brand_id) then
    raise exception 'Interaction author has no active brand membership' using errcode = '23514';
  end if;
  if new.assigned_user_id is not null and not private.user_has_active_brand_membership(new.assigned_user_id, new.brand_id) then
    raise exception 'Assigned interaction user has no active brand membership' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.validate_commercial_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_pharmacy_id uuid; assigned_role text;
begin
  select bp.pharmacy_id into target_pharmacy_id from public.brand_pharmacies bp
  where bp.id = new.brand_pharmacy_id and bp.brand_id = new.brand_id and bp.archived_at is null;
  if target_pharmacy_id is null then raise exception 'Task brand scope mismatch' using errcode = '23514'; end if;
  if not private.user_has_active_brand_membership(new.assigned_to, new.brand_id) then
    raise exception 'Task owner has no active brand membership' using errcode = '23514';
  end if;
  select r.key into assigned_role from public.memberships m join public.roles r on r.id = m.role_id
  where m.user_id = new.assigned_to and m.brand_id = new.brand_id and m.status = 'active' order by r.rank desc limit 1;
  if assigned_role = 'agent' and not private.user_is_assigned_to_relation(new.assigned_to, new.brand_pharmacy_id) then
    raise exception 'Agent is not assigned to this pharmacy' using errcode = '23514';
  end if;
  if new.pharmacy_contact_id is not null and not exists (
    select 1 from public.pharmacy_contacts c where c.id = new.pharmacy_contact_id and c.pharmacy_id = target_pharmacy_id and c.archived_at is null
  ) then raise exception 'Task contact does not belong to the pharmacy' using errcode = '23514'; end if;
  if new.status = 'cancelled' and nullif(btrim(new.cancellation_reason), '') is null then
    raise exception 'Cancellation reason is required' using errcode = '23514';
  end if;
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, (select auth.uid()));
  end if;
  if new.status = 'overdue' then raise exception 'Overdue status is derived dynamically' using errcode = '23514'; end if;
  return new;
end;
$$;

create or replace function private.sync_brand_pharmacy_next_action(target_relation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare next_task record;
begin
  select t.task_type, t.due_at, t.assigned_to into next_task
  from public.tasks t
  where t.brand_pharmacy_id = target_relation_id and t.status in ('open','in_progress') and t.archived_at is null
  order by t.due_at asc nulls last, t.created_at asc limit 1;
  update public.brand_pharmacies set
    next_action_type = next_task.task_type::text,
    next_action_at = next_task.due_at,
    next_action_owner_id = next_task.assigned_to
  where id = target_relation_id;
end;
$$;

create or replace function private.sync_next_action_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.sync_brand_pharmacy_next_action(coalesce(new.brand_pharmacy_id, old.brand_pharmacy_id));
  return coalesce(new, old);
end;
$$;

create or replace function private.validate_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.brand_pharmacies bp where bp.id = new.brand_pharmacy_id and bp.brand_id = new.brand_id and bp.archived_at is null) then
    raise exception 'Assignment brand scope mismatch' using errcode = '23514';
  end if;
  if not private.user_has_active_brand_membership(new.user_id, new.brand_id) then
    raise exception 'Assigned user has no active brand membership' using errcode = '23514';
  end if;
  if new.user_id = (select auth.uid()) and not private.has_brand_role(new.brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Self assignment is forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.sync_assignment_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid := coalesce(new.brand_pharmacy_id, old.brand_pharmacy_id);
begin
  update public.brand_pharmacies bp set
    current_agent_user_id = (select pa.user_id from public.pharmacy_assignments pa where pa.brand_pharmacy_id = target_id and pa.assignment_type = 'commercial_agent' and pa.is_primary and pa.ends_at is null and pa.archived_at is null order by pa.starts_at desc limit 1),
    tr1_manager_user_id = (select pa.user_id from public.pharmacy_assignments pa where pa.brand_pharmacy_id = target_id and pa.assignment_type = 'tr1_manager' and pa.is_primary and pa.ends_at is null and pa.archived_at is null order by pa.starts_at desc limit 1)
  where bp.id = target_id;
  return coalesce(new, old);
end;
$$;

create or replace function private.record_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare reason text := nullif(current_setting('app.status_change_reason', true), '');
  source_value public.status_change_source := coalesce(nullif(current_setting('app.status_change_source', true), '')::public.status_change_source, 'manual');
  standard_transition boolean;
begin
  if new.commercial_status = old.commercial_status then return new; end if;
  standard_transition := (old.commercial_status, new.commercial_status) in (
    ('targeted','qualified'),('qualified','contacted'),('contacted','appointment_scheduled'),
    ('appointment_scheduled','offer_sent'),('offer_sent','pending_order'),('pending_order','implanted')
  ) or (new.commercial_status = 'lost' and old.archived_at is null)
    or (old.commercial_status = 'lost' and new.commercial_status in ('targeted','qualified') and reason is not null);
  if not standard_transition and reason is null then
    raise exception 'A reason is required for a non-standard status transition' using errcode = '23514';
  end if;
  insert into public.brand_pharmacy_status_history (
    brand_pharmacy_id, brand_id, previous_status, new_status, change_reason, changed_by, source, metadata
  ) values (new.id, new.brand_id, old.commercial_status, new.commercial_status, reason, (select auth.uid()), source_value,
    coalesce(nullif(current_setting('app.status_change_metadata', true), '')::jsonb, '{}'::jsonb));
  return new;
end;
$$;

create or replace function private.create_status_follow_up()
returns trigger language plpgsql security definer set search_path = '' as $$
declare settings public.brand_settings%rowtype; task_kind public.commercial_task_type; delay_value interval; owner_id uuid;
begin
  if new.commercial_status = old.commercial_status then return new; end if;
  select * into settings from public.brand_settings where brand_id = new.brand_id;
  task_kind := case new.commercial_status when 'qualified' then 'call' when 'contacted' then 'follow_up'
    when 'appointment_scheduled' then 'appointment' when 'offer_sent' then 'follow_up'
    when 'pending_order' then 'request_order' else null end;
  if task_kind is null then return new; end if;
  delay_value := case new.commercial_status
    when 'offer_sent' then make_interval(days => settings.offer_follow_up_delay_days)
    when 'pending_order' then make_interval(days => settings.pending_order_follow_up_delay_days)
    when 'appointment_scheduled' then make_interval(hours => settings.appointment_reminder_delay_hours)
    else make_interval(days => settings.default_follow_up_delay_days) end;
  owner_id := coalesce(new.current_agent_user_id, new.tr1_manager_user_id, (select auth.uid()));
  if owner_id is not null and not exists (select 1 from public.tasks t where t.brand_pharmacy_id = new.id and t.task_type = task_kind and t.status in ('open','in_progress') and t.archived_at is null) then
    insert into public.tasks (brand_id, brand_pharmacy_id, task_type, title, status, priority, due_at, assigned_to, created_by, source)
    values (new.brand_id, new.id, task_kind, 'Action suggérée après passage à ' || new.commercial_status::text, 'open', 'normal', now() + delay_value, owner_id, coalesce((select auth.uid()), owner_id), 'status_change');
  end if;
  return new;
end;
$$;

create trigger validate_commercial_interaction before insert or update on public.interactions for each row execute function private.validate_commercial_interaction();
create trigger validate_commercial_task before insert or update on public.tasks for each row execute function private.validate_commercial_task();
create trigger sync_next_action after insert or update or delete on public.tasks for each row execute function private.sync_next_action_trigger();
create trigger validate_assignment before insert or update on public.pharmacy_assignments for each row execute function private.validate_assignment();
create trigger sync_assignment_owner after insert or update or delete on public.pharmacy_assignments for each row execute function private.sync_assignment_owner();
create trigger record_status_change before update of commercial_status on public.brand_pharmacies for each row execute function private.record_status_change();
create trigger create_status_follow_up after update of commercial_status on public.brand_pharmacies for each row execute function private.create_status_follow_up();
create trigger set_assignments_updated_at before update on public.pharmacy_assignments for each row execute function private.set_updated_at();
create trigger set_brand_settings_updated_at before update on public.brand_settings for each row execute function private.set_updated_at();
create trigger audit_interactions after insert or update on public.interactions for each row execute function private.audit_row_change();
create trigger audit_tasks after insert or update on public.tasks for each row execute function private.audit_row_change();

create or replace function public.change_brand_pharmacy_status(target_brand_pharmacy_id uuid, target_status public.commercial_status, reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.brand_pharmacies%rowtype; settings public.brand_settings%rowtype;
begin
  select * into target from public.brand_pharmacies where id = target_brand_pharmacy_id;
  if target.id is null then raise exception 'Brand pharmacy unavailable' using errcode = '42501'; end if;
  select * into settings from public.brand_settings where brand_id = target.brand_id;
  if not private.has_brand_role(target.brand_id, array['tr1_manager','brand_admin','brand_user']) then
    if not (coalesce(settings.allow_agents_to_change_status, false) and private.user_is_assigned_to_relation((select auth.uid()), target.id)) then
      raise exception 'Status change forbidden' using errcode = '42501';
    end if;
  end if;
  perform set_config('app.status_change_reason', coalesce(reason, ''), true);
  perform set_config('app.status_change_source', 'manual', true);
  update public.brand_pharmacies set commercial_status = target_status where id = target.id;
end;
$$;

create or replace function public.create_commercial_interaction(
  target_brand_pharmacy_id uuid, target_interaction_type public.interaction_type, target_outcome public.interaction_outcome,
  target_subject text, target_notes text default null, target_visibility public.interaction_visibility default 'shared',
  target_contact_id uuid default null, target_occurred_at timestamptz default now(), target_duration_minutes integer default null,
  next_task_type public.commercial_task_type default null, next_task_at timestamptz default null, next_task_owner uuid default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare target_brand uuid; interaction_id uuid; task_id uuid; owner_id uuid;
begin
  select brand_id into target_brand from public.brand_pharmacies where id = target_brand_pharmacy_id;
  if target_brand is null or not private.can_access_brand_pharmacy(target_brand_pharmacy_id) then raise exception 'Interaction forbidden' using errcode = '42501'; end if;
  if target_visibility = 'tr1_internal' and not private.has_brand_role(target_brand, array['tr1_manager']) then raise exception 'TR1 visibility forbidden' using errcode = '42501'; end if;
  insert into public.interactions (brand_id, brand_pharmacy_id, pharmacy_contact_id, interaction_type, outcome, occurred_at, duration_minutes, subject, notes, created_by, visibility, next_action_type, next_action_at, next_action_owner_id)
  values (target_brand, target_brand_pharmacy_id, target_contact_id, target_interaction_type, target_outcome, target_occurred_at, target_duration_minutes, target_subject, target_notes, (select auth.uid()), target_visibility, next_task_type, next_task_at, next_task_owner)
  returning id into interaction_id;
  if next_task_type is not null then
    owner_id := coalesce(next_task_owner, (select auth.uid()));
    insert into public.tasks (brand_id, brand_pharmacy_id, pharmacy_contact_id, task_type, title, due_at, assigned_to, created_by, source, related_interaction_id)
    values (target_brand, target_brand_pharmacy_id, target_contact_id, next_task_type, 'Suite : ' || target_subject, next_task_at, owner_id, (select auth.uid()), 'interaction', interaction_id)
    returning id into task_id;
    update public.interactions set related_task_id = task_id where id = interaction_id;
  end if;
  return interaction_id;
end;
$$;

create or replace function public.assign_brand_pharmacy(
  target_brand_pharmacy_id uuid, target_user_id uuid, target_assignment_type public.assignment_type,
  target_is_primary boolean default true, reason text default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare target_brand uuid; assignment_id uuid;
begin
  select brand_id into target_brand from public.brand_pharmacies where id = target_brand_pharmacy_id;
  if target_brand is null or not private.has_brand_role(target_brand, array['tr1_manager','brand_admin']) then
    raise exception 'Assignment forbidden' using errcode = '42501';
  end if;
  if target_is_primary then
    update public.pharmacy_assignments set ends_at = current_date, ended_reason = coalesce(reason, 'Réattribution')
    where brand_pharmacy_id = target_brand_pharmacy_id and assignment_type = target_assignment_type
      and is_primary and ends_at is null and archived_at is null;
  end if;
  insert into public.pharmacy_assignments (brand_id, brand_pharmacy_id, user_id, assignment_type, is_primary, starts_at, assignment_reason, assigned_by)
  values (target_brand, target_brand_pharmacy_id, target_user_id, target_assignment_type, target_is_primary, current_date, reason, (select auth.uid()))
  returning id into assignment_id;
  return assignment_id;
end;
$$;

revoke all on function private.user_has_active_brand_membership(uuid,uuid), private.user_is_assigned_to_relation(uuid,uuid), private.validate_commercial_interaction(), private.validate_commercial_task(), private.sync_brand_pharmacy_next_action(uuid), private.sync_next_action_trigger(), private.validate_assignment(), private.sync_assignment_owner(), private.record_status_change(), private.create_status_follow_up() from public, anon, authenticated;
grant execute on function private.user_is_assigned_to_relation(uuid,uuid) to authenticated;
revoke all on function public.change_brand_pharmacy_status(uuid,public.commercial_status,text), public.create_commercial_interaction(uuid,public.interaction_type,public.interaction_outcome,text,text,public.interaction_visibility,uuid,timestamptz,integer,public.commercial_task_type,timestamptz,uuid), public.assign_brand_pharmacy(uuid,uuid,public.assignment_type,boolean,text) from public, anon;
grant execute on function public.change_brand_pharmacy_status(uuid,public.commercial_status,text), public.create_commercial_interaction(uuid,public.interaction_type,public.interaction_outcome,text,text,public.interaction_visibility,uuid,timestamptz,integer,public.commercial_task_type,timestamptz,uuid), public.assign_brand_pharmacy(uuid,uuid,public.assignment_type,boolean,text) to authenticated, service_role;

alter table public.brand_pharmacy_status_history enable row level security;
alter table public.brand_settings enable row level security;
revoke all on public.brand_pharmacy_status_history, public.brand_settings from anon;
grant select, insert on public.brand_pharmacy_status_history to authenticated;
grant select, insert, update on public.brand_settings to authenticated;
grant all on public.brand_pharmacy_status_history, public.brand_settings to service_role;
grant usage, select on sequence public.brand_pharmacy_status_history_id_seq to authenticated;

create policy status_history_select on public.brand_pharmacy_status_history for select to authenticated using (private.can_access_brand_pharmacy(brand_pharmacy_id));
create policy brand_pharmacies_select on public.brand_pharmacies for select to authenticated using (
  private.has_elevated_brand_access(brand_id) or
  (archived_at is null and private.user_is_assigned_to_relation((select auth.uid()), id))
);
create policy brand_settings_select on public.brand_settings for select to authenticated using (private.can_access_brand(brand_id));
create policy brand_settings_insert on public.brand_settings for insert to authenticated with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy brand_settings_update on public.brand_settings for update to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));

create policy interactions_select on public.interactions for select to authenticated using (
  (archived_at is null or private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) and private.can_access_brand_pharmacy(brand_pharmacy_id) and (
    visibility = 'shared' or created_by = (select auth.uid()) or
    (visibility = 'tr1_internal' and private.has_brand_role(brand_id, array['tr1_manager'])) or
    (visibility = 'brand_internal' and private.has_brand_role(brand_id, array['tr1_manager','brand_admin','brand_user']))
  )
);
create policy interactions_insert on public.interactions for insert to authenticated with check (
  created_by = (select auth.uid()) and private.can_access_brand_pharmacy(brand_pharmacy_id) and
  (visibility <> 'tr1_internal' or private.has_brand_role(brand_id, array['tr1_manager'])) and
  (visibility <> 'brand_internal' or private.has_brand_role(brand_id, array['tr1_manager','brand_admin','brand_user']))
);
create policy interactions_update on public.interactions for update to authenticated
using (created_by = (select auth.uid()) or private.has_brand_role(brand_id, array['tr1_manager','brand_admin']))
with check (private.can_access_brand_pharmacy(brand_pharmacy_id));

create policy tasks_select on public.tasks for select to authenticated using (
  archived_at is null and (private.has_brand_role(brand_id, array['tr1_manager','brand_admin','brand_user']) or assigned_to = (select auth.uid()))
);
create policy tasks_insert on public.tasks for insert to authenticated with check (
  created_by = (select auth.uid()) and private.can_access_brand_pharmacy(brand_pharmacy_id) and
  (private.has_brand_role(brand_id, array['tr1_manager','brand_admin','brand_user']) or assigned_to = (select auth.uid()))
);
create policy tasks_update on public.tasks for update to authenticated
using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']) or assigned_to = (select auth.uid()))
with check (private.can_access_brand_pharmacy(brand_pharmacy_id) and (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']) or assigned_to = (select auth.uid())));

create policy pharmacy_assignments_select on public.pharmacy_assignments for select to authenticated
using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin','brand_user']) or user_id = (select auth.uid()));
create policy pharmacy_assignments_insert on public.pharmacy_assignments for insert to authenticated
with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy pharmacy_assignments_update on public.pharmacy_assignments for update to authenticated
using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));

create view public.commercial_tasks with (security_invoker = true) as
select t.*, case when t.status in ('open','in_progress') and t.due_at < now() then 'overdue'::public.commercial_task_status else t.status end as effective_status,
  coalesce(p.trade_name, p.legal_name) as pharmacy_name, p.city, bp.territory_id, territory.name as territory_name,
  bp.current_agent_user_id, assigned_profile.full_name as assigned_name
from public.tasks t
join public.brand_pharmacies bp on bp.id = t.brand_pharmacy_id
join public.pharmacies p on p.id = bp.pharmacy_id
left join public.territories territory on territory.id = bp.territory_id
left join public.user_profiles assigned_profile on assigned_profile.user_id = t.assigned_to;

create view public.commercial_pipeline with (security_invoker = true) as
select bp.id, bp.brand_id, bp.pharmacy_id, bp.commercial_status, bp.priority_level, bp.potential_level, bp.current_agent_user_id, bp.territory_id,
  p.trade_name, p.legal_name, p.city, p.postal_code, up.full_name as agent_name,
  bp.last_interaction_at, bp.next_action_type, bp.next_action_at, bp.next_action_owner_id,
  (bp.next_action_at < now()) as is_overdue,
  not exists (select 1 from public.tasks t where t.brand_pharmacy_id = bp.id and t.status in ('open','in_progress') and t.archived_at is null) as has_no_next_action
from public.brand_pharmacies bp join public.pharmacies p on p.id = bp.pharmacy_id
left join public.user_profiles up on up.user_id = bp.current_agent_user_id
where bp.archived_at is null;

create view public.brand_pharmacy_timeline with (security_invoker = true) as
select i.brand_pharmacy_id, i.brand_id, 'interaction'::text as event_type, i.id::text as event_id, i.occurred_at as occurred_at, i.subject as title, i.notes as details from public.interactions i where i.archived_at is null
union all select h.brand_pharmacy_id, h.brand_id, 'status_change', h.id::text, h.changed_at, h.previous_status::text || ' → ' || h.new_status::text, h.change_reason from public.brand_pharmacy_status_history h
union all select t.brand_pharmacy_id, t.brand_id, case when t.status = 'completed' then 'task_completed' else 'task' end, t.id::text, coalesce(t.completed_at,t.created_at), t.title, t.description from public.tasks t where t.archived_at is null
union all select a.brand_pharmacy_id, a.brand_id, 'assignment', a.id::text, a.created_at, a.assignment_type::text, coalesce(a.assignment_reason,a.ended_reason) from public.pharmacy_assignments a;

create view public.accounts_without_next_action with (security_invoker = true) as
select * from public.commercial_pipeline where commercial_status <> 'lost' and has_no_next_action;

create view public.accounts_to_reassign with (security_invoker = true) as
select pa.*, up.full_name, m.status as membership_status
from public.pharmacy_assignments pa
left join public.user_profiles up on up.user_id = pa.user_id
left join public.memberships m on m.user_id = pa.user_id and m.brand_id = pa.brand_id
where pa.ends_at is null and pa.archived_at is null and (m.id is null or m.status <> 'active');

revoke all on public.commercial_tasks, public.commercial_pipeline, public.brand_pharmacy_timeline, public.accounts_without_next_action, public.accounts_to_reassign from anon;
grant select on public.commercial_tasks, public.commercial_pipeline, public.brand_pharmacy_timeline, public.accounts_without_next_action, public.accounts_to_reassign to authenticated, service_role;

-- Replace the eight inherited FOR ALL policies that overlap SELECT policies.
drop policy if exists agents_manage on public.agents;
create policy agents_insert on public.agents for insert to authenticated with check (private.can_manage_user(user_id));
create policy agents_update on public.agents for update to authenticated using (private.can_manage_user(user_id)) with check (private.can_manage_user(user_id));
create policy agents_delete on public.agents for delete to authenticated using (private.can_manage_user(user_id));
drop policy if exists agent_brands_manage on public.agent_brand_assignments;
create policy agent_brands_insert on public.agent_brand_assignments for insert to authenticated with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy agent_brands_update on public.agent_brand_assignments for update to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy agent_brands_delete on public.agent_brand_assignments for delete to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
drop policy if exists brands_manage on public.brands;
create policy brands_insert on public.brands for insert to authenticated with check (private.has_global_role(array['super_admin']));
create policy brands_update on public.brands for update to authenticated using (private.has_global_role(array['super_admin'])) with check (private.has_global_role(array['super_admin']));
create policy brands_delete on public.brands for delete to authenticated using (private.has_global_role(array['super_admin']));
drop policy if exists missions_manage on public.missions;
create policy missions_insert on public.missions for insert to authenticated with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy missions_update on public.missions for update to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy missions_delete on public.missions for delete to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
drop policy if exists order_items_operate on public.order_items;
create policy order_items_insert on public.order_items for insert to authenticated with check (private.can_access_brand(brand_id));
create policy order_items_update on public.order_items for update to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.created_by_user_id = (select auth.uid()) or private.has_elevated_brand_access(o.brand_id)))) with check (private.can_access_brand(brand_id));
create policy order_items_delete on public.order_items for delete to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.created_by_user_id = (select auth.uid()) or private.has_elevated_brand_access(o.brand_id))));
drop policy if exists organizations_manage on public.organizations;
create policy organizations_insert on public.organizations for insert to authenticated with check (private.has_global_role(array['super_admin']));
create policy organizations_update on public.organizations for update to authenticated using (private.has_global_role(array['super_admin'])) with check (private.has_global_role(array['super_admin']));
create policy organizations_delete on public.organizations for delete to authenticated using (private.has_global_role(array['super_admin']));
drop policy if exists product_references_manage on public.product_references;
create policy product_references_insert on public.product_references for insert to authenticated with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy product_references_update on public.product_references for update to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin'])) with check (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy product_references_delete on public.product_references for delete to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));

comment on table public.brand_pharmacy_status_history is 'Historique immuable des transitions du pipeline commercial.';
comment on view public.commercial_tasks is 'Tâches avec statut overdue calculé dynamiquement.';
comment on view public.commercial_pipeline is 'Projection sécurisée du pipeline, dernière activité et prochaine action.';
