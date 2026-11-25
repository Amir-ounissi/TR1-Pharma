create table public.tr1_support_message_reads (
 message_id uuid not null references public.pharmacy_support_messages(id) on delete restrict,
 user_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 read_at timestamptz not null default now(),
 primary key(message_id,user_id)
);
create index tr1_support_reads_user on public.tr1_support_message_reads(user_id,message_id);
alter table public.tr1_support_message_reads enable row level security;
revoke all on public.tr1_support_message_reads from public,anon,authenticated;
grant select on public.tr1_support_message_reads to authenticated;
grant insert(message_id) on public.tr1_support_message_reads to authenticated;
create policy support_reads_self_select on public.tr1_support_message_reads for select to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.pharmacy_support_messages m where m.id=message_id));
create policy support_reads_self_insert on public.tr1_support_message_reads for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.pharmacy_support_messages m where m.id=message_id and ((m.sender_role='owner' and not (select public.tr1_is_owner())) or (m.sender_role='pharmacy' and (select public.tr1_is_owner())))));
create function public.tr1_unread_summary() returns table(unread_messages bigint,unread_announcements bigint,new_requests bigint)
language sql stable security invoker set search_path='' as $$
 select
 (select count(*) from public.pharmacy_support_messages m where ((m.sender_role='owner' and not (select public.tr1_is_owner())) or (m.sender_role='pharmacy' and (select public.tr1_is_owner()))) and not exists(select 1 from public.tr1_support_message_reads r where r.message_id=m.id and r.user_id=(select auth.uid()))),
 (select count(*) from public.tr1_announcements a where not (select public.tr1_is_owner()) and a.status='published' and not exists(select 1 from public.tr1_announcement_reads r where r.announcement_id=a.id and r.user_id=(select auth.uid()))),
 (select count(*) from public.pharmacy_support_requests r where (select public.tr1_is_owner()) and r.status='received');
$$;
revoke execute on function public.tr1_unread_summary() from public,anon,authenticated;
grant execute on function public.tr1_unread_summary() to authenticated;
create function public.tr1_mark_support_read(p_request_id uuid) returns bigint
language sql volatile security invoker set search_path='' as $$
 with inserted as (
 insert into public.tr1_support_message_reads(message_id)
 select m.id from public.pharmacy_support_messages m where m.request_id=p_request_id and ((m.sender_role='owner' and not (select public.tr1_is_owner())) or (m.sender_role='pharmacy' and (select public.tr1_is_owner())))
 on conflict(message_id,user_id) do nothing returning message_id
 ) select count(*) from inserted;
$$;
revoke execute on function public.tr1_mark_support_read(uuid) from public,anon,authenticated;
grant execute on function public.tr1_mark_support_read(uuid) to authenticated;
