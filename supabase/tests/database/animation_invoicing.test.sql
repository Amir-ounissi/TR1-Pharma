begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

select ok(
  to_regclass('public.animation_invoices') is not null,
  'animation invoice table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.animation_invoices'::regclass),
  'animation invoices use row level security'
);

select ok(
  has_table_privilege('authenticated', 'public.animation_invoices', 'SELECT'),
  'authenticated users can read invoices through RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.animation_invoices', 'INSERT'),
  'authenticated users cannot bypass invoice submission RPC'
);

select ok(
  to_regprocedure('public.submit_animation_invoice(uuid,uuid,text,numeric,numeric)') is not null,
  'invoice submission RPC exists'
);

select ok(
  to_regprocedure('public.review_animation_invoice(uuid,text,text)') is not null,
  'invoice review RPC exists'
);

select ok(
  to_regprocedure('public.mark_animation_invoice_paid(uuid)') is not null,
  'invoice paid-state RPC exists'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.submit_animation_invoice(uuid,uuid,text,numeric,numeric)'::regprocedure),
  'invoice submission is protected by a security-definer boundary'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mission_attachments'::regclass
      and conname = 'mission_attachments_evidence_kind_check'
      and pg_get_constraintdef(oid) like '%invoice%'
  ),
  'mission evidence accepts invoice PDFs as a dedicated evidence kind'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.animation_invoices'::regclass
      and tgname = 'validate_animation_invoice'
      and not tgisinternal
  ),
  'invoice rows require the validated animation closeout contract'
);

select ok(
  (select prosecdef from pg_proc where oid = 'private.can_access_mission_object(text)'::regprocedure),
  'private mission-object access remains a security-definer boundary'
);

select * from finish();
rollback;
