create or replace function public.search_pharmacy_directory_for_order(
  target_brand_id uuid,
  search_term text default null,
  candidate_siret text default null,
  candidate_cip text default null,
  candidate_finess text default null,
  candidate_name text default null,
  candidate_postal_code text default null,
  result_limit integer default 12
)
returns table (
  pharmacy_id uuid,
  brand_pharmacy_id uuid,
  relation_status text,
  legal_name text,
  trade_name text,
  siret text,
  cip_code text,
  finess_code text,
  postal_code text,
  city text,
  address_line_1 text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := nullif(btrim(search_term), '');
begin
  if (select auth.uid()) is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Brand access is required' using errcode = '42501';
  end if;

  if normalized_search is null
    and nullif(btrim(candidate_siret), '') is null
    and nullif(btrim(candidate_cip), '') is null
    and nullif(btrim(candidate_finess), '') is null
    and (nullif(btrim(candidate_name), '') is null or nullif(btrim(candidate_postal_code), '') is null) then
    return;
  end if;

  return query
  select
    pharmacy.id,
    relation.id,
    case when relation.id is null then 'global_only' else 'existing_brand_relation' end,
    pharmacy.legal_name,
    pharmacy.trade_name,
    pharmacy.siret,
    pharmacy.cip_code,
    pharmacy.finess_code,
    pharmacy.postal_code,
    pharmacy.city,
    pharmacy.address_line_1
  from public.pharmacies pharmacy
  left join public.brand_pharmacies relation
    on relation.pharmacy_id = pharmacy.id
    and relation.brand_id = target_brand_id
    and relation.archived_at is null
  where pharmacy.archived_at is null
    and pharmacy.is_active
    and (
      (normalized_search is not null and (
        pharmacy.legal_name ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.trade_name, '') ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.city, '') ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.siret, '') ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.cip_code, '') ilike '%' || normalized_search || '%'
        or coalesce(pharmacy.finess_code, '') ilike '%' || normalized_search || '%'
      ))
      or (nullif(btrim(candidate_siret), '') is not null and upper(btrim(pharmacy.siret)) = upper(btrim(candidate_siret)))
      or (nullif(btrim(candidate_cip), '') is not null and upper(btrim(pharmacy.cip_code)) = upper(btrim(candidate_cip)))
      or (nullif(btrim(candidate_finess), '') is not null and upper(btrim(pharmacy.finess_code)) = upper(btrim(candidate_finess)))
      or (
        nullif(btrim(candidate_name), '') is not null
        and nullif(btrim(candidate_postal_code), '') is not null
        and private.normalize_reference_text(coalesce(pharmacy.trade_name, pharmacy.legal_name)) = private.normalize_reference_text(candidate_name)
        and pharmacy.postal_code = candidate_postal_code
      )
    )
  order by (relation.id is not null) desc, pharmacy.legal_name, pharmacy.id
  limit greatest(1, least(coalesce(result_limit, 12), 25));
end;
$$;

create or replace function public.create_order_with_pharmacy_resolution(
  target_brand_id uuid,
  target_brand_pharmacy_id uuid default null,
  target_pharmacy_id uuid default null,
  new_pharmacy_payload jsonb default null,
  order_payload jsonb default '{}'::jsonb,
  item_payload jsonb default '[]'::jsonb
)
returns table (order_id uuid, brand_pharmacy_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  resolved_brand_pharmacy_id uuid;
  resolved_pharmacy_id uuid;
  created_order_id uuid;
  actor_is_agent boolean;
  existing_duplicate uuid;
  pharmacy_record public.pharmacies%rowtype;
begin
  if actor is null or not private.can_access_brand(target_brand_id) then
    raise exception 'Brand access is required' using errcode = '42501';
  end if;

  actor_is_agent := exists (
    select 1
    from public.memberships membership
    join public.roles role on role.id = membership.role_id
    where membership.user_id = actor
      and membership.brand_id = target_brand_id
      and membership.status = 'active'
      and role.key = 'agent'
  );

  if not (private.has_elevated_brand_access(target_brand_id) or actor_is_agent) then
    raise exception 'Order creation forbidden' using errcode = '42501';
  end if;

  if num_nonnulls(target_brand_pharmacy_id, target_pharmacy_id, new_pharmacy_payload) <> 1 then
    raise exception 'Select one pharmacy resolution method' using errcode = '23514';
  end if;

  if target_brand_pharmacy_id is not null then
    select relation.id, relation.pharmacy_id
    into resolved_brand_pharmacy_id, resolved_pharmacy_id
    from public.brand_pharmacies relation
    where relation.id = target_brand_pharmacy_id
      and relation.brand_id = target_brand_id
      and relation.archived_at is null
    for update;
    if resolved_brand_pharmacy_id is null then
      raise exception 'Brand pharmacy unavailable' using errcode = '42501';
    end if;
  else
    if target_pharmacy_id is null then
      if coalesce(nullif(btrim(new_pharmacy_payload ->> 'legal_name'), ''), nullif(btrim(new_pharmacy_payload ->> 'trade_name'), '')) is null then
        raise exception 'A pharmacy name is required' using errcode = '23514';
      end if;
      select pharmacy.id into existing_duplicate
      from public.pharmacies pharmacy
      where pharmacy.archived_at is null
        and (
          (nullif(btrim(new_pharmacy_payload ->> 'siret'), '') is not null and upper(btrim(pharmacy.siret)) = upper(btrim(new_pharmacy_payload ->> 'siret')))
          or (nullif(btrim(new_pharmacy_payload ->> 'cip_code'), '') is not null and upper(btrim(pharmacy.cip_code)) = upper(btrim(new_pharmacy_payload ->> 'cip_code')))
          or (nullif(btrim(new_pharmacy_payload ->> 'finess_code'), '') is not null and upper(btrim(pharmacy.finess_code)) = upper(btrim(new_pharmacy_payload ->> 'finess_code')))
          or (
            nullif(btrim(coalesce(new_pharmacy_payload ->> 'trade_name', new_pharmacy_payload ->> 'legal_name')), '') is not null
            and nullif(btrim(new_pharmacy_payload ->> 'postal_code'), '') is not null
            and private.normalize_reference_text(coalesce(pharmacy.trade_name, pharmacy.legal_name)) = private.normalize_reference_text(coalesce(new_pharmacy_payload ->> 'trade_name', new_pharmacy_payload ->> 'legal_name'))
            and pharmacy.postal_code = new_pharmacy_payload ->> 'postal_code'
          )
        )
      limit 1;
      if existing_duplicate is not null then
        raise exception 'A matching directory pharmacy already exists; select it before confirming' using errcode = '23505';
      end if;
      insert into public.pharmacies (
        legal_name, trade_name, siret, cip_code, finess_code, postal_code, city, address_line_1, is_active, created_by
      ) values (
        coalesce(nullif(btrim(new_pharmacy_payload ->> 'legal_name'), ''), nullif(btrim(new_pharmacy_payload ->> 'trade_name'), '')),
        nullif(btrim(new_pharmacy_payload ->> 'trade_name'), ''),
        nullif(btrim(new_pharmacy_payload ->> 'siret'), ''),
        nullif(btrim(new_pharmacy_payload ->> 'cip_code'), ''),
        nullif(btrim(new_pharmacy_payload ->> 'finess_code'), ''),
        nullif(btrim(new_pharmacy_payload ->> 'postal_code'), ''),
        nullif(btrim(new_pharmacy_payload ->> 'city'), ''),
        nullif(btrim(new_pharmacy_payload ->> 'address_line_1'), ''),
        true,
        actor
      ) returning id into target_pharmacy_id;
    end if;

    select * into pharmacy_record
    from public.pharmacies pharmacy
    where pharmacy.id = target_pharmacy_id
      and pharmacy.archived_at is null
      and pharmacy.is_active
    for update;
    if pharmacy_record.id is null then
      raise exception 'Directory pharmacy unavailable' using errcode = '42501';
    end if;

    select relation.id into resolved_brand_pharmacy_id
    from public.brand_pharmacies relation
    where relation.brand_id = target_brand_id
      and relation.pharmacy_id = pharmacy_record.id
      and relation.archived_at is null
    for update;

    if resolved_brand_pharmacy_id is null then
      insert into public.brand_pharmacies (
        brand_id, pharmacy_id, commercial_status, activity_status, source,
        priority_level, potential_level, current_agent_user_id, created_by
      ) values (
        target_brand_id, pharmacy_record.id, 'implanted', 'active', 'agent',
        'normal', 'unknown', actor, actor
      ) returning id into resolved_brand_pharmacy_id;

      if actor_is_agent then
        insert into public.pharmacy_assignments (
          brand_id, brand_pharmacy_id, user_id, assignment_type, is_primary, assigned_by, assignment_reason
        ) values (
          target_brand_id, resolved_brand_pharmacy_id, actor, 'commercial_agent', true, actor,
          'Première commande saisie par l’agent'
        );
      end if;
    end if;
  end if;

  if actor_is_agent and not private.user_is_assigned_to_relation(actor, resolved_brand_pharmacy_id) then
    raise exception 'Order creation forbidden' using errcode = '42501';
  end if;

  created_order_id := public.create_order(resolved_brand_pharmacy_id, order_payload, item_payload);
  return query select created_order_id, resolved_brand_pharmacy_id;
end;
$$;

revoke all on function public.search_pharmacy_directory_for_order(uuid, text, text, text, text, text, text, integer) from public, anon;
revoke all on function public.create_order_with_pharmacy_resolution(uuid, uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.search_pharmacy_directory_for_order(uuid, text, text, text, text, text, text, integer) to authenticated;
grant execute on function public.create_order_with_pharmacy_resolution(uuid, uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
