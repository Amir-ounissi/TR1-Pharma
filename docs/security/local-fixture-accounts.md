# Comptes de fixtures locales

Les comptes utilisant un domaine `.local` sont réservés aux environnements de développement, test et preview.

Ils ne doivent jamais être actifs dans une base utilisée par un déploiement production.

## Protections

- le login et le signup bloquent les adresses `.local` lorsque `VERCEL_ENV=production` ou `APP_ENV=production` ;
- les fixtures restent disponibles pour Supabase local et les E2E ;
- avant une release production, vérifier qu'aucun compte `.local` ne possède un membership actif sur la base distante.

## Contrôle SQL

```sql
select u.email, m.status
from auth.users u
left join public.memberships m on m.user_id = u.id
where lower(u.email) like '%.local';
```

Tout membership retourné pour la production doit être suspendu ou supprimé avant mise en ligne.
