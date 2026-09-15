alter table public.order_email_transmissions
  add column if not exists body_text text;
