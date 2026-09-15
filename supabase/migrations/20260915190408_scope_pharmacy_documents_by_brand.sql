alter table public.pharmacy_documents
  add column brand_id uuid not null references public.brands(id) on delete cascade;

alter table public.pharmacy_documents
  drop constraint if exists pharmacy_documents_pharmacy_id_document_type_key,
  add constraint pharmacy_documents_brand_pharmacy_type_key
    unique (brand_id, pharmacy_id, document_type);

create index if not exists pharmacy_documents_brand_pharmacy_idx
  on public.pharmacy_documents(brand_id, pharmacy_id);
