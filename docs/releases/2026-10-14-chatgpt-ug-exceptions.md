# ChatGPT MCP — exceptions d'UG par commande (14 octobre 2026)

## Terrain : Pharmacie Grand Vitrolles, bon 416508
* 24 Cheveux → 4 UG commerciales (12+2), **ignorer les 26 UG erronées** du document.
* 24 Collagène → **24 UG** via offre exceptionnelle 1 acheté / 1 offert, **remplace** les 4 UG du 12+2 et **ne modifie pas les conditions permanentes**.
* 24 Anti-Stress 60 → **4 UG commerciales + 17 UG de compensation** (21 UG). Classement « compensation opé promo ».
* 24 Sachet découverte → 4 UG commerciales (12+2).
* Total 96 payées + 53 gratuites = 149 boîtes ; HT 1 753,60 €. L'UG ne modifie pas le montant HT. La date source est ignorée : la date de traitement est celle de création du brouillon (serveur).

## Nouvelles opérations MCP
1. `preview_tr1_priced_order` : prix et UG habituels, sans écriture.
2. `preview_tr1_ug_adjustments` : simulation non destructive. `adjustments` contient au maximum une ligne par produit :
   * `mode: "add"` : supplément d'UG au-delà de la règle commerciale ;
   * `mode: "replace"` : le nombre fourni **remplace** les UG automatiques (0 permet de supprimer les UG commerciales de cette ligne) ;
   * `classification` : motif obligatoire, dans la nomenclature TR1, ex. `offre exceptionnelle sell-in` ou `compensation opé promo`.
3. `create_tr1_priced_order_draft` : conservation du numéro du bon, date du jour, remises catalogue/TR1 calculées automatiquement, brouillon seulement.
4. `set_tr1_priced_order_ug_adjustments` : applique après confirmation explicite au **brouillon non transmis**. La liste est exhaustive. Les exceptions sont journalisées dans `tr1_chatgpt_order_ug_overrides`, avec la ventilation effective dans `order_item_free_unit_allocations`. Une liste vide restaure les UG habituelles.
5. `review_tr1_priced_order` : revalide le panier, les prix, les conditions, les UG de base et exceptionnelles, les classifications et retourne un jeton distinct incluant les exceptions.
6. `submit_tr1_priced_order_to_hubspot` : après nouvelle confirmation utilisateur, synchro HubSpot des lignes payantes et gratuites. Aucune transmission par e-mail.

Les calculs de prix et de remise ne sont jamais modifiables via ces nouvelles opérations. L'ajustement d'UG ne crée pas de double commande, ne change aucune condition permanente, n'envoie rien sans contrôle et ne peut pas modifier une commande déjà soumise.

## Contrôle qualité
Tests TS : validation stricte, sécurité des montants, unicité des exceptions, confirmation et routage API. Tests SQL : OAuth, prévisualisation 1+1 hors 12+2, compensation additive, revue/jeton, réinitialisation et préservation du brouillon et des tarifs.
