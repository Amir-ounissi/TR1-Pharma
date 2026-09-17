# Générateur de bons de commande TR1 Pharma

## Objectif

TR1 Pharma transforme une commande validée en bon de commande fournisseur homogène, multi-marques et directement exploitable par la marque.

Le PDF final utilise la charte graphique TR1 Pharma et doit rester une représentation fidèle des données commerciales validées dans la commande.

## Workflow cible

1. Import ou saisie de la commande.
2. Analyse et rapprochement de la pharmacie et des produits.
3. Contrôle humain des lignes, quantités, UG, remises et prix.
4. Validation de la commande.
5. Génération du bon de commande dans la charte TR1.
6. Prévisualisation du PDF final dans TR1.
7. Validation explicite « J’ai vérifié le bon de commande ».
8. Transmission à la marque.
9. Archivage dans TR1 et poursuite du suivi de la commande.

## Principe d’intégrité

La génération du PDF ne modifie jamais silencieusement la commande.

Les champs suivants proviennent de la commande validée :

- quantités facturées ;
- quantités gratuites ;
- prix unitaires HT ;
- remises ;
- taux de TVA ;
- totaux HT et TTC.

Une offre commerciale connue de TR1 peut être proposée pendant la phase de contrôle, mais elle ne peut être appliquée qu’après action explicite de l’utilisateur.

Le rendu PDF peut enrichir le document avec des métadonnées du référentiel produit qui ne modifient pas la commande :

- EAN / code-barres ;
- référence produit ;
- PCB ;
- désignation catalogue.

## Template BDC

Le générateur est multi-marques. Il ne doit pas contenir de logique spécifique à VK Swiss.

Le squelette commun comprend :

- identité TR1 Pharma ;
- marque concernée ;
- identité du commercial ;
- numéro et date du bon de commande ;
- informations pharmacie ;
- tableau produits ;
- lignes UG distinctes ;
- récapitulatif des quantités ;
- sous-total HT, remises, net HT, TVA et total TTC ;
- pagination et référence du BDC en pied de page.

Les données propres à une marque sont injectées dynamiquement depuis son contexte TR1.

## Prévisualisation avant envoi

La transmission ne doit jamais partir immédiatement après génération du PDF.

Dans la carte « Transmission de la commande », TR1 affiche le BDC final dans une prévisualisation PDF intégrée. L’utilisateur peut également ouvrir le même PDF dans un nouvel onglet pour un contrôle plein écran.

Le bouton d’envoi reste désactivé tant que :

- les prérequis de transmission ne sont pas complets ;
- l’utilisateur n’a pas coché « J’ai vérifié le bon de commande ».

La prévisualisation et la pièce jointe envoyée doivent utiliser les mêmes données. L’email transmis à la marque reçoit donc le même BDC que celui contrôlé à l’écran, y compris les métadonnées produit EAN et PCB.

## Tests de non-régression

Le renderer PDF est couvert sur les invariants suivants :

- présence des informations de commande, marque et pharmacie ;
- présence de la référence produit, de l’EAN et du PCB quand ils existent ;
- affichage d’une ligne UG uniquement si une quantité gratuite a été validée ;
- absence d’UG inventée lorsque `freeQuantity = 0` ;
- pagination des commandes longues tout en conservant la référence du BDC.

## Règle produit

Le PDF est une sortie du workflow de commande, pas une deuxième source de vérité.

La source de vérité reste la commande enregistrée et validée dans TR1 Pharma.
