# TR1 ChatGPT — référence du bon de commande d'origine

Publication visée : 14 octobre 2026.

- Le brouillon commercial ChatGPT accepte désormais un champ facultatif `source_order_number`, conservé dans `orders.order_number`.
- `orders.external_order_id` reste la clé d'idempotence propre au connecteur ChatGPT / à l'intégration HubSpot.
- Les remises et unités gratuites restent issues des conditions TR1/HubSpot vérifiées, et non du document externe.
- Toute tentative non confirmée, avec numéro déjà utilisé, ou avec un retry contradictoire est bloquée. Aucun envoi ni synchronisation HubSpot n'est déclenché.
- Le brouillon Plein Sud existant est rattaché au numéro 156589, sans transmission.

Vérifications : CI PR #359 (application, base pgTAP, E2E) verte; staging SQL avec retour idempotent et rejet des collisions; déploiement Vercel preview READY. Migrations staging/production rattachées au même identifiant Git `20261014090000`.

Le lancement de production doit passer par les workflows protégés (CI → staging officiel → candidate → smoke → promotion), et non par un déploiement Vercel brut sans injection explicite des variables d'environnement.
