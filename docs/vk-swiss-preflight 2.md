# VK Swiss — Preflight Phase 0

_Date_: 2026-08-21
_Branch_: `release/sprint-12-2a-pilot-gate-closure`
_HEAD_: `79f81af35c0a8c3e8d8203b7a308e9b2acbeb255`
_Project ref linked locally_: `zhifmehctuflwfexlvkz`

## Résumé exécutif

Le préflight demandé a été lancé avant toute implémentation VK Swiss.

Conclusion à ce stade : **le repo n'est pas encore en état exécutable fiable dans cet environnement Codex**, principalement parce que les dépendances Node locales ne sont pas présentes/exploitables dans le workspace courant, ce qui bloque `lint`, `typecheck`, `Vitest`, `DB tests` et `E2E` avant même d'évaluer le code applicatif.

En parallèle, la configuration staging est **cohérente côté variables** mais **la connectivité réseau staging n'est pas vérifiable depuis ce sandbox** à cause d'une résolution DNS bloquée.

Le développement VK Swiss peut être poursuivi localement une fois les dépendances restaurées, mais **le gate Phase 0 n'est pas validé** dans l'état actuel de ce workspace sandbox.

## État build / outillage

### `npm install` / `npm ci`
- Tentative lancée : `npm ci`
- Résultat : **bloqué / non concluant** dans ce sandbox.
- Constat matériel : `node_modules/.bin` est absent dans le workspace courant.

### `npm run lint`
- Résultat : **FAIL**
- Cause observée : `Cannot find module '../package.json'` depuis `node_modules/eslint/bin/eslint.js`
- Lecture : l'installation locale des dépendances est absente ou corrompue.

### `npm run typecheck`
- Résultat : **FAIL**
- Cause observée : `ERR_INVALID_PACKAGE_CONFIG` sur `node_modules/typescript/package.json`
- Lecture : l'arbre de dépendances n'est pas exploitable dans cet environnement.

### `npm run test:unit`
- Résultat : **FAIL**
- Cause observée : `ERR_INVALID_PACKAGE_CONFIG` sur `node_modules/vitest/package.json`
- Lecture : même blocage racine que lint / typecheck.

### `npm run build`
- Résultat : **non exécuté utilement en Phase 0**
- Raison : tant que `lint`, `typecheck` et `Vitest` sont cassés à cause des dépendances, le build ne constitue pas une preuve exploitable.

## État database

### `npm run db:test`
- Résultat : **FAIL / bloqué**
- Cause racine : dépendance CLI Supabase introuvable (`node_modules/.bin/supabase` absent)

### Migrations locales présentes dans le worktree
- Nombre total de fichiers visibles dans `supabase/migrations/` : **15**
- Dernière migration visible dans le worktree : `20260811130000_superadmin_onboarding_hardening.sql`

### Migrations trackées par Git au HEAD
- Nombre de migrations trackées au HEAD : **14**

### Écart repo vs worktree
- Le worktree contient **une migration non trackée supplémentaire** :
  - `supabase/migrations/20260811130000_superadmin_onboarding_hardening.sql`
- Donc, dans ce sandbox :
  - **schéma attendu par le worktree = 15 migrations**
  - **schéma tracké par le HEAD Git = 14 migrations**
- Risque : tant que cette migration n'est pas clarifiée/committée ou explicitement exclue, il existe un **risque de drift** entre ce que le code local semble attendre et ce que staging exécute réellement.

## État staging

### Variables d'environnement staging
Le check staging a été exécuté avec `.env.vercel.staging` et un contexte Preview Vercel simulé.

- Résultat : **PASS**
- Commande logique validée : `scripts/check-staging-env.mjs`
- Lecture : les variables requises sont présentes et structurellement cohérentes.

### Connectivité Supabase staging
- `supabase/.temp/project-ref` contient bien : `zhifmehctuflwfexlvkz`
- Test réseau simple vers `https://zhifmehctuflwfexlvkz.supabase.co`
- Résultat : **FAIL dans ce sandbox**
- Erreur exacte : `Could not resolve host: zhifmehctuflwfexlvkz.supabase.co`

### Interprétation
- Le projet staging est **lié localement**.
- En revanche, **la connectivité réelle staging n'est pas vérifiable depuis cet environnement Codex** à cause d'un blocage réseau/DNS sandbox.
- Il ne faut **pas** conclure que Supabase staging est cassé ; seulement que **ce sandbox ne peut pas le joindre**.

## État E2E

### `npm run test:e2e`
- Résultat : **FAIL**
- Cause observée : `scripts/supabase-local.sh: ... node_modules/.bin/supabase: No such file or directory`
- Lecture : l'E2E ne peut pas démarrer car l'outillage local n'est pas restauré.

## Worktree actuel

Le worktree est déjà **largement non propre** avant le sprint VK Swiss. Cela doit être pris en compte avant toute implémentation business.

Points notables :
- modifications en cours sur `README.md`, `next.config.ts`, `src/app/(auth)/onboarding/actions.ts`, `src/app/auth/confirm/route.ts`, `src/app/(protected)/dashboard/layout.tsx`, `src/components/app-shell.tsx`, `src/components/shell/role-navigation.tsx`, `src/lib/ux/navigation.ts`
- chantiers UX / map / platform admin / quick panel déjà présents en non tracké
- seed local modifié : `supabase/seed.sql`
- migration non trackée : `20260811130000_superadmin_onboarding_hardening.sql`

Conséquence : le sprint VK Swiss devra être isolé avec beaucoup de discipline pour éviter de mélanger les chantiers.

## Blocages identifiés

### Bloquant P0-A — Dépendances locales absentes ou incohérentes
Sans arbre `node_modules` sain, impossible de fiabiliser :
- lint
- typecheck
- Vitest
- tests DB
- E2E

### Bloquant P0-B — Schéma local ambigu
Le worktree inclut 15 migrations visibles mais Git n'en tracke que 14.
Tant que cette divergence n'est pas explicitement résolue, la comparaison repo ↔ staging reste ambiguë.

### Bloquant P0-C — Vérification staging limitée par le sandbox
Les variables staging sont cohérentes, mais la connectivité réelle à Supabase staging ne peut pas être prouvée ici à cause du DNS sandbox.

## Recommandation immédiate

Avant de commencer les chantiers VK Swiss :

1. restaurer un `node_modules` sain dans le workspace utilisé pour ce sprint ;
2. confirmer si la migration `20260811130000_superadmin_onboarding_hardening.sql` fait partie du périmètre officiel ou d'un chantier parallèle non finalisé ;
3. relancer localement hors sandbox :
   - `npm ci`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test:unit`
   - `npm run db:test`
   - `npm run test:e2e`
4. vérifier depuis un shell réseau normal la connectivité staging réelle et comparer le schéma distant à la liste canonique des migrations retenues.

## Statut Phase 0

- État build : **KO (outillage local non restauré)**
- État tests : **KO (bloqués par dépendances)**
- État database : **KO localement (CLI Supabase absente), drift local possible**
- État staging : **variables OK, connectivité non prouvable depuis sandbox**
- Blocages éventuels : **oui, bloquants**
