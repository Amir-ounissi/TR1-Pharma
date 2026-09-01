alter table public.access_requests
  drop constraint if exists access_requests_user_id_key;

create unique index access_requests_one_pending_per_user_idx
  on public.access_requests(user_id)
  where status = 'pending';

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_profile text := new.raw_user_meta_data ->> 'requested_profile_type';
begin
  insert into public.users (id, email) values (new.id, coalesce(new.email, ''));
  insert into public.user_profiles (user_id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));

  if requested_profile in ('brand', 'agent', 'facilitator') then
    insert into public.access_requests (user_id, requested_profile_type, requested_access)
    values (
      new.id,
      requested_profile,
      coalesce(new.raw_user_meta_data -> 'requested_access', '{}'::jsonb)
    )
    on conflict (user_id) where status = 'pending' do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create or replace function public.submit_my_access_request(
  target_requested_profile_type text,
  target_requested_access jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_request_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if target_requested_profile_type not in ('brand', 'agent', 'facilitator') then
    raise exception 'Unsupported access request type' using errcode = '22023';
  end if;

  if target_requested_access is null
    or jsonb_typeof(target_requested_access) <> 'object'
    or octet_length(target_requested_access::text) > 8192 then
    raise exception 'Access request details are invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.access_requests
    where user_id = (select auth.uid())
      and status = 'pending'
  ) then
    raise exception 'An access request is already pending' using errcode = '23505';
  end if;

  insert into public.access_requests (user_id, requested_profile_type, requested_access)
  values ((select auth.uid()), target_requested_profile_type, target_requested_access)
  returning id into created_request_id;

  return created_request_id;
end;
$$;

revoke all on function public.submit_my_access_request(text, jsonb) from public, anon;
grant execute on function public.submit_my_access_request(text, jsonb) to authenticated;

create or replace function public.cancel_my_access_request()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled_request_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  update public.access_requests
  set
    status = 'cancelled',
    reviewed_by = (select auth.uid()),
    reviewed_at = now(),
    reviewer_note = 'Annulée par le demandeur'
  where user_id = (select auth.uid())
    and status = 'pending'
  returning id into cancelled_request_id;

  if cancelled_request_id is null then
    raise exception 'No pending access request found' using errcode = 'P0002';
  end if;

  return cancelled_request_id;
end;
$$;

revoke all on function public.cancel_my_access_request() from public, anon;
grant execute on function public.cancel_my_access_request() to authenticated;

alter function public.execute_onboarding_import(uuid)
  rename to execute_onboarding_import_atomic;

alter function public.execute_onboarding_import_atomic(uuid)
  set schema private;

revoke all on function private.execute_onboarding_import_atomic(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.execute_onboarding_import(target_batch_id uuid)
returns table (
  lifecycle_status text,
  processed integer,
  skipped integer,
  error_code text,
  error_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_batch public.import_batches%rowtype;
  completed_lifecycle_status text;
  processed_count integer;
  skipped_count integer;
  captured_error_code text;
  captured_error_message text;
begin
  select * into target_batch
  from public.import_batches
  where id = target_batch_id
  for update;

  if target_batch.id is null
    or not private.has_brand_role(target_batch.brand_id, array['tr1_manager', 'brand_admin']) then
    raise exception 'Import execution forbidden' using errcode = '42501';
  end if;

  if target_batch.lifecycle_status <> 'ready' or target_batch.error_rows > 0 then
    raise exception 'Import must be ready and contain no invalid row' using errcode = '23514';
  end if;

  begin
    select atomic_result.processed, atomic_result.skipped
    into processed_count, skipped_count
    from private.execute_onboarding_import_atomic(target_batch_id) as atomic_result;

    select batch.lifecycle_status into completed_lifecycle_status
    from public.import_batches as batch
    where batch.id = target_batch_id;

    return query select
      completed_lifecycle_status,
      processed_count,
      skipped_count,
      null::text,
      null::text;
  exception when others then
    captured_error_code := SQLSTATE;
    get stacked diagnostics captured_error_message = message_text;

    update public.import_batches
    set
      status = 'failed',
      lifecycle_status = 'failed',
      rollback_status = 'unavailable',
      metadata = metadata || jsonb_build_object(
        'execution_error_code', captured_error_code,
        'execution_error_message', captured_error_message,
        'execution_failed_at', now()
      )
    where id = target_batch_id;

    return query select
      'failed'::text,
      0,
      0,
      captured_error_code,
      captured_error_message;
  end;
end;
$$;

revoke all on function public.execute_onboarding_import(uuid) from public, anon;
grant execute on function public.execute_onboarding_import(uuid) to authenticated, service_role;

create or replace function private.execute_onboarding_import_atomic(target_batch_id uuid)
returns table (processed integer, skipped integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_batch public.import_batches%rowtype;
  staged public.import_rows%rowtype;
  processed_count integer := 0;
  skipped_count integer := 0;
  target_id uuid;
  existing_id uuid;
  import_role_id smallint;
  import_user_id uuid;
  relation_id uuid;
  quantity_value integer;
  amount_value numeric;
  target_territory_id uuid;
  target_group_id uuid;
  group_was_created boolean;
  product_tax_rate numeric;
begin
  select * into target_batch from public.import_batches
  where id=target_batch_id for update;
  if target_batch.id is null
    or not private.has_brand_role(target_batch.brand_id,array['tr1_manager','brand_admin']) then
    raise exception 'Import execution forbidden' using errcode='42501';
  end if;
  if target_batch.lifecycle_status <> 'ready' or target_batch.error_rows > 0 then
    raise exception 'Import must be ready and contain no invalid row' using errcode='23514';
  end if;
  update public.import_batches set lifecycle_status='executing' where id=target_batch_id;

  if target_batch.entity_type::text='products' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into existing_id from public.products
      where brand_id=target_batch.brand_id
        and (
          upper(sku)=upper(staged.normalized_payload->>'sku')
          or (
            nullif(staged.normalized_payload->>'ean','') is not null
            and upper(coalesce(ean,''))=upper(staged.normalized_payload->>'ean')
          )
        )
      limit 1;
      if existing_id is not null and target_batch.import_mode='create_only' then
        update public.import_rows set status='skipped',is_duplicate=true where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif existing_id is null and target_batch.import_mode='update_only' then
        update public.import_rows set status='skipped',
          warnings=array_append(warnings,'Aucun produit existant à mettre à jour')
        where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif existing_id is null then
        insert into public.products(
          brand_id,name,description,sku,ean,category,product_family,format,
          wholesale_price_ht,retail_price_ttc,tax_rate,units_per_case,minimum_order_quantity,
          is_active,is_pharmacy_eligible,counts_for_distribution,strategic_priority
        ) values (
          target_batch.brand_id,
          staged.normalized_payload->>'name',
          nullif(staged.normalized_payload->>'description',''),
          staged.normalized_payload->>'sku',
          nullif(staged.normalized_payload->>'ean',''),
          nullif(staged.normalized_payload->>'category',''),
          nullif(staged.normalized_payload->>'product_family',''),
          nullif(staged.normalized_payload->>'format',''),
          nullif(staged.normalized_payload->>'wholesale_price_ht','')::numeric,
          nullif(staged.normalized_payload->>'retail_price_ttc','')::numeric,
          nullif(staged.normalized_payload->>'tax_rate','')::numeric,
          nullif(staged.normalized_payload->>'units_per_case','')::integer,
          nullif(staged.normalized_payload->>'minimum_order_quantity','')::integer,
          coalesce((staged.normalized_payload->>'is_active')::boolean,true),
          true,
          coalesce((staged.normalized_payload->>'counts_for_distribution')::boolean,true),
          coalesce(nullif(staged.normalized_payload->>'strategic_priority','')::public.strategic_priority,'standard'::public.strategic_priority)
        ) returning id into target_id;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'products',target_id,'created',staged.normalized_payload);
      else
        update public.products set
          name=staged.normalized_payload->>'name',
          description=coalesce(nullif(staged.normalized_payload->>'description',''),description),
          ean=coalesce(nullif(staged.normalized_payload->>'ean',''),ean),
          category=coalesce(nullif(staged.normalized_payload->>'category',''),category),
          product_family=coalesce(nullif(staged.normalized_payload->>'product_family',''),product_family),
          format=coalesce(nullif(staged.normalized_payload->>'format',''),format),
          wholesale_price_ht=coalesce(nullif(staged.normalized_payload->>'wholesale_price_ht','')::numeric,wholesale_price_ht),
          retail_price_ttc=coalesce(nullif(staged.normalized_payload->>'retail_price_ttc','')::numeric,retail_price_ttc),
          tax_rate=coalesce(nullif(staged.normalized_payload->>'tax_rate','')::numeric,tax_rate),
          units_per_case=coalesce(nullif(staged.normalized_payload->>'units_per_case','')::integer,units_per_case),
          minimum_order_quantity=coalesce(nullif(staged.normalized_payload->>'minimum_order_quantity','')::integer,minimum_order_quantity),
          is_active=coalesce((staged.normalized_payload->>'is_active')::boolean,is_active),
          counts_for_distribution=coalesce((staged.normalized_payload->>'counts_for_distribution')::boolean,counts_for_distribution),
          strategic_priority=coalesce(nullif(staged.normalized_payload->>'strategic_priority','')::public.strategic_priority,strategic_priority)
        where id=existing_id;
        target_id:=existing_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='pharmacies' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      relation_id:=null;
      target_id:=null;
      target_territory_id:=null;
      target_group_id:=null;
      group_was_created:=false;
      if nullif(staged.normalized_payload->>'territory_code','') is not null then
        select id into target_territory_id from public.territories
        where brand_id=target_batch.brand_id
          and upper(code)=upper(staged.normalized_payload->>'territory_code')
          and archived_at is null limit 1;
        if target_territory_id is null then
          raise exception 'Unknown territory code at line %', staged.line_number using errcode='23503';
        end if;
      end if;
      if nullif(staged.normalized_payload->>'group_name','') is not null then
        select id into target_group_id from public.pharmacy_groups
        where lower(name)=lower(staged.normalized_payload->>'group_name') and archived_at is null limit 1;
        if target_group_id is null then
          insert into public.pharmacy_groups(name,group_type)
          values(staged.normalized_payload->>'group_name','other')
          returning id into target_group_id;
          group_was_created:=true;
        end if;
      end if;
      select bp.id,bp.pharmacy_id into relation_id,target_id
      from public.brand_pharmacies bp
      join public.pharmacies p on p.id=bp.pharmacy_id
      where bp.brand_id=target_batch.brand_id and bp.archived_at is null
        and (
          (
            nullif(staged.normalized_payload->>'external_id','') is not null
            and lower(coalesce(bp.external_id,''))=lower(staged.normalized_payload->>'external_id')
          )
          or (
            lower(p.legal_name)=lower(staged.normalized_payload->>'pharmacy_name')
            and lower(coalesce(p.address_line_1,''))=lower(staged.normalized_payload->>'address_line_1')
            and p.postal_code=staged.normalized_payload->>'postal_code'
          )
        )
      order by case when lower(coalesce(bp.external_id,''))=lower(coalesce(staged.normalized_payload->>'external_id','')) then 0 else 1 end
      limit 1;
      if relation_id is not null and target_batch.import_mode='create_only' then
        update public.import_rows set status='skipped',is_duplicate=true where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif relation_id is null and target_batch.import_mode='update_only' then
        update public.import_rows set status='skipped',
          warnings=array_append(warnings,'Aucune pharmacie existante à mettre à jour')
        where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      elsif relation_id is null then
        insert into public.pharmacies(
          legal_name,trade_name,phone,email,address_line_1,address_line_2,postal_code,city,
          country_code,created_by
        ) values (
          staged.normalized_payload->>'pharmacy_name',staged.normalized_payload->>'pharmacy_name',
          nullif(staged.normalized_payload->>'phone',''),nullif(staged.normalized_payload->>'email',''),
          staged.normalized_payload->>'address_line_1',nullif(staged.normalized_payload->>'address_line_2',''),
          staged.normalized_payload->>'postal_code',staged.normalized_payload->>'city',
          staged.normalized_payload->>'country',(select auth.uid())
        ) returning id into target_id;
        update public.pharmacies set pharmacy_group_id=target_group_id where id=target_id;
        insert into public.brand_pharmacies(
          brand_id,pharmacy_id,external_id,source,potential_level,priority_level,territory_id,created_by
        ) values (
          target_batch.brand_id,target_id,nullif(staged.normalized_payload->>'external_id',''),'import',
          case lower(coalesce(staged.normalized_payload->>'potential',''))
            when 'high' then 'high'::public.potential_level
            when 'medium' then 'medium'::public.potential_level
            when 'low' then 'low'::public.potential_level
            else 'unknown'::public.potential_level end,
          case when coalesce((staged.normalized_payload->>'strategic')::boolean,false)
            then 'high'::public.priority_level else 'normal'::public.priority_level end,
          target_territory_id,(select auth.uid())
        ) returning id into relation_id;
        if group_was_created then
          insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
          values(target_batch_id,staged.id,target_batch.brand_id,'pharmacy_groups',target_group_id,'created',
            jsonb_build_object('name',staged.normalized_payload->>'group_name'));
        end if;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'pharmacies',target_id,'created',staged.normalized_payload);
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'brand_pharmacies',relation_id,'created',staged.normalized_payload);
      else
        update public.pharmacies set
          legal_name=staged.normalized_payload->>'pharmacy_name',
          trade_name=staged.normalized_payload->>'pharmacy_name',
          phone=coalesce(nullif(staged.normalized_payload->>'phone',''),phone),
          email=coalesce(nullif(staged.normalized_payload->>'email',''),email),
          address_line_1=staged.normalized_payload->>'address_line_1',
          address_line_2=coalesce(nullif(staged.normalized_payload->>'address_line_2',''),address_line_2),
          postal_code=staged.normalized_payload->>'postal_code',
          city=staged.normalized_payload->>'city',
          country_code=staged.normalized_payload->>'country',
          pharmacy_group_id=coalesce(target_group_id,pharmacy_group_id)
        where id=target_id;
        update public.brand_pharmacies set
          external_id=coalesce(nullif(staged.normalized_payload->>'external_id',''),external_id),
          territory_id=coalesce(target_territory_id,territory_id)
        where id=relation_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='orders' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into existing_id from public.orders
      where brand_id=target_batch.brand_id
        and external_order_id=staged.normalized_payload->>'external_order_id'
        and archived_at is null limit 1;
      if existing_id is not null then
        update public.import_rows set status='skipped',is_duplicate=true,processed_entity_id=existing_id where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      end if;
      select bp.id into relation_id from public.brand_pharmacies bp
      where bp.brand_id=target_batch.brand_id and bp.archived_at is null
        and lower(coalesce(bp.external_id,''))=lower(staged.normalized_payload->>'pharmacy_external_id')
      limit 1;
      if relation_id is null then
        raise exception 'Unknown pharmacy external id at line %', staged.line_number using errcode='23503';
      end if;
      select id, coalesce(tax_rate, 0) into target_id, product_tax_rate from public.products
      where brand_id=target_batch.brand_id and is_active
        and upper(sku)=upper(staged.normalized_payload->>'product_code')
      limit 1;
      if target_id is null then
        raise exception 'Unknown product code at line %', staged.line_number using errcode='23503';
      end if;
      quantity_value:=(staged.normalized_payload->>'quantity')::integer;
      amount_value:=(staged.normalized_payload->>'total_ht')::numeric;
      select public.create_order(
        relation_id,
        jsonb_build_object(
          'external_order_id',staged.normalized_payload->>'external_order_id',
          'order_date',staged.normalized_payload->>'order_date',
          'order_status',staged.normalized_payload->>'status',
          'source','import',
          'currency_code',staged.normalized_payload->>'currency',
          'import_batch_id',target_batch_id
        ),
        jsonb_build_array(jsonb_build_object(
          'product_id',target_id,
          'quantity',quantity_value,
          'unit_price_ht',round(amount_value/quantity_value,4),
          'tax_rate',product_tax_rate
        ))
      ) into target_id;
      if nullif(staged.normalized_payload->>'salesperson_email','') is not null then
        select id into import_user_id from public.users
        where lower(email)=lower(staged.normalized_payload->>'salesperson_email') limit 1;
        update public.orders set source_user_id=import_user_id
        where id=target_id and import_user_id is not null;
      end if;
      insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
      values(target_batch_id,staged.id,target_batch.brand_id,'orders',target_id,'created',staged.normalized_payload);
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='territories' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into existing_id from public.territories
      where brand_id=target_batch.brand_id
        and upper(code)=upper(staged.normalized_payload->>'territory_code')
        and archived_at is null limit 1;
      if existing_id is not null and target_batch.import_mode='create_only' then
        update public.import_rows set status='skipped',is_duplicate=true where id=staged.id;
        skipped_count:=skipped_count+1;
        continue;
      end if;
      if existing_id is null then
        import_user_id:=null;
        if nullif(staged.normalized_payload->>'manager_email','') is not null then
          select id into import_user_id from public.users
          where lower(email)=lower(staged.normalized_payload->>'manager_email') limit 1;
        end if;
        insert into public.territories(organization_id,brand_id,name,code,country_code,territory_type,region_code)
        values(target_batch.organization_id,target_batch.brand_id,staged.normalized_payload->>'territory_name',
          staged.normalized_payload->>'territory_code',coalesce(staged.normalized_payload->>'country','FR'),
          'custom',nullif(staged.normalized_payload->>'department_or_region',''))
        returning id into target_id;
        update public.territories set manager_user_id=import_user_id where id=target_id and import_user_id is not null;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'territories',target_id,'created',staged.normalized_payload);
      else
        import_user_id:=null;
        if nullif(staged.normalized_payload->>'manager_email','') is not null then
          select id into import_user_id from public.users
          where lower(email)=lower(staged.normalized_payload->>'manager_email') limit 1;
        end if;
        update public.territories set
          name=coalesce(nullif(staged.normalized_payload->>'territory_name',''),name),
          region_code=coalesce(nullif(staged.normalized_payload->>'department_or_region',''),region_code),
          manager_user_id=coalesce(import_user_id,manager_user_id)
        where id=existing_id;
        target_id:=existing_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  elsif target_batch.entity_type::text='users' then
    for staged in select * from public.import_rows
      where batch_id=target_batch_id and is_valid order by line_number
    loop
      select id into import_user_id from public.users where lower(email)=lower(staged.normalized_payload->>'email') limit 1;
      if import_user_id is null then
        raise exception 'User % must be invited before transactional execution', staged.normalized_payload->>'email' using errcode='23514';
      end if;
      select id into import_role_id from public.roles
      where key=staged.normalized_payload->>'role'
        and key in ('brand_admin','brand_user','agent','facilitator');
      if import_role_id is null then raise exception 'Role import forbidden' using errcode='42501'; end if;
      target_territory_id:=null;
      if nullif(staged.normalized_payload->>'territory_code','') is not null then
        select id into target_territory_id from public.territories
        where brand_id=target_batch.brand_id
          and upper(code)=upper(staged.normalized_payload->>'territory_code')
          and archived_at is null limit 1;
        if target_territory_id is null then
          raise exception 'Unknown territory code at line %', staged.line_number using errcode='23503';
        end if;
      end if;
      select id into existing_id from public.memberships
      where user_id=import_user_id and brand_id=target_batch.brand_id and role_id=import_role_id limit 1;
      if existing_id is null then
        insert into public.memberships(user_id,organization_id,brand_id,role_id,status,invited_by,territory_id)
        values(import_user_id,target_batch.organization_id,target_batch.brand_id,import_role_id,
          'invited'::public.membership_status,
          (select auth.uid()),target_territory_id)
        returning id into target_id;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'memberships',target_id,'created',staged.normalized_payload);
      else
        update public.memberships set
          territory_id=coalesce(target_territory_id,territory_id)
        where id=existing_id;
        target_id:=existing_id;
      end if;
      update public.import_rows set status='processed',processed_entity_id=target_id where id=staged.id;
      processed_count:=processed_count+1;
    end loop;
  else
    raise exception 'Unsupported import type' using errcode='22023';
  end if;

  update public.import_batches set
    status='confirmed',
    lifecycle_status=case when warning_rows>0 or skipped_count>0 then 'completed_with_warnings' else 'completed' end,
    executed_at=now(),
    rollback_status=case when exists(select 1 from public.import_mutations where import_batch_id=target_batch_id and mutation_kind='created')
      then 'rollback_available' else 'rollback_blocked' end
  where id=target_batch_id;
  update public.brand_onboarding_sessions
  set step_statuses=jsonb_set(step_statuses,array[target_batch.entity_type::text],'"completed"'::jsonb,true),
      current_step=case target_batch.entity_type::text
        when 'products' then 'pharmacies'
        when 'pharmacies' then 'territories'
        when 'territories' then 'users'
        when 'users' then 'orders'
        else 'verification'
      end
  where brand_id=target_batch.brand_id;
  insert into public.onboarding_audit_logs(organization_id,brand_id,import_batch_id,actor_user_id,event_name,metadata)
  values(target_batch.organization_id,target_batch.brand_id,target_batch.id,(select auth.uid()),'import_executed',
    jsonb_build_object('processed',processed_count,'skipped',skipped_count,'type',target_batch.entity_type::text));
  insert into public.onboarding_audit_logs(organization_id,brand_id,import_batch_id,actor_user_id,event_name,metadata)
  values(target_batch.organization_id,target_batch.brand_id,target_batch.id,(select auth.uid()),'onboarding_step_completed',
    jsonb_build_object('step',target_batch.entity_type::text));
  return query select processed_count,skipped_count;
end;
$$;
