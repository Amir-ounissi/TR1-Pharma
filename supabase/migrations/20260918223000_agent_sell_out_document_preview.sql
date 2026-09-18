-- P0 #216 — Agent sell-out document analysis confirmation.
-- The AI/document preview remains ephemeral until the agent validates it.
-- Confirmation atomically replaces the capture lines so retries cannot duplicate them.

create or replace function public.apply_sell_out_document_preview(
  target_capture_id uuid,
  target_period_start date,
  target_period_end date,
  target_confidence numeric,
  target_extraction_version text,
  target_raw_extraction jsonb,
  target_lines jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture_record public.sell_out_captures%rowtype;
  actor uuid := (select auth.uid());
  item jsonb;
  item_product_id uuid;
  item_units integer;
  item_revenue numeric;
  item_confidence numeric;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into capture_record
  from public.sell_out_captures
  where id = target_capture_id
    and archived_at is null
  for update;

  if capture_record.id is null then
    raise exception 'Sell-out capture not found' using errcode = 'P0002';
  end if;
  if capture_record.method <> 'document' then
    raise exception 'Only document captures accept document previews' using errcode = '22023';
  end if;
  if capture_record.status not in ('draft','review_required') then
    raise exception 'Reviewed sell-out capture is immutable' using errcode = '55000';
  end if;
  if not private.can_capture_sell_out(capture_record.brand_id, capture_record.brand_pharmacy_id) then
    raise exception 'Sell-out document confirmation forbidden' using errcode = '42501';
  end if;
  if target_period_start is null or target_period_end is null or target_period_end < target_period_start then
    raise exception 'Invalid sell-out period' using errcode = '22023';
  end if;
  if target_confidence is not null and (target_confidence < 0 or target_confidence > 1) then
    raise exception 'Invalid confidence value' using errcode = '22023';
  end if;
  if target_extraction_version is null or char_length(btrim(target_extraction_version)) not between 1 and 100 then
    raise exception 'Extraction version is required' using errcode = '22023';
  end if;
  if target_raw_extraction is null or private.sell_out_payload_has_pii(target_raw_extraction) then
    raise exception 'Sell-out extraction must not contain patient or customer personal data' using errcode = '22023';
  end if;
  if jsonb_typeof(target_lines) <> 'array'
     or jsonb_array_length(target_lines) < 1
     or jsonb_array_length(target_lines) > 150 then
    raise exception 'Sell-out document lines are invalid' using errcode = '22023';
  end if;

  -- Validate the full payload before deleting the existing draft lines.
  for item in select value from jsonb_array_elements(target_lines)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Sell-out document line is invalid' using errcode = '22023';
    end if;

    item_product_id := case
      when nullif(btrim(item->>'product_id'), '') is null then null
      else (item->>'product_id')::uuid
    end;
    item_units := case
      when nullif(btrim(item->>'units_sold'), '') is null then null
      else (item->>'units_sold')::integer
    end;
    item_revenue := case
      when nullif(btrim(item->>'revenue_ht'), '') is null then null
      else (item->>'revenue_ht')::numeric
    end;
    item_confidence := case
      when nullif(btrim(item->>'confidence'), '') is null then null
      else (item->>'confidence')::numeric
    end;

    if item_product_id is not null and not exists (
      select 1
      from public.products product
      where product.id = item_product_id
        and product.brand_id = capture_record.brand_id
        and product.is_active
        and product.discontinued_at is null
    ) then
      raise exception 'Sell-out product is outside active brand' using errcode = '23514';
    end if;

    if item_product_id is null
       and nullif(btrim(item->>'source_product_code'), '') is null
       and nullif(btrim(item->>'ean'), '') is null
       and nullif(btrim(item->>'label'), '') is null then
      raise exception 'A product identifier is required' using errcode = '22023';
    end if;
    if item_units is null or item_units < 0 then
      raise exception 'Sell-out units are required and cannot be negative' using errcode = '22023';
    end if;
    if item_revenue is not null and item_revenue < 0 then
      raise exception 'Revenue cannot be negative' using errcode = '22023';
    end if;
    if item_confidence is not null and (item_confidence < 0 or item_confidence > 1) then
      raise exception 'Invalid line confidence' using errcode = '22023';
    end if;
    if char_length(coalesce(item->>'source_product_code', '')) > 120
       or char_length(coalesce(item->>'ean', '')) > 32
       or char_length(coalesce(item->>'label', '')) > 300 then
      raise exception 'Sell-out line text is too long' using errcode = '22023';
    end if;
  end loop;

  update public.sell_out_captures
  set
    period_start = target_period_start,
    period_end = target_period_end,
    confidence = target_confidence,
    extraction_version = btrim(target_extraction_version),
    raw_extraction = target_raw_extraction,
    status = 'draft',
    quality = null,
    validation_notes = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_by = actor
  where id = target_capture_id;

  delete from public.sell_out_lines
  where capture_id = target_capture_id;

  for item in select value from jsonb_array_elements(target_lines)
  loop
    item_product_id := case
      when nullif(btrim(item->>'product_id'), '') is null then null
      else (item->>'product_id')::uuid
    end;
    item_units := (item->>'units_sold')::integer;
    item_revenue := case
      when nullif(btrim(item->>'revenue_ht'), '') is null then null
      else (item->>'revenue_ht')::numeric
    end;
    item_confidence := case
      when nullif(btrim(item->>'confidence'), '') is null then null
      else (item->>'confidence')::numeric
    end;

    insert into public.sell_out_lines(
      capture_id,
      organization_id,
      brand_id,
      brand_pharmacy_id,
      product_id,
      source_product_code,
      ean,
      label,
      units_sold,
      revenue_ht,
      confidence,
      created_by,
      updated_by
    ) values (
      capture_record.id,
      capture_record.organization_id,
      capture_record.brand_id,
      capture_record.brand_pharmacy_id,
      item_product_id,
      nullif(btrim(item->>'source_product_code'), ''),
      nullif(btrim(item->>'ean'), ''),
      nullif(btrim(item->>'label'), ''),
      item_units,
      item_revenue,
      item_confidence,
      actor,
      actor
    );

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.apply_sell_out_document_preview(
  uuid, date, date, numeric, text, jsonb, jsonb
) from public, anon;
grant execute on function public.apply_sell_out_document_preview(
  uuid, date, date, numeric, text, jsonb, jsonb
) to authenticated, service_role;

comment on function public.apply_sell_out_document_preview(uuid,date,date,numeric,text,jsonb,jsonb) is
  'Atomically applies a human-reviewed document extraction to a draft sell-out capture. Replaces draft lines to make retries idempotent.';
