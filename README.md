# TR1 Pharma Platform

TR1 Pharma est une plateforme SaaS de pilotage commercial et d’exécution terrain dédiée aux marques qui se développent en pharmacie. Chaque marque cliente dispose de son environnement strictement séparé ; un même agent ou intervenant peut travailler pour plusieurs marques uniquement dans les périmètres qui lui sont autorisés.

## Prérequis

- Node.js 24.14.0 (`.nvmrc`)
- npm 11.9.0 (`packageManager` et `engines`)
- Docker Desktop 29.6.1 ou un moteur compatible Docker API récent
- Supabase CLI 2.109.1 (dépendance de développement verrouillée)
- PostgreSQL 17 fourni par Supabase local

## Installation locale

```bash
nvm use
npm ci
npm run db:start
npm run db:reset
cp .env.example .env.local
npm run dev
```

`npm run db:reset` est la commande de reconstruction de référence : elle recrée la base locale, applique les migrations dans l’ordre et charge le seed. `npm run db:rebuild:sandbox` fournit le même comportement avec un nom explicite pour les environnements contraints. Le wrapper local isole la configuration Supabase dans `.supabase-home`, désactive uniquement la télémétrie et conserve tous les contrôles SQL et RLS.

Si le sandbox interdit à la CLI d’inspecter le socket Docker alors que les conteneurs sont actifs, `npm run db:rebuild:sandbox` reconstruit directement la base locale via `docker exec`, enregistre les treize migrations et échoue dès la première erreur SQL.

Après `npm run db:start`, exécuter `sh scripts/supabase-local.sh status -o env`. Reporter l’URL, la clé publique et la clé secrète dans `.env.local`. L’application accepte aussi les anciens noms `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`, mais les nouveaux noms sont préférés.

L’application est disponible sur [http://localhost:3000](http://localhost:3000), Supabase Studio sur [http://localhost:54323](http://localhost:54323) et la boîte email locale sur [http://localhost:54324](http://localhost:54324).

## Variables d’environnement

| Variable | Exposition | Usage |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client et serveur | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client et serveur | Clé publique soumise aux politiques RLS |
| `SUPABASE_SECRET_KEY` | Serveur uniquement | Invitations et administration Auth |
| `NEXT_PUBLIC_APP_URL` | Client et serveur | URL canonique des redirections Auth |
| `LEAD_CAPTURE_SALT` | Serveur uniquement | Sel secret des clés de déduplication et de limitation du formulaire public |
| `BOOKING_URL` | Serveur uniquement | Lien HTTPS optionnel affiché après soumission |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | Client | Fournisseur optionnel ; vide par défaut, `dataLayer` si explicitement configuré |
| `WHATSAPP_ENABLED` et `WHATSAPP_*` | Serveur uniquement | Connecteur WhatsApp Business optionnel |

Ne jamais préfixer la clé secrète par `NEXT_PUBLIC_`. Elle doit être configurée uniquement dans les variables Vercel côté serveur.

## Comptes de démonstration

Tous les comptes locaux utilisent le mot de passe `DemoTR1!2026`.

| Compte | Rôle | Portée |
| --- | --- | --- |
| `superadmin@tr1.local` | Super administrateur | Toutes les marques |
| `admin@dermavita.local` | Administrateur de marque | Dermavita |
| `agent@dermavita.local` | Agent commercial | Une pharmacie Dermavita affectée |
| `admin@nutrilab.local` | Administrateur de marque | Nutrilab |

## Validation

```bash
npm run security:secrets
npm run security:release
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:db
npm run test:e2e
npm run test:benchmark
```

`npm run db:test` exécute les tests pgTAP contre Supabase local et vérifie l’isolation entre marques ainsi que la restriction des agents à leurs affectations.

`npm run test:e2e` récupère automatiquement l’URL et la clé publique de Supabase local, démarre Next.js et exécute le parcours critique Chromium. Installer une fois le navigateur avec `npx playwright install chromium`.

`npm run ci:quality` reproduit localement le job applicatif GitHub Actions. La CI utilise exclusivement `npm ci`, Supabase local et des données fictives seedées.

## Validation depuis un clone vierge

```bash
git clone https://github.com/Amir-ounissi/TR1-Pharma.git
cd TR1-Pharma
nvm use
npm ci
npm run db:start
npm run db:reset
npm run test:db
npm run db:lint
npm run db:advisors
npm run test:unit
npm run test:benchmark
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Cette procédure ne nécessite ni Meta, ni WhatsApp, ni géocodage, ni API Vercel. Toute réactivation de l’optimisation d’image rouvre le gate sécurité Sharp.

## Déploiement Vercel

1. Créer un projet Supabase et lier le CLI avec `npx supabase link --project-ref <ref>`.
2. Appliquer la migration avec `npx supabase db push`.
3. Configurer l’URL du site et les URL de redirection Auth dans Supabase.
4. Ajouter les quatre variables d’environnement dans Vercel pour Production, Preview et Development selon le besoin.
5. Importer le repository dans Vercel ; le framework Next.js est détecté automatiquement.
6. Pour les invitations SSR, configurer le template d’invitation avec un lien vers `/auth/confirm` contenant `token_hash`, `type=invite` et `next=/onboarding`.

## Documentation

- [Architecture technique](docs/architecture.md)
- [Modèle de sécurité et RLS](docs/security.md)
- [Migration initiale](supabase/migrations/20260720201616_initial_platform_foundation.sql)
- [Tests RLS](supabase/tests/database/rls.test.sql)
- [Tests Commandes Sprint 4](supabase/tests/database/orders.test.sql)
- [Validation et backlog Sprint 5](docs/sprint5-validation.md)
- [Security Gate Sprint 5](docs/security-gate-sprint5.md)
- [Assistant Terrain Core Sprint 7](docs/sprint7-assistant-terrain.md)
- [Connecteur WhatsApp texte Sprint 8](docs/sprint8-whatsapp-connector.md)
- [Pilotage commercial et réassort Sprint 9](docs/sprint9-commercial-health.md)
- [Onboarding marque et imports contrôlés Sprint 11](docs/sprint11-onboarding-imports.md)
- [Release Sprint 11](docs/releases/sprint-11-release.md)
- [Checklist staging](docs/releases/staging-checklist.md)
- [Go-to-market et pilot readiness Sprint 12](docs/sprint12-go-to-market.md)
- [Rapport sécurité Sprint 12](docs/releases/sprint-12-security-report.md)
