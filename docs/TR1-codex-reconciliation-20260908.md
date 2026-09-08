# TR1 Pharma — réconciliation du travail Codex local

## Contexte

Le travail Codex du 8 septembre 2026 a été réalisé localement sur une base devenue ancienne pendant que `main` avançait. La règle de cette branche est donc de conserver les apports métier utiles sans restaurer les anciens écrans ni réintroduire des architectures concurrentes.

## Source de vérité

- Base de réconciliation : `main` au commit `90574fe19f7255092850c735968f493c41b79163`.
- Le travail Codex original reste archivé hors de cette branche.
- Aucun changement de cette branche ne doit être considéré comme validé avant CI et test terrain réel.

## Éléments volontairement non repris

### Capacitor / dossier `ios/`

Non intégré. TR1 dispose déjà de l'application mobile Expo / React Native dans `mobile/` et d'une PWA installable. Introduire en plus un wrapper Capacitor créerait une troisième voie cliente à maintenir.

### Ancienne home Agent

Non restaurée. Le `main` récent possède déjà le démarrage et la clôture de visite, la progression réelle de journée et le parcours PWA. Les apports Codex sont portés dans ces composants récents.

### Ancien cockpit pharmacie

Non restauré. Le cockpit récent de `main` reste la base. Les alertes stock utiles remontent dans Ma journée plutôt que de surcharger immédiatement la fiche pharmacie.

### Ancien formulaire de commande

Non restauré. Le workflow récent de recherche pharmacie, révision, validation marque et import PDF reste la source de vérité. Seul le préchargement utile du réassort est réimplémenté.

### Ancien tagging des preuves mission

Non repris. Le système actuel `evidence_kind` est plus structuré : plan merchandising, avant, après, détail merchandising, PLV et sortie de caisse. Le préfixage de noms de fichiers proposé localement par Codex est abandonné.

### Auth / onboarding Codex

Non repris dans ce lot. Le SaaS multimarque et les rôles ont évolué depuis la base locale ; ces changements seront réévalués séparément si un besoin fonctionnel subsiste.

## Éléments repris et corrigés

### Hors connexion

Une file locale persistante est ajoutée pour les comptes rendus d'interaction. Elle expose clairement les états en attente et les erreurs de synchronisation.

Important : une visite saisie hors connexion n'est pas considérée comme reçue par TR1 avant synchronisation serveur. Le compteur de progression ne doit donc jamais progresser sur un simple enregistrement local.

L'horodatage et la durée sont figés au moment de la saisie hors ligne. Avant un retry, le serveur vérifie si la même interaction a déjà été reçue afin d'éviter un doublon lorsqu'une écriture serveur a réussi mais que la réponse réseau s'est perdue.

La première version Codex déclarait aussi `sell_out`, `mission_report` et `attachment` comme types de queue alors que leurs handlers serveur complets n'étaient pas câblés. Ils ne sont pas annoncés comme supportés dans cette réconciliation.

### Sell-out et couverture de stock

Le calcul de couverture est repris avec une règle de fraîcheur centralisée : un relevé de plus de 45 jours ne produit pas d'alerte prédictive.

Les alertes utilisent uniquement des relevés sell-out validés et sont calculées référence par référence sur les dernières périodes disponibles.

Dans le détail sell-out, les références sont classées par sorties puis stock disponible. Le stock actuel reste visible et une référence rapprochée présentant un stock faible peut alimenter directement une nouvelle commande.

### Commandes et réassort

Depuis une pharmacie, la dernière commande validée ou opérationnelle peut précharger les références et quantités. Une commande encore simplement `pending` n'est pas utilisée comme modèle de réassort afin d'éviter les doublons de commande.

Les lignes restent entièrement modifiables avant envoi. Le lien sell-out `Ajouter à la commande` précharge la pharmacie et la référence ciblée avec le paramètre `product`.

Le workflow récent de validation marque, correction, révision et import PDF reste inchangé.

### Agenda

L'utilisateur saisit une heure de début et une durée de 15 à 480 minutes ; l'heure de fin est calculée côté serveur. Les blocs d'indisponibilité conservent un début et une fin explicites.

## Principes produit retenus

1. Une seule donnée métier, partagée entre web/PWA et mobile Expo.
2. Une action locale n'est pas synonyme d'une action reçue ou validée par le serveur.
3. La pharmacie reste le point d'ancrage commercial.
4. Les écrans récents du `main` sont conservés ; on porte les fonctionnalités Codex, pas leurs anciennes implémentations.
5. Les concepts ne doivent pas se dupliquer : visite, mission, prochaine action, interaction, preuve et sell-out gardent chacun un rôle précis.
6. Les alertes prédictives doivent toujours respecter la fraîcheur de leur donnée source et disparaître lorsqu'elle n'est plus suffisamment fiable.

## Suites hors de ce lot

- synchronisation offline sell-out / rapports de mission / pièces jointes avec contrats idempotents dédiés ;
- éventuelle extension des alertes stock à une vue manager dédiée si le besoin terrain le justifie ;
- revue séparée de l'onboarding ;
- décision produit ultérieure sur la profondeur du natif Expo versus PWA.
