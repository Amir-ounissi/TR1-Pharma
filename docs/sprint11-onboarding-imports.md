# Sprint 11 — Onboarding marque et imports contrôlés

## Parcours livré

La console `/dashboard/admin/onboarding` permet à un super administrateur TR1 de créer une organisation et sa première marque, configurer les paramètres commerciaux, préparer et exécuter les imports, inviter un administrateur de marque, contrôler la checklist puis activer explicitement la marque.

Les imports pris en charge sont `products`, `pharmacies`, `territories`, `users` et `orders`. Le MVP accepte uniquement les CSV UTF-8 avec virgule ou point-virgule, 5 Mo et 10 000 lignes maximum. Les modèles et leur documentation sont exposés par `/api/onboarding/templates/[type]`.

## Moteur d’import

Le moteur indépendant de React se trouve dans `src/lib/imports/` :

- parsing CSV et détection du séparateur ;
- mapping automatique, surcharge manuelle et colonnes ignorées ;
- normalisation explicite des dates, montants, booléens, emails et téléphones ;
- validation ligne par ligne ;
- détection de doublons déterministe ;
- prévisualisation et rapport.

Une ligne invalide maintient le lot en revue et interdit son exécution. Les exécutions vérifient à nouveau le tenant, le rôle et l’état `ready`. Le lot, ses lignes et ses mutations sont journalisés. Une seconde exécution est refusée. Le rollback ne supprime que les cibles créées par le lot et se bloque si elles ont été modifiées ou liées après l’import.

## Données et sécurité

Les migrations Sprint 11 ajoutent les sessions d’onboarding, le suivi enrichi des lots et lignes, les mutations, modèles, erreurs et audits. Les index couvrent tenant/statut, lot/statut, clés de déduplication, identifiants externes, SKU, email et code territoire.

Le bucket `onboarding-imports` reste privé. Les chemins sont `{brand_id}/{job_id}/{nom_assaini}`. Seuls un responsable TR1 ou un administrateur de la marque peut lire le fichier ; seul un super administrateur peut le supprimer. Les exports de contrôle réappliquent les contrôles de rôle et de marque.

Les événements enregistrés sont : démarrage, étape terminée, upload, mapping, validation, exécution, échec, rollback, marque prête, activation, fin d’onboarding et export. Le contenu intégral des fichiers n’est jamais journalisé.

## Benchmark reproductible

Commande :

```bash
npm run benchmark:sprint11
```

Le benchmark SQL transactionnel crée puis annule :

- 4 organisations et 4 marques ;
- 4 000 pharmacies et relations marque-pharmacie ;
- 4 000 commandes historiques ;
- 4 000 missions terminées.

Mesures locales du 28 juillet 2026 :

| Mesure | Résultat |
| --- | ---: |
| Vue santé commerciale, une marque | 9,31 ms |
| Vue impact missions, une marque | 35,50 ms |
| Liste prioritaire, une marque | 33,69 ms |
| Parsing, mapping et validation de 5 000 produits CSV | 37,52 ms |

Les trois requêtes manager restent sous le seuil de 10 secondes et l’ensemble SQL est exécuté en 5 secondes, chargement inclus. Les vues utilisent des requêtes agrégées tenant-scoped ; aucun appel par ligne depuis l’interface n’est introduit. Le benchmark est conservé dans `supabase/tests/database/zz_sprint11_load.test.sql` pour détecter les régressions.

## Validation

- reconstruction : 12 migrations et seed réussis ;
- pgTAP : 423/423 ;
- Vitest applicatif : 166/166 ;
- benchmark Vitest : 1/1 ;
- E2E complet : 33/33, dont Sprint 11 7/7 et Storage privé ;
- build et lint : réussis ;
- DB lint et advisors : aucun problème ;
- `images.unoptimized=true` : conservé.

L’audit npm complet retourne 13 vulnérabilités : 11 élevées et 2 modérées. L’audit runtime retourne 2 alertes élevées sur la chaîne `next@16.2.12 > sharp@0.34.5`. Le traitement d’image vulnérable reste désactivé par `images.unoptimized=true`, sans utilisation de `next/image`. La production publique reste bloquée jusqu’à une mise à jour compatible ou une acceptation de risque formelle.

Le parcours XLSX, les intégrations ERP/SFTP et les imports planifiés restent hors périmètre.
