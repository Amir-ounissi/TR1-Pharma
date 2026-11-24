create table public.tr1_announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 3 and 180),
 summary text not null check(length(trim(summary)) between 3 and 500),
 body text not null check(length(trim(body)) between 3 and 8000),
 category text not null check(category in ('news','offer','launch','event','training','field_update')),
 brand_id uuid references public.brands(id) on delete restrict,
 audience_scope text not null default 'all' check(audience_scope in ('all','implanted','discovery','selected')),
 target_pharmacy_ids uuid[] not null default '{}',
 cover_image_url text check(cover_image_url is null or cover_image_url ~ '^https://'),
 cta_label text check(cta_label is null or length(trim(cta_label)) between 2 and 60),
 cta_url text check(cta_url is null or cta_url ~ '^(https://|/catalogue/)[^[:space:]]*$'),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 starts_on date not null default current_date,
 ends_on date,
 published_at timestamptz,
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(ends_on is null or ends_on>=starts_on),
 check((cta_label is null)=(cta_url is null)),
 check((audience_scope='selected' and cardinality(target_pharmacy_ids)>0) or (audience_scope<>'selected' and cardinality(target_pharmacy_ids)=0)),
 check((audience_scope in ('implanted','discovery') and brand_id is not null) or audience_scope in ('all','selected'))
);
create index tr1_announcements_publication on public.tr1_announcements(status,starts_on desc,created_at desc);
create index tr1_announcements_brand on public.tr1_announcements(brand_id);
create table public.tr1_announcement_reads (
 announcement_id uuid not null references public.tr1_announcements(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 read_at timestamptz not null default now(),
 primary key(announcement_id,user_id)
);
create index tr1_announcement_reads_user on public.tr1_announcement_reads(user_id,read_at desc);
create table public.tr1_resources (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 3 and 180),
 description text not null check(length(trim(description)) between 3 and 1000),
 category text not null check(category in ('catalogue','product_sheet','argumentaire','training','plv','other')),
 brand_id uuid references public.brands(id) on delete restrict,
 audience_scope text not null default 'all' check(audience_scope in ('all','implanted','discovery','selected')),
 target_pharmacy_ids uuid[] not null default '{}',
 resource_url text not null check(resource_url ~ '^https://'),
 published boolean not null default false,
 starts_on date not null default current_date,
 ends_on date,
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(ends_on is null or ends_on>=starts_on),
 check((audience_scope='selected' and cardinality(target_pharmacy_ids)>0) or (audience_scope<>'selected' and cardinality(target_pharmacy_ids)=0)),
 check((audience_scope in ('implanted','discovery') and brand_id is not null) or audience_scope in ('all','selected'))
);
create index tr1_resources_publication on public.tr1_resources(published,starts_on desc,created_at desc);
create index tr1_resources_brand on public.tr1_resources(brand_id);
alter table public.tr1_announcements enable row level security;
alter table public.tr1_announcement_reads enable row level security;
alter table public.tr1_resources enable row level security;
revoke all on public.tr1_announcements,public.tr1_announcement_reads,public.tr1_resources from public,anon,authenticated;
grant select,insert,update on public.tr1_announcements to authenticated;
grant select,insert on public.tr1_announcement_reads to authenticated;
grant select,insert,update on public.tr1_resources to authenticated;
create policy announcements_owner_all on public.tr1_announcements for all to authenticated using((select public.tr1_is_owner())) with check((select public.tr1_is_owner()));
create policy announcements_pharmacy_read on public.tr1_announcements for select to authenticated using(
 status='published' and starts_on<=current_date and (ends_on is null or ends_on>=current_date)
 and exists(select 1 from public.pharmacy_memberships m where m.user_id=(select auth.uid()) and m.active and (
  audience_scope='all'
  or (audience_scope='selected' and m.pharmacy_id=any(target_pharmacy_ids))
  or (audience_scope='implanted' and exists(select 1 from public.pharmacy_brand_relationships r where r.pharmacy_id=m.pharmacy_id and r.brand_id=tr1_announcements.brand_id and r.status='implanted'))
  or (audience_scope='discovery' and not exists(select 1 from public.pharmacy_brand_relationships r where r.pharmacy_id=m.pharmacy_id and r.brand_id=tr1_announcements.brand_id and r.status='implanted'))
 ))
);
create policy announcement_reads_owner_read on public.tr1_announcement_reads for select to authenticated using((select public.tr1_is_owner()));
create policy announcement_reads_pharmacy_read on public.tr1_announcement_reads for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.tr1_announcements a where a.id=announcement_id));
create policy announcement_reads_pharmacy_insert on public.tr1_announcement_reads for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.tr1_announcements a where a.id=announcement_id));
create policy resources_owner_all on public.tr1_resources for all to authenticated using((select public.tr1_is_owner())) with check((select public.tr1_is_owner()));
create policy resources_pharmacy_read on public.tr1_resources for select to authenticated using(
 published and starts_on<=current_date and (ends_on is null or ends_on>=current_date)
 and exists(select 1 from public.pharmacy_memberships m where m.user_id=(select auth.uid()) and m.active and (
  audience_scope='all'
  or (audience_scope='selected' and m.pharmacy_id=any(target_pharmacy_ids))
  or (audience_scope='implanted' and exists(select 1 from public.pharmacy_brand_relationships r where r.pharmacy_id=m.pharmacy_id and r.brand_id=tr1_resources.brand_id and r.status='implanted'))
  or (audience_scope='discovery' and not exists(select 1 from public.pharmacy_brand_relationships r where r.pharmacy_id=m.pharmacy_id and r.brand_id=tr1_resources.brand_id and r.status='implanted'))
 ))
);
create function public.tr1_communication_timestamp() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); if tg_table_name='tr1_announcements' and new.status='published' and new.published_at is null then new.published_at=now(); end if; return new; end $$;
revoke execute on function public.tr1_communication_timestamp() from public,anon,authenticated;
create trigger tr1_announcements_timestamp before update on public.tr1_announcements for each row execute function public.tr1_communication_timestamp();
create trigger tr1_resources_timestamp before update on public.tr1_resources for each row execute function public.tr1_communication_timestamp();
