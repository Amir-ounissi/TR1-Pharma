# Sprint 11.1 — Rapport de hardening

Date de validation locale : 29 juillet 2026.

Dernière validation locale : 29 juillet 2026.

## Statut

**Validation locale complète.** Le gate Sprint 11.1 reste conditionné à une CI distante verte. Le staging est autorisable sous réserve de revue du risque runtime `next > sharp`; la production publique reste bloquée tant qu'une version corrigée compatible n'est pas disponible ou intégrée.

## Clone vierge

- Clone indépendant créé sans `node_modules`, `.next`, artefact Playwright ni variable shell implicite.
- `npm ci` : réussi, 714 packages installés.
- Scan secrets : réussi.
- Configuration release : réussie.
- ESLint : réussi.
- TypeScript `tsc --noEmit` : réussi.
- Vitest applicatif : 166/166, 24 fichiers.
- Benchmark Vitest import 5 000 lignes : 1/1.
- Build production Next.js 16.2.12 : réussi, 33 routes.

## Base locale

- Reconstruction depuis zéro : réussie depuis le clone propre.
- Migrations : 12/12 appliquées dans l'ordre.
- Seed fictif : chargé.
- pgTAP : 423/423.
- Benchmark SQL : 5/5.
- Mesures SQL : santé commerciale 17,32 ms ; impact mission 51,28 ms ; priorités 55,80 ms.
- DB lint : aucun problème.
- DB advisors : aucun problème.

Le test pgTAP de charge a été rendu autonome en chargeant explicitement l'extension pgTAP et son `search_path`. La reconstruction sandbox supprime proprement les objets Storage, applique les migrations avec arrêt immédiat sur erreur, charge le seed et recharge le cache PostgREST.

## E2E

- 33/33 scénarios Playwright réussis en mode production.
- Sprint 11 : 7/7 scénarios, avec vérifications finales en base, cloisonnement tenant, export CSV sécurisé et Storage privé.
- Une condition de course a été corrigée : un lot d'import n'est plus marqué `ready` avant l'insertion complète de ses lignes de staging.

## Sécurité

- `.gitignore` couvre secrets, environnements, dépendances, builds, caches, logs, dumps, artefacts Supabase et Playwright.
- `.env.example` ne contient que des valeurs fictives et distingue client, serveur, obligatoire et optionnel.
- Aucun secret réel détecté dans les fichiers préparés pour commit.
- L'historique GitHub complet n'a pas pu être scanné : authentification distante indisponible.
- `images.unoptimized=true` est contrôlé automatiquement.
- Aucune utilisation de `next/image` détectée.
- La route `/_next/image` reste couverte par le scénario sécurité.
- Les exports CSV neutralisent `=`, `+`, `-` et `@`, y compris après espaces ou tabulations.
- Les logs sensibles sont expurgés et testés.
- Storage privé, isolation tenant et URLs signées sont couverts par les 423 tests pgTAP et les 33 E2E.

Toute réactivation de l'optimisation d'image rouvre le gate sécurité Sharp.

## Dépendances et audit

- `npm install` signale 13 alertes : 11 élevées et 2 modérées.
- `npm audit --json` : 13 alertes, dont 11 élevées et 2 modérées, aucune critique.
- `npm audit --omit=dev --json` : 2 alertes élevées, aucune critique.
- La chaîne runtime est `next@16.2.12 > sharp@0.34.5`, advisory `GHSA-f88m-g3jw-g9cj`, corrigée dans Sharp 0.35.0.
- Next.js 16.2.12 contraint Sharp à `^0.34.5`; aucun override major incompatible n'est appliqué.
- Le chemin vulnérable est mitigé par `images.unoptimized=true`, l'absence de `next/image` et un test de refus de `/_next/image`.
- Aucun `npm audit fix --force` n'a été utilisé.

## Versions

- Node.js 24.14.0.
- npm 11.9.0.
- Supabase CLI 2.109.1.
- Docker CLI 29.6.1.
- Docker Desktop 4.82.0 observé, mise à jour 4.83.0 proposée.
- PostgreSQL local 17.6.
- Playwright 1.61.1.

## CI et GitHub

- Workflow `.github/workflows/ci.yml` créé pour pull requests, `main` et exécution manuelle.
- Jobs : qualité applicative, base locale/pgTAP, E2E production.
- `npm ci`, benchmark, deux audits, DB reset, DB lint/advisors, screenshots, traces et artefacts sur échec sont configurés.
- Aucun `continue-on-error` sur les étapes critiques.
- GitHub CLI est authentifié avec le compte propriétaire `Amir-ounissi`.
- Branche préparée : `release/sprint-11-hardening`.
- Aucun tag ne doit être créé avant une CI verte.

## Documentation

- README de démarrage et reconstruction.
- `.env.example`.
- `CHANGELOG.md`.
- Notes de release Sprint 11.
- Checklist staging.
- Présent rapport de hardening.

## Risques ouverts

1. Synchroniser la branche `release/sprint-11-hardening` et obtenir une CI distante entièrement verte.
2. Suivre la disponibilité d'une combinaison Next.js/Sharp corrigée et compatible avant production publique.
3. Créer le tag et la GitHub Release uniquement après validation de la pull request et de la CI.

Aucun travail Sprint 12 n'a commencé.
