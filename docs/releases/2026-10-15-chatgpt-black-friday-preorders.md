# ChatGPT TR1 – précommandes Trade Black Friday 2026

La campagne Naali Black Friday 2026 dispose d'un flux de commande autonome :
1. `preview_tr1_black_friday_preorder` : pharmacie autorisée, produits, quantités payantes et UG explicites, catalogue fiable, remise CRM vérifiée dans les 24h.
2. `create_tr1_black_friday_preorder_draft` : après confirmation du bon complet, brouillon **non envoyé**, numéro d'origine conservé, quantité UG inscrite avec la classification « conditions commerciales client » ; cadeau consommateur calculé **1 par boîte payante ou UG**, partagé strictement 50/50 entre Dream x20 et Anti-Stress x20. Pas de frais, remises, produits ou cadeaux arbitraires injectés par le demandeur.
3. `review_tr1_black_friday_preorder` : jeton de revue basé sur les quantités, la source, le prix et la ventilation promotionnelle.
4. `submit_tr1_black_friday_preorder_to_hubspot` : confirmation distincte, commande TR1 en `pending`, synchronisation transaction **Réassort / Précommande / Précommande Opération Trade / Black Friday 2026**, propriétaire Amir, prise de commande Amir, cadeaux catalogue HubSpot en lignes `Autre` à **0 €**. Aucun email ni traitement d'expédition.

## Exemple confirmé par le terrain

**Pharmacie Praden n°492986** : 48 Sachet découverte Anti-Stress x20 +6 UG, 48 Anti-Stress Mangue x60 +6 UG, 48 Safran Kids +6 UG, 12 Dream +2 UG. Total 156 payées +20 UG = 176 cadeaux => 88 Anti-Stress x20 +88 Dream x20. Remise 40 % => 2 106,64 € HT.

**Ne pas réimporter ce bon** : la transaction Praden est **déjà** dans HubSpot sous l'ID 526950864112, saisie directement avant cette fonctionnalité. Les outils sont prévus pour les **nouvelles** précommandes.

## Garde-fous
- RLS activée sur les métadonnées, aucun accès direct au rôle OAuth, appels RPC SECURITY DEFINER réservés aux OAuth autorisés.
- Idempotence par UUID demande et unicité du numéro source dans TR1 pour la relation marque-pharmacie; refus de l'étape de soumission sans revue fraîche.
- Remise toujours calculée depuis TR1/HubSpot (aucune remise fournie par ChatGPT).
- Refus de Zen (SKU commençant par `1tdah`) et Anti-Stress Fruits des Bois pour cette campagne.
- Refus d'une répartition cadeau inégale, d'un total impair ou d'une quantité supérieure aux bornes; vérifier et confirmer la ventilation avec le commercial.
- Les dotations spécifiques d'échantillons/PLV, non chiffrées pour Praden, ne sont pas ajoutées automatiquement.
- Les boîtes 100 % UG sans quantité payante restent hors du panier Black Friday spécialisé; à traiter dans un chantier séparé.
- Détection des doublons TR1; toute précommande saisie antérieurement directement dans HubSpot nécessite une vérification du CRM avant création dans TR1.
