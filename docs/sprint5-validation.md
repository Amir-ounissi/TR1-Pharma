# Validation Sprint 5

## Reconstruction locale

La reconstruction automatisée de référence est :

```bash
npm run db:start
npm run db:reset
npm run db:test
```

La commande alternative `npm run db:rebuild:sandbox` recrée également la base, applique toutes les migrations dans l’ordre et charge le seed. Le script échoue dès qu’une étape Supabase échoue et transmet son code de sortie. Il utilise une configuration locale au projet et désactive uniquement la télémétrie ; aucun contrôle métier, grant ou politique RLS n’est désactivé.

## Import historique reporté

L’import historique reste au backlog et ne fait pas partie de la correction Sprint 5.

- Données : missions historiques, rapports historiques et résultats d’animation.
- Format attendu : CSV UTF-8 ou JSON documenté, avec identifiants source stables, dates ISO 8601, statuts normalisés et références externes explicites.
- Dépendances : correspondance des marques, pharmacies, produits et utilisateurs ; validation des rôles ; résolution des doublons ; stockage préalable des pièces jointes ; prévisualisation puis confirmation transactionnelle.
- Contrôles requis avant développement : modèle de mapping, rapport d’erreurs par ligne, idempotence, audit de l’auteur, respect des RLS et stratégie de reprise.

## Correctif Next.js

Les dépendances sont épinglées sur la ligne compatible patchée : Next.js `16.2.12`, React `19.2.6`, React DOM `19.2.6` et `eslint-config-next` `16.2.12`, sans recours à `--force`.

Les advisories suivis avant déploiement public sont `GHSA-4c39-4ccg-62r3`, `GHSA-68g3-v927-f742`, `GHSA-4633-3j49-mh5q`, `GHSA-q8wf-6r8g-63ch` et `GHSA-955p-x3mx-jcvp`. L’application utilise des Server Actions : les vulnérabilités affectant ce chemin sont pertinentes pour son runtime. Les cas exclusivement Edge ou liés à l’optimisation de SVG non fiables ne correspondent pas à la configuration actuelle, mais l’audit npm final reste obligatoire.
