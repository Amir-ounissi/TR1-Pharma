# Sprint 12.1 — Rapport de clôture

## 1. Statut final

**NON PRÊT POUR UN PILOTE RÉEL** tant que les gates distants, juridiques et Sharp restent ouverts.

## 2. Version

- Branche : `release/sprint-12-1-hardening-staging`
- Commit Sprint 12 : `7aa7920fec81ed1f5c6c263cb0af93f738f9eb6a`
- SHA audité avant ajout de cette référence : `0955cc91c81d3bd60176f89ed046c2f509302c63`
- Pull request : `https://github.com/Amir-ounissi/TR1-Pharma/pull/4`
- Working tree : propre au moment de la publication

## 3. CI

Le workflow `.github/workflows/ci.yml` exécute installation reproductible, scan de secrets, lint, typecheck, Vitest, benchmark, build, audit niveau high, reconstruction DB, pgTAP, DB lint/advisors et Playwright. Le résultat distant de la PR 4 reste à reporter après exécution.

## 4. Dépendances

- Audit initial : 2 high runtime, 0 critical.
- Chaîne : `tr1-platform → next@16.2.12 → sharp@0.34.5` optionnel de production.
- Advisory : `GHSA-f88m-g3jw-g9cj` couvrant CVE-2026-33327, CVE-2026-33328, CVE-2026-35590 et CVE-2026-35591.
- Version corrigée Sharp : `>=0.35.0`; dernière observée : `0.35.3`.
- Next stable observé : `16.2.12`, imposant `sharp ^0.34.5`.
- Next `16.3.0-canary.106` accepte `sharp ^0.35.3`, mais une canary n’est pas retenue pour un pilote réel.
- `npm audit fix --force` propose un downgrade Next majeur et reste interdit.

## 5. Base de données

Environnement local : treize migrations, seed fictif, 455 pgTAP, DB lint et advisors verts. Environnement staging : non configuré faute de projet et credentials fournis.

## 6. Application

Validation locale après hardening : scan de secrets, configuration release, lint, typecheck et build verts ; 187/187 Vitest et benchmark 1/1 réussis. Le rejeu E2E intégral a validé 44/45 scénarios, puis l’unique navigation instable a été corrigée et réussie en rejeu ciblé. La CI distante doit encore confirmer les 45 scénarios dans un même run.

## 7. Staging

URL, SHA déployé, date, build distant, smoke tests et captures : non disponibles. L’inventaire des connecteurs ne contient aucun projet Supabase ou Vercel nommé TR1 staging. Les projets existants d’autres produits ne sont pas réutilisés. Aucun credential ni projet staging n’a été inventé.

## 8. Sécurité

RLS leads TR1, séparation des marques, périmètres Agent/Intervenant, stockage privé et scan de secrets sont couverts par pgTAP et E2E. Le formulaire produit maintenant une référence technique sans journaliser nom, e-mail, IP ou contenu.

## 9. Juridique

Structure technique complétée et placeholders explicites. Informations définitives encore attendues selon `sprint-12-1-legal-checklist.md`.

## 10. Rollback

Runbook disponible dans `sprint-12-1-staging-runbook.md`. Les migrations destructives ne sont pas déclarées automatiquement réversibles.

## 11. Risques résiduels

| Risque | Sévérité | Exposition | Mesure compensatoire | Propriétaire | Décision |
| --- | --- | --- | --- | --- | --- |
| Sharp 0.34.5 | High | Dépendance runtime installée; chemin image non utilisé | `images.unoptimized`, interdiction `next/image`, attente Next stable corrigé | Technique | Bloquant |
| Staging absent | High | Aucun test distant possible | Runbook et validation d’environnement préparés | Propriétaire infrastructure | Bloquant |
| Mentions/RGPD incomplets | High si collecte externe | Formulaire public | `LEAD_CAPTURE_ENABLED=false` jusqu’à complétion | Responsable TR1 | Bloquant |

## 12. Décision

Les tests locaux ne suffisent pas. Sans CI verte sur SHA final, staging réel, smoke tests distants, informations légales définitives et résolution ou acceptation formelle de Sharp, TR1 reste **NON PRÊT POUR UN PILOTE RÉEL**.
