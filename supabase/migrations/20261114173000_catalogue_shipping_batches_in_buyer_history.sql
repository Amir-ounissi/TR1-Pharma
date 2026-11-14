-- La pharmacie retrouve le même identifiant de lot franco sur toutes ses demandes coréennes mutualisées.
CREATE OR REPLACE FUNCTION public.catalogue_buyer_workspace()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pharmacy uuid := private.catalogue_current_pharmacy_id();
  v_user uuid := (select auth.uid());
  v_lines jsonb := '[]'::jsonb;
  v_history jsonb := '[]'::jsonb;
begin
  if v_user is null or v_pharmacy is null then
    raise exception 'Catalogue non autorise' using errcode='42501';
  end if;

  select c.lines into v_lines
    from public.private_catalog_cart_drafts c
    where c.user_id=v_user and c.pharmacy_id=v_pharmacy;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',r.id,'created_at',r.created_at,'brand_name',b.name,
      'request_kind',r.request_kind,'status',r.status,
      'items',r.items,'shipping_batch_id',r.shipping_batch_id
    ) order by r.created_at desc
  ),'[]'::jsonb) into v_history
  from (
    select r.id,r.created_at,r.brand_id,r.request_kind,r.status,r.shipping_batch_id,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id',i.product_id,'quantity',i.quantity,'name',p.name
        ) order by i.id)
        from public.private_catalog_request_items i
        join public.private_catalog_products p
          on p.id=i.product_id and p.active
        join public.private_catalog_access a
          on a.brand_id=p.brand_id and a.pharmacy_id=v_pharmacy and a.active
        join public.private_catalog_brands ab
          on ab.id=a.brand_id and ab.active
        where i.request_id=r.id
      ), '[]'::jsonb) as items
    from public.private_catalog_requests r
    where r.pharmacy_id=v_pharmacy
    order by r.created_at desc
    limit 12
  ) r
  join public.private_catalog_brands b on b.id=r.brand_id
  where jsonb_array_length(r.items)>0;

  return jsonb_build_object(
    'lines',coalesce(v_lines,'[]'::jsonb),
    'recent_requests',coalesce(v_history,'[]'::jsonb)
  );
end $function$

revoke all on function public.catalogue_buyer_workspace() from public,anon,authenticated;
grant execute on function public.catalogue_buyer_workspace() to authenticated;
