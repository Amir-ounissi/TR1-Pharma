
create table if not exists public.product_media_audit (
 product_id uuid primary key references public.products(id) on delete cascade,
 candidate_image_url text not null check(length(candidate_image_url) between 15 and 2000 and candidate_image_url ~ '^https://'),
 source_product_url text check(source_product_url is null or source_product_url ~ '^https://'),
 source_product_name text,
 source_brand_slug text,
 matched_by text not null default 'title'
   check(matched_by in ('ean','title','manual','supplier_document')),
 match_score numeric(5,2) check(match_score between 0 and 100),
 image_review_status text not null default 'pending'
   check(image_review_status in ('pending','verified','rejected')),
 applied_to_draft boolean not null default false,
 image_confirmed_reference text,
 detected_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint image_verified_requires_proof check (
 image_review_status<>'verified' or (
 image_confirmed_reference is not null
 and length(trim(image_confirmed_reference))>=5
 and reviewed_at is not null
 )),
 constraint image_rejected_not_applied check (
 image_review_status <> 'rejected' or applied_to_draft=false
 )
);
create index if not exists product_media_review_idx on public.product_media_audit(image_review_status,detected_at);
alter table public.product_media_audit enable row level security;
create policy product_media_audit_owner on public.product_media_audit
for all to authenticated using(public.tr1_is_owner()) with check(public.tr1_is_owner());
revoke all on public.product_media_audit from anon;
grant select,insert,update,delete on public.product_media_audit to authenticated;
