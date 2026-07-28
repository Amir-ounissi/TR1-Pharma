# Architecture technique

## Audit initial

Le repository ne contenait aucun code source, aucune configuration et aucun historique Git. Les seuls dossiers présents (`outputs/` et `work/`) appartiennent à l’environnement Codex. Le projet a donc été initialisé comme une application neuve.

## Décisions structurantes

- Next.js App Router et React Server Components par défaut ; les composants client sont limités aux formulaires interactifs.
- Supabase Auth avec sessions stockées en cookies HTTP et rafraîchies par `src/proxy.ts`.
- PostgreSQL et RLS comme autorité unique pour les permissions. Le serveur appelle la fonction SQL `can_manage_brand_users` au lieu de reproduire une matrice de rôles en TypeScript.
- Contexte de marque stocké dans un cookie HTTP-only, puis revalidé par RLS à chaque chargement. Modifier le cookie ou l’URL ne donne aucun accès supplémentaire.
- Clé publique dans le navigateur ; clé secrète uniquement dans `src/lib/supabase/admin.ts`, lui-même marqué `server-only`.
- Colonnes `organization_id` et `brand_id` sur les objets opérationnels, complétées par des clés étrangères composites qui interdisent les liens entre deux tenants.
- Journal d’activité append-only depuis l’application : aucune politique de modification ou suppression n’est accordée aux utilisateurs authentifiés.

## Flux applicatif

1. `/login` authentifie l’utilisateur avec Supabase Auth.
2. `/onboarding` complète son profil et active les adhésions invitées.
3. `/select-brand` récupère les contextes autorisés via `get_my_brand_contexts`.
4. Le cookie `tr1_active_brand` sélectionne l’espace courant sans porter d’autorisation.
5. Le layout `/dashboard` revalide la session, le profil et la marque via la base.
6. `/dashboard/users` consulte `can_manage_brand_users` avant d’utiliser l’API Auth Admin pour envoyer une invitation.

## Structure principale

| Chemin | Responsabilité |
| --- | --- |
| `src/app/(auth)` | Connexion, onboarding et sélection de marque |
| `src/app/(protected)/dashboard` | Espace authentifié et gestion des utilisateurs |
| `src/lib/supabase` | Clients navigateur, serveur et administrateur |
| `src/lib/auth.ts` | Chargement du contexte de session et de marque |
| `src/proxy.ts` | Rafraîchissement des cookies Auth, sans être l’unique garde d’accès |
| `supabase/migrations` | Schéma, fonctions, grants et politiques RLS versionnés |
| `supabase/tests/database` | Tests pgTAP exécutés avec différents JWT simulés |

## Référentiel officinal — Sprint 2

- `pharmacies` représente une officine physique unique et porte les identifiants administratifs, l’adresse et le groupement.
- `brand_pharmacies` représente la relation commerciale propre à une marque : statut, potentiel, priorité, source, territoire et responsables.
- Une même officine peut être rattachée à plusieurs marques, mais une seule relation active est autorisée par couple marque/officine.
- `pharmacy_contacts`, `pharmacy_groups`, `territories`, `products` et `brand_pharmacy_products` complètent le référentiel.
- `import_batches` et `import_rows` isolent la prévisualisation CSV ; seule la confirmation RPC transactionnelle écrit les données métier.
- La vue `brand_pharmacy_directory` utilise `security_invoker=true` et conserve les politiques RLS des tables sources.

Les commandes et missions existantes référencent désormais `brand_pharmacy_id`, avec des clés étrangères composites qui empêchent tout rattachement inter-marques.

## Moteur commercial — Sprint 3

- `brand_pharmacies.commercial_status` reste le statut courant optimisé pour les lectures ; chaque changement alimente `brand_pharmacy_status_history` par trigger.
- `tasks` est l’unique source de vérité de la prochaine action. Un trigger recalcule `next_action_type`, `next_action_at` et `next_action_owner_id` depuis la tâche ouverte la plus proche.
- `commercial_tasks` expose le statut `overdue` dynamiquement, sans mutation périodique de la table.
- `interactions` stocke le canal, le résultat et la visibilité. La RPC `create_commercial_interaction` crée atomiquement la tâche suivante et lie les deux enregistrements.
- `pharmacy_assignments` conserve l’historique des responsables. La RPC `assign_brand_pharmacy` clôt l’affectation principale précédente avant d’insérer la nouvelle ; un trigger synchronise le responsable courant de la relation.
- `brand_settings` porte les délais et permissions configurables par marque avec des valeurs par défaut restrictives.
- Les vues `commercial_pipeline`, `brand_pharmacy_timeline`, `accounts_without_next_action` et `accounts_to_reassign` utilisent `security_invoker=true` afin de conserver les RLS des tables sources.
- Les automatismes sont limités aux relances après interaction ou changement de statut. Ils ne créent ni commande, ni réassort, ni donnée financière.

## Interfaces commerciales

| Chemin | Responsabilité |
| --- | --- |
| `/dashboard/pipeline` | Pipeline en tableau ou colonnes, transitions explicites et indicateurs simples |
| `/dashboard/tasks` | Vues personnelles, équipe, retards, échéances et filtres opérationnels |
| `/dashboard/pharmacies/[id]?tab=activity` | Timeline, interaction, tâche, statut et affectation rapides |
| `/dashboard/agent` | Vue mobile des comptes, tâches et interactions de l’agent connecté |

## Commandes et performance — Sprint 4

- `orders` et `order_items` restent les sources historiques. Les snapshots de SKU, nom, prix, remise et taxe figent chaque ligne ; les triggers SQL recalculent tous les montants sans faire confiance au client.
- La première commande valide (`invoiced`, `partially_delivered` ou `delivered`) devient l’implantation. Les suivantes deviennent des réassorts, indépendamment du type demandé par l’interface.
- `brand_pharmacy_order_performance` calcule les agrégats à la lecture. Une vue classique `security_invoker=true` est privilégiée à un cache prématuré : exactitude et idempotence priment au volume initial.
- `brand_pharmacy_distribution` calcule la DN et la DN stratégique depuis `brand_pharmacy_products` et les produits éligibles. `brand_pharmacy_distribution_snapshots` conserve les points historiques créés par les événements métier, jamais par l’affichage.
- `brand_pharmacy_activity_history` conserve chaque transition. Le statut `lost` reste manuel ; les autres statuts sont recalculés depuis `last_valid_order_at` et les seuils de `brand_settings`.
- `expected_next_order_at` utilise l’intervalle moyen lorsque deux commandes valides existent, sinon le délai de premier réassort configuré. Cette date reste une estimation simple.
- Les RPC `create_order`, `change_order_status`, `recalculate_brand_activity` et `confirm_order_import` regroupent validation, écriture, agrégats, historique et automatisations dans des transactions PostgreSQL.

### Avoirs et retours

- Un retour n’entre ni dans l’activité ni dans le chiffre d’affaires.
- Un avoir utilise des montants négatifs contrôlés et diminue le chiffre d’affaires, sans créer de nouvelle activité ni modifier silencieusement la commande facturée d’origine.
- Les commandes `cancelled` et `refunded` sont exclues des indicateurs. Si elles invalident l’unique implantation historique, une anomalie est exposée pour traitement manuel au lieu d’une régression destructive automatique.

### Interfaces Sprint 4

| Chemin | Responsabilité |
| --- | --- |
| `/dashboard/orders` | Liste, filtres, pagination, création et accès aux imports |
| `/dashboard/orders/[id]` | Lignes figées, montants, statut, historique et anomalie |
| `/dashboard/pharmacies/[id]?tab=performance` | CA, fréquence, activité, réassort estimé et DN |
| `/dashboard/network` | Segmentation opérationnelle du réseau et cockpit simple |

## Risques identifiés

- Une clé secrète Supabase contourne RLS : son usage reste limité à une action serveur qui vérifie d’abord une fonction d’autorisation SQL.
- Les invitations dépendent du template email Supabase et de la configuration des URL autorisées.
- La RLS complexe doit être testée à chaque nouvelle table et chaque nouvelle politique.
- Les commissions, la facturation TR1 Pharma, les animations, les formations, les stocks avancés, le sell-out et les prévisions par IA restent volontairement hors périmètre.
- Les données personnelles nécessiteront une politique de conservation, d’export et de suppression RGPD avant production.
