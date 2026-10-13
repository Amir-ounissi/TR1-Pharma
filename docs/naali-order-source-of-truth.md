# Import des commandes : hiérarchie des sources (Naali)

## Règles validées

1. **Bon de commande pharmacie** : EAN et quantités achetées. L'intitulé, les prix et les remises imprimés ne font pas foi.
2. **Catalogue actif TR1 PHARMA** : identification par EAN, prix d'achat HT et taux de TVA. Un EAN absent, inconnu ou ambigu bloque la résolution automatique ; aucune substitution par libellé ou SKU.
3. **Conditions commerciales de la pharmacie (HubSpot, ou dérogation TR1 explicite)** : remise sur facture et unités gratuites. Le statut HubSpot `Client ambassadeur` correspond à **12 achetées + 2 offertes par référence**, sur toute la gamme Naali. Les UG sont calculées par ligne, jamais sur la somme des quantités de produits différents.
4. La facture est calculée sur les **unités achetées** après remise ; les unités gratuites augmentent uniquement les unités à livrer.
5. Avant toute écriture, présenter les quantités, les UG, le prix catalogue, la remise, le total HT/TTC et les éventuels écarts ; demander une validation explicite. Ne jamais transmettre une commande à HubSpot sans autorisation.

## Correctifs de cette PR

- Correspondance des produits par EAN strict, y compris références EAN connues. Un code GTIN reconnu dans le champ SKU d'un document extrait est interprété comme un EAN mal positionné, mais un SKU alphanumérique ne remplace jamais l'EAN.
- Pas de veto fondé sur un intitulé contradictoire lorsque l'EAN est valide.
- Association des lignes UG par EAN uniquement.
- Prix catalogue prioritaire dans la prévisualisation **et relu côté serveur lors de la confirmation**. Les prix fournis par le document ou le navigateur sont ignorés.

## Reste à faire avant un import automatisé de bout en bout

- Dans le flux PDF/photo, récupérer et appliquer les conditions commerciales HubSpot **à la prévisualisation et à la confirmation serveur**, sans utiliser la remise ni les UG imprimées comme source de vérité. La récupération HubSpot et la règle `Client ambassadeur` 12+2 existent déjà dans `src/lib/integrations/hubspot/naali-pricing.ts`, mais ce flux d'import ne les consomme pas encore.
- Verrouiller les EAN à la confirmation serveur, y compris après modification manuelle de la prévisualisation.
- Étendre le brouillon MCP ChatGPT pour accepter des remises et UG **résolues côté serveur** ; maintenir l'absence d'envoi, l'idempotence et la confirmation utilisateur.
- Vérifier l'absence de doublon sur le numéro externe de commande avant synchronisation HubSpot.
- Tester sur le bon Plein Sud n°156589 : 5 lignes de 12 achetées, 2 UG par ligne, remise de 35 %, 60 facturées, 10 UG, 70 livrées. Les écarts de centimes liés à l'arrondi du document doivent être signalés, pas compensés par un prix importé.

**Aucune modification des commandes réelles ni de HubSpot dans cette PR.**
