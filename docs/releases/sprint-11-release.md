# TR1 Pharma v0.11.0 — Release Sprint 11

## Périmètre

Cette release regroupe les Sprints 5 à 11 : missions terrain, expérience agent, assistant terrain, connecteur WhatsApp simulé, santé commerciale, réassort, impact des missions, onboarding marque et imports contrôlés. Aucun travail Sprint 12 n’est inclus.

## Architecture

- Next.js 16.2.12, React 19.2.6 et TypeScript.
- Supabase local avec PostgreSQL 17, Auth, Storage privé et RLS.
- Douze migrations SQL immuables et un seed exclusivement fictif.
- Vitest, pgTAP et Playwright Chromium.

## Reconstruction

```bash
nvm use
npm ci
npm run db:start
npm run db:reset
npm run test:db
npm run db:lint
npm run db:advisors
npm run ci:quality
npm run test:benchmark
npx playwright install chromium
npm run test:e2e
```

`db:reset` applique les douze migrations dans l’ordre et charge `supabase/seed.sql`. À partir de `v0.11.0`, une migration publiée est immuable : toute correction passe par une nouvelle migration.

## Sécurité

- RLS et policies couvrent les données métier, l’onboarding et les imports.
- Le bucket `onboarding-imports` est privé, limité à 5 MiB et tenant-aware.
- Les fonctions `SECURITY DEFINER` testées imposent un `search_path` vide et des permissions explicites.
- Les exports CSV neutralisent les préfixes de formule tableur.
- `images.unoptimized=true` reste obligatoire. Toute réactivation de l’optimisation d’image rouvre le gate sécurité Sharp.
- Les secrets serveur ne portent jamais le préfixe `NEXT_PUBLIC_`.

## Tests et benchmark

Validation après hardening : 423 pgTAP, 166 Vitest applicatifs, 1 benchmark Vitest et 33 E2E.

Le benchmark Sprint 11 conserve quatre tenants, 4 000 pharmacies, 4 000 commandes, 4 000 missions et 5 000 lignes CSV. Il vérifie les index, les requêtes de pilotage et la validation d’import.

## Rollback

1. Ne pas modifier une migration publiée.
2. Revenir au tag applicatif précédent.
3. Restaurer une sauvegarde de staging si une migration destructive a été appliquée.
4. Pour un import, utiliser uniquement le rollback contrôlé journalisé.
5. Vérifier les policies RLS, le Storage privé et les tests avant remise en service.

## Risques et conditions production

- La release peut viser le staging après CI verte.
- La production publique reste bloquée par les deux alertes runtime élevées `next > sharp`, malgré la mitigation `images.unoptimized=true`.
- Les alertes ESLint sont un risque d’outillage CI, pas un chemin runtime démontré.
- Les secrets de production ne doivent jamais être réutilisés en staging.
- Un tag `v0.11.0` et une GitHub Release ne sont créés qu’après CI verte.

## Non inclus

Sprint 12, facturation, commissions, marketplace, nouveau connecteur, IA supplémentaire, vocal, refonte d’architecture et déploiement de production publique.
