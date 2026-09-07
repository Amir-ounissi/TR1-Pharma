create type public.field_visit_order_result as enum ('order_taken','no_order');
create type public.field_visit_photo_result as enum ('photo_added','not_required');

alter table public.field_visits
  add column started_at timestamptz,
  add column completed_at timestamptz;

create table public.field_visit_completions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.field_visits(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_pharmacy_id uuid not null,
  created_by uuid not null references public.users(id) on delete restrict,
  order_result public.field_visit_order_result not null,
  photo_result public.field_visit_photo_result not null,
  note text not null check (nullif(btrim(note),'') is not null),
  next_visit_date date not null,
  interaction_id uuid references public.interactions(id) on delete set null,
  follow_up_task_id uuid references public.tasks(id) on delete set null,
  photo_bucket_id text,
  photo_object_path text,
  photo_original_name text,
  photo_mime_type text,
  photo_size_bytes bigint,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (visit_id, brand_id),
  foreign key (visit_id, brand_id) references public.field_visit_brands(visit_id, brand_id) on delete cascade,
  foreign key (brand_pharmacy_id, brand_id) references public.brand_pharmacies(id, brand_id) on delete restrict,
  check (
    (photo_result = 'not_required' and photo_bucket_id is null and photo_object_path is null and photo_original_name is null and photo_mime_type is null and photo_size_bytes is null)
    or
    (photo_result = 'photo_added' and photo_bucket_id = 'field-visit-evidence' and photo_object_path is not null and photo_original_name is not null and photo_mime_type in ('image/jpeg','image/png','image/webp') and photo_size_bytes > 0 and photo_size_bytes <= 10485760)
  ),
  check (
    photo_object_path is null or (
      split_part(photo_object_path,'/',1) = brand_id::text
      and split_part(photo_object_path,'/',2) = visit_id::text
      and split_part(photo_object_path,'/',3) = created_by::text
    )
  )
);

create index field_visit_completions_brand_date_idx
  on public.field_visit_completions(brand_id, completed_at desc);
create index field_visit_completions_relation_idx
  on public.field_visit_completions(brand_pharmacy_id, completed_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('field-visit-evidence','field-visit-evidence',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.can_write_field_visit_object(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    and split_part(object_name,'/',3) = (select auth.uid())::text
    and exists (
      select 1
      from public.field_visits v
      join public.field_visit_brands fvb on fvb.visit_id=v.id
      where v.id=split_part(object_name,'/',2)::uuid
        and fvb.brand_id=split_part(object_name,'/',1)::uuid
        and v.owner_user_id=(select auth.uid())
        and v.archived_at is null
    );
$$;

create or replace function private.can_access_field_visit_object(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.field_visit_completions completion
    join public.field_visits visit on visit.id=completion.visit_id
    where completion.photo_object_path=object_name
      and (
        visit.owner_user_id=(select auth.uid())
        or private.can_access_brand_pharmacy(completion.brand_pharmacy_id)
      )
  );
$$;

create or replace function public.start_field_visit(target_visit_id uuid, target_brand_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.field_visits%rowtype;
  relation_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select * into target from public.field_visits where id=target_visit_id for update;
  select fvb.brand_pharmacy_id into relation_id
  from public.field_visit_brands fvb
  where fvb.visit_id=target_visit_id and fvb.brand_id=target_brand_id;

  if target.id is null or target.archived_at is not null or target.owner_user_id<>actor or relation_id is null
     or not private.user_is_assigned_to_relation(actor,relation_id) then
    raise exception 'Visit unavailable' using errcode='42501';
  end if;
  if target.status not in ('planned','confirmed','in_progress') then
    raise exception 'Visit cannot be started' using errcode='23514';
  end if;

  update public.field_visits
  set status='in_progress', started_at=coalesce(started_at,now()), updated_at=now()
  where id=target_visit_id;
end;
$$;

create or replace function public.complete_field_visit(target_visit_id uuid, target_brand_id uuid, completion_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  target public.field_visits%rowtype;
  relation_id uuid;
  pharmacy_name text;
  clean_note text := nullif(btrim(completion_payload->>'note'),'');
  next_date date := nullif(completion_payload->>'next_visit_date','')::date;
  order_result public.field_visit_order_result := (completion_payload->>'order_result')::public.field_visit_order_result;
  photo_result public.field_visit_photo_result := (completion_payload->>'photo_result')::public.field_visit_photo_result;
  photo jsonb := coalesce(completion_payload->'photo','{}'::jsonb);
  next_at timestamptz;
  interaction_id uuid;
  task_id uuid;
  completion_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select * into target from public.field_visits where id=target_visit_id for update;
  select fvb.brand_pharmacy_id into relation_id
  from public.field_visit_brands fvb
  where fvb.visit_id=target_visit_id and fvb.brand_id=target_brand_id;

  if target.id is null or target.archived_at is not null or target.owner_user_id<>actor or relation_id is null
     or not private.user_is_assigned_to_relation(actor,relation_id) then
    raise exception 'Visit unavailable' using errcode='42501';
  end if;
  if target.status not in ('in_progress','completed') then
    raise exception 'Start the visit before closing it' using errcode='23514';
  end if;
  if exists(select 1 from public.field_visit_completions where visit_id=target_visit_id and brand_id=target_brand_id) then
    raise exception 'Visit already closed for this brand' using errcode='23514';
  end if;
  if clean_note is null then raise exception 'Visit note is required' using errcode='23514'; end if;
  if next_date is null or next_date <= current_date then
    raise exception 'Next visit date must be in the future' using errcode='23514';
  end if;

  if photo_result='photo_added' then
    if photo->>'bucket_id' <> 'field-visit-evidence'
       or nullif(photo->>'object_path','') is null
       or nullif(photo->>'original_name','') is null
       or coalesce((photo->>'size_bytes')::bigint,0) <= 0
       or coalesce((photo->>'size_bytes')::bigint,0) > 10485760
       or photo->>'mime_type' not in ('image/jpeg','image/png','image/webp')
       or split_part(photo->>'object_path','/',1) <> target_brand_id::text
       or split_part(photo->>'object_path','/',2) <> target_visit_id::text
       or split_part(photo->>'object_path','/',3) <> actor::text then
      raise exception 'Visit photo metadata is invalid' using errcode='23514';
    end if;
  end if;

  next_at := ((next_date::timestamp + interval '9 hours') at time zone 'Europe/Paris');
  select coalesce(p.trade_name,p.legal_name) into pharmacy_name from public.pharmacies p where p.id=target.pharmacy_id;

  insert into public.interactions(
    brand_id,brand_pharmacy_id,created_by,interaction_type,occurred_at,subject,notes,outcome,
    assigned_user_id,next_action_type,next_action_at,next_action_owner_id,visibility
  ) values (
    target_brand_id,relation_id,actor,'visit',coalesce(target.started_at,now()),
    'Visite terrain · '||target.title,clean_note,'completed',actor,'visit',next_at,actor,'shared'
  ) returning id into interaction_id;

  insert into public.tasks(
    brand_id,brand_pharmacy_id,assigned_to,created_by,title,description,due_at,status,task_type,priority,source,related_interaction_id
  ) values (
    target_brand_id,relation_id,actor,actor,'Prochaine visite · '||coalesce(pharmacy_name,'Pharmacie'),
    'Suite de la visite terrain du '||current_date::text,next_at,'open','visit','normal','interaction',interaction_id
  ) returning id into task_id;

  update public.interactions set related_task_id=task_id where id=interaction_id;

  insert into public.field_visit_completions(
    visit_id,brand_id,brand_pharmacy_id,created_by,order_result,photo_result,note,next_visit_date,
    interaction_id,follow_up_task_id,photo_bucket_id,photo_object_path,photo_original_name,photo_mime_type,photo_size_bytes
  ) values (
    target_visit_id,target_brand_id,relation_id,actor,order_result,photo_result,clean_note,next_date,
    interaction_id,task_id,
    case when photo_result='photo_added' then photo->>'bucket_id' else null end,
    case when photo_result='photo_added' then photo->>'object_path' else null end,
    case when photo_result='photo_added' then left(photo->>'original_name',255) else null end,
    case when photo_result='photo_added' then photo->>'mime_type' else null end,
    case when photo_result='photo_added' then (photo->>'size_bytes')::bigint else null end
  ) returning id into completion_id;

  if not exists (
    select 1 from public.field_visit_brands fvb
    where fvb.visit_id=target_visit_id
      and not exists (
        select 1 from public.field_visit_completions c
        where c.visit_id=fvb.visit_id and c.brand_id=fvb.brand_id
      )
  ) then
    update public.field_visits
    set status='completed', completed_at=coalesce(completed_at,now()), updated_at=now()
    where id=target_visit_id;
  end if;

  return completion_id;
end;
$$;

alter table public.field_visit_completions enable row level security;
revoke all on public.field_visit_completions from public,anon;
grant select on public.field_visit_completions to authenticated;
grant all on public.field_visit_completions to service_role;

create policy field_visit_completions_select on public.field_visit_completions
for select to authenticated
using (
  created_by=(select auth.uid())
  or private.can_access_brand_pharmacy(brand_pharmacy_id)
);

create policy field_visit_storage_select on storage.objects
for select to authenticated
using (bucket_id='field-visit-evidence' and private.can_access_field_visit_object(name));

create policy field_visit_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='field-visit-evidence'
  and owner_id=(select auth.uid())::text
  and private.can_write_field_visit_object(name)
);

create policy field_visit_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id='field-visit-evidence'
  and owner_id=(select auth.uid())::text
  and private.can_write_field_visit_object(name)
);

revoke all on function private.can_write_field_visit_object(text), private.can_access_field_visit_object(text) from public,anon,authenticated;
grant execute on function private.can_write_field_visit_object(text), private.can_access_field_visit_object(text) to authenticated;

revoke all on function public.start_field_visit(uuid,uuid), public.complete_field_visit(uuid,uuid,jsonb) from public,anon;
grant execute on function public.start_field_visit(uuid,uuid), public.complete_field_visit(uuid,uuid,jsonb) to authenticated,service_role;

comment on table public.field_visit_completions is 'Brand-scoped proof that a planned field visit is actually closed: order answer, photo answer, mandatory note and mandatory next visit date.';
comment on column public.field_visits.completed_at is 'Physical visit completion timestamp. A brand-level visit counts in progress only when field_visit_completions exists for that brand.';
