# TR1 Pharma Mobile

Application terrain iOS / Android de TR1 Pharma.

## Socle

- Expo SDK 57 / React Native 0.86
- TypeScript strict
- Supabase Auth avec persistance de session React Native
- récupération des marques accessibles via `get_my_brand_contexts`
- sélection locale de la marque active, toujours revalidée contre les accès renvoyés par Supabase
- aucun `service_role` dans l’application

Le projet web Next.js reste à la racine du repo. Le mobile est volontairement isolé dans `mobile/` afin de ne pas restructurer le web pendant le développement du MVP.

## Configuration locale

```bash
cd mobile
cp .env.example .env
npm install
npm run typecheck
npm run start
```

Renseigner dans `.env` :

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_TR1_API_URL=...
```

Utiliser uniquement la clé publique/publishable Supabase. Ne jamais ajouter la clé `service_role` au bundle mobile.

## MVP terrain couvert

1. authentification Supabase et choix de marque ;
2. accueil terrain ;
3. portefeuille pharmacies, recherche et fiche Pharmacie 360 selon permissions ;
4. missions, transitions terrain et compte-rendu ;
5. agenda du jour et backlog à planifier ;
6. scan photo d’une commande, compression, analyse serveur, correction et validation humaine ;
7. historique commandes en lecture seule ;
8. saisie manuelle avec revue puis validation explicite ;
9. brouillon local offline contrôlé : aucune synchronisation ou création automatique ;
10. rappels locaux terrain via `expo-notifications`, synchronisés sur les 7 prochains jours.

Les notifications push distantes ne font pas partie de ce MVP : aucun token device n’est enregistré côté serveur. Elles nécessiteront un lot backend dédié avant activation.

## QA mobile

La CI mobile exécute :

```bash
npm run typecheck
npx expo install --check
npx expo export --platform all --output-dir dist-ci
npm audit --audit-level=high
```

L’export Metro iOS + Android permet de détecter les erreurs de bundling en plus du typecheck.

## Build interne

Le projet est lié à EAS sous `@tr1pharma1/tr1-pharma-mobile` avec le project ID `53e6c736-f161-4423-8622-5bfedf481c98`.

`eas.json` contient un profil `preview` pour distribution interne, avec APK directement installable côté Android. Le premier build Android interne a été généré avec succès le 6 septembre 2026 et le keystore Android est géré à distance par Expo.

Les variables publiques du profil `preview` pointent vers Supabase staging et l’API TR1 staging. Aucun secret `service_role` n’est embarqué dans le build.

Pour les builds suivants :

```bash
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

Le build iOS physique nécessite encore la configuration Apple Developer, la signature et l’enregistrement des appareils de test. Aucun build App Store / Play Store n’est déclenché automatiquement par ce repo.

## Sécurité

Le stockage de session repose sur AsyncStorage pour ce MVP. Les brouillons offline sont isolés par utilisateur et par marque, restent locaux au téléphone et sont supprimés après création réussie de la commande.

Avant distribution large TestFlight/Play, le stockage sécurisé natif, le verrouillage biométrique optionnel, la politique de cache hors ligne et l’infrastructure de push distant devront faire l’objet d’un hardening séparé.


## Journée guidée et progression terrain

L’accueil affiche les visites et missions personnelles planifiées pour la journée Europe/Paris, le même fuseau que l’agenda serveur. Les tâches, échéances de rapport et blocs agenda ne participent pas à ce compteur. Les événements d’autres intervenants, annulations, absences et propositions non approuvées sont exclus. Les doublons sont éliminés par type et identifiant.

Une visite terminée compte dans la progression ; une mission nécessite un statut terminé ET un rapport validé. Un rapport envoyé reste en attente de validation, un rejet ne donne aucune réussite. Aucun point, classement, potentiel financier ou objectif fictif n’est généré. Les données sont relues au retour à l’accueil, à la reprise de l’application et lors d’un changement de journée. En cas d’échec réseau, le compteur est indisponible et ne prétend pas fonctionner hors ligne.

La prochaine mission s’ouvre directement ; une visite renvoie vers l’agenda existant. Les raccourcis de commande ne sont proposés qu’aux rôles autorisés à créer des commandes. Le changement de marque ou d’utilisateur réinitialise la navigation terrain.

Les rapports proposent des boutons par type de mission et conservent une saisie libre. Les réponses alimentent les champs existants (résumé, retour pharmacie, opportunité, suite) : elles ne créent ni commande ni tâche automatiquement. Les rapports soumis restent verrouillés ; l’envoi n’est pas une validation.

### Vérification

- `npm test` : règles de progression, exclusions, déduplication, validation des missions et frontière de journée.
- `npm run typecheck` et `npx expo export --platform all` : vérification native statique et bundles.
- Recette sur appareil à effectuer : compte agent puis intervenant, parcours accueil → mission → boutons → revue, correction d’un texte existant, changement de marque, retour à l’accueil après validation serveur et coupure réseau. Contrôler lisibilité et tailles tactiles avec une police agrandie.

Les défis de campagne, notifications de récompense, classements et une synchronisation hors ligne complète ne font pas partie de ce lot.
