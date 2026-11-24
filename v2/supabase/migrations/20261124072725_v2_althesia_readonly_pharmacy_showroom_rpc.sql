
-- Read-only, permission-scoped Althesia showroom.
-- Returns source catalogue data only: no products are published, sold, or submitted to supplier.
create or replace function private.althesia_showroom_catalogue()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',p.id,'brand_id',b.id,'brand',b.name,'brand_slug',b.slug,
      'name',p.name,'sku',p.sku,'ean',p.ean,'format',p.format,
      'category',p.category,'image_url',p.image_url,
      'summary',s.source_summary,'ingredients',s.ingredients_and_doses,
      'dosage',s.dosage_and_duration,'audience',s.target_audience,
      'precautions',s.precaution_notes,
      'source_document',s.source_document,'source_page',s.source_page,
      'sub_brand',s.sub_brand,
      'retail_ttc',s.source_retail_ttc,'vat_rate',s.source_vat_rate,
      'market_status',s.market_status,
      'offers',coalesce((
        select jsonb_agg(jsonb_build_object(
          'paid_quantity',o.paid_quantity,'free_quantity',o.free_quantity,
          'price_ht',o.purchase_unit_ht,'price_confirmed',o.price_confirmed
        ) order by o.paid_quantity)
        from public.althesia_trade_offers o where o.product_id=p.id
      ),'[]'::jsonb)
    ) order by b.name,p.name
  ),'[]'::jsonb)
  from public.products p
  join public.brands b on b.id=p.brand_id
  join public.althesia_product_specs s on s.product_id=p.id
  where b.slug in ('vitalora','bloomster','noto')
    and (select auth.uid()) is not null
    and exists(
      select 1 from public.demo_catalogue_access a
      where a.brand_id=b.id and a.active
      and private.demo_can_access(a.pharmacy_id,a.brand_id)
    );
$$;
revoke all on function private.althesia_showroom_catalogue() from public,anon;
grant execute on function private.althesia_showroom_catalogue() to authenticated;

create or replace function public.althesia_showroom_catalogue()
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.althesia_showroom_catalogue();
$$;
revoke all on function public.althesia_showroom_catalogue() from public,anon;
grant execute on function public.althesia_showroom_catalogue() to authenticated;
