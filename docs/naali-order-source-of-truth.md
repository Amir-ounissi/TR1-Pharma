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

## Intégration réalisée dans cette PR

- Prévisualisation PDF/photo sur le site et dans l'API mobile : consultation des conditions HubSpot / TR1 de la pharmacie Naali identifiée, remise et UG calculées par référence, avertissement sur les écarts avec le document.
- Confirmation serveur web et mobile : contrôle des EAN, prix catalogue relus, conditions commerciales relues, blocage si la remise est inconnue ou si les UG/remises ne correspondent plus à la prévisualisation.
- La sélection d'une autre pharmacie dans la prévisualisation web Naali demande une nouvelle analyse pour recharger ses conditions.
- Le calcul ne suppose pas que toute pharmacie est ambassadrice ; la règle 12+2 s'applique seulement si HubSpot ou une dérogation TR1 indique cette règle.

## Reste à faire

- Étendre le brouillon MCP ChatGPT pour accepter des remises et UG **résolues côté serveur** ; maintenir l'absence d'envoi, l'idempotence et la confirmation utilisateur.
- Tests E2E complets de l'import web/mobile avec conditions HubSpot de test, y compris la confirmation et la synchronisation.
- Vérifier l'absence de doublon sur le numéro externe de commande avant synchronisation HubSpot, et vérifier le statut réel de la synchronisation.
- Tester sur le bon Plein Sud n°156589 **après lecture des conditions réelles** : 5 lignes de 12 achetées ; si la pharmacie est ambassadrice avec remise 35 %, 2 UG par ligne, 60 facturées, 10 UG, 70 livrées. Les écarts de centimes liés à l'arrondi du document doivent être signalés, pas compensés par un prix importé.

**Aucune modification des commandes réelles ni de HubSpot dans cette PR.**
