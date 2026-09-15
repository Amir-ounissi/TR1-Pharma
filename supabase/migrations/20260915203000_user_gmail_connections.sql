create table if not exists public.user_gmail_connections (
  user_id uuid primary key references public.users(id) on delete cascade,
  email text not null,
  refresh_token_ciphertext text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_gmail_connections enable row level security;
revoke all on public.user_gmail_connections from public, anon, authenticated;
grant all on public.user_gmail_connections to service_role;

comment on table public.user_gmail_connections is
  'Server-only Gmail OAuth connection metadata. Refresh tokens are encrypted by the application before persistence.';
