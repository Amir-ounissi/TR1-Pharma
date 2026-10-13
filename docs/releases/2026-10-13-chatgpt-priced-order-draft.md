# ChatGPT MCP — prévisualisation et brouillon chiffrés

Release demandée après fusion de la PR #355.

- Prévisualisation de commande avec prix catalogue, remises commerciales et unités gratuites provenant des données TR1/HubSpot vérifiées.
- Création de brouillon chiffré sans copie des remises dans les notes.
- Contrôles OAuth et d'affectation commerciale, validation des prix catalogue, refus des conditions manquantes, protection contre les doublons.
- Les brouillons ne sont pas des commandes transmises. La confirmation finale et la synchronisation HubSpot via ChatGPT restent un chantier distinct.
- Migration SQL incluse, revue et couverte par les tests SQL de la PR #355.

Pipeline : CI main → staging officiel → production, sans contournement des gates.
