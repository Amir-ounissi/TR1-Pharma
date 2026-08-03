# Sprint 12.2A — Accès requis pour le staging

Ne fournir les valeurs suivantes que dans le coffre de secrets de l’hébergeur ou dans un canal sécurisé. Ne jamais les ajouter à Git.

## Supabase staging

- URL du projet.
- Clé publique/publishable.
- Clé serveur/service role.
- Project ref.
- Chaîne de connexion PostgreSQL ou autorisation Supabase CLI équivalente.
- Confirmation de la configuration Storage attendue.

## Hébergement staging

- Projet Vercel staging ou hébergeur explicitement retenu.
- Accès au projet.
- Domaine ou URL de preview HTTPS.
- Autorisation de configurer les variables d’environnement.
- Méthode de déploiement du SHA validé.

## Facultatif

- `BOOKING_URL`.
- Fournisseur `NEXT_PUBLIC_ANALYTICS_PROVIDER`.
- Configuration externe de rate limiting.

## Secret à générer côté propriétaire

- `LEAD_CAPTURE_SALT`, aléatoire et d’au moins 24 caractères.

## Commandes après réception des accès

```bash
cp .env.staging.example .env.staging.local
npm run staging:check-env
npx supabase login
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase db push --dry-run
npx supabase db push
psql "$STAGING_DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/seed.sql
BASE_URL="$NEXT_PUBLIC_APP_URL" npm run staging:smoke
```

Le seed est interdit sur toute production et nécessite un projet de démonstration isolé. La commande `npm run staging:reset-demo` exige `APP_ENV=staging`, `SUPABASE_PROJECT_REF` et une confirmation explicite `CONFIRM_STAGING_RESET=RESET_<project-ref>`.
