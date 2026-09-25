-- P2 incident repair: remove incomplete HubSpot order headers created by the
-- 2026-09-25 candidate reconciliation before the importer was made draft-first.
-- Scope is intentionally narrow: Naali, the exact failed-run window, import source,
-- HubSpot signature, and no persisted line items.

delete from public.connector_external_child_links child
using public.orders o, public.brands b
where b.id = o.brand_id
  and b.slug = 'naali'
  and o.source = 'import'
  and o.created_at >= '2026-09-25T19:34:00Z'::timestamptz
  and o.created_at < '2026-09-25T19:38:00Z'::timestamptz
  and o.external_order_id is not null
  and o.notes like 'Import HubSpot Naali bidirectionnel%'
  and not exists (select 1 from public.order_items oi where oi.order_id = o.id)
  and child.parent_entity_type = 'orders'
  and child.parent_tr1_record_id = o.id;

delete from public.connector_external_links link
using public.orders o, public.brands b
where b.id = o.brand_id
  and b.slug = 'naali'
  and o.source = 'import'
  and o.created_at >= '2026-09-25T19:34:00Z'::timestamptz
  and o.created_at < '2026-09-25T19:38:00Z'::timestamptz
  and o.external_order_id is not null
  and o.notes like 'Import HubSpot Naali bidirectionnel%'
  and not exists (select 1 from public.order_items oi where oi.order_id = o.id)
  and link.entity_type = 'orders'
  and link.tr1_record_id = o.id;

delete from public.orders o
using public.brands b
where b.id = o.brand_id
  and b.slug = 'naali'
  and o.source = 'import'
  and o.created_at >= '2026-09-25T19:34:00Z'::timestamptz
  and o.created_at < '2026-09-25T19:38:00Z'::timestamptz
  and o.external_order_id is not null
  and o.notes like 'Import HubSpot Naali bidirectionnel%'
  and not exists (select 1 from public.order_items oi where oi.order_id = o.id);
