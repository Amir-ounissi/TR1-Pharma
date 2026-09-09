-- Multibrand commercial workspace foundation.
-- Reads can span every brand where the current user is an agent.
-- Writes remain scoped to their existing brand-aware RPCs and relations.

create or replace function public.get_agent_today_multibrand(
  target_date date default current_date,
  brand_filter uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Agent workspace authentication required' using errcode = '42501';
  end if;

  if brand_filter is not null
    and not private.has_brand_role(brand_filter, array['agent']) then
    raise exception 'Agent workspace brand forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(rows) order by rows.is_overdue desc, rows.due_at asc nulls last, rows.priority_rank desc)
      from (
        select
          t.id,
          t.brand_id,
          b.name as brand_name,
          t.brand_pharmacy_id,
          bp.pharmacy_id,
          t.title,
          t.task_type,
          t.priority,
          t.due_at,
          t.due_at < now() as is_overdue,
          case t.priority when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end as priority_rank,
          coalesce(p.trade_name, p.legal_name) as pharmacy_name,
          p.city
        from public.tasks t
        join public.brands b on b.id = t.brand_id
        join public.brand_pharmacies bp on bp.id = t.brand_pharmacy_id
        join public.pharmacies p on p.id = bp.pharmacy_id
        where t.assigned_to = (select auth.uid())
          and private.has_brand_role(t.brand_id, array['agent'])
          and (brand_filter is null or t.brand_id = brand_filter)
          and t.status in ('open', 'in_progress')
          and t.archived_at is null
          and (t.due_at::date <= target_date or t.due_at is null)
      ) rows
    ), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'brand_id', m.brand_id,
        'brand_name', b.name,
        'brand_pharmacy_id', m.brand_pharmacy_id,
        'pharmacy_id', m.pharmacy_id,
        'title', m.title,
        'objective', m.objective,
        'scheduled_start_at', m.scheduled_start_at,
        'priority', m.priority,
        'status', m.status,
        'pharmacy_name', coalesce(p.trade_name, p.legal_name),
        'city', p.city
      ) order by m.scheduled_start_at asc)
      from public.missions m
      join public.brands b on b.id = m.brand_id
      join public.pharmacies p on p.id = m.pharmacy_id
      where m.assigned_user_id = (select auth.uid())
        and private.has_brand_role(m.brand_id, array['agent'])
        and (brand_filter is null or m.brand_id = brand_filter)
        and m.archived_at is null
        and m.scheduled_start_at::date = target_date
        and m.status not in ('completed', 'cancelled', 'rejected', 'no_show')
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'brand_id', r.brand_id,
        'brand_name', b.name,
        'mission_id', r.mission_id,
        'title', m.title,
        'brand_pharmacy_id', m.brand_pharmacy_id,
        'pharmacy_id', m.pharmacy_id,
        'report_status', r.report_status,
        'pharmacy_name', coalesce(p.trade_name, p.legal_name)
      ) order by r.updated_at asc)
      from public.mission_reports r
      join public.missions m on m.id = r.mission_id
      join public.brands b on b.id = r.brand_id
      join public.pharmacies p on p.id = m.pharmacy_id
      where r.submitted_by = (select auth.uid())
        and private.has_brand_role(r.brand_id, array['agent'])
        and (brand_filter is null or r.brand_id = brand_filter)
        and r.archived_at is null
        and r.report_status in ('draft', 'needs_correction')
    ), '[]'::jsonb),
    'follow_ups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand_id', bp.brand_id,
        'brand_name', b.name,
        'brand_pharmacy_id', bp.id,
        'pharmacy_id', bp.pharmacy_id,
        'pharmacy_name', coalesce(p.trade_name, p.legal_name),
        'city', p.city,
        'last_interaction_at', bp.last_interaction_at,
        'priority', bp.priority_level
      ) order by bp.priority_level desc, bp.last_interaction_at asc nulls first)
      from public.brand_pharmacies bp
      join public.brands b on b.id = bp.brand_id
      join public.pharmacies p on p.id = bp.pharmacy_id
      where bp.current_agent_user_id = (select auth.uid())
        and private.has_brand_role(bp.brand_id, array['agent'])
        and (brand_filter is null or bp.brand_id = brand_filter)
        and bp.archived_at is null
        and bp.commercial_status <> 'lost'
        and not exists (
          select 1
          from public.tasks t
          where t.brand_pharmacy_id = bp.id
            and t.status in ('open', 'in_progress')
            and t.archived_at is null
        )
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.get_my_next_field_visit(
  brand_filter uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Agent workspace authentication required' using errcode = '42501';
  end if;

  if brand_filter is not null
    and not private.has_brand_role(brand_filter, array['agent']) then
    raise exception 'Agent workspace brand forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'visit_id', v.id,
    'pharmacy_id', v.pharmacy_id,
    'name', coalesce(p.trade_name, p.legal_name),
    'address', concat_ws(', ', p.address_line_1, concat_ws(' ', p.postal_code, p.city)),
    'city', p.city,
    'phone', p.phone,
    'latitude', p.latitude,
    'longitude', p.longitude,
    'visit_kind', v.visit_kind,
    'status', v.status,
    'title', v.title,
    'objective', v.objective,
    'scheduled_at', v.scheduled_start_at,
    'scheduled_end_at', v.scheduled_end_at,
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand_id', fvb.brand_id,
        'brand_name', b.name,
        'brand_pharmacy_id', fvb.brand_pharmacy_id,
        'objective', fvb.objective,
        'is_primary', fvb.is_primary
      ) order by fvb.is_primary desc, b.name asc)
      from public.field_visit_brands fvb
      join public.brands b on b.id = fvb.brand_id
      where fvb.visit_id = v.id
        and private.has_brand_role(fvb.brand_id, array['agent'])
        and (brand_filter is null or fvb.brand_id = brand_filter)
    ), '[]'::jsonb),
    'primary_contact', (
      select jsonb_build_object(
        'name', concat_ws(' ', c.first_name, c.last_name),
        'phone', c.phone
      )
      from public.pharmacy_contacts c
      where c.pharmacy_id = p.id
        and c.is_primary
        and c.archived_at is null
      limit 1
    )
  ) into result
  from public.field_visits v
  join public.pharmacies p on p.id = v.pharmacy_id
  where v.owner_user_id = (select auth.uid())
    and v.archived_at is null
    and v.status in ('planned', 'confirmed', 'in_progress')
    and (v.status = 'in_progress' or v.scheduled_end_at >= now())
    and (
      brand_filter is null
      or exists (
        select 1
        from public.field_visit_brands scoped
        where scoped.visit_id = v.id
          and scoped.brand_id = brand_filter
          and private.has_brand_role(scoped.brand_id, array['agent'])
      )
    )
  order by
    case when v.status = 'in_progress' then 0 else 1 end,
    v.scheduled_start_at asc
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_agent_today_multibrand(date, uuid) from public, anon;
revoke all on function public.get_my_next_field_visit(uuid) from public, anon;

grant execute on function public.get_agent_today_multibrand(date, uuid) to authenticated, service_role;
grant execute on function public.get_my_next_field_visit(uuid) to authenticated, service_role;

comment on function public.get_agent_today_multibrand(date, uuid) is
  'Returns the current agent day across every authorized agent brand, optionally narrowed to one brand. Every row carries explicit brand metadata.';
comment on function public.get_my_next_field_visit(uuid) is
  'Returns one physical upcoming field visit with its authorized brand relations, optionally narrowed to one brand.';
