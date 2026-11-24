# Parcours implantation et gestion des marques — V2

- Admin : `/app/marques` (hub), `/app/marques/[id]` (fiche 6 rubriques), `/app/offres-implantation` (configurateur).
- Pharmacie : `/catalogue/mes-marques` = marque implantée ; `/catalogue/decouvrir` = marque non implantée / à confirmer ; `/catalogue/decouvrir/[slug]` = conditions et packs disponibles.
- `pharmacy_brand_relationships` = statut réel d'implantation de l'officine, séparé de l'accès commercial.
- `brand_implantation_offers` et `brand_implantation_offer_lines` = packs flexibles ou fixes, minimums de références, quantités, UG, remises, PLV, formation, conditions de livraison, justificatifs.
- `brand_referencing_interests.offer_id` associe une demande de présentation au pack choisi, sans jamais créer de bon de commande.
- **Pilot test** : Vitalora 6 paliers historiques et Bloomster 2 offres UG, marqués « à confirmer » ; offres commerciales publiées : 0.
- Les règles de rémunération TR1 restent dans `brand_commission_settings` et `brand_bonus_rules` en accès administrateur seulement.
- Ne pas convertir un palier de réassort historique en condition d'implantation contractuelle sans accord fournisseur.
