# Références retirées : novembre 2026

## Règle de catalogue
La table `product_discontinuations` identifie les références par **marque + EAN** pour ne pas les faire réapparaître lors de futurs imports (l'ID interne peut changer). La date d'arrêt, la page de preuve, et le motif restent disponibles au propriétaire.

La RPC privée `private.althesia_showroom_catalogue()` exclut ces EAN, de sorte que les pharmacies pilotes ne les voient plus, y compris par recherche et lien de fiche. Un trigger bloque leur publication ultérieure. Les lignes de packs contenant une référence arrêtée sont également interdites.

Les produits historiques, les sources, les photos et les tarifs historiques ne sont pas effacés. Administration : `/app/produits?statut=archives` et `/app/althesia?statut=archives`.

## Liste VIDAL — arrêt au 20 mai 2026
- 3770019227060 Huile CBD 500 mg menthe poivrée
- 3770019227138 Huile CBD 2000 mg mangue
- 3770019227053 Huile CBD 500 mg citron frais
- 3770019227077 Huile CBD 500 mg fruits rouges
- 3770019227121 Huile CBD 1000 mg fraise
- 3770019227213 Huile CBD 3000 mg pêche
- 3770019227107 Granules Olympe
- 3770019227084 Granules Morphée
- 3770019227091 Granules Algos
- 3770019227046 Gummies CBD 700 mg

Source précise pour chaque EAN : table `public.product_discontinuations`, liens VIDAL.

**Attention :** ces références apparaissent dans le catalogue Althesia septembre 2026, alors que VIDAL indique une cessation au 20 mai 2026. Vérifier cette contradiction avec le fournisseur avant une éventuelle restauration. Les autres références Nōto (notamment Gynalia, huiles pour animaux, Artimove, Noctalis, Serenor, shampooings et sprays) ne sont **pas** archivées automatiquement, même si certaines restent sous contrôle réglementaire.

## Vérification V2
Catalogue documentaire pharmacie Plein Sud : 33 références (18 Vitalora + 5 Bloomster + 10 Nōto). Enregistrements archives privés à la pharmacie, zéro produit publié et zéro commande.
