create or replace function public.get_brand_activation_checklist(target_brand_id uuid)
returns table (check_key text, label text, completed boolean, blocking boolean, detail text)
language sql stable security invoker set search_path = '' as $$
  select * from (
    select 'organization', 'Organisation créée', exists(
      select 1 from public.brands b join public.organizations o on o.id=b.organization_id
      where b.id=target_brand_id and o.status in ('draft','active')
    ), true, null::text

    union all select 'settings','Configuration métier validée', coalesce((
      select s.step_statuses ->> 'settings' = 'completed'
      from public.brand_onboarding_sessions s where s.brand_id=target_brand_id
    ),false), true, null

    union all select 'administrator','Administrateur de marque ajouté', exists(
      select 1 from public.memberships m join public.roles r on r.id=m.role_id
      where m.brand_id=target_brand_id
        and m.status in ('invited','active')
        and r.key='brand_admin'
    ), false, 'Facultatif pour activer l’espace. Peut être ajouté après l’ouverture.'

    union all select 'products','Premiers produits ajoutés', exists(
      select 1 from public.products p
      where p.brand_id=target_brand_id and p.is_active
    ), false, 'Facultatif pour activer l’espace. Le catalogue peut être complété ensuite.'

    union all select 'pharmacies','Premières pharmacies ajoutées', exists(
      select 1 from public.brand_pharmacies bp
      where bp.brand_id=target_brand_id and bp.archived_at is null
    ), false, 'Facultatif pour activer l’espace. Une marque peut démarrer sans pharmacie existante.'

    union all select 'imports','Imports sans erreur bloquante', not exists(
      select 1 from public.import_batches b
      where b.brand_id=target_brand_id
        and b.lifecycle_status in ('failed','executing')
        and b.error_rows > 0
    ), false, 'Facultatif pour activer l’espace. Les imports peuvent être repris après l’ouverture.'
  ) checklist
  where private.has_brand_role(
    target_brand_id,
    array['tr1_manager','brand_admin']
  );
$$;
