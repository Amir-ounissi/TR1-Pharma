alter table public.orders
  alter column payment_status
  set default 'not_applicable'::public.order_payment_status;
