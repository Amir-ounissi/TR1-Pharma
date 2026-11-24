# ALTHESIA – V2 : catalogue source et rémunération

## Documents transmis
- `Vitalora_Catalogue_Produits_Tarifs_0926.pdf`, 21 pages, 18 produits, compositions et paliers HT.
- `Bloomster_Catalogue_0925.pdf`, 8 pages, 5 produits avec ingrédients/doses et posologies.
- `Althesia_Catalogue_0926.pdf`, 12 pages, tarifs HT/PVC TTC/UG et programme multimarque.
- `Althesia_EasyVRP.xlsx`, 142 lignes, 43 EAN distincts, taux de 15 % dans les colonnes « Commission » et « Type Commission ».

## État initial importé le 24 novembre 2026
- Vitalora 18 fiches, Bloomster 5, Nōto 20, total 43 fiches sources.
- 179 paliers / offres commerciaux, tous **non reconfirmés**.
- 3 commissions de marque à 15 % renseignées **en brouillon**, base, déclenchement, dates et bénéficiaire à vérifier.
- Aucune prime contractuelle documentée ; la page admin autorise d'ajouter des règles d'implantation, seuil CA, unité, etc. Pas de prime fictive insérée.
- 14 produits Nōto alimentaires / animaux au CBD/CBG/CBN signalés `food_cbd_blocked`. Produits Dermasense restent à vérifier.
- Total 21 visuels connus (18 Vitalora + 3 Bloomster) ; le reste est indiqué absent.
- Aucune marque commerciale activée, aucun produit commercial publié, aucune vraie commande.

## Programme commercial du groupe Althesia (document source p.2)
- 2 marques : remise 2,5 %, 3 marques : 5 %, condition minimum 500 € / marque / an.
- Remise annuelle selon CA N-1 : à partir de 5 000 € -> 2 %, 10 000 € -> 3 %, 25 000 € -> 5 %, 50 000 € -> 7 %, UG au choix.
- Franco annoncé par commande : 1 marque 200 € HT, 2 marques 300 € HT, 3 marques 400 € HT.
Ces conditions concernent **l'officine**, et **pas** les commissions ou primes de TR1.

## Anomalies de données
1. EAN `3770019227329` – Feel Focused : Bloomster PDF septembre 2025 250 mg de Bacopa, fiche bloomster.fr consultée novembre 2026 120 mg. Formule à demander à la marque.
2. EAN `3770034273127` – Multivitamines : PDF Vitalora « 17 Nutriments Bioactifs », EasyVRP « 21 Nutriments Bioactifs ». Étiquette à obtenir.
3. Allégations, étiquettes françaises, ingrédients intégraux, disponibilité et expédition non vérifiés pour diffusion commerciale.
4. Références au CBD alimentaire : ne pas ouvrir à la commande en France sans base légale et validation spécifiques.

## Accès et isolation
- Le showroom pharmacie `/catalogue/althesia` et ses fiches sont privés et **en lecture seule**, via la RPC `althesia_showroom_catalogue` qui contrôle les autorisations spécifiques du compte.
- Les commissions / primes ne passent jamais dans les données de cette RPC et restent visibles uniquement par le propriétaire.
- Pilot autorisé : pharmacie test Plein Sud. Ne pas autoriser de nouvelles officines sans consentement.
- Les onglets administrateur : `/app/althesia` (qualité) et `/app/commissions` (rémunération).
- Aucune requête showroom ne modifie `order_requests` ou `order_items`.

## Séparation essentielle
`althesia_trade_offers` : PA, remises, unités gratuites pour l'officine.
`brand_commission_settings` : taux et conditions de rémunération TR1.
`brand_bonus_rules` : primes additionnelles distinctes, à créer seulement avec un justificatif.
