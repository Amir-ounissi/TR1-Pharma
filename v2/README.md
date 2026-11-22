# TR1 PHARMA V2 — socle propre

## Architecture
- Landing page reprise à l'identique de l'application historique : `/`
- Cockpit multimarque propriétaire : `/app`, réservé au rôle `owner`
- Catalogue professionnel : `/catalogue`, réservé au rôle `pharmacy`
- Une nouvelle base Supabase PostgreSQL indépendante doit être créée et initialisée par `supabase/migrations/20261122094204_v2_core_initial_schema.sql`.

Les migrations sont suivies par Supabase : `20261122094204_v2_core_initial_schema.sql` puis `20261122094351_v2_rls_policy_and_index_optimization.sql`. Ne pas réappliquer les migrations sur la base V2 : elles y sont déjà installées.

## État
Première fondation, **non destinée à la production**. Formulaires, connexion et parcours
catalogue deviennent fonctionnels uniquement après création de la nouvelle base V2,
application de la migration, configuration des variables et création des comptes vérifiés.

## Invariants de sécurité
- Ne jamais utiliser les identifiants Supabase de production/staging historiques.
- Aucun rôle propriétaire attribué à partir d'un formulaire public.
- Aucune lecture de données concurrentes par une pharmacie.
- Les demandes utilisent une procédure SQL vérifiant le rattachement, l'accès,
  le minimum, le pas et le prix ; le prix est figé au moment de la demande.
- Aucune transmission automatique à une marque ni facturation.
- Les données existantes seront exportées/importées seulement après validation.

## Démarrage
```sh
cd v2
npm install
npm run dev
```

Variables (Vercel uniquement, projet V2) :
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` : serveur uniquement ; ne jamais la préfixer `NEXT_PUBLIC_`
- `LEAD_CAPTURE_SALT` : valeur aléatoire de 24 caractères minimum
- variables juridiques `LEGAL_*` et `PRIVACY_*` avant exposition publique

La landing page conserve les formulaires mais le formulaire V2 refuse les soumissions
tant que la base et ses secrets ne sont pas configurés. Pour la collecte active
des demandes, la landing historique reste le site de référence jusqu'à la bascule.
