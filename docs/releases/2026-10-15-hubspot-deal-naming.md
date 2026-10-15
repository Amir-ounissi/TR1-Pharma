# Correctif nommage des transactions HubSpot Naali

- Toutes les transactions créées ou mises à jour par TR1 utilisent le nom de la fiche société pharmacie HubSpot comme `dealname`.
- Le numéro du bon de commande reste dans son champ séparé.
- Les retries n'écrasent plus le nom de la transaction.
- Couverture testée dans `src/lib/integrations/hubspot/hubspot.test.ts`.

Livraison attendue via le pipeline officiel staging puis production, sous contrôle des tests et des validations de déploiement.
