-- Add the optional SEPA mandate to pharmacy documents.
-- SEPA is intentionally not part of order_email_transmission.required_documents:
-- its absence must never block an order email.

alter table public.pharmacy_documents
  drop constraint if exists pharmacy_documents_document_type_check;

alter table public.pharmacy_documents
  add constraint pharmacy_documents_document_type_check
  check (document_type in ('kbis','rib','sepa'));

comment on table public.pharmacy_documents is
  'Private pharmacy documents reused for order transmission. KBIS/RIB may be required by brand configuration; SEPA is always optional.';
