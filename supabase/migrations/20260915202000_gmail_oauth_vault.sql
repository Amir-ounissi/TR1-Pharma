create table if not exists public.gmail_user_connections (
  user_id uuid primary key references public.users(id) on delete cascade,
  email text not null,
  vault_secret_id uuid not null,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gmail_user_connections_email_check
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

alter table public.gmail_user_connections enable row level security;
revoke all on public.gmail_user_connections from public, anon, authenticated;
grant all on public.gmail_user_connections to service_role;

create or replace function public.store_gmail_oauth_grant(
  target_user_id uuid,
  target_email text,
  target_grant text,
  target_expires_at timestamptz,
  target_scopes text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_secret_id uuid;
  next_secret_id uuid;
begin
  if not private.is_service_role_request() then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select vault_secret_id into existing_secret_id
  from public.gmail_user_connections
  where user_id = target_user_id;

  if existing_secret_id is null then
    select vault.create_secret(
      target_grant,
      'tr1-gmail-' || target_user_id::text,
      'TR1 Pharma Gmail OAuth grant'
    ) into next_secret_id;
  else
    perform vault.update_secret(existing_secret_id, target_grant);
    next_secret_id := existing_secret_id;
  end if;

  insert into public.gmail_user_connections(
    user_id, email, vault_secret_id, expires_at, scopes, connected_at, updated_at
  ) values (
    target_user_id, lower(btrim(target_email)), next_secret_id,
    target_expires_at, coalesce(target_scopes, '{}'), now(), now()
  )
  on conflict (user_id) do update set
    email = excluded.email,
    vault_secret_id = excluded.vault_secret_id,
    expires_at = excluded.expires_at,
    scopes = excluded.scopes,
    updated_at = now();
end;
$$;

create or replace function public.read_gmail_oauth_grant(target_user_id uuid)
returns table(email text, grant text, expires_at timestamptz, scopes text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_role_request() then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  return query
  select c.email, s.decrypted_secret, c.expires_at, c.scopes
  from public.gmail_user_connections c
  join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.user_id = target_user_id;
end;
$$;

revoke all on function public.store_gmail_oauth_grant(uuid,text,text,timestamptz,text[]) from public, anon, authenticated;
revoke all on function public.read_gmail_oauth_grant(uuid) from public, anon, authenticated;
grant execute on function public.store_gmail_oauth_grant(uuid,text,text,timestamptz,text[]) to service_role;
grant execute on function public.read_gmail_oauth_grant(uuid) to service_role;

comment on table public.gmail_user_connections is
  'Per-user Gmail connection metadata. OAuth grant material is stored in Supabase Vault, not in application tables.';
