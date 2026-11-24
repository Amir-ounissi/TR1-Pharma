# Vitalora V2 - pilote de démonstration

## État
- 18 fiches issues en lecture seule de l'ancien catalogue Vitalora, mais tous les produits commerciaux restent en brouillon.
- Les 18 copies dans `demo_products` reprennent les noms, EAN, formats, descriptions sources et URL des images.
- Tarifs de **simulation** exclusivement : base arbitraire de 8 à 15 € HT selon SKU. Paliers fictifs 3 / 6 / 12 unités (-0 / -0,50 / -1 € HT).
- Compte test lié à Pharmacie Plein Sud Pérols : `amir.ounissi69@gmail.com`.
- `demo_catalogue_access` autorise la pharmacie pour Vitalora TEST uniquement.
- Aucune modification du catalogue commercial Vitalora ni de l'accès B2B réel.

## Tables isolées
`demo_catalogue_access`, `demo_products`, `demo_price_tiers`, `demo_cart_items`, `demo_requests`, `demo_request_items`.

Les RPC `demo_set_cart_item` et `demo_checkout` vérifient le rôle `pharmacy`, le rattachement actif et l'accès au pilote. Les simulations sont exclusivement enregistrées dans `demo_requests` / `demo_request_items`. Pas d'envoi de commande, de facture, d'email fournisseur, de stock réservé ni de paiement.

## Interfaces
- Pharmacie : `/catalogue/demo`, `/catalogue/demo/panier`, `/catalogue/demo/demandes`
- Cockpit propriétaire : `/app/demo`

## Mise en production réelle
Ne pas convertir automatiquement des demandes simulées en ventes. Vérifier prix fournisseurs, garanties réglementaires et étiquettes avant publication, puis demander une autorisation distincte.
