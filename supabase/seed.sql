insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'superadmin@tr1.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sophie Martin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'admin@dermavita.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lucas Bernard"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'agent@dermavita.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nora Petit"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', 'admin@nutrilab.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Hugo Robert"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'animatrice@dermavita.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Emma Laurent"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', 'autre-animatrice@dermavita.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Léa Moreau"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', 'agent.sud@dermavita.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Camille Roussel"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a8', 'authenticated', 'authenticated', 'agent.ouest@dermavita.local', extensions.crypt('DemoTR1!2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Julien Morel"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'superadmin@tr1.local', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"superadmin@tr1.local"}', 'email', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'admin@dermavita.local', '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"admin@dermavita.local"}', 'email', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3', 'agent@dermavita.local', '{"sub":"00000000-0000-0000-0000-0000000000a3","email":"agent@dermavita.local"}', 'email', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'admin@nutrilab.local', '{"sub":"00000000-0000-0000-0000-0000000000a4","email":"admin@nutrilab.local"}', 'email', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', 'animatrice@dermavita.local', '{"sub":"00000000-0000-0000-0000-0000000000a5","email":"animatrice@dermavita.local"}', 'email', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a6', 'autre-animatrice@dermavita.local', '{"sub":"00000000-0000-0000-0000-0000000000a6","email":"autre-animatrice@dermavita.local"}', 'email', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a7', 'agent.sud@dermavita.local', '{"sub":"00000000-0000-0000-0000-0000000000a7","email":"agent.sud@dermavita.local"}', 'email', now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a8', 'agent.ouest@dermavita.local', '{"sub":"00000000-0000-0000-0000-0000000000a8","email":"agent.ouest@dermavita.local"}', 'email', now(), now(), now());

update public.user_profiles set onboarding_completed_at = now();

insert into public.organizations (id, name, slug, is_platform_owner) values
  ('00000000-0000-0000-0000-000000000001', 'TR1 Pharma', 'tr1-pharma', true),
  ('00000000-0000-0000-0000-000000000002', 'Laboratoires Dermavita', 'laboratoires-dermavita', false),
  ('00000000-0000-0000-0000-000000000003', 'Laboratoires Nutrilab', 'laboratoires-nutrilab', false);

insert into public.brands (id, organization_id, managed_by_organization_id, name, slug) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Dermavita', 'dermavita'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Nutrilab', 'nutrilab');

insert into public.memberships (user_id, organization_id, brand_id, role_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', null, (select id from public.roles where key = 'super_admin'), 'active'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'brand_admin'), 'active'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'agent'), 'active'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', (select id from public.roles where key = 'brand_admin'), 'active'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'facilitator'), 'active'),
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'facilitator'), 'active'),
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'agent'), 'active'),
  ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', (select id from public.roles where key = 'agent'), 'active');

insert into public.territories (id, organization_id, brand_id, name, code, territory_type, region_code, department_code, postal_codes) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', 'Paris Centre', '75-C', 'postal_area', '11', '75', array['75001','75002','75003','75004','75005']),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', 'Lyon Métropole', '69-M', 'postal_area', '84', '69', array['69001','69002','69003','69006']),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', 'Grand Ouest', '44-O', 'postal_area', '52', '44', array['44000','44100','44200']),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', 'Grand Sud', '13-S', 'postal_area', '93', '13', array['13001','13006','13008']),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', 'Nord', '59-N', 'postal_area', '32', '59', array['59000','59800']),
  ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', 'Est', '67-E', 'postal_area', '44', '67', array['67000','67100']);

insert into public.pharmacy_groups (id, name, group_type, headquarters_city) values
  ('00000000-0000-0000-0000-000000000301', 'Santé Plus', 'national_group', 'Paris'),
  ('00000000-0000-0000-0000-000000000302', 'Pharma Union', 'network', 'Lyon');

insert into public.pharmacies (
  id, legal_name, trade_name, cip_code, finess_code, siret, phone, email,
  address_line_1, postal_code, city, pharmacy_group_id, created_by
) values
  ('00000000-0000-0000-0000-000000000401', 'Pharmacie République SAS', 'Pharmacie République', '7500001', '750100001', '12345678900011', '0142000001', 'contact@pharmacie-republique.test', '10 place de la République', '75003', 'Paris', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000402', 'Pharmacie Monge SELARL', 'Pharmacie Monge', '7500002', '750100002', '12345678900029', '0142000002', 'contact@pharmacie-monge.test', '20 rue Monge', '75005', 'Paris', null, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000403', 'Pharmacie Bellecour SARL', 'Pharmacie Bellecour', '6900001', '690100001', '12345678900037', '0478000001', 'contact@pharmacie-bellecour.test', '5 place Bellecour', '69002', 'Lyon', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-000000000404', 'Pharmacie Canebière SAS', 'Pharmacie Canebière', '1300001', '130100001', '12345678900045', '0491000001', 'contact@pharmacie-canebiere.test', '42 La Canebière', '13001', 'Marseille', null, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000405', 'Pharmacie Graslin SELARL', 'Pharmacie Graslin', '4400001', '440100001', '12345678900052', '0240000001', 'contact@pharmacie-graslin.test', '7 place Graslin', '44000', 'Nantes', null, '00000000-0000-0000-0000-0000000000a8'),
  ('00000000-0000-0000-0000-000000000406', 'Pharmacie Flandres SAS', 'Pharmacie Flandres', '5900001', '590100001', '12345678900060', '0320000001', 'contact@pharmacie-flandres.test', '18 rue Faidherbe', '59000', 'Lille', null, '00000000-0000-0000-0000-0000000000a7'),
  ('00000000-0000-0000-0000-000000000407', 'Pharmacie Quinconces SARL', 'Pharmacie Quinconces', '3300001', '330100001', '12345678900078', '0556000001', 'contact@pharmacie-quinconces.test', '3 cours du 30 juillet', '33000', 'Bordeaux', null, '00000000-0000-0000-0000-0000000000a7'),
  ('00000000-0000-0000-0000-000000000408', 'Pharmacie Kléber SELAS', 'Pharmacie Kléber', '6700001', '670100001', '12345678900086', '0388000001', 'contact@pharmacie-kleber.test', '15 place Kléber', '67000', 'Strasbourg', null, '00000000-0000-0000-0000-0000000000a8'),
  ('00000000-0000-0000-0000-000000000409', 'Pharmacie Capitole SARL', 'Pharmacie Capitole', '3100001', '310100001', '12345678900094', '0561000001', 'contact@pharmacie-capitole.test', '12 place du Capitole', '31000', 'Toulouse', null, '00000000-0000-0000-0000-0000000000a7');

insert into public.pharmacy_contacts (
  id, pharmacy_id, first_name, last_name, job_title, email, phone, is_primary, preferred_contact_channel
) values
  ('00000000-0000-0000-0000-000000000421', '00000000-0000-0000-0000-000000000401', 'Claire', 'Durand', 'Titulaire', 'claire@pharmacie-republique.test', '0142000011', true, 'email'),
  ('00000000-0000-0000-0000-000000000422', '00000000-0000-0000-0000-000000000402', 'Marc', 'Petit', 'Titulaire', 'marc@pharmacie-monge.test', '0142000012', true, 'phone');

insert into public.brand_pharmacies (
  id, brand_id, pharmacy_id, commercial_status, activity_status, priority_level,
  potential_level, source, current_agent_user_id, territory_id, created_by
) values
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000401', 'active', 'active', 'strategic', 'very_high', 'brand_existing_client', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000402', 'targeted', 'never_ordered', 'normal', 'medium', 'tr1_prospecting', null, '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000403', 'implanted', 'watch', 'high', 'high', 'brand_existing_client', null, '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000401', 'qualified', 'never_ordered', 'normal', 'unknown', 'referral', null, null, '00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000404', 'active', 'watch', 'high', 'high', 'brand_existing_client', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000416', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000405', 'targeted', 'never_ordered', 'normal', 'medium', 'tr1_prospecting', '00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000417', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000406', 'implanted', 'at_risk', 'strategic', 'very_high', 'brand_existing_client', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000418', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000407', 'qualified', 'watch', 'normal', 'high', 'referral', '00000000-0000-0000-0000-0000000000a7', null, '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000419', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000408', 'dormant', 'dormant', 'high', 'medium', 'import', '00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000420', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000409', 'pending_order', 'watch', 'high', 'high', 'tr1_prospecting', '00000000-0000-0000-0000-0000000000a8', null, '00000000-0000-0000-0000-0000000000a2');

insert into public.agents (id, user_id, kind, external_code) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-0000000000a3', 'commercial', 'AG-001'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-0000000000a7', 'commercial', 'AG-002'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-0000000000a8', 'commercial', 'AG-003');
insert into public.agent_brand_assignments (brand_id, agent_id) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000501'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000502'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000503');
insert into public.pharmacy_assignments (brand_id, brand_pharmacy_id, user_id, assignment_type, is_primary, assignment_reason, assigned_by) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-0000000000a3', 'commercial_agent', true, 'Portefeuille initial', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-0000000000a7', 'commercial_agent', true, 'Couverture sud', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000416', '00000000-0000-0000-0000-0000000000a8', 'commercial_agent', true, 'Couverture ouest', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000417', '00000000-0000-0000-0000-0000000000a7', 'commercial_agent', true, 'Couverture nord', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000418', '00000000-0000-0000-0000-0000000000a7', 'commercial_agent', true, 'Développement sud-ouest', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000419', '00000000-0000-0000-0000-0000000000a8', 'commercial_agent', true, 'Relance est', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000420', '00000000-0000-0000-0000-0000000000a8', 'commercial_agent', true, 'Ouverture sud-ouest', '00000000-0000-0000-0000-0000000000a2');

insert into public.interactions (id, brand_id, brand_pharmacy_id, pharmacy_contact_id, interaction_type, outcome, occurred_at, subject, notes, created_by, visibility) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000421', 'visit', 'interested', now() - interval '2 days', 'Visite de suivi', 'Présentation des nouveautés.', '00000000-0000-0000-0000-0000000000a3', 'shared'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000415', null, 'visit', 'completed', now() - interval '4 days', 'Tournée Marseille', 'Réassort confirmé sur le point de vente.', '00000000-0000-0000-0000-0000000000a7', 'shared'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000416', null, 'call', 'callback_requested', now() - interval '1 day', 'Prospection Nantes', 'Demande de rappel pour présentation de gamme.', '00000000-0000-0000-0000-0000000000a8', 'shared'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000417', null, 'visit', 'offer_requested', now() - interval '6 days', 'Visite Lille', 'Offre stratégique demandée par le titulaire.', '00000000-0000-0000-0000-0000000000a7', 'shared');
insert into public.tasks (id, brand_id, brand_pharmacy_id, task_type, title, description, priority, due_at, assigned_to, created_by, source) values
  ('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000411', 'follow_up', 'Relancer la titulaire', 'Confirmer la sélection produits.', 'high', now() + interval '2 days', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2', 'manual'),
  ('00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000411', 'visit', 'Visite de suivi Dermavita', 'Présenter la sélection Dermacalm et confirmer le réassort.', 'urgent', date_trunc('day', now()) + interval '4 days 10 hours', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2', 'manual'),
  ('00000000-0000-0000-0000-000000000713', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000415', 'visit', 'Confirmer le linéaire', 'Vérifier la bonne implantation de la gamme dans le point de vente.', 'high', date_trunc('day', now()) + interval '3 days 09 hours', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a2', 'manual'),
  ('00000000-0000-0000-0000-000000000714', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000416', 'call', 'Rappel prospection Nantes', 'Recontacter le titulaire après premier échange.', 'normal', date_trunc('day', now()) + interval '1 days 15 hours', '00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a2', 'manual'),
  ('00000000-0000-0000-0000-000000000715', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000417', 'follow_up', 'Préparer offre Lille', 'Consolider l’offre stratégique demandée.', 'urgent', date_trunc('day', now()) + interval '2 days 11 hours', '00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a2', 'manual');

update public.pharmacies
set latitude = 48.867366,
    longitude = 2.363080,
    geocoding_status = 'manual',
    geocoded_at = now(),
    geocoding_source = 'seed_verified'
where id = '00000000-0000-0000-0000-000000000401';

insert into public.products (id, brand_id, name, description, sku, ean, category, format, wholesale_price_ht, retail_price_ttc, tax_rate, units_per_case, minimum_order_quantity, product_family, strategic_priority, counts_for_distribution) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101', 'Dermacalm', 'Soin dermocosmétique de démonstration', 'DV-DC-50', '3400000000001', 'Dermocosmétique', '50 ml', 18.50, 29.90, 5.50, 6, 2, 'Dermocosmétique', 'strategic', true),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000102', 'NutriBoost', 'Complément alimentaire de démonstration', 'NL-NB-30', '3400000000002', 'Compléments alimentaires', '30 gélules', 14.90, 24.90, 5.50, 12, 3, 'Compléments alimentaires', 'standard', true);

update public.brands
set commercial_email = case id
    when '00000000-0000-0000-0000-000000000101' then 'contact@dermavita.local'
    when '00000000-0000-0000-0000-000000000102' then 'contact@nutrilab.local'
  end,
  order_email = case id
    when '00000000-0000-0000-0000-000000000101' then 'commandes@dermavita.local'
    when '00000000-0000-0000-0000-000000000102' then 'commandes@nutrilab.local'
  end,
  phone = case id
    when '00000000-0000-0000-0000-000000000101' then '+33142000000'
    when '00000000-0000-0000-0000-000000000102' then '+33478000000'
  end,
  address_line_1 = case id
    when '00000000-0000-0000-0000-000000000101' then '12 avenue du Réseau'
    when '00000000-0000-0000-0000-000000000102' then '4 rue de la Nutrition'
  end,
  postal_code = case id
    when '00000000-0000-0000-0000-000000000101' then '75008'
    when '00000000-0000-0000-0000-000000000102' then '69002'
  end,
  city = case id
    when '00000000-0000-0000-0000-000000000101' then 'Paris'
    when '00000000-0000-0000-0000-000000000102' then 'Lyon'
  end
where id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102');

insert into public.product_references (brand_id, product_id, sku, ean, label, unit_price) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000601', 'DV-DC-50', '3400000000001', 'Dermacalm 50 ml', 18.50),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000602', 'NL-NB-30', '3400000000002', 'NutriBoost 30 gélules', 14.90);

insert into public.brand_pharmacy_products (
  brand_pharmacy_id, product_id, status, first_implanted_at, last_confirmed_at, source
) values
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000601', 'active', now() - interval '6 months', now(), 'brand_existing_client');
