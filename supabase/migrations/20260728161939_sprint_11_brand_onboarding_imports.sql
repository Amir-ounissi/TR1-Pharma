alter table public.organizations
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists country_code char(2) not null default 'FR',
  add column if not exists currency_code char(3) not null default 'EUR',
  add column if not exists timezone text not null default 'Europe/Paris',
  add column if not exists locale text not null default 'fr-FR',
  add column if not exists status text not null default 'active',
  add column if not exists external_id text,
  add column if not exists created_by uuid references public.users(id) on delete set null;

update public.organizations
set legal_name = coalesce(legal_name, name),
    trade_name = coalesce(trade_name, name);

create or replace function private.prepare_organization_onboarding_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.legal_name := coalesce(nullif(btrim(new.legal_name), ''), new.name);
  new.trade_name := coalesce(nullif(btrim(new.trade_name), ''), new.name);
  return new;
end;
$$;

create trigger organizations_prepare_onboarding_fields
before insert or update of name, legal_name, trade_name on public.organizations
for each row execute function private.prepare_organization_onboarding_fields();

alter table public.organizations
  alter column legal_name set not null,
  add constraint organizations_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  add constraint organizations_currency_code_check check (currency_code ~ '^[A-Z]{3}$'),
  add constraint organizations_status_check check (status in ('draft','active','suspended','archived'));

create unique index organizations_external_id_unique
  on public.organizations(lower(external_id))
  where external_id is not null and btrim(external_id) <> '';

alter table public.brands
  add column if not exists code text,
  add column if not exists country_code char(2) not null default 'FR',
  add column if not exists currency_code char(3) not null default 'EUR',
  add column if not exists status text not null default 'active',
  add column if not exists logo_path text,
  add column if not exists accent_color text,
  add column if not exists short_description text,
  add column if not exists launch_date date,
  add column if not exists activated_at timestamptz,
  add column if not exists created_by uuid references public.users(id) on delete set null;

update public.brands
set code = coalesce(code, upper(replace(slug, '-', '_'))),
    status = case when is_active then 'active' else 'draft' end,
    activated_at = case when is_active then coalesce(activated_at, created_at) end;

create or replace function private.prepare_brand_onboarding_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := coalesce(nullif(btrim(new.code), ''), upper(replace(new.slug, '-', '_')));
  new.status := coalesce(
    nullif(new.status, ''),
    case when new.is_active then 'active' else 'draft' end
  );
  return new;
end;
$$;

create trigger brands_prepare_onboarding_fields
before insert or update of slug, code, status, is_active on public.brands
for each row execute function private.prepare_brand_onboarding_fields();

alter table public.brands
  alter column code set not null,
  add constraint brands_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  add constraint brands_currency_code_check check (currency_code ~ '^[A-Z]{3}$'),
  add constraint brands_status_check check (status in ('draft','ready','active','suspended','archived')),
  add constraint brands_accent_color_check check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');

create unique index brands_organization_code_unique
  on public.brands(organization_id, upper(code));

alter table public.brand_settings
  add column if not exists currency_code char(3) not null default 'EUR',
  add column if not exists timezone text not null default 'Europe/Paris';

alter table public.pharmacies add column if not exists external_id text;
create index pharmacies_external_id_idx
  on public.pharmacies(lower(external_id))
  where external_id is not null and archived_at is null;
alter table public.brand_pharmacies add column if not exists external_id text;
create unique index brand_pharmacies_external_id_unique
  on public.brand_pharmacies(brand_id, lower(external_id))
  where external_id is not null and archived_at is null;
create unique index territories_brand_code_unique
  on public.territories(brand_id, upper(code))
  where brand_id is not null and code is not null and archived_at is null;
create index users_email_normalized_idx on public.users(lower(email));
alter table public.territories
  add column if not exists manager_user_id uuid references public.users(id) on delete set null;
alter table public.memberships
  add column if not exists territory_id uuid references public.territories(id) on delete set null;
create index memberships_territory_idx on public.memberships(territory_id)
  where territory_id is not null and status = 'active';

create type public.onboarding_step_status as enum (
  'not_started','in_progress','ready','completed','blocked','skipped'
);

create table public.brand_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress','ready','completed','blocked','cancelled')),
  current_step text not null default 'organization',
  step_statuses jsonb not null default jsonb_build_object(
    'organization','completed',
    'brand','completed',
    'settings','not_started',
    'products','not_started',
    'pharmacies','not_started',
    'territories','not_started',
    'users','not_started',
    'orders','not_started',
    'verification','not_started',
    'activation','not_started'
  ),
  warnings jsonb not null default '[]'::jsonb,
  blocking_errors jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  constraint onboarding_step_statuses_object check (jsonb_typeof(step_statuses) = 'object'),
  constraint onboarding_warnings_array check (jsonb_typeof(warnings) = 'array'),
  constraint onboarding_errors_array check (jsonb_typeof(blocking_errors) = 'array')
);

alter table public.import_batches
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists file_hash text,
  add column if not exists lifecycle_status text not null default 'review',
  add column if not exists import_mode text not null default 'create_only',
  add column if not exists source_path text,
  add column if not exists warning_rows integer not null default 0,
  add column if not exists total_rows integer not null default 0,
  add column if not exists validated_at timestamptz,
  add column if not exists executed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists rollback_status text not null default 'unavailable',
  add column if not exists rolled_back_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.import_batches b
set organization_id = brands.organization_id,
    total_rows = greatest(b.valid_rows + b.error_rows, b.total_rows),
    import_mode = b.strategy::text,
    lifecycle_status = case b.status::text when 'confirmed' then 'completed' when 'failed' then 'failed' else 'review' end
from public.brands
where brands.id = b.brand_id and b.organization_id is null;

alter table public.import_batches
  alter column organization_id set not null,
  add constraint import_batches_lifecycle_status_check check (
    lifecycle_status in ('uploaded','parsing','review','ready','executing','completed','completed_with_warnings','failed','cancelled','rolled_back')
  ),
  add constraint import_batches_import_mode_check check (
    import_mode in ('create_only','update_only','upsert','skip_duplicates','append_only','invite')
  ),
  add constraint import_batches_rollback_status_check check (
    rollback_status in ('unavailable','rollback_available','rollback_blocked','rolled_back','partially_rolled_back')
  ),
  add constraint import_batches_metadata_size_check check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192
  );

create or replace function private.prepare_onboarding_import_batch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id from public.brands where id=new.brand_id;
  end if;
  new.import_mode := coalesce(nullif(new.import_mode,''),new.strategy::text);
  new.total_rows := greatest(new.total_rows,new.valid_rows+new.error_rows);
  return new;
end;
$$;

create trigger import_batches_prepare_onboarding
before insert or update of brand_id, organization_id, strategy, import_mode, valid_rows, error_rows
on public.import_batches
for each row execute function private.prepare_onboarding_import_batch();

create index import_batches_tenant_status_idx
  on public.import_batches(organization_id, brand_id, lifecycle_status, created_at desc);
create unique index import_batches_brand_file_hash_unique
  on public.import_batches(brand_id, entity_type, file_hash)
  where file_hash is not null and lifecycle_status not in ('failed','cancelled','rolled_back');

alter table public.import_rows
  add column if not exists status text not null default 'valid',
  add column if not exists deduplication_key text,
  add column if not exists warnings text[] not null default '{}',
  add column if not exists resolution text not null default 'create',
  add column if not exists updated_at timestamptz not null default now(),
  add constraint import_rows_status_check check (status in ('valid','warning','invalid','processed','skipped','rolled_back')),
  add constraint import_rows_resolution_check check (resolution in ('create','update','ignore','manual'));

create index import_rows_batch_status_idx on public.import_rows(batch_id, status, line_number);
create index import_rows_deduplication_idx on public.import_rows(batch_id, deduplication_key)
  where deduplication_key is not null;

create table public.import_mutations (
  id bigint generated always as identity primary key,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  import_row_id bigint references public.import_rows(id) on delete set null,
  brand_id uuid not null references public.brands(id) on delete cascade,
  target_table text not null,
  target_id uuid not null,
  mutation_kind text not null check (mutation_kind in ('created','updated','invited')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  unique(import_batch_id, target_table, target_id)
);

create table public.import_templates (
  id uuid primary key default gen_random_uuid(),
  import_type public.import_entity_type not null unique,
  version integer not null default 1,
  columns jsonb not null,
  csv_header text not null,
  documentation text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint import_templates_columns_array check (jsonb_typeof(columns) = 'array')
);

create table public.onboarding_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  event_name text not null check (event_name in (
    'onboarding_started','onboarding_step_completed','import_file_uploaded',
    'import_mapping_completed','import_validation_completed','import_executed',
    'import_failed','import_rolled_back','brand_activation_ready',
    'brand_activated','onboarding_completed','control_exported'
  )),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint onboarding_audit_metadata_check check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096
  )
);

insert into public.import_templates(import_type, columns, csv_header, documentation) values
  ('products', '["product_code","product_name","category","active","unit_price_ht","ean","strategic"]',
   'product_code;product_name;category;active;unit_price_ht;ean;strategic',
   'product_code et product_name obligatoires. active accepte oui/non, true/false ou 1/0.'),
  ('pharmacies', '["external_id","pharmacy_name","address_line_1","address_line_2","postal_code","city","country","phone","email","group_name","potential","strategic","territory_code"]',
   'external_id;pharmacy_name;address_line_1;address_line_2;postal_code;city;country;phone;email;group_name;potential;strategic;territory_code',
   'pharmacy_name, address_line_1, postal_code, city et country obligatoires.'),
  ('orders', '["external_order_id","pharmacy_external_id","order_date","status","total_ht","currency","product_code","quantity","salesperson_email"]',
   'external_order_id;pharmacy_external_id;order_date;status;total_ht;currency;product_code;quantity;salesperson_email',
   'Dates ISO AAAA-MM-JJ. Les commandes sont ajoutées de manière idempotente.'),
  ('users', '["email","first_name","last_name","role","territory_code","active"]',
   'email;first_name;last_name;role;territory_code;active',
   'Aucun mot de passe ne doit être présent. Les invitations ne partent qu’après confirmation.'),
  ('territories', '["territory_code","territory_name","country","department_or_region","manager_email"]',
   'territory_code;territory_name;country;department_or_region;manager_email',
   'territory_code, territory_name et country obligatoires.')
on conflict (import_type) do update set
  columns = excluded.columns,
  csv_header = excluded.csv_header,
  documentation = excluded.documentation,
  version = public.import_templates.version + 1;

alter table public.brand_onboarding_sessions enable row level security;
alter table public.import_mutations enable row level security;
alter table public.import_templates enable row level security;
alter table public.onboarding_audit_logs enable row level security;

revoke all on public.brand_onboarding_sessions, public.import_mutations, public.import_templates, public.onboarding_audit_logs from anon, authenticated;
grant select, insert, update on public.brand_onboarding_sessions, public.import_mutations, public.onboarding_audit_logs to authenticated;
grant select on public.import_templates to authenticated;
grant all on public.brand_onboarding_sessions, public.import_mutations, public.import_templates, public.onboarding_audit_logs to service_role;
grant usage, select on sequence public.import_mutations_id_seq, public.onboarding_audit_logs_id_seq to authenticated, service_role;

create policy onboarding_sessions_select on public.brand_onboarding_sessions
for select to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy onboarding_sessions_insert on public.brand_onboarding_sessions
for insert to authenticated
with check (private.has_global_role(array['super_admin']));
create policy onboarding_sessions_update on public.brand_onboarding_sessions
for update to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

create policy import_mutations_select on public.import_mutations
for select to authenticated using (private.has_brand_role(brand_id, array['tr1_manager','brand_admin']));
create policy import_mutations_insert on public.import_mutations
for insert to authenticated
with check (private.has_global_role(array['super_admin']));
create policy import_mutations_update on public.import_mutations
for update to authenticated
using (private.has_global_role(array['super_admin']))
with check (private.has_global_role(array['super_admin']));

create policy import_templates_select on public.import_templates
for select to authenticated using (true);

create policy onboarding_audit_select on public.onboarding_audit_logs
for select to authenticated using (
  (brand_id is not null and private.has_brand_role(brand_id, array['tr1_manager','brand_admin']))
  or private.has_global_role(array['super_admin'])
);
create policy onboarding_audit_insert on public.onboarding_audit_logs
for insert to authenticated with check (
  actor_user_id = (select auth.uid())
  and ((brand_id is not null and private.has_brand_role(brand_id, array['tr1_manager','brand_admin']))
    or private.has_global_role(array['super_admin']))
);

create or replace function private.slugify_onboarding(value text)
returns text language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(btrim(value))), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_brand_onboarding(
  organization_data jsonb,
  brand_data jsonb
)
returns table (organization_id uuid, brand_id uuid, onboarding_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  created_organization_id uuid;
  created_brand_id uuid;
  created_onboarding_id uuid;
  organization_slug text;
  brand_slug text;
  platform_organization_id uuid;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Onboarding creation forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(organization_data ->> 'legal_name',''))) < 2
    or char_length(btrim(coalesce(brand_data ->> 'name',''))) < 2 then
    raise exception 'Organization and brand names are required' using errcode = '22023';
  end if;

  organization_slug := private.slugify_onboarding(coalesce(organization_data ->> 'trade_name', organization_data ->> 'legal_name'));
  brand_slug := private.slugify_onboarding(brand_data ->> 'name');
  if organization_slug = '' or brand_slug = '' then
    raise exception 'Invalid slug source' using errcode = '22023';
  end if;
  select id into platform_organization_id from public.organizations where is_platform_owner;

  insert into public.organizations(
    name, legal_name, trade_name, slug, country_code, currency_code, timezone,
    locale, status, external_id, created_by
  ) values (
    coalesce(nullif(organization_data ->> 'trade_name',''), organization_data ->> 'legal_name'),
    organization_data ->> 'legal_name', nullif(organization_data ->> 'trade_name',''),
    organization_slug, upper(coalesce(nullif(organization_data ->> 'country_code',''),'FR')),
    upper(coalesce(nullif(organization_data ->> 'currency_code',''),'EUR')),
    coalesce(nullif(organization_data ->> 'timezone',''),'Europe/Paris'),
    coalesce(nullif(organization_data ->> 'locale',''),'fr-FR'), 'draft',
    nullif(organization_data ->> 'external_id',''), (select auth.uid())
  ) returning id into created_organization_id;

  insert into public.brands(
    organization_id, managed_by_organization_id, name, slug, code, country_code,
    currency_code, status, is_active, accent_color, short_description, launch_date, created_by
  ) values (
    created_organization_id, platform_organization_id, brand_data ->> 'name', brand_slug,
    upper(coalesce(nullif(brand_data ->> 'code',''), replace(brand_slug,'-','_'))),
    upper(coalesce(nullif(brand_data ->> 'country_code',''), organization_data ->> 'country_code','FR')),
    upper(coalesce(nullif(brand_data ->> 'currency_code',''), organization_data ->> 'currency_code','EUR')),
    'draft', false, nullif(brand_data ->> 'accent_color',''),
    nullif(brand_data ->> 'short_description',''), nullif(brand_data ->> 'launch_date','')::date,
    (select auth.uid())
  ) returning id into created_brand_id;

  update public.brand_settings bs set
    currency_code = upper(coalesce(nullif(brand_data ->> 'currency_code',''), organization_data ->> 'currency_code','EUR')),
    timezone = coalesce(nullif(organization_data ->> 'timezone',''),'Europe/Paris')
  where bs.brand_id = created_brand_id;

  insert into public.brand_onboarding_sessions(organization_id, brand_id, created_by)
  values (created_organization_id, created_brand_id, (select auth.uid()))
  returning id into created_onboarding_id;

  insert into public.onboarding_audit_logs(organization_id, brand_id, actor_user_id, event_name)
  values (created_organization_id, created_brand_id, (select auth.uid()), 'onboarding_started');

  return query select created_organization_id, created_brand_id, created_onboarding_id;
end;
$$;

create or replace function public.update_onboarding_settings(
  target_brand_id uuid,
  settings_data jsonb
)
returns public.brand_settings
language plpgsql security invoker set search_path = '' as $$
declare updated_settings public.brand_settings;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Settings update forbidden' using errcode = '42501';
  end if;
  update public.brand_settings set
    default_reorder_interval_days = coalesce((settings_data ->> 'default_reorder_interval_days')::integer, default_reorder_interval_days),
    first_reorder_target_days = coalesce((settings_data ->> 'first_reorder_target_days')::integer, first_reorder_target_days),
    reorder_due_soon_days = coalesce((settings_data ->> 'reorder_due_soon_days')::integer, reorder_due_soon_days),
    at_risk_multiplier = coalesce((settings_data ->> 'at_risk_multiplier')::numeric, at_risk_multiplier),
    dormant_multiplier = coalesce((settings_data ->> 'dormant_multiplier')::numeric, dormant_multiplier),
    reorder_eligibility_days = coalesce((settings_data ->> 'reorder_eligibility_days')::integer, reorder_eligibility_days),
    post_mission_followup_days = coalesce((settings_data ->> 'post_mission_followup_days')::integer, post_mission_followup_days),
    currency_code = upper(coalesce(nullif(settings_data ->> 'currency_code',''), currency_code)),
    timezone = coalesce(nullif(settings_data ->> 'timezone',''), timezone)
  where brand_id = target_brand_id
  returning * into updated_settings;

  update public.brand_onboarding_sessions
  set step_statuses = jsonb_set(step_statuses, '{settings}', '"completed"'), current_step = 'products'
  where brand_id = target_brand_id;
  insert into public.onboarding_audit_logs(organization_id,brand_id,actor_user_id,event_name,metadata)
  select organization_id,target_brand_id,(select auth.uid()),'onboarding_step_completed',
    jsonb_build_object('step','settings')
  from public.brands where id=target_brand_id;
  return updated_settings;
end;
$$;

create or replace function public.get_brand_activation_checklist(target_brand_id uuid)
returns table (check_key text, label text, completed boolean, blocking boolean, detail text)
language sql stable security invoker set search_path = '' as $$
  select * from (
    select 'organization', 'Organisation créée', exists(
      select 1 from public.brands b join public.organizations o on o.id=b.organization_id
      where b.id=target_brand_id and o.status in ('draft','active')
    ), true, null::text
    union all select 'settings','Configuration métier validée', coalesce((
      select s.step_statuses ->> 'settings' = 'completed'
      from public.brand_onboarding_sessions s where s.brand_id=target_brand_id
    ),false), true, null
    union all select 'administrator','Au moins un administrateur', exists(
      select 1 from public.memberships m join public.roles r on r.id=m.role_id
      where m.brand_id=target_brand_id and m.status in ('invited','active') and r.key='brand_admin'
    ), true, null
    union all select 'products','Au moins un produit', exists(
      select 1 from public.products p where p.brand_id=target_brand_id and p.is_active
    ), true, null
    union all select 'pharmacies','Au moins une pharmacie', exists(
      select 1 from public.brand_pharmacies bp where bp.brand_id=target_brand_id and bp.archived_at is null
    ), true, null
    union all select 'imports','Aucun import bloquant', not exists(
      select 1 from public.import_batches b where b.brand_id=target_brand_id
      and b.lifecycle_status in ('failed','executing') and b.error_rows > 0
    ), true, null
  ) checklist
  where private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']);
$$;

create or replace function public.activate_onboarded_brand(target_brand_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare blocking_count integer;
declare target_organization_id uuid;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Brand activation forbidden' using errcode = '42501';
  end if;
  select count(*) into blocking_count
  from public.get_brand_activation_checklist(target_brand_id)
  where blocking and not completed;
  if blocking_count > 0 then
    raise exception 'Brand activation blocked: % required checks missing', blocking_count using errcode = '23514';
  end if;

  select organization_id into target_organization_id
  from public.brands where id=target_brand_id;
  insert into public.onboarding_audit_logs(organization_id,brand_id,actor_user_id,event_name)
  values(target_organization_id,target_brand_id,(select auth.uid()),'brand_activation_ready');

  update public.brands
  set is_active=true, status='active', activated_at=now()
  where id=target_brand_id
  returning organization_id into target_organization_id;
  update public.organizations set status='active' where id=target_organization_id;
  update public.brand_onboarding_sessions
  set status='completed', current_step='activation',
      step_statuses=jsonb_set(jsonb_set(step_statuses,'{verification}','"completed"'),'{activation}','"completed"'),
      activated_at=now(), completed_at=now()
  where brand_id=target_brand_id;
  insert into public.onboarding_audit_logs(organization_id,brand_id,actor_user_id,event_name)
  values(target_organization_id,target_brand_id,(select auth.uid()),'brand_activated'),
        (target_organization_id,target_brand_id,(select auth.uid()),'onboarding_completed');
  return true;
end;
$$;

create or replace function public.rollback_onboarding_import(target_batch_id uuid)
returns table (rolled_back integer, blocked integer)
language plpgsql security definer set search_path = '' as $$
declare target_batch public.import_batches%rowtype;
declare mutation public.import_mutations%rowtype;
declare rolled_back_count integer := 0;
declare blocked_count integer := 0;
begin
  select * into target_batch from public.import_batches
  where id=target_batch_id for update;
  if target_batch.id is null or not private.has_global_role(array['super_admin']) then
    raise exception 'Rollback forbidden' using errcode='42501';
  end if;
  if target_batch.lifecycle_status not in ('completed','completed_with_warnings') then
    raise exception 'Rollback unavailable' using errcode='23514';
  end if;

  for mutation in select * from public.import_mutations
    where import_batch_id=target_batch_id and mutation_kind='created' and rolled_back_at is null
    order by id desc
  loop
    begin
      if mutation.target_table='territories' then
        delete from public.territories where id=mutation.target_id and updated_at <= mutation.created_at + interval '1 second';
      elsif mutation.target_table='memberships' then
        delete from public.memberships where id=mutation.target_id and updated_at <= mutation.created_at + interval '1 second';
      elsif mutation.target_table='products' then
        delete from public.products where id=mutation.target_id and updated_at <= mutation.created_at + interval '1 second';
      elsif mutation.target_table='brand_pharmacies' then
        delete from public.brand_pharmacies where id=mutation.target_id and updated_at <= mutation.created_at + interval '1 second';
      elsif mutation.target_table='pharmacies' then
        delete from public.pharmacies where id=mutation.target_id and updated_at <= mutation.created_at + interval '1 second';
      elsif mutation.target_table='pharmacy_groups' then
        delete from public.pharmacy_groups where id=mutation.target_id and updated_at <= mutation.created_at + interval '1 second';
      elsif mutation.target_table='orders' then
        delete from public.orders where id=mutation.target_id and updated_at <= mutation.created_at + interval '1 second';
      else
        blocked_count := blocked_count + 1;
        continue;
      end if;
      if found then
        update public.import_mutations set rolled_back_at=now() where id=mutation.id;
        rolled_back_count := rolled_back_count + 1;
      else
        blocked_count := blocked_count + 1;
      end if;
    exception when foreign_key_violation then
      blocked_count := blocked_count + 1;
    end;
  end loop;

  update public.import_batches set
    lifecycle_status=case when blocked_count=0 then 'rolled_back' else 'completed_with_warnings' end,
    rollback_status=case when blocked_count=0 then 'rolled_back' else 'partially_rolled_back' end,
    rolled_back_at=case when blocked_count=0 then now() else rolled_back_at end
  where id=target_batch_id;
  update public.import_rows set status='rolled_back'
  where batch_id=target_batch_id and processed_entity_id is not null;
  insert into public.onboarding_audit_logs(organization_id,brand_id,import_batch_id,actor_user_id,event_name,metadata)
  values(target_batch.organization_id,target_batch.brand_id,target_batch.id,(select auth.uid()),'import_rolled_back',
    jsonb_build_object('rolled_back',rolled_back_count,'blocked',blocked_count));
  return query select rolled_back_count, blocked_count;
end;
$$;

create or replace function public.execute_onboarding_import(target_batch_id uuid)
returns table (processed integer, skipped integer)
language plpgsql security definer set search_path = '' as $$
declare target_batch public.import_batches%rowtype;
declare staged public.import_rows%rowtype;
declare processed_count integer := 0;
declare skipped_count integer := 0;
declare target_id uuid;
declare existing_id uuid;
declare import_role_id smallint;
declare import_user_id uuid;
declare relation_id uuid;
declare quantity_value integer;
declare amount_value numeric;
declare target_territory_id uuid;
declare target_group_id uuid;
declare group_was_created boolean;
begin
  select * into target_batch from public.import_batches
  where id=target_batch_id for update;
  if target_batch.id is null
    or not private.has_brand_role(target_batch.brand_id,array['tr1_manager','brand_admin']) then
    raise exception 'Import execution forbidden' using errcode='42501';
  end if;
  if target_batch.lifecycle_status <> 'ready' or target_batch.error_rows > 0 then
    raise exception 'Import must be ready and contain no invalid row' using errcode='23514';
  end if;
  update public.import_batches set lifecycle_status='executing' where id=target_batch_id;

  if target_batch.entity_type::text='products' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into existing_id from public.products
      where brand_id=target_batch.brand_id
        and (
          upper(sku)=upper(staged.normalized_payload->>'product_code')
          or (
            nullif(staged.normalized_payload->>'ean','') is not null
            and upper(coalesce(ean,''))=upper(staged.normalized_payload->>'ean')
          )
        )
      limit 1;
      if existing_id is not null and target_batch.import_mode='create_only' then
        update public.import_rows set status='skipped',is_duplicate=true where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif existing_id is null and target_batch.import_mode='update_only' then
        update public.import_rows set status='skipped',
          warnings=array_append(warnings,'Aucun produit existant à mettre à jour')
        where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif existing_id is null then
        insert into public.products(
          brand_id,name,sku,ean,category,wholesale_price_ht,is_active,strategic_priority
        ) values (
          target_batch.brand_id,staged.normalized_payload->>'product_name',
          staged.normalized_payload->>'product_code',nullif(staged.normalized_payload->>'ean',''),
          nullif(staged.normalized_payload->>'category',''),
          nullif(staged.normalized_payload->>'unit_price_ht','')::numeric,
          coalesce((staged.normalized_payload->>'active')::boolean,true),
          case when coalesce((staged.normalized_payload->>'strategic')::boolean,false)
            then 'strategic'::public.strategic_priority else 'standard'::public.strategic_priority end
        ) returning id into target_id;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'products',target_id,'created',staged.normalized_payload);
      else
        update public.products set
          name=staged.normalized_payload->>'product_name',
          ean=coalesce(nullif(staged.normalized_payload->>'ean',''),ean),
          category=coalesce(nullif(staged.normalized_payload->>'category',''),category),
          wholesale_price_ht=coalesce(nullif(staged.normalized_payload->>'unit_price_ht','')::numeric,wholesale_price_ht),
          is_active=coalesce((staged.normalized_payload->>'active')::boolean,is_active),
          strategic_priority=case when coalesce((staged.normalized_payload->>'strategic')::boolean,false)
            then 'strategic'::public.strategic_priority else strategic_priority end
        where id=existing_id;
        target_id:=existing_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='pharmacies' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      relation_id:=null;
      target_id:=null;
      target_territory_id:=null;
      target_group_id:=null;
      group_was_created:=false;
      if nullif(staged.normalized_payload->>'territory_code','') is not null then
        select id into target_territory_id from public.territories
        where brand_id=target_batch.brand_id
          and upper(code)=upper(staged.normalized_payload->>'territory_code')
          and archived_at is null limit 1;
        if target_territory_id is null then
          raise exception 'Unknown territory code at line %', staged.line_number using errcode='23503';
        end if;
      end if;
      if nullif(staged.normalized_payload->>'group_name','') is not null then
        select id into target_group_id from public.pharmacy_groups
        where lower(name)=lower(staged.normalized_payload->>'group_name') and archived_at is null limit 1;
        if target_group_id is null then
          insert into public.pharmacy_groups(name,group_type)
          values(staged.normalized_payload->>'group_name','other')
          returning id into target_group_id;
          group_was_created:=true;
        end if;
      end if;
      select bp.id,bp.pharmacy_id into relation_id,target_id
      from public.brand_pharmacies bp
      join public.pharmacies p on p.id=bp.pharmacy_id
      where bp.brand_id=target_batch.brand_id and bp.archived_at is null
        and (
          (
            nullif(staged.normalized_payload->>'external_id','') is not null
            and lower(coalesce(bp.external_id,''))=lower(staged.normalized_payload->>'external_id')
          )
          or (
            lower(p.legal_name)=lower(staged.normalized_payload->>'pharmacy_name')
            and lower(coalesce(p.address_line_1,''))=lower(staged.normalized_payload->>'address_line_1')
            and p.postal_code=staged.normalized_payload->>'postal_code'
          )
        )
      order by case when lower(coalesce(bp.external_id,''))=lower(coalesce(staged.normalized_payload->>'external_id','')) then 0 else 1 end
      limit 1;
      if relation_id is not null and target_batch.import_mode='create_only' then
        update public.import_rows set status='skipped',is_duplicate=true where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif relation_id is null and target_batch.import_mode='update_only' then
        update public.import_rows set status='skipped',
          warnings=array_append(warnings,'Aucune pharmacie existante à mettre à jour')
        where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif relation_id is null then
        insert into public.pharmacies(
          legal_name,trade_name,phone,email,address_line_1,address_line_2,postal_code,city,
          country_code,created_by
        ) values (
          staged.normalized_payload->>'pharmacy_name',staged.normalized_payload->>'pharmacy_name',
          nullif(staged.normalized_payload->>'phone',''),nullif(staged.normalized_payload->>'email',''),
          staged.normalized_payload->>'address_line_1',nullif(staged.normalized_payload->>'address_line_2',''),
          staged.normalized_payload->>'postal_code',staged.normalized_payload->>'city',
          staged.normalized_payload->>'country',(select auth.uid())
        ) returning id into target_id;
        update public.pharmacies set pharmacy_group_id=target_group_id where id=target_id;
        insert into public.brand_pharmacies(
          brand_id,pharmacy_id,external_id,source,potential_level,priority_level,territory_id,created_by
        ) values (
          target_batch.brand_id,target_id,nullif(staged.normalized_payload->>'external_id',''),'import',
          case lower(coalesce(staged.normalized_payload->>'potential',''))
            when 'high' then 'high'::public.potential_level
            when 'medium' then 'medium'::public.potential_level
            when 'low' then 'low'::public.potential_level
            else 'unknown'::public.potential_level end,
          case when coalesce((staged.normalized_payload->>'strategic')::boolean,false)
            then 'high'::public.priority_level else 'normal'::public.priority_level end,
          target_territory_id,(select auth.uid())
        ) returning id into relation_id;
        if group_was_created then
          insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
          values(target_batch_id,staged.id,target_batch.brand_id,'pharmacy_groups',target_group_id,'created',
            jsonb_build_object('name',staged.normalized_payload->>'group_name'));
        end if;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'pharmacies',target_id,'created',staged.normalized_payload);
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'brand_pharmacies',relation_id,'created',staged.normalized_payload);
      else
        update public.pharmacies set
          legal_name=staged.normalized_payload->>'pharmacy_name',
          trade_name=staged.normalized_payload->>'pharmacy_name',
          phone=coalesce(nullif(staged.normalized_payload->>'phone',''),phone),
          email=coalesce(nullif(staged.normalized_payload->>'email',''),email),
          address_line_1=staged.normalized_payload->>'address_line_1',
          address_line_2=coalesce(nullif(staged.normalized_payload->>'address_line_2',''),address_line_2),
          postal_code=staged.normalized_payload->>'postal_code',
          city=staged.normalized_payload->>'city',
          country_code=staged.normalized_payload->>'country',
          pharmacy_group_id=coalesce(target_group_id,pharmacy_group_id)
        where id=target_id;
        update public.brand_pharmacies set
          external_id=coalesce(nullif(staged.normalized_payload->>'external_id',''),external_id),
          territory_id=coalesce(target_territory_id,territory_id)
        where id=relation_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='orders' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into existing_id from public.orders
      where brand_id=target_batch.brand_id
        and external_order_id=staged.normalized_payload->>'external_order_id'
        and archived_at is null limit 1;
      if existing_id is not null then
        update public.import_rows set status='skipped',is_duplicate=true,processed_entity_id=existing_id where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      end if;
      select bp.id into relation_id from public.brand_pharmacies bp
      where bp.brand_id=target_batch.brand_id and bp.archived_at is null
        and lower(coalesce(bp.external_id,''))=lower(staged.normalized_payload->>'pharmacy_external_id')
      limit 1;
      if relation_id is null then
        raise exception 'Unknown pharmacy external id at line %', staged.line_number using errcode='23503';
      end if;
      select id into target_id from public.products
      where brand_id=target_batch.brand_id and is_active
        and upper(sku)=upper(staged.normalized_payload->>'product_code')
      limit 1;
      if target_id is null then
        raise exception 'Unknown product code at line %', staged.line_number using errcode='23503';
      end if;
      quantity_value:=(staged.normalized_payload->>'quantity')::integer;
      amount_value:=(staged.normalized_payload->>'total_ht')::numeric;
      select public.create_order(
        relation_id,
        jsonb_build_object(
          'external_order_id',staged.normalized_payload->>'external_order_id',
          'order_date',staged.normalized_payload->>'order_date',
          'order_status',staged.normalized_payload->>'status',
          'source','import',
          'currency_code',staged.normalized_payload->>'currency',
          'import_batch_id',target_batch_id
        ),
        jsonb_build_array(jsonb_build_object(
          'product_id',target_id,
          'quantity',quantity_value,
          'unit_price_ht',round(amount_value/quantity_value,4),
          'tax_rate',0
        ))
      ) into target_id;
      if nullif(staged.normalized_payload->>'salesperson_email','') is not null then
        select id into import_user_id from public.users
        where lower(email)=lower(staged.normalized_payload->>'salesperson_email') limit 1;
        update public.orders set source_user_id=import_user_id
        where id=target_id and import_user_id is not null;
      end if;
      insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
      values(target_batch_id,staged.id,target_batch.brand_id,'orders',target_id,'created',staged.normalized_payload);
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='territories' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into existing_id from public.territories
      where brand_id=target_batch.brand_id
        and upper(code)=upper(staged.normalized_payload->>'territory_code')
        and archived_at is null limit 1;
      if existing_id is not null and target_batch.import_mode='create_only' then
        update public.import_rows set status='skipped',is_duplicate=true where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      end if;
      if existing_id is null then
        import_user_id:=null;
        if nullif(staged.normalized_payload->>'manager_email','') is not null then
          select id into import_user_id from public.users
          where lower(email)=lower(staged.normalized_payload->>'manager_email') limit 1;
        end if;
        insert into public.territories(organization_id,brand_id,name,code,country_code,territory_type,region_code)
        values(target_batch.organization_id,target_batch.brand_id,staged.normalized_payload->>'territory_name',
          staged.normalized_payload->>'territory_code',coalesce(staged.normalized_payload->>'country','FR'),
          'custom',nullif(staged.normalized_payload->>'department_or_region',''))
        returning id into target_id;
        update public.territories set manager_user_id=import_user_id where id=target_id and import_user_id is not null;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'territories',target_id,'created',staged.normalized_payload);
      else
        import_user_id:=null;
        if nullif(staged.normalized_payload->>'manager_email','') is not null then
          select id into import_user_id from public.users
          where lower(email)=lower(staged.normalized_payload->>'manager_email') limit 1;
        end if;
        update public.territories set
          name=coalesce(nullif(staged.normalized_payload->>'territory_name',''),name),
          region_code=coalesce(nullif(staged.normalized_payload->>'department_or_region',''),region_code),
          manager_user_id=coalesce(import_user_id,manager_user_id)
        where id=existing_id;
        target_id:=existing_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='users' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into import_user_id from public.users where lower(email)=lower(staged.normalized_payload->>'email') limit 1;
      if import_user_id is null then
        raise exception 'User % must be invited before transactional execution', staged.normalized_payload->>'email' using errcode='23514';
      end if;
      select id into import_role_id from public.roles
      where key=staged.normalized_payload->>'role'
        and key in ('brand_admin','brand_user','agent','facilitator');
      if import_role_id is null then raise exception 'Role import forbidden' using errcode='42501'; end if;
      target_territory_id:=null;
      if nullif(staged.normalized_payload->>'territory_code','') is not null then
        select id into target_territory_id from public.territories
        where brand_id=target_batch.brand_id
          and upper(code)=upper(staged.normalized_payload->>'territory_code')
          and archived_at is null limit 1;
        if target_territory_id is null then
          raise exception 'Unknown territory code at line %', staged.line_number using errcode='23503';
        end if;
      end if;
      select id into existing_id from public.memberships
      where user_id=import_user_id and brand_id=target_batch.brand_id and role_id=import_role_id limit 1;
      if existing_id is null then
        insert into public.memberships(user_id,organization_id,brand_id,role_id,status,invited_by,territory_id)
        values(import_user_id,target_batch.organization_id,target_batch.brand_id,import_role_id,
          case
            when coalesce((staged.normalized_payload->>'active')::boolean,false)
              then 'active'::public.membership_status
            else 'invited'::public.membership_status
          end,
          (select auth.uid()),target_territory_id)
        returning id into target_id;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'memberships',target_id,'created',staged.normalized_payload);
      else
        update public.memberships set
          status=case
            when coalesce((staged.normalized_payload->>'active')::boolean,false)
              then 'active'::public.membership_status
            else status
          end,
          territory_id=coalesce(target_territory_id,territory_id)
        where id=existing_id;
        target_id:=existing_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  else
    raise exception 'Unsupported import type' using errcode='22023';
  end if;

  update public.import_batches set
    status='confirmed',
    lifecycle_status=case when warning_rows>0 or skipped_count>0 then 'completed_with_warnings' else 'completed' end,
    executed_at=now(),
    rollback_status=case when exists(select 1 from public.import_mutations where import_batch_id=target_batch_id and mutation_kind='created')
      then 'rollback_available' else 'rollback_blocked' end
  where id=target_batch_id;
  update public.brand_onboarding_sessions
  set step_statuses=jsonb_set(step_statuses,array[target_batch.entity_type::text],'"completed"'::jsonb,true),
      current_step=case target_batch.entity_type::text
        when 'products' then 'pharmacies'
        when 'pharmacies' then 'territories'
        when 'territories' then 'users'
        when 'users' then 'orders'
        else 'verification'
      end
  where brand_id=target_batch.brand_id;
  insert into public.onboarding_audit_logs(organization_id,brand_id,import_batch_id,actor_user_id,event_name,metadata)
  values(target_batch.organization_id,target_batch.brand_id,target_batch.id,(select auth.uid()),'import_executed',
    jsonb_build_object('processed',processed_count,'skipped',skipped_count,'type',target_batch.entity_type::text));
  insert into public.onboarding_audit_logs(organization_id,brand_id,import_batch_id,actor_user_id,event_name,metadata)
  values(target_batch.organization_id,target_batch.brand_id,target_batch.id,(select auth.uid()),'onboarding_step_completed',
    jsonb_build_object('step',target_batch.entity_type::text));
  return query select processed_count,skipped_count;
exception when others then
  update public.import_batches set lifecycle_status='failed',rollback_status='unavailable'
  where id=target_batch_id;
  raise;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('onboarding-imports','onboarding-imports',false,5242880,array['text/csv','application/csv','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy onboarding_import_files_select on storage.objects
for select to authenticated using (
  bucket_id='onboarding-imports'
  and private.has_brand_role(((storage.foldername(name))[1])::uuid,array['tr1_manager','brand_admin'])
);
create policy onboarding_import_files_insert on storage.objects
for insert to authenticated with check (
  bucket_id='onboarding-imports'
  and private.has_brand_role(((storage.foldername(name))[1])::uuid,array['tr1_manager','brand_admin'])
  and owner_id=(select auth.uid()::text)
);
create policy onboarding_import_files_delete on storage.objects
for delete to authenticated using (
  bucket_id='onboarding-imports'
  and private.has_global_role(array['super_admin'])
);

create trigger set_brand_onboarding_updated_at before update on public.brand_onboarding_sessions
for each row execute function private.set_updated_at();
create trigger set_import_rows_updated_at before update on public.import_rows
for each row execute function private.set_updated_at();
create trigger audit_brand_onboarding after insert or update on public.brand_onboarding_sessions
for each row execute function private.audit_row_change();

revoke all on function private.slugify_onboarding(text) from public,anon,authenticated;
revoke all on function public.create_brand_onboarding(jsonb,jsonb) from public,anon;
revoke all on function public.update_onboarding_settings(uuid,jsonb) from public,anon;
revoke all on function public.get_brand_activation_checklist(uuid) from public,anon;
revoke all on function public.activate_onboarded_brand(uuid) from public,anon;
revoke all on function public.rollback_onboarding_import(uuid) from public,anon;
revoke all on function public.execute_onboarding_import(uuid) from public,anon;
grant execute on function public.create_brand_onboarding(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.update_onboarding_settings(uuid,jsonb) to authenticated,service_role;
grant execute on function public.get_brand_activation_checklist(uuid) to authenticated,service_role;
grant execute on function public.activate_onboarded_brand(uuid) to authenticated,service_role;
grant execute on function public.rollback_onboarding_import(uuid) to authenticated,service_role;
grant execute on function public.execute_onboarding_import(uuid) to authenticated,service_role;
grant execute on function private.order_counts_for_activity(public.order_status,public.order_type,numeric),
  private.order_counts_for_revenue(public.order_status,public.order_type,numeric)
to service_role;
