# Sprint 12.2A — Rapport de clôture

## 1. Statut

- `LOCAL_READY` : OUI.
- `PILOT_READY` : NON.

## 2. Version

- Branche : `release/sprint-12-2a-pilot-gate-closure`.
- SHA, PR, CI et working tree : à renseigner après publication du commit final.

## 3. E2E flaky

Cause et correctif documentés dans `sprint-12-2-e2e-stability-report.md`. Le scénario ciblé réussit 10/10 fois et les trois suites complètes réussissent 45/45 fois chacune, sans retry.

## 4. Sharp

Expérience non compatible : Next 16.2.12 conserve Sharp 0.34.5, Sharp 0.35.3 est extraneous et l’audit reste à 2 high. Aucun changement fusionné.

## 5. Staging

Exemples de variables, validation, smoke public configurable, reset démonstration protégé, runbook et checklist d’accès préparés. Aucun credential fourni et aucun déploiement réalisé.

## 6. Juridique

Configuration centralisée, placeholders explicites et blocage production ajoutés. Toutes les informations définitives restent attendues.

## 7. Tests

- Lint : réussi.
- Typecheck : réussi.
- Build local : réussi avec avertissement juridique explicite.
- Build staging : réussi avec avertissement juridique explicite.
- Build production sans informations juridiques : bloqué comme attendu.
- Vitest : 190/190.
- Benchmark : 1/1.
- Reconstruction sandbox : réussie, 12 migrations appliquées et seed chargé.
- pgTAP : 455/455.
- Playwright : 10/10 ciblés puis 135/135 dans trois suites complètes, sans retry.
- Scan de secrets : réussi.
- DB lint : aucune erreur.
- Supabase advisors : aucun problème.
- npm audit global et runtime : 0 critical, 2 high via `next@16.2.12 -> sharp@0.34.5`.

Le CLI Supabase a produit ponctuellement une course Docker lors d'un `db reset` après les longues suites E2E. Un redémarrage propre de la pile minimale a réussi, puis la reconstruction sandbox automatisée et les 455 tests pgTAP ont tous réussi. Aucune migration ni politique RLS n'était en cause.

## 8. Gates restants

- Créer et fournir les accès Supabase staging.
- Créer et fournir le projet d’hébergement staging.
- Déployer le SHA validé et exécuter les smoke tests distants.
- Fournir et valider les informations juridiques.
- Publier une version Next stable compatible avec Sharp corrigé ou accepter formellement le risque.

## 9. Décision

TR1 reste **NON PRÊT POUR UN PILOTE RÉEL** tant que les gates externes, juridiques et audit runtime restent ouverts.
