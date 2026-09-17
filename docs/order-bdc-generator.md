# Générateur de bons de commande TR1 Pharma

## Objectif

Transformer une commande pharmacie en un bon de commande fournisseur standardisé, multi-marques et généré avec la charte TR1 Pharma.

Le PDF est une sortie du workflow commande. Il ne doit jamais devenir une source de données indépendante ni modifier silencieusement les conditions commerciales saisies ou validées.

## Workflow cible

1. Importer ou saisir la commande pharmacie.
2. Extraire et rapprocher la pharmacie et les produits du référentiel de la marque.
3. Présenter un écran de contrôle avant validation.
4. Permettre un enrichissement commercial explicite (UG, remise, quantité, prix), jamais automatique sans validation utilisateur.
5. Enregistrer la commande validée.
6. Générer le BDC fournisseur avec la charte TR1 Pharma.
7. Prévisualiser/télécharger le PDF avant envoi.
8. Confirmer explicitement « J’ai vérifié le bon de commande ».
9. Envoyer et journaliser la transmission à la marque.

## Règles d'intégrité

- Les quantités facturées enregistrées dans la commande sont la source du BDC.
- Les UG du BDC proviennent uniquement des `free_quantity` validées.
- Les remises du BDC proviennent uniquement des remises enregistrées sur les lignes.
- Le prix affiché utilise le snapshot de la ligne de commande, pas le tarif courant du catalogue.
- Aucun mécanisme commercial ne doit être appliqué silencieusement lors de la génération PDF.
- EAN et PCB peuvent être enrichis depuis le référentiel produit pour l'affichage du document ; cet enrichissement ne doit pas modifier la commande.
- Une commande sans ligne produit ne produit pas de BDC final.
- La prévisualisation et la pièce jointe envoyée passent par le même mapper de données PDF.

## Template BDC TR1

Le template reste commun à toutes les marques :

- logo et signature TR1 Pharma ;
- marque concernée et email commandes ;
- référence du BDC et date ;
- bloc client/pharmacie ;
- bloc marque/commercial avec nom du commercial quand son profil le fournit, puis son email ;
- tableau produits avec code-barres EAN, référence, désignation, quantité, PU HT, remise, PU net et total HT ;
- lignes UG distinctes ;
- PCB et TVA en information secondaire ;
- récapitulatif des lignes, quantités facturées et UG ;
- sous-total HT, remises, net HT, TVA et total TTC ;
- pagination et footer TR1.

La marque fournit les données dynamiques ; elle ne possède pas un template PDF spécifique. Cela garantit un générateur réellement multi-marques.

## État du chantier

Le socle existe déjà dans TR1 : import PDF/photo, rapprochement pharmacie/produits, validation de commande, renderer PDF TR1, prévisualisation et transmission Gmail.

Cette branche consolide ce socle au lieu de créer un second workflow parallèle. La prévisualisation est intégrée avant envoi, l'envoi Gmail reste bloqué jusqu'à validation explicite du document, et le rendu aperçu/envoyé utilise désormais le même mapper de données.

## Critères d'acceptation MVP

- Le même renderer fonctionne pour VK Swiss, Naali ou toute autre marque configurée.
- La prévisualisation PDF affiche l'EAN/code-barres quand il existe dans le catalogue.
- Le PCB est affiché quand il existe.
- Quantités, UG, prix et remises du PDF correspondent exactement aux valeurs de la commande validée.
- Le total du document repose sur les totaux de la commande enregistrée.
- Le document peut être prévisualisé avant transmission.
- L'envoi reste désactivé tant que le commercial n'a pas confirmé avoir vérifié le BDC.
- Le PDF envoyé à la marque et le PDF prévisualisé reposent sur le même renderer et le même mapper de données.
- L'identité du commercial reprend son nom de profil lorsqu'il existe, avec son email en solution de repli.

## Tests de non-régression

Le chantier couvre désormais :

- contenu et métadonnées principales du PDF ;
- EAN/code-barres et PCB ;
- génération des UG uniquement quand elles existent ;
- pagination des commandes longues ;
- intégrité du payload commercial : quantités, UG, prix, remises et totaux sont recopiés sans recalcul métier silencieux ;
- scénario de référence à six lignes avec quantité 8, zéro UG et total HT enregistré à 884 € ;
- conservation de l'identité commerciale transmise au rendu PDF.

## Suite prévue

- Faire passer l'ensemble de la CI sur le dernier commit.
- Ajouter un contrôle visuel/snapshot du template BDC si le pipeline le permet sans rendre les tests instables.
- Effectuer un contrôle fonctionnel final sur une vraie commande avant passage de la PR en ready.
