alter table public.brand_pharmacy_products
  add column if not exists order_presence boolean not null default false,
  add column if not exists derived_from_orders boolean not null default false;

alter table public.brand_pharmacies
  add column if not exists order_driven_implantation boolean not null default false;

create or replace function private.order_counts_for_activity(
  target_status public.order_status,
  target_type public.order_type,
  target_net_amount numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_status in ('confirmed','invoiced','partially_delivered','delivered')
    and target_type not in ('return','credit_note')
    and not (target_type = 'sample' and target_net_amount = 0);
$$;

create or replace function private.order_counts_for_revenue(
  target_status public.order_status,
  target_type public.order_type,
  target_net_amount numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_status in ('invoiced','partially_delivered','delivered')
    and target_type not in ('return','credit_note')
    and not (target_type = 'sample' and target_net_amount = 0);
$$;

create or replace function private.order_counts_for_booked_revenue(
  target_status public.order_status,
  target_type public.order_type,
  target_net_amount numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select target_status in ('confirmed','invoiced','partially_delivered','delivered')
    and target_type not in ('return','credit_note')
    and not (target_type = 'sample' and target_net_amount = 0);
$$;

create or replace function private.snapshot_manual_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1
     and coalesce(current_setting('app.order_product_rebuild', true), 'false') <> 'true' then
    perform private.capture_distribution_snapshot(
      coalesce(new.brand_pharmacy_id, old.brand_pharmacy_id),
      'manual'
    );
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.reclassify_brand_pharmacy_orders(target_brand_pharmacy_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.recalculating_order', 'true', true);
  perform set_config('app.order_admin_correction', 'true', true);

  with ranked as (
    select
      o.id,
      row_number() over (order by o.order_date, o.created_at, o.id) as seq
    from public.orders o
    where o.brand_pharmacy_id = target_brand_pharmacy_id
      and o.archived_at is null
      and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  )
  update public.orders o
  set
    is_initial_order = ranked.seq = 1,
    is_reorder = ranked.seq > 1,
    order_type = case
      when o.order_type in ('initial','reorder','other') then
        case when ranked.seq = 1 then 'initial'::public.order_type else 'reorder'::public.order_type end
      else o.order_type
    end
  from ranked
  where o.id = ranked.id
    and (
      o.is_initial_order is distinct from (ranked.seq = 1)
      or o.is_reorder is distinct from (ranked.seq > 1)
      or (
        o.order_type in ('initial','reorder','other')
        and o.order_type is distinct from
          case when ranked.seq = 1 then 'initial'::public.order_type else 'reorder'::public.order_type end
      )
    );

  update public.orders o
  set
    is_initial_order = false,
    is_reorder = false,
    order_type = case when o.order_type in ('initial','reorder') then 'other'::public.order_type else o.order_type end
  where o.brand_pharmacy_id = target_brand_pharmacy_id
    and o.archived_at is null
    and not private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
    and (o.is_initial_order or o.is_reorder or o.order_type in ('initial','reorder'));

  perform set_config('app.recalculating_order', 'false', true);
  perform set_config('app.order_admin_correction', 'false', true);
end;
$$;

create or replace function private.rebuild_brand_pharmacy_order_products(target_brand_pharmacy_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_record record;
  existing_record public.brand_pharmacy_products%rowtype;
begin
  perform set_config('app.order_product_rebuild', 'true', true);

  update public.brand_pharmacy_products
  set
    order_presence = false,
    first_ordered_at = null,
    last_ordered_at = null,
    last_order_quantity = null,
    total_ordered_quantity = 0,
    valid_order_count = 0,
    updated_at = now()
  where brand_pharmacy_id = target_brand_pharmacy_id
    and removed_at is null;

  for product_record in
    with valid_lines as (
      select
        o.id as order_id,
        o.order_date,
        o.created_at,
        oi.product_id,
        sum(oi.quantity + oi.free_quantity)::integer as physical_quantity
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.brand_pharmacy_id = target_brand_pharmacy_id
        and o.archived_at is null
        and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
      group by o.id, o.order_date, o.created_at, oi.product_id
    ), aggregates as (
      select
        product_id,
        min(order_date) as first_ordered_at,
        max(order_date) as last_ordered_at,
        sum(physical_quantity)::integer as total_ordered_quantity,
        count(distinct order_id)::integer as valid_order_count
      from valid_lines
      group by product_id
    ), latest as (
      select distinct on (product_id)
        product_id,
        physical_quantity as last_order_quantity
      from valid_lines
      order by product_id, order_date desc, created_at desc, order_id desc
    )
    select
      aggregates.product_id,
      aggregates.first_ordered_at,
      aggregates.last_ordered_at,
      aggregates.total_ordered_quantity,
      aggregates.valid_order_count,
      latest.last_order_quantity
    from aggregates
    join latest using (product_id)
  loop
    select * into existing_record
    from public.brand_pharmacy_products bpp
    where bpp.brand_pharmacy_id = target_brand_pharmacy_id
      and bpp.product_id = product_record.product_id
      and bpp.removed_at is null
      and bpp.status <> 'removed'
    order by bpp.created_at desc
    limit 1;

    if existing_record.id is null then
      insert into public.brand_pharmacy_products (
        brand_pharmacy_id,
        product_id,
        status,
        first_implanted_at,
        first_ordered_at,
        last_ordered_at,
        last_order_quantity,
        total_ordered_quantity,
        valid_order_count,
        order_presence,
        derived_from_orders,
        source
      ) values (
        target_brand_pharmacy_id,
        product_record.product_id,
        'implanted',
        product_record.first_ordered_at,
        product_record.first_ordered_at,
        product_record.last_ordered_at,
        product_record.last_order_quantity,
        product_record.total_ordered_quantity,
        product_record.valid_order_count,
        true,
        true,
        'other'
      );
    else
      update public.brand_pharmacy_products
      set
        status = case when existing_record.derived_from_orders then 'implanted'::public.implantation_status else status end,
        first_implanted_at = case
          when existing_record.derived_from_orders then coalesce(first_implanted_at, product_record.first_ordered_at)
          else first_implanted_at
        end,
        first_ordered_at = product_record.first_ordered_at,
        last_ordered_at = product_record.last_ordered_at,
        last_order_quantity = product_record.last_order_quantity,
        total_ordered_quantity = product_record.total_ordered_quantity,
        valid_order_count = product_record.valid_order_count,
        order_presence = true,
        updated_at = now()
      where id = existing_record.id;
    end if;
  end loop;

  delete from public.brand_pharmacy_products
  where brand_pharmacy_id = target_brand_pharmacy_id
    and removed_at is null
    and derived_from_orders
    and not order_presence;

  perform set_config('app.order_product_rebuild', 'false', true);
end;
$$;

create or replace function private.capture_order_distribution_snapshot(
  target_brand_pharmacy_id uuid,
  target_snapshot_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  metrics record;
begin
  select
    bp.brand_id,
    count(distinct p.id) filter (
      where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
    )::integer as eligible,
    count(distinct p.id) filter (
      where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
        and exists (
          select 1
          from public.orders o
          join public.order_items oi on oi.order_id = o.id
          where o.brand_pharmacy_id = bp.id
            and oi.product_id = p.id
            and o.archived_at is null
            and o.order_date::date <= target_snapshot_date
            and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
        )
    )::integer as implanted,
    count(distinct p.id) filter (
      where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
        and p.strategic_priority = 'strategic'
    )::integer as strategic_eligible,
    count(distinct p.id) filter (
      where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
        and p.strategic_priority = 'strategic'
        and exists (
          select 1
          from public.orders o
          join public.order_items oi on oi.order_id = o.id
          where o.brand_pharmacy_id = bp.id
            and oi.product_id = p.id
            and o.archived_at is null
            and o.order_date::date <= target_snapshot_date
            and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
        )
    )::integer as strategic_implanted
  into metrics
  from public.brand_pharmacies bp
  join public.products p on p.brand_id = bp.brand_id
  where bp.id = target_brand_pharmacy_id
  group by bp.id, bp.brand_id;

  if metrics.brand_id is null then return; end if;

  insert into public.brand_pharmacy_distribution_snapshots (
    brand_id,
    brand_pharmacy_id,
    snapshot_date,
    eligible_product_count,
    implanted_product_count,
    strategic_eligible_count,
    strategic_implanted_count,
    distribution_rate,
    strategic_distribution_rate,
    source
  ) values (
    metrics.brand_id,
    target_brand_pharmacy_id,
    target_snapshot_date,
    metrics.eligible,
    metrics.implanted,
    metrics.strategic_eligible,
    metrics.strategic_implanted,
    case when metrics.eligible = 0 then 0 else round(metrics.implanted * 100.0 / metrics.eligible, 2) end,
    case when metrics.strategic_eligible = 0 then 0 else round(metrics.strategic_implanted * 100.0 / metrics.strategic_eligible, 2) end,
    'order'
  )
  on conflict (brand_pharmacy_id, snapshot_date) do update
  set
    eligible_product_count = excluded.eligible_product_count,
    implanted_product_count = excluded.implanted_product_count,
    strategic_eligible_count = excluded.strategic_eligible_count,
    strategic_implanted_count = excluded.strategic_implanted_count,
    distribution_rate = excluded.distribution_rate,
    strategic_distribution_rate = excluded.strategic_distribution_rate,
    source = excluded.source,
    created_at = now()
  where public.brand_pharmacy_distribution_snapshots.source <> 'manual';
end;
$$;

create or replace function private.sync_post_implantation_follow_up(target_brand_pharmacy_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_record public.brand_pharmacies%rowtype;
  settings public.brand_settings%rowtype;
  first_order record;
  owner_id uuid;
  due_date timestamptz;
begin
  select * into relation_record
  from public.brand_pharmacies
  where id = target_brand_pharmacy_id;

  if relation_record.id is null then return; end if;

  select * into settings
  from public.brand_settings
  where brand_id = relation_record.brand_id;

  select o.id, o.order_date, o.created_by
  into first_order
  from public.orders o
  where o.brand_pharmacy_id = target_brand_pharmacy_id
    and o.archived_at is null
    and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  order by o.order_date, o.created_at, o.id
  limit 1;

  if first_order.id is null then return; end if;

  owner_id := coalesce(relation_record.current_agent_user_id, relation_record.tr1_manager_user_id, first_order.created_by);
  if owner_id is null then return; end if;

  due_date := first_order.order_date + make_interval(days => settings.post_implantation_follow_up_days);

  update public.tasks
  set
    due_at = due_date,
    assigned_to = owner_id,
    updated_at = now()
  where brand_pharmacy_id = target_brand_pharmacy_id
    and title = 'Suivi post-implantation'
    and status in ('open','in_progress')
    and archived_at is null;

  if not found then
    insert into public.tasks (
      brand_id,
      brand_pharmacy_id,
      task_type,
      title,
      status,
      priority,
      due_at,
      assigned_to,
      created_by,
      source
    ) values (
      relation_record.brand_id,
      target_brand_pharmacy_id,
      'follow_up',
      'Suivi post-implantation',
      'open',
      'high',
      due_date,
      owner_id,
      first_order.created_by,
      'automation'
    );
  end if;
end;
$$;

create or replace view public.brand_pharmacy_distribution
with (security_invoker = true)
as
with eligible as (
  select
    p.brand_id,
    count(*) filter (
      where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
    ) as eligible_product_count,
    count(*) filter (
      where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
        and p.strategic_priority = 'strategic'
    ) as strategic_eligible_count
  from public.products p
  group by p.brand_id
), present as (
  select distinct bpp.brand_pharmacy_id, bpp.product_id
  from public.brand_pharmacy_products bpp
  where bpp.removed_at is null
    and (
      bpp.order_presence
      or bpp.status in ('implanted','active','temporarily_unavailable')
      or bpp.manually_confirmed_present
    )
), implanted as (
  select
    present.brand_pharmacy_id,
    count(*)::integer as implanted_product_count,
    count(*) filter (where p.strategic_priority = 'strategic')::integer as strategic_implanted_count
  from present
  join public.products p on p.id = present.product_id
  where p.is_active and p.discontinued_at is null and p.is_pharmacy_eligible and p.counts_for_distribution
  group by present.brand_pharmacy_id
)
select
  bp.id as brand_pharmacy_id,
  bp.brand_id,
  coalesce(e.eligible_product_count, 0)::integer as eligible_product_count,
  coalesce(i.implanted_product_count, 0)::integer as implanted_product_count,
  coalesce(e.strategic_eligible_count, 0)::integer as strategic_eligible_count,
  coalesce(i.strategic_implanted_count, 0)::integer as strategic_implanted_count,
  case
    when coalesce(e.eligible_product_count, 0) = 0 then 0::numeric
    else round(coalesce(i.implanted_product_count, 0)::numeric * 100.0 / e.eligible_product_count::numeric, 2)
  end as distribution_rate,
  case
    when coalesce(e.strategic_eligible_count, 0) = 0 then null::numeric
    else round(coalesce(i.strategic_implanted_count, 0)::numeric * 100.0 / e.strategic_eligible_count::numeric, 2)
  end as strategic_distribution_rate,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'sku', p.sku) order by p.name)
    from public.products p
    where p.brand_id = bp.brand_id
      and p.is_active
      and p.discontinued_at is null
      and p.is_pharmacy_eligible
      and p.counts_for_distribution
      and not exists (
        select 1 from present
        where present.brand_pharmacy_id = bp.id and present.product_id = p.id
      )
  ), '[]'::jsonb) as missing_products
from public.brand_pharmacies bp
left join eligible e on e.brand_id = bp.brand_id
left join implanted i on i.brand_pharmacy_id = bp.id;

create or replace function private.process_order_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_is_valid boolean := private.order_counts_for_activity(new.order_status, new.order_type, new.net_amount_ht);
  old_is_valid boolean := case
    when tg_op = 'UPDATE' then private.order_counts_for_activity(old.order_status, old.order_type, old.net_amount_ht)
    else false
  end;
  perf public.brand_pharmacy_order_performance%rowtype;
begin
  if new_is_valid is distinct from old_is_valid then
    perform private.reclassify_brand_pharmacy_orders(new.brand_pharmacy_id);
    perform private.rebuild_brand_pharmacy_order_products(new.brand_pharmacy_id);

    select * into perf
    from public.brand_pharmacy_order_performance
    where brand_pharmacy_id = new.brand_pharmacy_id;

    if perf.valid_order_count > 0 then
      perform set_config('app.status_change_reason', 'Première commande commerciale confirmée', true);
      perform set_config('app.status_change_source', 'automation', true);

      update public.brand_pharmacies
      set
        implanted_at = coalesce(implanted_at, perf.first_valid_order_at),
        commercial_status = case
          when commercial_status in ('targeted','qualified','contacted','appointment_scheduled','offer_sent','pending_order')
            then 'implanted'::public.commercial_status
          else commercial_status
        end,
        order_driven_implantation = case
          when commercial_status in ('targeted','qualified','contacted','appointment_scheduled','offer_sent','pending_order')
            then true
          else order_driven_implantation
        end
      where id = new.brand_pharmacy_id;

      perform private.sync_post_implantation_follow_up(new.brand_pharmacy_id);
    else
      update public.brand_pharmacies
      set
        commercial_status = case
          when order_driven_implantation and commercial_status = 'implanted' then 'pending_order'::public.commercial_status
          else commercial_status
        end,
        implanted_at = case
          when order_driven_implantation and commercial_status = 'implanted' then null
          else implanted_at
        end,
        order_driven_implantation = case
          when order_driven_implantation and commercial_status = 'implanted' then false
          else order_driven_implantation
        end
      where id = new.brand_pharmacy_id;
    end if;

    perform private.recalculate_brand_pharmacy_activity(
      new.brand_pharmacy_id,
      case when new.source = 'import' then 'import'::public.activity_history_source else 'order'::public.activity_history_source end,
      case when new_is_valid then 'Commande commerciale confirmée' else 'Commande annulée ou remboursée' end,
      new.id,
      new.created_by
    );

    perform private.capture_order_distribution_snapshot(new.brand_pharmacy_id, new.order_date::date);
  end if;

  return new;
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
returns table(order_id uuid, brand_pharmacy_id uuid)
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
  trusted_order_payload jsonb := order_payload;
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
      if coalesce(
        nullif(btrim(new_pharmacy_payload ->> 'legal_name'), ''),
        nullif(btrim(new_pharmacy_payload ->> 'trade_name'), '')
      ) is null then
        raise exception 'A pharmacy name is required' using errcode = '23514';
      end if;

      select pharmacy.id into existing_duplicate
      from public.pharmacies pharmacy
      where pharmacy.archived_at is null
        and (
          (nullif(btrim(new_pharmacy_payload ->> 'siret'), '') is not null
            and upper(regexp_replace(coalesce(pharmacy.siret, ''), '[^0-9A-Za-z]', '', 'g')) = upper(regexp_replace(new_pharmacy_payload ->> 'siret', '[^0-9A-Za-z]', '', 'g')))
          or (nullif(btrim(new_pharmacy_payload ->> 'cip_code'), '') is not null
            and upper(regexp_replace(coalesce(pharmacy.cip_code, ''), '[^0-9A-Za-z]', '', 'g')) = upper(regexp_replace(new_pharmacy_payload ->> 'cip_code', '[^0-9A-Za-z]', '', 'g')))
          or (nullif(btrim(new_pharmacy_payload ->> 'finess_code'), '') is not null
            and upper(regexp_replace(coalesce(pharmacy.finess_code, ''), '[^0-9A-Za-z]', '', 'g')) = upper(regexp_replace(new_pharmacy_payload ->> 'finess_code', '[^0-9A-Za-z]', '', 'g')))
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
        legal_name,
        trade_name,
        siret,
        cip_code,
        finess_code,
        postal_code,
        city,
        address_line_1,
        is_active,
        created_by
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
        brand_id,
        pharmacy_id,
        commercial_status,
        activity_status,
        source,
        priority_level,
        potential_level,
        current_agent_user_id,
        created_by
      ) values (
        target_brand_id,
        pharmacy_record.id,
        'pending_order',
        'never_ordered',
        'agent',
        'normal',
        'unknown',
        actor,
        actor
      ) returning id into resolved_brand_pharmacy_id;

      if actor_is_agent and not private.user_is_assigned_to_relation(actor, resolved_brand_pharmacy_id) then
        insert into public.pharmacy_assignments (
          brand_id,
          brand_pharmacy_id,
          user_id,
          assignment_type,
          is_primary,
          assigned_by,
          assignment_reason
        ) values (
          target_brand_id,
          resolved_brand_pharmacy_id,
          actor,
          'commercial_agent',
          true,
          actor,
          'Première commande saisie par l’agent'
        );
      end if;
    end if;
  end if;

  if actor_is_agent and not private.user_is_assigned_to_relation(actor, resolved_brand_pharmacy_id) then
    raise exception 'Order creation forbidden' using errcode = '42501';
  end if;

  if actor_is_agent and coalesce(trusted_order_payload ->> 'source_agent_user_id', '') = '' then
    trusted_order_payload := jsonb_set(trusted_order_payload, '{source_agent_user_id}', to_jsonb(actor::text), true);
  end if;

  created_order_id := public.create_order(resolved_brand_pharmacy_id, trusted_order_payload, item_payload);
  return query select created_order_id, resolved_brand_pharmacy_id;
end;
$$;

-- Freeze the responsible agent for existing imported orders whenever it can be inferred safely.
update public.orders o
set source_agent_user_id = coalesce(o.source_user_id, bp.current_agent_user_id)
from public.brand_pharmacies bp
where bp.id = o.brand_pharmacy_id
  and o.source = 'import'
  and o.source_agent_user_id is null
  and coalesce(o.source_user_id, bp.current_agent_user_id) is not null
  and exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.brand_id = o.brand_id
      and m.user_id = coalesce(o.source_user_id, bp.current_agent_user_id)
      and m.status = 'active'
      and r.key = 'agent'
  )
  and private.user_is_assigned_to_relation(coalesce(o.source_user_id, bp.current_agent_user_id), o.brand_pharmacy_id);

-- Backfill all commercial order classifications chronologically and rebuild current assortment.
do $$
declare
  relation_record record;
  perf public.brand_pharmacy_order_performance%rowtype;
  inferred_order_driven boolean;
begin
  for relation_record in
    select distinct o.brand_pharmacy_id
    from public.orders o
    where o.archived_at is null
      and private.order_counts_for_activity(o.order_status, o.order_type, o.net_amount_ht)
  loop
    perform private.reclassify_brand_pharmacy_orders(relation_record.brand_pharmacy_id);
    perform private.rebuild_brand_pharmacy_order_products(relation_record.brand_pharmacy_id);

    select * into perf
    from public.brand_pharmacy_order_performance
    where brand_pharmacy_id = relation_record.brand_pharmacy_id;

    select exists (
      select 1
      from public.brand_pharmacies bp
      join public.orders first_order on first_order.brand_pharmacy_id = bp.id
      where bp.id = relation_record.brand_pharmacy_id
        and first_order.is_initial_order
        and abs(extract(epoch from (first_order.created_at - bp.created_at))) <= 10
    ) into inferred_order_driven;

    perform set_config('app.activity_history_managed', 'true', true);
    update public.brand_pharmacies bp
    set
      implanted_at = coalesce(bp.implanted_at, perf.first_valid_order_at),
      first_valid_order_at = perf.first_valid_order_at,
      last_valid_order_at = perf.last_valid_order_at,
      first_reorder_at = perf.first_reorder_at,
      last_order_at = perf.last_valid_order_at,
      activity_status = case
        when bp.activity_status = 'lost' then 'lost'::public.activity_status
        else perf.current_activity_status
      end,
      commercial_status = case
        when bp.commercial_status in ('targeted','qualified','contacted','appointment_scheduled','offer_sent','pending_order')
          then 'implanted'::public.commercial_status
        else bp.commercial_status
      end,
      order_driven_implantation = bp.order_driven_implantation or inferred_order_driven
    where bp.id = relation_record.brand_pharmacy_id;
    perform set_config('app.activity_history_managed', 'false', true);

    perform private.sync_post_implantation_follow_up(relation_record.brand_pharmacy_id);

    perform private.capture_order_distribution_snapshot(
      relation_record.brand_pharmacy_id,
      perf.first_valid_order_at::date
    );
  end loop;
end;
$$;;
