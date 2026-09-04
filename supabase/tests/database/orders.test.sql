begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create temp table _tr1_order_workflow_helper_anchor(id integer);

create or replace function pg_temp.tr1_advance_order_to(
  target_order_id uuid,
  desired_status public.order_status,
  transition_reason text default null
)
returns void
language plpgsql
as $$
declare
  current_status public.order_status;
  clean_reason text := coalesce(nullif(btrim(transition_reason), ''), 'Test workflow transition');
begin
  loop
    select order_status
    into current_status
    from public.orders
    where id = target_order_id;

    if current_status is null then
      raise exception 'Test order unavailable';
    end if;

    exit when current_status = desired_status;

    if desired_status = 'cancelled' then
      perform public.change_order_status(target_order_id, 'cancelled', clean_reason);
    elsif current_status = 'draft' then
      if desired_status in ('pending','needs_correction','rejected') then
        perform public.change_order_status(target_order_id, 'pending', null);
      else
        perform public.change_order_status(target_order_id, 'confirmed', null);
      end if;
    elsif current_status = 'pending' then
      if desired_status = 'needs_correction' then
        perform public.change_order_status(target_order_id, 'needs_correction', clean_reason);
      elsif desired_status = 'rejected' then
        perform public.change_order_status(target_order_id, 'rejected', clean_reason);
      else
        perform public.change_order_status(target_order_id, 'confirmed', null);
      end if;
    elsif current_status = 'needs_correction' then
      perform public.change_order_status(target_order_id, 'pending', null);
    elsif current_status = 'confirmed' then
      perform public.change_order_status(target_order_id, 'invoiced', null);
    elsif current_status = 'invoiced' then
      if desired_status = 'partially_delivered' then
        perform public.change_order_status(target_order_id, 'partially_delivered', null);
      elsif desired_status = 'delivered' then
        perform public.change_order_status(target_order_id, 'delivered', null);
      elsif desired_status = 'refunded' then
        perform public.change_order_status(target_order_id, 'refunded', null);
      else
        raise exception 'Unsupported test transition from invoiced to %', desired_status;
      end if;
    elsif current_status = 'partially_delivered' then
      if desired_status = 'delivered' then
        perform public.change_order_status(target_order_id, 'delivered', null);
      elsif desired_status = 'refunded' then
        perform public.change_order_status(target_order_id, 'refunded', null);
      else
        raise exception 'Unsupported test transition from partially_delivered to %', desired_status;
      end if;
    else
      raise exception 'Unsupported test transition from % to %', current_status, desired_status;
    end if;
  end loop;
end;
$$;

create or replace function pg_temp.tr1_create_order_at_status(
  target_brand_pharmacy_id uuid,
  order_payload jsonb,
  item_payload jsonb
)
returns uuid
language plpgsql
as $$
declare
  desired_status public.order_status :=
    coalesce((order_payload ->> 'order_status')::public.order_status, 'draft');
  entry_status public.order_status;
  entry_payload jsonb;
  created_order_id uuid;
begin
  entry_status := case
    when desired_status in ('invoiced','partially_delivered','delivered','refunded')
      then 'confirmed'::public.order_status
    when desired_status in ('pending','needs_correction','rejected','cancelled')
      then 'draft'::public.order_status
    else desired_status
  end;

  entry_payload := jsonb_set(
    order_payload,
    '{order_status}',
    to_jsonb(entry_status::text),
    true
  );

  created_order_id := public.create_order(
    target_brand_pharmacy_id,
    entry_payload,
    item_payload
  );

  if desired_status <> entry_status then
    perform pg_temp.tr1_advance_order_to(
      created_order_id,
      desired_status,
      order_payload ->> 'cancellation_reason'
    );
  end if;

  return created_order_id;
end;
$$;


insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','orders-suspended@test.local','',now(),'{}','{}',now(),now(),'','','','');
insert into public.memberships (user_id, organization_id, brand_id, role_id, status)
values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',(select id from public.roles where key='agent'),'suspended');

insert into public.products (id, brand_id, name, sku, wholesale_price_ht, strategic_priority) values
  ('00000000-0000-0000-0000-000000000603','00000000-0000-0000-0000-000000000101','Produit stratégique','S4-STRAT',20,'strategic'),
  ('00000000-0000-0000-0000-000000000604','00000000-0000-0000-0000-000000000101','Produit complémentaire','S4-COMP',12,'standard');
insert into public.pharmacies (id, legal_name, trade_name, siret, postal_code, city) values
  ('00000000-0000-0000-0000-00000000d407','Pharmacie Watch','Pharmacie Watch','12345678900077','75013','Paris'),
  ('00000000-0000-0000-0000-00000000d408','Pharmacie Risque','Pharmacie Risque','12345678900085','75014','Paris'),
  ('00000000-0000-0000-0000-00000000d409','Pharmacie Dormante','Pharmacie Dormante','12345678900093','75015','Paris'),
  ('00000000-0000-0000-0000-00000000d410','Pharmacie Perdue','Pharmacie Perdue','12345678900101','75016','Paris');
insert into public.brand_pharmacies (id, brand_id, pharmacy_id, source) values
  ('00000000-0000-0000-0000-00000000d416','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-00000000d407','brand_existing_client'),
  ('00000000-0000-0000-0000-00000000d417','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-00000000d408','brand_existing_client'),
  ('00000000-0000-0000-0000-00000000d418','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-00000000d409','brand_existing_client'),
  ('00000000-0000-0000-0000-00000000d419','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-00000000d410','brand_existing_client');
insert into public.brand_pharmacy_products (brand_pharmacy_id, product_id, status, source)
values ('00000000-0000-0000-0000-000000000412','00000000-0000-0000-0000-000000000604','planned','other');

create or replace function pg_temp.tr1_update_order_item_quantity_count(
  target_order_id uuid,
  target_quantity integer
)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  update public.order_items
  set quantity = target_quantity
  where order_id = target_order_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function pg_temp.tr1_update_order_item_fields_count(
  target_order_id uuid,
  target_product_id uuid,
  target_unit_price_ht numeric,
  target_tax_rate numeric
)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  update public.order_items
  set product_id = target_product_id,
      unit_price_ht = target_unit_price_ht,
      tax_rate = target_tax_rate
  where order_id = target_order_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

select plan(71);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);

select lives_ok($$select pg_temp.tr1_create_order_at_status(
  '00000000-0000-0000-0000-000000000412',
  '{"external_order_id":"S4-001","order_number":"CMD-001","order_type":"initial","order_status":"invoiced","order_date":"2026-07-11T10:00:00Z"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":2,"free_quantity":1,"unit_price_ht":10,"discount_rate":10,"tax_rate":20}]'
)$$,'first invoiced order is created transactionally');
select is((select subtotal_ht from public.orders where external_order_id='S4-001'),20.00::numeric,'subtotal is recalculated by SQL');
select is((select net_amount_ht from public.orders where external_order_id='S4-001'),18.00::numeric,'discounted net amount is recalculated by SQL');
select is((select total_ttc from public.orders where external_order_id='S4-001'),18.99::numeric,'catalog product tax and total are recalculated by SQL');
select is((select tax_rate from public.order_items where order_id=(select id from public.orders where external_order_id='S4-001') limit 1),5.5::numeric,'catalog tax wins over client item payload');
select ok((select is_initial_order and not is_reorder from public.orders where external_order_id='S4-001'),'first valid order is classified as initial');
select ok((select implanted_at is not null from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),'first valid order records implantation date');
select is((select commercial_status from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),'implanted'::public.commercial_status,'commercial pipeline advances to implanted');
select is((select activity_status from public.brand_pharmacies where id='00000000-0000-0000-0000-000000000412'),'active'::public.activity_status,'recent valid order activates the account');
select is((select count(*) from public.brand_pharmacy_activity_history where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and new_activity_status='active'),1::bigint,'activity transition is historized');
select ok((select total_ordered_quantity=3 and valid_order_count=1 from public.brand_pharmacy_products where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and product_id='00000000-0000-0000-0000-000000000601'),'ordered and free quantities update implanted product metrics');
select is((select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-000000000412' and title='Suivi post-implantation' and status='open'),1::bigint,'post implantation follow-up is created once');
select is(
  (
    select count(*)
    from public.brand_pharmacy_distribution_snapshots
    where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'
      and snapshot_date='2026-07-11'::date
      and source='order'
  ),
  1::bigint,
  'valid order creates one order-dated distribution snapshot'
);
select is((select distribution_rate from public.brand_pharmacy_distribution where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),33.33::numeric,'planned product is excluded from pharmacy distribution');
select is((select strategic_distribution_rate from public.brand_pharmacy_distribution where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),50.00::numeric,'first strategic product yields partial strategic distribution');

select lives_ok($$select pg_temp.tr1_create_order_at_status(
  '00000000-0000-0000-0000-000000000412',
  '{"external_order_id":"S4-002","order_type":"other","order_status":"delivered","order_date":"2026-07-20T10:00:00Z"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000603","quantity":1,"unit_price_ht":20,"tax_rate":20}]'
)$$,'second valid order is created');
select ok((select is_reorder and not is_initial_order from public.orders where external_order_id='S4-002'),'second valid order is classified as reorder');
select is((select order_type from public.orders where external_order_id='S4-002'),'reorder'::public.order_type,'generic second order receives reorder type');
select is((select valid_order_count from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),2,'aggregate counts valid orders');
select is((select reorder_count from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),1,'aggregate counts reorders');
select is((select total_revenue_net_ht from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),38.00::numeric,'aggregate sums recognized revenue');
select ok((select expected_next_order_at is not null from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),'next reorder date is estimated');
select is((select first_reorder_at from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),'2026-07-20 10:00:00+00'::timestamptz,'first reorder date is retained');
select is((select distribution_rate from public.brand_pharmacy_distribution where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),66.67::numeric,'distribution includes ordered strategic product');
select is((select strategic_distribution_rate from public.brand_pharmacy_distribution where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),100.00::numeric,'strategic distribution is correct');
select is(
  (
    select count(*)
    from public.brand_pharmacy_distribution_snapshots
    where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'
      and snapshot_date='2026-07-20'::date
      and source='order'
  ),
  1::bigint,
  'second valid order creates one snapshot for its order date'
);

select throws_ok($$select public.create_order('00000000-0000-0000-0000-000000000412','{"external_order_id":"S4-002"}','[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]')$$,'23505',null,'duplicate external order id is blocked');
select throws_ok($$select public.create_order('00000000-0000-0000-0000-000000000412','{"order_type":"initial","order_date":"2026-07-21T10:00:00Z"}','[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]')$$,'23514','An initial order already exists for this brand pharmacy','initial type cannot be declared after a valid order');
select throws_ok($$select public.create_order('00000000-0000-0000-0000-000000000412','{}','[{"product_id":"00000000-0000-0000-0000-000000000602","quantity":1,"unit_price_ht":10}]')$$,'23514','Order item product is unavailable for this brand','cross-brand product is blocked');
select throws_ok($$select public.create_order('00000000-0000-0000-0000-000000000413','{}','[{"product_id":"00000000-0000-0000-0000-000000000602","quantity":1,"unit_price_ht":10}]')$$,'42501','Brand pharmacy unavailable','cross-brand pharmacy is blocked');
select throws_ok($$update public.orders set net_amount_ht=999 where external_order_id='S4-001'$$,'42501','Order totals are server controlled','client cannot alter server totals');
select is(
  pg_temp.tr1_update_order_item_quantity_count(
    (select id from public.orders where external_order_id='S4-001'),
    99
  ),
  0::bigint,
  'invoiced order items are immutable'
);

select lives_ok($$select public.change_order_status((select id from public.orders where external_order_id='S4-002'),'refunded','Remboursement intégral')$$,'reorder can be refunded explicitly');
select is((select valid_order_count from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),1,'refunded order is excluded from activity count');
select is((select total_revenue_net_ht from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),18.00::numeric,'refunded order is excluded from revenue');
select lives_ok($$select pg_temp.tr1_create_order_at_status(
  '00000000-0000-0000-0000-000000000412','{"external_order_id":"S4-CREDIT","order_type":"credit_note","order_status":"invoiced","order_date":"2026-07-21T12:00:00Z"}',
  '[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":5,"tax_rate":20}]'
)$$,'credit note is created as an explicit negative order');
select is((select net_amount_ht from public.orders where external_order_id='S4-CREDIT'),-5.00::numeric,'credit note amount is negative and controlled');
select is((select valid_order_count from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),1,'credit note does not create activity');
select is((select total_revenue_net_ht from public.brand_pharmacy_order_performance where brand_pharmacy_id='00000000-0000-0000-0000-000000000412'),18.00::numeric,'credit note is excluded from recognized revenue');

select pg_temp.tr1_create_order_at_status('00000000-0000-0000-0000-00000000d416',jsonb_build_object('external_order_id','S4-WATCH','order_status','invoiced','order_date',current_date - 65),'[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]');
select is((select activity_status from public.brand_pharmacies where id='00000000-0000-0000-0000-00000000d416'),'watch'::public.activity_status,'65-day account is watch with default thresholds');
select is((select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-00000000d416' and title='Activité watch — action de suivi'),1::bigint,'watch creates one stock control task');
select pg_temp.tr1_create_order_at_status('00000000-0000-0000-0000-00000000d417',jsonb_build_object('external_order_id','S4-RISK','order_status','invoiced','order_date',current_date - 80),'[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]');
select is((select activity_status from public.brand_pharmacies where id='00000000-0000-0000-0000-00000000d417'),'at_risk'::public.activity_status,'80-day account is at risk');
select ok((select priority='high' from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-00000000d417' and title='Activité at_risk — action de suivi'),'at-risk account creates a high-priority task');
select pg_temp.tr1_create_order_at_status('00000000-0000-0000-0000-00000000d418',jsonb_build_object('external_order_id','S4-DORMANT','order_status','invoiced','order_date',current_date - 100),'[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]');
select is((select activity_status from public.brand_pharmacies where id='00000000-0000-0000-0000-00000000d418'),'dormant'::public.activity_status,'100-day account is dormant');
select ok((select priority='urgent' from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-00000000d418' and title='Activité dormant — action de suivi'),'dormant account creates an urgent reactivation task');
select is(
  public.recalculate_brand_activity('00000000-0000-0000-0000-000000000101'),
  (select count(*)::integer from public.brand_pharmacies where brand_id = '00000000-0000-0000-0000-000000000101' and archived_at is null),
  'brand activity recalculation processes every active relation'
);
select is((select count(*) from public.brand_pharmacy_activity_history where brand_pharmacy_id='00000000-0000-0000-0000-00000000d418' and new_activity_status='dormant'),1::bigint,'idempotent recalculation does not duplicate history');

select lives_ok($$select public.change_activity_status('00000000-0000-0000-0000-00000000d419','lost','Compte perdu confirmé')$$,'lost status is set manually with a reason');
select pg_temp.tr1_create_order_at_status('00000000-0000-0000-0000-00000000d419','{"external_order_id":"S4-LOST","order_status":"invoiced","order_date":"2026-07-21T10:00:00Z"}','[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]');
select is((select activity_status from public.brand_pharmacies where id='00000000-0000-0000-0000-00000000d419'),'lost'::public.activity_status,'manual lost status remains prioritary after an order');
select pg_temp.tr1_create_order_at_status('00000000-0000-0000-0000-00000000d418','{"external_order_id":"S4-REACTIVATE","order_status":"invoiced","order_date":"2026-07-21T11:00:00Z"}','[{"product_id":"00000000-0000-0000-0000-000000000603","quantity":1,"unit_price_ht":20}]');
select is((select activity_status from public.brand_pharmacies where id='00000000-0000-0000-0000-00000000d418'),'active'::public.activity_status,'new valid order reactivates a dormant account');
select is((select count(*) from public.brand_pharmacy_activity_history where brand_pharmacy_id='00000000-0000-0000-0000-00000000d418' and previous_activity_status='dormant' and new_activity_status='active'),1::bigint,'dormant reactivation is historized');
select is((select count(*) from public.tasks where brand_pharmacy_id='00000000-0000-0000-0000-00000000d418' and title='Activité dormant — action de suivi' and status='completed'),1::bigint,'reactivation closes the explicit dormant follow-up');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}',true);
select lives_ok($$select public.create_order('00000000-0000-0000-0000-000000000411','{"external_order_id":"S4-AGENT","source":"agent"}','[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":18.5}]')$$,'assigned agent creates a draft order for its pharmacy');
select lives_ok($$select public.create_order('00000000-0000-0000-0000-000000000411','{"external_order_id":"S4-AGENT-CONF","source":"agent","order_status":"pending"}','[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":18.5}]')$$,'assigned agent can submit an order for brand review');
select throws_ok($$select public.create_order('00000000-0000-0000-0000-000000000411','{"external_order_id":"S4-AGENT-INVOICED","source":"agent","order_status":"invoiced"}','[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":18.5}]')$$,'42501','Agent orders must be draft or pending brand review','agent cannot create invoiced revenue');
select throws_ok($$select public.change_order_status((select id from public.orders where external_order_id='S4-AGENT-CONF'),'delivered','')$$,'42501','Invalid order status transition','agent cannot mark a pending order delivered');
select is((select count(*) from public.orders where external_order_id='S4-AGENT'),1::bigint,'agent reads its own pharmacy order');
select is((select count(*) from public.orders where external_order_id='S4-001'),0::bigint,'direct URL order outside agent scope is invisible');
select throws_ok($$select public.create_order('00000000-0000-0000-0000-000000000412','{}','[{"product_id":"00000000-0000-0000-0000-000000000601","quantity":1,"unit_price_ht":10}]')$$,'42501','Brand pharmacy unavailable','agent cannot create for an unassigned pharmacy');

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}',true);
select is((select count(*) from public.orders),0::bigint,'suspended membership reads no order');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select lives_ok($$select pg_temp.tr1_advance_order_to((select id from public.orders where external_order_id='S4-AGENT-CONF'),'invoiced',null)$$,'manager can review and record invoiced revenue');
select is((select count(*) from public.orders where brand_id='00000000-0000-0000-0000-000000000102'),0::bigint,'brand admin reads no cross-brand order');

select count(*) as orders_before_preview from public.orders \gset
insert into public.import_batches (id,brand_id,entity_type,strategy,file_name,valid_rows,created_by)
values ('00000000-0000-0000-0000-000000000a04','00000000-0000-0000-0000-000000000101','orders','create_only','orders.csv',1,'00000000-0000-0000-0000-0000000000a2');
insert into public.import_rows (batch_id,line_number,payload,normalized_payload,is_valid) values (
  '00000000-0000-0000-0000-000000000a04',2,'{}',
  '{"brand_pharmacy_id":"00000000-0000-0000-0000-000000000412","external_order_id":"S4-IMPORT","order_status":"invoiced","order_date":"2026-07-21T12:00:00Z","items":[{"product_id":"00000000-0000-0000-0000-000000000604","quantity":1,"unit_price_ht":12}]}',true
);
select is((select count(*) from public.orders),:'orders_before_preview'::bigint,'order import preview writes no business order');
select is((public.confirm_order_import('00000000-0000-0000-0000-000000000a04')->>'created')::integer,1,'valid order import confirms one order');
select is((select count(*) from public.orders where external_order_id='S4-IMPORT'),1::bigint,'confirmed import creates the order');

insert into public.import_batches (id,brand_id,entity_type,strategy,file_name,valid_rows,created_by)
values ('00000000-0000-0000-0000-000000000a05','00000000-0000-0000-0000-000000000101','orders','create_only','duplicate.csv',2,'00000000-0000-0000-0000-0000000000a2');
insert into public.import_rows (batch_id,line_number,payload,normalized_payload,is_valid) values
  ('00000000-0000-0000-0000-000000000a05',2,'{}','{"brand_pharmacy_id":"00000000-0000-0000-0000-000000000412","external_order_id":"S4-IMPORT","items":[{"product_id":"00000000-0000-0000-0000-000000000604","quantity":1,"unit_price_ht":12}]}',true),
  ('00000000-0000-0000-0000-000000000a05',3,'{}','{"brand_pharmacy_id":"00000000-0000-0000-0000-000000000412","external_order_id":"S4-UNKNOWN","items":[{"product_id":"00000000-0000-0000-0000-999999999999","quantity":1,"unit_price_ht":12}]}',true);
select is((public.confirm_order_import('00000000-0000-0000-0000-000000000a05')->>'failed')::integer,2,'duplicate and unknown product import rows fail in isolation');
select is((select count(*) from public.import_rows where batch_id='00000000-0000-0000-0000-000000000a05' and cardinality(errors)>0),2::bigint,'import failures retain an error report per row');
select ok((select relrowsecurity from pg_class where oid='public.brand_pharmacy_activity_history'::regclass),'activity history has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.brand_pharmacy_distribution_snapshots'::regclass),'distribution snapshots have RLS enabled');
select ok((select 'security_invoker=true'=any(reloptions) from pg_class where relname='brand_pharmacy_order_performance'),'performance view is a security invoker');
select has_index('public','orders','orders_relation_date_idx','relation and order date index exists');

select * from finish();
rollback;
