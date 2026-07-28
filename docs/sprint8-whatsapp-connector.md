# Sprint 8 — Connecteur WhatsApp texte

## Architecture

Le connecteur est un adaptateur de transport isolé :

```text
WhatsApp / simulateur
→ validation et normalisation du webhook
→ identité liée au numéro
→ passerelle SQL service-only
→ Assistant Terrain Core
→ brouillon existant
→ confirmation existante
→ RPC métier et audit
```

Le code sous `src/lib/integrations/whatsapp` ne lit ni n’écrit directement les tables métier. `execute_whatsapp_assistant_tool` associe l’événement à un canal actif, établit les claims de l’utilisateur lié et n’expose qu’une liste fermée d’outils de l’Assistant Core.

## Configuration serveur

| Variable | Obligatoire quand activé | Usage |
| --- | --- | --- |
| `WHATSAPP_ENABLED` | Oui | Active le connecteur uniquement avec la valeur `true` |
| `WHATSAPP_ACCESS_TOKEN` | Oui | Jeton Graph API |
| `WHATSAPP_PHONE_NUMBER_ID` | Oui | Identifiant du numéro expéditeur |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Oui | Identifiant du compte WhatsApp Business |
| `WHATSAPP_VERIFY_TOKEN` | Oui | Vérification initiale du webhook |
| `WHATSAPP_APP_SECRET` | Oui | Validation HMAC SHA-256 des événements |
| `WHATSAPP_SIMULATOR_ENABLED` | Non | Autorise explicitement le simulateur en production ; doit rester `false` |

Ces variables sont strictement serveur et ne doivent jamais utiliser le préfixe `NEXT_PUBLIC_`. Quand `WHATSAPP_ENABLED=false`, le build et l’environnement local ne nécessitent aucun secret Meta.

## Linking

1. L’utilisateur authentifié ouvre `/dashboard/account/whatsapp`.
2. `start_whatsapp_link` génère un code aléatoire, haché en base, valable dix minutes et à usage unique.
3. Le numéro envoie le code au webhook.
4. Le claim service-only lie le numéro à l’utilisateur porté par le token.
5. Les anciennes liaisons et les contextes Assistant de cet utilisateur sont invalidés.
6. La révocation désactive le canal et supprime les contextes temporaires.

Le claim est limité à cinq tentatives par numéro sur dix minutes. Les messages sont limités à trente par numéro et par heure. Un numéro non lié reçoit uniquement les instructions de linking.

## Webhook et idempotence

`POST /api/integrations/whatsapp/webhook` limite le corps à 64 Ko, valide la signature `x-hub-signature-256`, parse un schéma strict et répond immédiatement. Le traitement différé est isolé avec `after()` afin de pouvoir être remplacé ultérieurement par une queue.

`whatsapp_events.provider_message_id` est unique. Une nouvelle livraison du même identifiant retourne `duplicate=true` et n’appelle ni l’Assistant ni les RPC métier.

## Confirmation et sécurité

Les réponses `1`, `2`, `3` ciblent le dernier brouillon autorisé :

- `1` appelle `confirm_assistant_draft` ; une seconde confirmation retourne le résultat idempotent existant ;
- `2` renvoie un lien authentifié vers l’Assistant TR1 ;
- `3` appelle `cancel_assistant_draft` sans écriture métier.

L’identité est recalculée pour chaque événement depuis le canal actif. Les claims de l’utilisateur sont ensuite utilisés par les RPC Assistant et leurs contrôles RLS. Une marque ou une pharmacie hors périmètre reste indistinguable d’une donnée inexistante.

## Données et audit

La migration Sprint 8 ajoute :

- `communication_channels`
- `whatsapp_link_tokens`
- `whatsapp_events`
- `whatsapp_rate_limits`
- `whatsapp_audit_logs`

Toutes les tables exposées ont RLS activée. Les événements et compteurs ne sont accessibles qu’au rôle serveur. L’utilisateur peut seulement lire ses propres canaux, tokens et audits.

L’audit couvre réception, acceptation/rejet, résolution utilisateur, linking, appel Assistant, brouillon, confirmation, annulation, envoi et erreurs. Les événements produit `whatsapp_*` utilisent l’instrumentation existante avec des métadonnées limitées.

## Simulateur et tests

En local ou en test :

```bash
curl -X POST http://localhost:3000/api/integrations/whatsapp/simulate \
  -H 'content-type: application/json' \
  -d '{"providerMessageId":"local-1","phone":"+33612345678","type":"text","text":"Bonjour"}'
```

Le simulateur est refusé en production sauf activation explicite. Il traverse le même processeur, la même passerelle Assistant, l’idempotence et les mêmes contrôles que le webhook réel.

Validation :

```bash
npm run db:reset
npm run db:test
npm test
npm run lint
npm run build
npm run test:e2e
```

## Limites du MVP

Le Sprint 8 accepte uniquement le texte et les confirmations simples. Audio, images, documents, localisation, messages proactifs, campagnes et commandes WhatsApp restent hors périmètre. Aucune dépendance npm n’a été ajoutée : le connecteur utilise `fetch`, `node:crypto`, Zod et les bibliothèques déjà présentes.
