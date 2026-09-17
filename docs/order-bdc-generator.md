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
8. Envoyer et journaliser la transmission à la marque.

## Règles d'intégrité

- Les quantités facturées enregistrées dans la commande sont la source du BDC.
- Les UG du BDC proviennent uniquement des `free_quantity` validées.
- Les remises du BDC proviennent uniquement des remises enregistrées sur les lignes.
- Le prix affiché utilise le snapshot de la ligne de commande, pas le tarif courant du catalogue.
- Aucun mécanisme commercial ne doit être appliqué silencieusement lors de la génération PDF.
- EAN et PCB peuvent être enrichis depuis le référentiel produit pour l'affichage du document ; cet enrichissement ne doit pas modifier la commande.
- Une commande sans ligne produit ne produit pas de BDC final.

## Template BDC TR1

Le template reste commun à toutes les marques :

- logo et signature TR1 Pharma ;
- marque concernée et email commandes ;
- référence du BDC et date ;
- bloc client/pharmacie ;
- bloc marque/commercial ;
- tableau produits avec code-barres EAN, référence, désignation, quantité, PU HT, remise, PU net et total HT ;
- lignes UG distinctes ;
- PCB et TVA en information secondaire ;
- récapitulatif des lignes, quantités facturées et UG ;
- sous-total HT, remises, net HT, TVA et total TTC ;
- pagination et footer TR1.

La marque fournit les données dynamiques ; elle ne possède pas un template PDF spécifique. Cela garantit un générateur réellement multi-marques.

## État du chantier

Le socle existe déjà dans TR1 : import PDF/photo, rapprochement pharmacie/produits, validation de commande, renderer PDF TR1, prévisualisation et transmission Gmail.

Cette branche consolide ce socle au lieu de créer un second workflow parallèle. Première étape : enrichir le BDC existant avec les métadonnées catalogue utiles au document (EAN/code-barres et PCB) tout en conservant les valeurs commerciales figées de la commande.

## Critères d'acceptation MVP

- Le même renderer fonctionne pour VK Swiss, Naali ou toute autre marque configurée.
- La prévisualisation PDF affiche l'EAN/code-barres quand il existe dans le catalogue.
- Le PCB est affiché quand il existe.
- Quantités, UG, prix et remises du PDF correspondent exactement aux valeurs de la commande validée.
- Le total du document repose sur les totaux de la commande enregistrée.
- Le document peut être prévisualisé avant transmission.
- Le PDF envoyé à la marque et le PDF prévisualisé reposent sur le même renderer et les mêmes règles de données.

## Suite prévue

- Factoriser la préparation des données PDF afin que prévisualisation et envoi utilisent strictement le même payload.
- Ajouter des tests de non-régression sur quantités, UG, remises, EAN/PCB et totaux.
- Afficher l'identité complète du commercial si le profil utilisateur la fournit.
- Ajouter un contrôle visuel/snapshot du template BDC dans la CI si le pipeline le permet.
