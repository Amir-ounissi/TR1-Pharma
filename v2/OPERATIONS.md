# TR1 PHARMA V2 — exploitation

## Isolation
- V2 Supabase : `evkvbjnftffstcqxgard`, région Paris.
- V2 Vercel : `tr1-pharma-v2`, projet distinct.
- Production historique : **aucune modification autorisée** par ce plan.
- Ancien staging Supabase : suspendu, sans suppression.

## Catalogue
Les quatre marques Beauty of Joseon, Biodance, Dr. Althea et VK SWISS
ont été créées en brouillon. Le catalogue V2 reprend **97 fiches** de
l'ancien catalogue (lecture seule depuis la source), toutes avec
`published=false`, `requires_review=true` et `price_verified=false`.
Aucune valeur commerciale importée ne doit être considérée comme
vérifiée ou exposée au catalogue.

Points à corriger avant publication : 24 EAN manquants sur Biodance ;
visuels absents pour 91 fiches ; descriptions absentes sur plusieurs gammes.
Les prix de référence importés proviennent de l'ancien catalogue :
leur statut contractuel et leur actualité sont **à vérifier**.

## Validation
1. Vérifier nom, format, EAN, description et URL HTTPS du visuel.
2. Confirmer le prix HT unitaire et, si applicable, les paliers réels.
3. Enregistrer la fiche (elle reste brouillon), puis publier explicitement.
4. Activer la marque et lui donner accès à une pharmacie confirmée.
5. Vérifier le résultat dans le catalogue avec un compte pharmacie.
6. Tester une demande de réassort, puis la vérifier dans le cockpit.

Le catalogue utilise en priorité les prix propres à l'officine, ensuite
les paliers généraux vérifiés, enfin le prix HT unitaire publié.
Aucune demande ne déclenche automatiquement une commande fournisseur.

## Comptes pharmacies
Créer l'utilisateur dans Supabase Auth V2 et confirmer son adresse.
Le cockpit `/app/acces` permet ensuite de le rattacher à une
pharmacie et d'autoriser les marques. Le rôle `owner` est réservé
à l'administrateur TR1 et ne peut pas être lié à une pharmacie.

## Migrations
Les six migrations sous `supabase/migrations/` reflètent celles
appliquées à V2. Ne pas les réexécuter sur une base déjà migrée.

## À terminer avant lancement
- Terminer les informations légales de la landing et les secrets serveur
  du formulaire de leads.
- Valider la disponibilité réelle des produits et les conditions contractuelles.
- Tester les parcours dans un navigateur avec deux comptes pharmacies distincts.
- Effectuer la migration sélective des pharmacies avec dédoublonnage et accord explicite.
- Valider les réglages de sécurité Auth, dont la protection contre les mots de passe divulgués.
