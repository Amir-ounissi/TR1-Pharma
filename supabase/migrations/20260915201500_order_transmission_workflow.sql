alter table public.pharmacies
  add column if not exists vat_number text;

alter table public.pharmacies
  drop constraint if exists pharmacies_vat_number_check,
  add constraint pharmacies_vat_number_check check (
    vat_number is null or char_length(btrim(vat_number)) between 4 and 32
  );

create table if not exists public.pharmacy_documents (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  document_type text not null check (document_type in ('kbis','rib')),
  file_name text not null,
  content_type text not null,
  object_path text not null,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, document_type)
);

create table if not exists public.order_email_transmissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null,
  provider text not null default 'gmail' check (provider = 'gmail'),
  status text not null default 'prepared' check (status in ('prepared','sending','sent','failed')),
  sender_email text,
  recipient_email text not null,
  subject text not null,
  external_message_id text,
  attachment_manifest jsonb not null default '[]'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_email_transmissions_order_idx
  on public.order_email_transmissions(order_id, created_at desc);

alter table public.pharmacy_documents enable row level security;
alter table public.order_email_transmissions enable row level security;
revoke all on public.pharmacy_documents, public.order_email_transmissions from public, anon, authenticated;
grant all on public.pharmacy_documents, public.order_email_transmissions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pharmacy-documents','pharmacy-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.pharmacy_documents is 'Private KBIS and RIB documents reused for order transmission.';
comment on table public.order_email_transmissions is 'Audit trail for explicit order emails, independent from the commercial order status.';
