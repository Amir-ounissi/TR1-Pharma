# Transmission de commandes par Gmail

TR1 Pharma peut transmettre une commande depuis la fiche commande via le compte Gmail connecté du commercial.

## Parcours

1. La marque renseigne son `order_email` dans les paramètres (ex. destinataire des commandes VK Swiss).
2. Le commercial connecte son compte Gmail avec OAuth Google.
3. TR1 vérifie le numéro de TVA, le KBIS, le RIB et les lignes de commande.
4. TR1 génère un bon de commande PDF.
5. Le commercial clique sur **Envoyer la commande par Gmail**.
6. TR1 envoie le PDF + KBIS + RIB et journalise le résultat.

Aucun envoi n'est automatique.

## Variables d'environnement

Les trois variables suivantes doivent être configurées côté serveur :

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
TR1_CREDENTIAL_ENCRYPTION_KEY
```

`TR1_CREDENTIAL_ENCRYPTION_KEY` doit décoder vers exactement 32 octets. Exemple de génération locale :

```bash
openssl rand -base64 32
```

Ne jamais committer la valeur de cette clé ni les identifiants Google.

## Google OAuth

Créer/configurer un client OAuth Web dans Google Cloud et autoriser l'URI de redirection suivante :

```text
https://<domaine-tr1>/api/integrations/gmail/callback
```

Pour le développement local :

```text
http://localhost:3001/api/integrations/gmail/callback
```

Scopes demandés :

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.send`

Le refresh token Google est chiffré en AES-256-GCM avant stockage et les tables concernées ne sont accessibles qu'au runtime `service_role`.

## Données pharmacie

Les documents KBIS/RIB sont stockés dans le bucket privé `pharmacy-documents`. Ils sont isolés par marque et pharmacie afin qu'une pièce fournie dans un contexte de marque ne soit pas réutilisée automatiquement par une autre marque. Le numéro de TVA reste enregistré sur l'identité légale de la pharmacie.

## Activation

Les migrations doivent être appliquées avant d'activer l'interface :

- `20260915201500_order_transmission_workflow.sql`
- `20260915203000_user_gmail_connections.sql`
- `20260915204000_scope_pharmacy_documents_by_brand.sql`

Le déploiement automatique Vercel n'est pas réactivé par cette fonctionnalité.
