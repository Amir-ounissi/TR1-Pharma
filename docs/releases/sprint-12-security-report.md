# Sprint 12 — Rapport sécurité

## Audit des dépendances

`npm audit fix` a été exécuté sans `--force` après dry-run. Il a mis à jour uniquement l’arbre transitif de développement : `brace-expansion` vers `1.1.18` et `5.0.9`, `@modelcontextprotocol/sdk` vers `1.30.0` et `@hono/node-server` vers `2.0.12`. Les alertes modérées et les alertes `brace-expansion` sont supprimées.

L’audit runtime final contient deux entrées `high`, sans alerte `critical` :

| Dépendance | Version | Advisory | Exécution TR1 | Correctif compatible |
| --- | --- | --- | --- | --- |
| `sharp` | `0.34.5` | `GHSA-f88m-g3jw-g9cj` / CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 | Transitive runtime via Next, mais aucun import `next/image`; optimisation désactivée | Non. Corrigé à partir de `0.35.0` |
| `next` | `16.2.12` | Entrée agrégée par npm car Next dépend de Sharp | Serveur Next utilisé; le chemin image vulnérable n’est pas utilisé par TR1 | Non. Next `16.2.12` impose `sharp ^0.34.5`; npm propose un downgrade majeur interdit |

## Mitigations

- `images.unoptimized=true` reste obligatoire.
- Le gate `security:release` échoue si `next/image` est importé.
- Les routes publiques n’acceptent aucun upload et n’appellent pas Sharp.
- Aucun `npm audit fix --force`, override hors contrainte ou downgrade Next n’a été appliqué.

Le chemin vulnérable n’est pas appelé par le code TR1 actuel, mais la dépendance reste présente dans l’arbre runtime. Au 3 août 2026, Next stable `16.2.12` est la dernière version stable publiée et impose `sharp ^0.34.5`. La canary `16.3.0-canary.106` accepte `sharp ^0.35.3`, mais elle n’est pas retenue pour un pilote réel. Le risque n’est donc pas déclaré résolu ni formellement accepté. Une version Next stable compatible avec `sharp >=0.35.0`, ou une acceptation de risque signée après revue, reste nécessaire avant exposition publique.

## Capture des leads

- Validation Zod serveur, normalisation et limites de longueur.
- Honeypot, déduplication quotidienne et limitation par empreinte IP salée.
- Clé secrète exclusivement serveur.
- RPC de capture exécutable uniquement par `service_role`.
- RLS sans lecture anonyme et sans accès des rôles de marque.
- Historique append-only et transitions SQL contrôlées.

## Risques résiduels

1. Sharp runtime élevé non corrigé et non accepté.
2. Mentions légales, identité de l’éditeur, durée de conservation et contact RGPD à finaliser.
3. Aucun staging distant déployé et smoke-testé dans cette exécution locale.

Décision du gate : **NON PRÊT POUR UN PILOTE RÉEL** tant que ces trois points restent ouverts.
