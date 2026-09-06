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
```

Utiliser uniquement la clé publique/publishable Supabase. Ne jamais ajouter la clé `service_role` au bundle mobile.

## MVP terrain

1. Authentification et choix de marque — socle actuel
2. Navigation mobile + portefeuille pharmacies
3. Pharmacie 360 terrain
4. Missions / tâches / agenda
5. Scanner une commande par caméra, analyse serveur puis validation humaine
6. Historique commandes et création manuelle
7. Mode hors ligne contrôlé et synchronisation
8. Notifications push

## Sécurité

Le stockage de session repose pour ce premier socle sur l’adaptateur React Native recommandé par Supabase. Avant distribution TestFlight/Play interne, le stockage local, le verrouillage biométrique optionnel et la politique de cache hors ligne devront être revus dans le hardening mobile.
