alter table public.pharmacy_documents
  drop constraint if exists pharmacy_documents_document_type_check;

alter table public.pharmacy_documents
  add constraint pharmacy_documents_document_type_check
  check (document_type in ('kbis', 'rib', 'sepa'));

comment on table public.pharmacy_documents is
  'Private pharmacy documents reused for order transmission (KBIS, RIB, optional SEPA mandate).';
