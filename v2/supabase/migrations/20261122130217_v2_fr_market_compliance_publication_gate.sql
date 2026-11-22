-- TR1 V2: French-market compliance is an explicit manual gate on every published product.
-- For supplements, retain declaration/label/claims evidence; for cosmetics, retain the appropriate EU/French compliance file.
alter table public.products add column if not exists fr_market_checked boolean not null default false;
alter table public.products add column if not exists fr_label_checked boolean not null default false;
alter table public.products add column if not exists fr_market_document text;
alter table public.products add constraint products_fr_market_publication_guard
check (not published or (
 fr_market_checked and fr_label_checked
 and fr_market_document is not null
 and length(trim(fr_market_document)) >= 6
));
