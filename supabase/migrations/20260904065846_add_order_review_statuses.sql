alter type public.order_status add value if not exists 'needs_correction' after 'pending';
alter type public.order_status add value if not exists 'rejected' after 'needs_correction';;
