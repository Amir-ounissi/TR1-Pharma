# Sécurité multi-tenant

## Principes

L’interface ne constitue jamais une frontière de sécurité. Les politiques PostgreSQL s’appliquent même si un utilisateur modifie une URL, un corps de requête, le cookie de marque ou appelle directement la Data API.

Les fonctions privées utilisent `auth.uid()` et lisent les adhésions stockées en base. Aucune décision d’autorisation n’utilise `user_metadata`, qui est modifiable par l’utilisateur. Les fonctions `SECURITY DEFINER` restent dans le schéma non exposé `private`, ont un `search_path` vide et vérifient systématiquement l’identité courante. Les fonctions RPC publiques sont `SECURITY INVOKER`.

## Portées

| Rôle | Données visibles |
| --- | --- |
| `super_admin` | Toutes les marques et toutes les données |
| `tr1_manager` | Marques portées par ses adhésions actives |
| `brand_admin` | Marque de l’adhésion et administration de ses utilisateurs |
| `brand_user` | Données de sa marque, sans administration des accès |
| `agent` | Marque de travail, pharmacies affectées et tâches assignées |
| `facilitator` | Marque de travail, missions dont il est l’intervenant et comptes rendus associés |

## Fonctions centrales

- `private.has_global_role` vérifie un rôle global TR1 sans marque.
- `private.has_brand_role` vérifie un rôle pour une marque et inclut le super administrateur.
- `private.has_brand_permission` fusionne les permissions du rôle et les éventuelles dérogations d’adhésion.
- `private.can_assign_role` interdit à un administrateur d’accorder un rôle supérieur au sien ou un rôle global TR1.
- `private.can_access_brand` filtre les contextes de marque.
- `private.can_access_brand_pharmacy` combine accès de marque élevé et affectation agent active.
- `private.can_access_pharmacy` rend l’officine physique visible seulement lorsqu’au moins une relation commerciale autorisée existe.
- `private.can_access_mission` combine accès élevé et intervenant assigné.
- `private.validate_brand_pharmacy` refuse les responsables sans adhésion active, les territoires hors périmètre et les officines archivées.
- `private.validate_brand_pharmacy_product` refuse toute implantation d’un produit d’une autre marque.
- `public.can_manage_brand_users` est l’unique décision utilisée par RLS et par l’action serveur d’invitation.
- `public.create_brand_pharmacy` crée atomiquement une officine et sa relation commerciale, ou rattache une officine physique existante.
- `public.confirm_reference_import` confirme un lot CSV en une transaction et journalise l’opération.

## Défense en profondeur

- RLS activée sur toutes les tables du schéma `public`.
- Aucun droit accordé au rôle `anon`.
- Grants explicites pour `authenticated` et `service_role`, conformément au comportement Data API actuel.
- Contraintes composites pour empêcher une pharmacie, un produit, une commande ou une mission d’être relié à une marque différente.
- `UPDATE` possède à la fois une politique de lecture et des clauses `USING` / `WITH CHECK`.
- Les vues exposées utilisent `security_invoker=true` et ne contournent pas RLS.
- Aucune clé secrète dans une variable `NEXT_PUBLIC_*`.
- Le proxy rafraîchit la session, mais chaque Server Component et Server Action sensible revalide l’utilisateur ou la marque.
- Des triggers alimentent automatiquement `activity_logs` pour les adhésions, pharmacies, produits, affectations, commandes et missions.

## Extension du modèle

Toute nouvelle table exposée doit recevoir `organization_id` et/ou `brand_id`, des clés étrangères composites vers ses parents, RLS activée, des grants explicites et un scénario pgTAP négatif. Une politique `TO authenticated` sans prédicat d’appartenance est interdite, sauf pour la table de référence `roles`.
# Sécurité du moteur commercial — Sprint 3

## Principes

- Les actions serveur ne décident jamais seules d’un droit : elles valident les entrées puis laissent les fonctions, contraintes, triggers et politiques PostgreSQL autoriser ou refuser l’opération.
- Les clés étrangères composites `(id, brand_id)` bloquent les liens inter-marques, y compris lorsqu’un client altère un `brand_id`, un identifiant dans une URL ou le corps d’une requête.
- Les vues commerciales sont `security_invoker=true` et ne contournent donc pas les politiques des tables sous-jacentes.
- Une adhésion absente, suspendue ou rattachée à une autre marque n’accorde aucun accès. Le contexte actif ne remplace jamais le contrôle du membership.

## Visibilité

- `shared` est visible par TR1 et les utilisateurs autorisés de la marque.
- `tr1_internal` est réservé aux rôles TR1 autorisés.
- `brand_internal` est visible par TR1 et la marque, mais pas par un agent externe sauf cas explicitement autorisé par la politique.
- Un agent ne lit et ne modifie que ses pharmacies affectées et ses propres tâches autorisées. La fin logique d’une affectation retire cet accès immédiatement.
- Les rôles animateur et formateur n’obtiennent aucun accès au module commercial général.

## Écritures sensibles

- Les changements de statut passent par `change_brand_pharmacy_status`, qui contrôle la transition, exige un motif pour les sauts et écrit l’historique.
- Les réattributions passent par `assign_brand_pharmacy`, qui bloque l’auto-attribution non autorisée et vérifie le membership cible.
- Une tâche annulée exige un motif ; les interactions, tâches et affectations sont archivées ou clôturées logiquement et ne sont pas supprimées physiquement.
- Les huit couples de politiques permissives hérités ont été séparés par opération afin de supprimer les avertissements `multiple_permissive_policies` sans élargir les droits.

## Vérification

Les tests pgTAP couvrent les transitions, l’isolation inter-marques, les utilisateurs sans membership ou désactivés, les comptes multi-marques, les contacts hors pharmacie, les affectations expirées, l’altération de `brand_id`, les accès par identifiant direct et les visibilités internes.

# Sécurité des commandes — Sprint 4

- Les politiques de `orders`, `order_items`, `brand_pharmacy_activity_history` et `brand_pharmacy_distribution_snapshots` appellent les mêmes prédicats de marque et d’affectation que le référentiel.
- Un agent ne voit et ne crée des commandes que pour ses pharmacies affectées. Un animateur ou formateur ne reçoit aucun accès au module Commandes.
- Les clés étrangères composites bloquent une pharmacie ou un produit d’une autre marque, même avec un identifiant valide injecté dans le corps de requête.
- Les vues de performance, DN et anomalies utilisent `security_invoker=true`, afin que modifier une URL ou appeler directement la Data API ne contourne jamais RLS.
- Les fonctions privées privilégiées révoquent `EXECUTE` à `PUBLIC`, fixent leur `search_path` et contrôlent l’utilisateur. Les RPC publiques sont les seuls points d’entrée accordés à `authenticated`.
- Une commande facturée ou livrée est financièrement immuable. Toute correction passe par annulation motivée, remboursement ou avoir audité.
- L’import ne rattache jamais silencieusement une pharmacie ou un produit ambigu. La prévisualisation reste dans `import_batches` et `import_rows`; la confirmation traite les commandes de façon isolée et conserve les erreurs par ligne.

Les tests pgTAP Sprint 4 couvrent notamment la lecture et l’écriture inter-marques, l’accès direct par identifiant, l’agent hors périmètre, le membership suspendu, le produit ou la pharmacie d’une autre marque, l’immuabilité financière et les imports invalides.
