# Sprint 11.2 — UX Foundation

## Carte initiale de l’interface

- **Shell** : un layout protégé unique, une sidebar fixe desktop et un drawer mobile.
- **Navigation** : 20 liens identiques pour tous les rôles, sans regroupement ni état actif.
- **Agent** : `Ma journée`, visite active, pharmacie terrain, assistant, missions et rapports déjà fonctionnels.
- **Manager** : vue d’ensemble, priorités commerciales, réseau, commandes, missions et tâches.
- **Administration** : produits, territoires, utilisateurs, imports et onboarding marque.
- **Composants** : primitives shadcn/Radix réutilisables, cartes et formulaires métier déjà opérationnels.
- **Incohérences** : couleurs codées en dur, en-têtes dupliqués, densité variable, navigation mobile non orientée terrain et tableaux visuellement hétérogènes.

## Architecture finale

- `AppShell` conserve une sidebar stable, une top bar légère et une zone de contenu ivoire.
- `RoleNavigation` produit uniquement les sections autorisées pour le rôle actif.
- Agent : Ma journée, Pharmacies, Missions, Agenda, Documents et Assistant Terrain.
- Manager : Vue d’ensemble, Priorités, Pharmacies, Missions, Performance et Équipe.
- Administration : Produits, Groupements, Territoires, Imports, Utilisateurs, Configuration UI et Onboarding.
- `MobileBottomNav` est réservé à l’Agent et garantit des cibles tactiles de 44 px minimum.

## Recherche et permissions

- La palette globale est ouverte par le champ de top bar, `⌘ K` ou `Ctrl K`.
- Les résultats sont préparés côté serveur avec le client Supabase de l’utilisateur, filtrés par `brand_id`, limités puis transmis au client.
- Les politiques RLS restent la frontière d’autorisation ; le filtrage visuel n’est jamais considéré comme une protection.
- La palette ne recherche que dans les éléments reçus et ne charge aucune donnée à la frappe.
- Navigation clavier : flèches, Entrée et Échap. État vide explicite.

## Design tokens

- Navy `#0E1A2B`, navy secondaire `#14263E`, ivoire `#F6F2E9`, ivoire secondaire `#ECE6DA`.
- Orange actif accessible `#E96708`, bleu `#2B5FC7`, succès `#4F7A58`, alerte `#C54B3C`.
- Les variables shadcn existantes sont conservées comme couche sémantique.
- Radius, bordures, ombres, focus et réduction de mouvement sont centralisés dans `globals.css`.
- Geist reste la police principale ; la monospace est limitée aux scores, horaires, statuts et raccourcis.

## Composants

Créés : navigation par rôle, palette de commande, barre mobile Agent, en-tête de page, en-tête de section, actions rapides, badge de statut et page interne du design system.

Réutilisés : boutons, cartes, badges, inputs, sheet Radix, formulaires commerciaux, visite active, suivi de réassort, fiche pharmacie et RPC existantes.

## Arbitrages de périmètre

- Aucun kanban générique n’est ajouté : les routes existantes ne nécessitent pas une nouvelle représentation pour ce gate.
- Aucun constructeur de vues enregistrées n’est ajouté. Les filtres URL existants restent partageables et restaurables sans nouvelle donnée tenant-scoped.
- Aucune édition inline n’est ajoutée : les mutations sensibles restent dans les formulaires et RPC existants avec gestion d’erreur.
- L’instrumentation existante est conservée. Ajouter de nouveaux noms à l’enum SQL `product_events` aurait imposé une migration backend hors périmètre.
- La fiche pharmacie conserve ses onglets administratifs et historiques existants pour ne supprimer aucune fonctionnalité.

## Sécurité et performance

- Aucune migration, politique RLS, RPC ou règle métier n’est modifiée.
- Aucune dépendance n’est ajoutée.
- `images.unoptimized=true` est conservé et aucun import `next/image` n’est introduit.
- La recherche utilise trois requêtes bornées à 12 lignes et n’effectue aucun appel réseau à chaque frappe.
- Les animations restent CSS, courtes, et respectent `prefers-reduced-motion`.

## Validation locale

- Reconstruction : 12 migrations appliquées dans l’ordre et seed chargé.
- SQL : 423/423 pgTAP, db lint sans erreur, advisors sans alerte.
- Application : 177/177 Vitest, lint, typecheck et build réussis.
- Navigateur : 39/39 E2E, dont 6/6 scénarios Sprint 11.2.
- Audit npm : 0 critique ; 2 alertes runtime élevées restent dans `next > sharp`. La mitigation validée au Sprint 11.1 reste active (`images.unoptimized=true`, aucun usage de `next/image`, route d’optimisation refusée).
- Captures : six PNG de démonstration dans `artifacts/sprint11-2`.
