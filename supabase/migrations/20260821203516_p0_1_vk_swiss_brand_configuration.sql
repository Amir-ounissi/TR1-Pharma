alter table public.brands
  add column if not exists commercial_email text,
  add column if not exists order_email text,
  add column if not exists phone text,
  add column if not exists address_line_1 text,
  add column if not exists postal_code text,
  add column if not exists city text;

alter table public.brands
  drop constraint if exists brands_commercial_email_check,
  drop constraint if exists brands_order_email_check,
  add constraint brands_commercial_email_check check (
    commercial_email is null or commercial_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  add constraint brands_order_email_check check (
    order_email is null or order_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

alter table public.products
  add column if not exists tax_rate numeric(5,2),
  add column if not exists units_per_case integer,
  add column if not exists minimum_order_quantity integer;

alter table public.products
  drop constraint if exists products_tax_rate_check,
  drop constraint if exists products_units_per_case_check,
  drop constraint if exists products_minimum_order_quantity_check,
  add constraint products_tax_rate_check check (tax_rate is null or tax_rate between 0 and 100),
  add constraint products_units_per_case_check check (units_per_case is null or units_per_case >= 1),
  add constraint products_minimum_order_quantity_check check (minimum_order_quantity is null or minimum_order_quantity >= 1);

create or replace function public.create_brand_onboarding(
  organization_data jsonb,
  brand_data jsonb
)
returns table (organization_id uuid, brand_id uuid, onboarding_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  created_organization_id uuid;
  created_brand_id uuid;
  created_onboarding_id uuid;
  organization_slug text;
  brand_slug text;
  platform_organization_id uuid;
begin
  if not private.has_global_role(array['super_admin']) then
    raise exception 'Onboarding creation forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(organization_data ->> 'legal_name',''))) < 2
    or char_length(btrim(coalesce(brand_data ->> 'name',''))) < 2 then
    raise exception 'Organization and brand names are required' using errcode = '22023';
  end if;

  organization_slug := private.slugify_onboarding(coalesce(organization_data ->> 'trade_name', organization_data ->> 'legal_name'));
  brand_slug := coalesce(
    nullif(private.slugify_onboarding(brand_data ->> 'slug'), ''),
    private.slugify_onboarding(brand_data ->> 'name')
  );
  if organization_slug = '' or brand_slug = '' then
    raise exception 'Invalid slug source' using errcode = '22023';
  end if;
  select id into platform_organization_id from public.organizations where is_platform_owner;

  insert into public.organizations(
    name, legal_name, trade_name, slug, country_code, currency_code, timezone,
    locale, status, external_id, created_by
  ) values (
    coalesce(nullif(organization_data ->> 'trade_name',''), organization_data ->> 'legal_name'),
    organization_data ->> 'legal_name', nullif(organization_data ->> 'trade_name',''),
    organization_slug, upper(coalesce(nullif(organization_data ->> 'country_code',''),'FR')),
    upper(coalesce(nullif(organization_data ->> 'currency_code',''),'EUR')),
    coalesce(nullif(organization_data ->> 'timezone',''),'Europe/Paris'),
    coalesce(nullif(organization_data ->> 'locale',''),'fr-FR'), 'draft',
    nullif(organization_data ->> 'external_id',''), (select auth.uid())
  ) returning id into created_organization_id;

  insert into public.brands(
    organization_id, managed_by_organization_id, name, slug, code, country_code,
    currency_code, status, is_active, logo_path, accent_color, short_description,
    launch_date, created_by
  ) values (
    created_organization_id, platform_organization_id, brand_data ->> 'name', brand_slug,
    upper(coalesce(nullif(brand_data ->> 'code',''), replace(brand_slug,'-','_'))),
    upper(coalesce(nullif(brand_data ->> 'country_code',''), organization_data ->> 'country_code','FR')),
    upper(coalesce(nullif(brand_data ->> 'currency_code',''), organization_data ->> 'currency_code','EUR')),
    'draft', false, nullif(brand_data ->> 'logo_path',''), nullif(brand_data ->> 'accent_color',''),
    nullif(brand_data ->> 'short_description',''), nullif(brand_data ->> 'launch_date','')::date,
    (select auth.uid())
  ) returning id into created_brand_id;

  update public.brand_settings bs set
    currency_code = upper(coalesce(nullif(brand_data ->> 'currency_code',''), organization_data ->> 'currency_code','EUR')),
    timezone = coalesce(nullif(organization_data ->> 'timezone',''),'Europe/Paris')
  where bs.brand_id = created_brand_id;

  insert into public.brand_onboarding_sessions(organization_id, brand_id, created_by)
  values (created_organization_id, created_brand_id, (select auth.uid()))
  returning id into created_onboarding_id;

  insert into public.onboarding_audit_logs(organization_id, brand_id, actor_user_id, event_name)
  values (created_organization_id, created_brand_id, (select auth.uid()), 'onboarding_started');

  return query select created_organization_id, created_brand_id, created_onboarding_id;
end;
$$;

create or replace function public.update_onboarding_settings(
  target_brand_id uuid,
  settings_data jsonb
)
returns public.brand_settings
language plpgsql security invoker set search_path = '' as $$
declare
  updated_settings public.brand_settings;
  requested_slug text;
begin
  if not private.has_brand_role(target_brand_id, array['tr1_manager','brand_admin']) then
    raise exception 'Settings update forbidden' using errcode = '42501';
  end if;

  requested_slug := nullif(private.slugify_onboarding(settings_data ->> 'slug'), '');

  update public.brands
  set
    name = coalesce(nullif(settings_data ->> 'name', ''), name),
    slug = coalesce(requested_slug, slug),
    code = upper(coalesce(nullif(settings_data ->> 'code', ''), code)),
    logo_path = coalesce(nullif(settings_data ->> 'logo_path', ''), logo_path),
    country_code = upper(coalesce(nullif(settings_data ->> 'country_code', ''), country_code)),
    currency_code = upper(coalesce(nullif(settings_data ->> 'currency_code', ''), currency_code)),
    commercial_email = nullif(settings_data ->> 'commercial_email', ''),
    order_email = nullif(settings_data ->> 'order_email', ''),
    phone = nullif(settings_data ->> 'phone', ''),
    address_line_1 = nullif(settings_data ->> 'address_line_1', ''),
    postal_code = nullif(settings_data ->> 'postal_code', ''),
    city = nullif(settings_data ->> 'city', ''),
    short_description = coalesce(nullif(settings_data ->> 'short_description', ''), short_description)
  where id = target_brand_id;

  update public.brand_settings set
    default_reorder_interval_days = coalesce((settings_data ->> 'default_reorder_interval_days')::integer, default_reorder_interval_days),
    first_reorder_target_days = coalesce((settings_data ->> 'first_reorder_target_days')::integer, first_reorder_target_days),
    reorder_due_soon_days = coalesce((settings_data ->> 'reorder_due_soon_days')::integer, reorder_due_soon_days),
    at_risk_multiplier = coalesce((settings_data ->> 'at_risk_multiplier')::numeric, at_risk_multiplier),
    dormant_multiplier = coalesce((settings_data ->> 'dormant_multiplier')::numeric, dormant_multiplier),
    reorder_eligibility_days = coalesce((settings_data ->> 'reorder_eligibility_days')::integer, reorder_eligibility_days),
    post_mission_followup_days = coalesce((settings_data ->> 'post_mission_followup_days')::integer, post_mission_followup_days),
    currency_code = upper(coalesce(nullif(settings_data ->> 'currency_code',''), currency_code)),
    timezone = coalesce(nullif(settings_data ->> 'timezone',''), timezone)
  where brand_id = target_brand_id
  returning * into updated_settings;

  update public.brand_onboarding_sessions
  set step_statuses = jsonb_set(step_statuses, '{settings}', '"completed"'), current_step = 'products'
  where brand_id = target_brand_id;

  insert into public.onboarding_audit_logs(organization_id,brand_id,actor_user_id,event_name,metadata)
  select organization_id,target_brand_id,(select auth.uid()),'onboarding_step_completed',
    jsonb_build_object('step','settings')
  from public.brands where id=target_brand_id;

  return updated_settings;
end;
$$;

grant execute on function private.slugify_onboarding(text) to authenticated, service_role;

create or replace function public.execute_onboarding_import(target_batch_id uuid)
returns table (processed integer, skipped integer)
language plpgsql security definer set search_path = '' as $$
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
          case
            when coalesce((staged.normalized_payload->>'active')::boolean,false)
              then 'active'::public.membership_status
            else 'invited'::public.membership_status
          end,
          (select auth.uid()),target_territory_id)
        returning id into target_id;
        insert into public.import_mutations(import_batch_id,import_row_id,brand_id,target_table,target_id,mutation_kind,after_data)
        values(target_batch_id,staged.id,target_batch.brand_id,'memberships',target_id,'created',staged.normalized_payload);
      else
        update public.memberships set
          status=case
            when coalesce((staged.normalized_payload->>'active')::boolean,false)
              then 'active'::public.membership_status
            else status
          end,
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
exception when others then
  update public.import_batches set lifecycle_status='failed',rollback_status='unavailable'
  where id=target_batch_id;
  raise;
end;
$$;

insert into public.import_templates(import_type, columns, csv_header, documentation)
values (
  'products',
  '["sku","ean","name","description","category","product_family","format","wholesale_price_ht","retail_price_ttc","tax_rate","units_per_case","minimum_order_quantity","strategic_priority","counts_for_distribution","is_active"]'::jsonb,
  'sku;ean;name;description;category;product_family;format;wholesale_price_ht;retail_price_ttc;tax_rate;units_per_case;minimum_order_quantity;strategic_priority;counts_for_distribution;is_active',
  'sku, name et is_active obligatoires. strategic_priority accepte standard, priority ou strategic. tax_rate doit rester entre 0 et 100.'
)
on conflict (import_type) do update set
  columns = excluded.columns,
  csv_header = excluded.csv_header,
  documentation = excluded.documentation,
  version = public.import_templates.version + 1;
