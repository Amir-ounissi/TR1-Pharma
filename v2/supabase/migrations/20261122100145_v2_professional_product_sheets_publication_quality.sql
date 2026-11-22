
alter table public.products add column if not exists benefits text;
alter table public.products add column if not exists actives text;
alter table public.products add column if not exists inci text;
alter table public.products add column if not exists usage_advice text;
alter table public.products add column if not exists precautions text;
alter table public.products add constraint products_publication_completeness
check (not published or (
 ean is not null and ean ~ '^[0-9]{8,14}$'
 and image_url is not null and image_url like 'https://%'
 and description is not null and length(trim(description)) >= 10
));
