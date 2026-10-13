# Mobile CI: dépendances Expo bloquantes

## Constat

GitHub Actions Mobile CI #132 échoue à l'étape `npm audit --audit-level=high`, après les vérifications TypeScript, Expo et export.

Le rapport npm du 13 octobre 2026 signale **15 vulnérabilités high et 7 moderate**, notamment :
- `braces` via `micromatch` / `metro-file-map` / `@expo/metro` : GHSA-vfj7-8cjw-p6xm ;
- `node-forge` via `@expo/code-signing-certificates` : GHSA-86w9-cpqp-85rv ;
- `uuid` via `xcode` / `@expo/config-plugins` : GHSA-w5hq-g745-h8pq (moderate).

Le correctif automatique `npm audit fix --force` propose Expo 44.0.6 alors que l'application utilise Expo ~57.0.9 : **ne pas appliquer ce downgrade incompatible**.

## Critères de déblocage

1. Vérifier les versions corrigées et compatibles avec Expo SDK 57 de chaque dépendance vulnérable.
2. Mettre à jour uniquement les dépendances compatibles, avec un verrouillage reproductible de la résolution npm.
3. Exécuter `npm run typecheck`, `npx expo install --check`, `npx expo export --platform all` et `npm audit --audit-level=high`.
4. Vérifier le scanner documentaire et la confirmation de commande sur iOS et Android.
5. Garder cette PR en brouillon tant que le contrôle sécurité échoue.

Ne pas désactiver l'audit ni ignorer les alertes de sécurité pour obtenir un résultat vert.

## Vérification des correctifs disponibles (13/10/2026)

Les avis de sécurité publics indiquent qu'**aucune version corrigée n'est publiée** pour :
- `braces` — GHSA-vfj7-8cjw-p6xm, dernière version concernée 3.0.3 ; remplacer la chaîne `metro-file-map → micromatch → braces` nécessite une modification compatible de Metro/Expo, pas un simple `npm audit fix`.
- `node-forge` — GHSA-86w9-cpqp-85rv, versions jusqu'à 1.4.0 affectées ; la suppression de `@expo/code-signing-certificates → node-forge` nécessite une évolution compatible de l'outillage Expo.

Il est **impossible d'affirmer que ces deux alertes sont corrigées** par une montée de version ponctuelle aujourd'hui. Ne pas imposer `expo@44`, ne pas supprimer `npm audit`, ne pas marquer la PR prête pour fusion. Revoir dès qu'une version Expo/Metro corrigée est publiée ; évaluer alors l'impact sur l'application et les builds signés.

Sources : https://github.com/advisories/GHSA-vfj7-8cjw-p6xm et https://github.com/advisories/GHSA-86w9-cpqp-85rv.
