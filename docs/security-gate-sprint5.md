# Security Gate Sprint 5

## Diagnostic initial

Commandes exécutées :

```bash
npm audit --json
npm audit --omit=dev --json
npm ls @hono/node-server @modelcontextprotocol/sdk shadcn brace-expansion minimatch postcss sharp next --all
```

Le rapport initial contenait 15 entrées : 3 modérées et 12 élevées. Avec `--omit=dev`, npm conservait 7 entrées : 3 modérées et 4 élevées. La qualification « runtime » provenait en partie du classement de `shadcn` dans `dependencies`, alors que ce paquet fournit ici le CSS et la CLI de génération au moment du build.

| Vulnérabilité | Sévérité | Runtime | Dépendance directe | Chaîne | Fix disponible | Risque de régression |
| --- | --- | --- | --- | --- | --- | --- |
| `GHSA-frvp-7c67-39w9` | Modérée | Non après correction | `shadcn` | `shadcn > @modelcontextprotocol/sdk > @hono/node-server@1.19.14` | `@hono/node-server@2.0.5`, major hors contrainte `^1.19.9` | Élevé si override major ; aucun changement forcé |
| `GHSA-mh99-v99m-4gvg` | Élevée | Non après correction | `shadcn`, `eslint-config-next` | `minimatch > brace-expansion@5.0.7` et chaîne ESLint | `brace-expansion@5.0.8`; incompatible avec les anciennes chaînes `minimatch@3` | Faible pour `minimatch@10`, élevé pour les chaînes anciennes ; reste build/dev uniquement |
| `GHSA-qx2v-qp2m-jg93` | Modérée | Corrigée | `next` | `next@16.2.12 > postcss@8.4.31` | `postcss@8.5.10+` | Faible ; override testé sur `8.5.23` |
| `GHSA-6g55-p6wh-862q` | Élevée | Corrigée | `next` | `next@16.2.12 > postcss@8.4.31` | `postcss@8.5.12+` | Faible ; override testé sur `8.5.23` |
| `GHSA-r28c-9q8g-f849` | Élevée | Corrigée | `next` | `next@16.2.12 > postcss@8.4.31` | `postcss@8.5.18+` | Faible ; override testé sur `8.5.23` |
| `GHSA-f88m-g3jw-g9cj` | Élevée | Présente mais chemin désactivé | `next` | `next@16.2.12 > sharp@0.34.5` | `sharp@0.35.0+`, dernière version documentée `0.35.3` | Élevé : hors contrainte Next `^0.34.5`, donc aucun override incompatible |

## Correctifs appliqués

- `shadcn@4.13.1` est déplacé vers `devDependencies`. Il reste installé pour `shadcn/tailwind.css` et la génération de composants, mais n’appartient plus à l’arbre serveur de production.
- L’override npm `postcss@8.5.23` remplace le `8.4.31` épinglé par Next.js. `npm ls postcss` confirme une version unique dédupliquée et le build Next.js valide la compatibilité.
- Aucun `npm audit fix --force`, downgrade Next.js ou override major n’est utilisé.
- `sharp@0.34.5` n’est pas forcé vers `0.35.x`, car Next.js `16.2.12`, dernière version publiée lors du diagnostic, déclare `sharp: ^0.34.5`.

## Qualification du risque résiduel Sharp

- **Chemin d’exécution** : `node_modules/next/dist/server/image-optimizer.js`, appelé par `/_next/image`.
- **Usage TR1** : aucun import de `next/image`, aucun `ImageResponse`, aucune configuration `remotePatterns` et aucun pipeline d’images utilisateur.
- **Exposition réseau** : `images.unoptimized=true` force Next.js à répondre 404 avant la validation ou le décodage de l’image.
- **Preuve automatisée** : `e2e/security-gate.spec.ts` appelle `/_next/image` avec une URL TIFF non fiable et exige le statut 404.
- **Données Storage** : les preuves de mission restent dans Supabase Storage et ne transitent pas par l’optimiseur Next.js.
- **Mitigation** : endpoint désactivé, aucune source distante autorisée, aucune entrée image non fiable transmise à Sharp.
- **Version attendue** : une version Next.js compatible déclarant `sharp@0.35.0+`. Jusqu’à sa publication, toute réactivation de `next/image` est interdite.

Dans cette configuration, l’advisory Sharp reste présente dans le lockfile mais son chemin vulnérable n’est pas exploitable par le runtime TR1.

## Audit après correction

Le payload npm runtime produit depuis l’arbre réellement installé et envoyé à l’endpoint bulk du registre ne retourne plus que l’advisory directe `sharp` ; PostCSS, Hono et brace-expansion ont disparu de l’arbre runtime vulnérable. npm matérialise également `next` comme métavulnérabilité par dépendance à Sharp.

Le registre npm a ensuite été intermittent dans le sandbox (`ENOTFOUND`) pour la régénération finale des deux sorties complètes. Les commandes restent celles exigées :

```bash
npm audit --json
npm audit --omit=dev --json
```

Cette indisponibilité ne doit pas être interprétée comme un audit vert. La décision du gate s’appuie sur l’advisory runtime Sharp encore déclarée, sa chaîne exacte et la mitigation testée ci-dessus.

## Régression finale

- Reconstruction locale : 5 migrations appliquées dans l’ordre et seed chargé.
- pgTAP : 205/205 tests réussis.
- Supabase : db lint et advisors sans erreur.
- Application : lint réussi, 22/22 tests Vitest réussis et build Next.js réussi.
- E2E : 4/4 scénarios réussis — Sprint 4, Security Gate, Sprint 5 et Storage.

## Décision du gate

Le Sprint 5 satisfait le gate de sécurité :

- aucune vulnérabilité critique ;
- les advisories PostCSS runtime sont corrigées par une version compatible ;
- Hono et brace-expansion ne font plus partie de l’arbre runtime ;
- la seule advisory directe encore retournée pour l’arbre runtime concerne Sharp ;
- le chemin Sharp est désactivé, non utilisé et couvert par un test E2E 404 ;
- tous les tests de non-régression restent verts.

La mitigation doit rester en place jusqu’à ce que Next.js accepte `sharp@0.35.0+`. Toute réactivation de l’optimisation d’images impose de rouvrir ce gate.
