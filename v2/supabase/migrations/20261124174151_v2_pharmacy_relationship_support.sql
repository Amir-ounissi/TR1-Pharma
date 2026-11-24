create table public.pharmacy_support_requests (
 id uuid primary key default gen_random_uuid(),
 pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 category text not null check (category in ('question','appointment','animation','training','resources','implantation','reorder','delivery','claim','other')),
 subject text not null check (length(trim(subject)) between 3 and 180),
 brand_label text check (brand_label is null or length(trim(brand_label)) between 1 and 120),
 body text not null check (length(trim(body)) between 3 and 4000),
 status text not null default 'received' check (status in ('received','in_progress','waiting_client','resolved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index support_requests_pharmacy_date on public.pharmacy_support_requests(pharmacy_id,created_at desc);
create index support_requests_creator on public.pharmacy_support_requests(created_by);
create index support_requests_status_date on public.pharmacy_support_requests(status,updated_at desc);
create table public.pharmacy_support_messages (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.pharmacy_support_requests(id) on delete restrict,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 sender_role text not null check (sender_role in ('owner','pharmacy')),
 body text not null check (length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index support_messages_request_date on public.pharmacy_support_messages(request_id,created_at);
create index support_messages_author on public.pharmacy_support_messages(author_id);
alter table public.pharmacy_support_requests enable row level security;
alter table public.pharmacy_support_messages enable row level security;
revoke all on public.pharmacy_support_requests,public.pharmacy_support_messages from public,anon,authenticated;
grant select on public.pharmacy_support_requests,public.pharmacy_support_messages to authenticated;
grant insert(pharmacy_id,category,subject,brand_label,body) on public.pharmacy_support_requests to authenticated;
grant update(status) on public.pharmacy_support_requests to authenticated;
grant insert(request_id,sender_role,body) on public.pharmacy_support_messages to authenticated;
create policy support_request_read on public.pharmacy_support_requests for select to authenticated using ((select public.tr1_is_owner()) or exists(select 1 from public.pharmacy_memberships m where m.pharmacy_id=pharmacy_support_requests.pharmacy_id and m.active and m.user_id=(select auth.uid())));
create policy support_request_create on public.pharmacy_support_requests for insert to authenticated with check (not (select public.tr1_is_owner()) and created_by=(select auth.uid()) and status='received' and exists(select 1 from public.pharmacy_memberships m where m.pharmacy_id=pharmacy_support_requests.pharmacy_id and m.active and m.user_id=(select auth.uid())));
create policy support_request_owner_update on public.pharmacy_support_requests for update to authenticated using ((select public.tr1_is_owner())) with check ((select public.tr1_is_owner()));
create policy support_message_read on public.pharmacy_support_messages for select to authenticated using (exists(select 1 from public.pharmacy_support_requests r where r.id=pharmacy_support_messages.request_id));
create policy support_message_create on public.pharmacy_support_messages for insert to authenticated with check (author_id=(select auth.uid()) and ((sender_role='owner' and (select public.tr1_is_owner())) or (sender_role='pharmacy' and not (select public.tr1_is_owner()))) and exists(select 1 from public.pharmacy_support_requests r where r.id=pharmacy_support_messages.request_id and r.status<>'resolved'));
create function public.tr1_support_status_timestamp() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
revoke execute on function public.tr1_support_status_timestamp() from public,anon,authenticated;
create trigger support_status_timestamp before update on public.pharmacy_support_requests for each row execute function public.tr1_support_status_timestamp();
