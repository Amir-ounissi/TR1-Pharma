# TR1 PHARMA — Catalogue privé V1 / préparation de lancement

Statut : **candidate de production, non mise en ligne sur le site public**.
Branche : `feat/catalogue-prive-pharmacies-20261111`, PR #383.
La démonstration publique existante reste indépendante et ne traite aucune donnée réelle.

## Architecture effectivement développée

- **Public** : `/catalogue/decouvrir` (présentation et simulation explicitement fictive, aucune consultation de prix internes).
- **Pharmacie** : `/catalogue/connexion`, `/catalogue/inscription`, `/catalogue`, `/catalogue/marques/[slug]`, `/catalogue/mes-demandes`.
- **Administration TR1** : `/catalogue/administration` (super-administrateur seulement).
- **Contrôle des accès** : par compte avec email vérifié, officine active et marque autorisée et publiée.
- **Tarifs** : indication par paliers HT aux pharmacies invitées ; prix contractuels exacts propres à chaque officine.
- **Demande** : si un seul produit n'a pas de prix contractuel, la demande complète devient un devis sans total ; sinon commande avec total recalculé par transaction SQL.
- **Gestion des produits** : brouillon initial, édition des fiches, activation/désactivation, prix de référence interne et paliers publiables séparés.
- **Invitations** : préautorisation administrateur d'une adresse pour 30 jours ; partage manuel de `/catalogue/inscription` ; activation seulement après confirmation d'email. **Aucun email d'invitation automatique n'est envoyé actuellement.**

## Sécurité

- Un compte non invité ou dont l'email n'est pas confirmé ne peut pas obtenir de contexte catalogue.
- Les produits et prix internes restent en tables privées, avec RLS.
- Les trois RPC publics sont `SECURITY DEFINER` avec `search_path=''`, vérifient `auth.uid()` et les memberships en base et ne sont **pas exécutables par `anon`**.
- Les prix internes et les tarifs des autres officines ne figurent jamais dans les réponses.
- Les actions d'admin conservent la validation `requirePlatformAdmin()` et les policies RLS.
- Aucun client n'obtient le `service_role` ; les parcours pharmacie et admin utilisent leur session authentifiée.
- L'ancien `SUPABASE_SECRET_KEY` de preview reste incorrect pour les fonctions legacy ; le nouveau catalogue n'en dépend plus.

## Migrations STAGING réalisées, PRODUCTION non touchée

1. `20261111100242_private_pharmacy_catalog.sql`
2. `20261111143935_private_catalog_pricing_tiers.sql`
3. `20261111150110_private_catalog_platform_admin_rls.sql`
4. `20261112085932_catalogue_pharmacy_session_workflows.sql`
5. `20261112090338_catalogue_quantity_upper_bound_fix.sql`

La table `private_catalog_invitations` et les RPC `catalogue_claim_invitation`,
`catalogue_my_data` et `catalogue_submit_request` sont issus de la migration n°4.

## Vérifications réalisées sur staging

- SQL transactionnel avec rollback : pharmacie autorisée, tarif indicatif,
  prix contractuel, refus d'une officine étrangère, devis sans montant,
  commande `12 × 8,99 € = 107,88 € HT`.
- SQL transactionnel avec rollback : invitation refusée tant que l'email
  n'est pas confirmé, puis autorisée après confirmation.
- Les nouveaux tests pgTAP `private_catalogue_access.test.sql` sont
  versionnés ; résultat du runner GitHub à vérifier avant fusion.
- Vercel preview : compilation et checks de qualité à vérifier sur le commit final.

## Conditions de mise en production (toutes obligatoires)

- [ ] Vercel : dernière preview READY, TypeScript/ESLint sans erreurs, CI DB/pgTAP verte.
- [ ] E2E : session réelle avec **deux pharmacies distinctes** ; impossible de voir
  les prix de l'autre ; devis, commande, activation, annulation et statut.
- [ ] Auth : les redirects d'email de confirmation sont autorisés pour l'URL finale ;
  limites antispam / CAPTCHA et modèle d'invitation validés.
- [ ] Conditions VK SWISS : références, photos autorisées, EAN, TVA, marges,
  prix de référence internes, fourchettes publiables et paliers négociés approuvés.
- [ ] Confidentialité & mentions légales : informations société, responsable
  traitement, hébergeur, durée de conservation, cookies éventuels et CGV/B2B
  conformes. Le build staging signale actuellement des informations légales manquantes.
- [ ] Transactions/notifications : identifier qui reçoit et confirme les demandes
  (puis brancher email transactionnel si nécessaire).
- [ ] Plan de sauvegarde et de rollback (Git + migration additive, pas de suppression
  des commandes existantes), puis tests de non-régression sur le CRM TR1.
- [ ] Validation d'ouverture au pilote (3–5 pharmacies) après contrôle des contenus ;
  lancement à plus grande échelle seulement après retours terrain.

## Contenus en staging

- Marque `VK SWISS` en **brouillon non publié**, avec **six références importées de TR1 PHARMA Production** (nom, SKU, EAN, TVA, prix de référence HT interne). Les produits restent tous `active=false` : aucune fiche ni aucun montant visible aux pharmacies.
- Les six minimums et pas de commande ont la valeur de travail `1` : **à confirmer avec le laboratoire avant toute publication** ; la description, les visuels et les fourchettes B2B doivent également être validés et saisis.
- Aucune pharmacie réelle invitée ; aucun email commercial envoyé.
- La démonstration publique reste : https://tr1-pharma-catalogue-demo.vercel.app/
