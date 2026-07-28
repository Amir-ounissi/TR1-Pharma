# Sprint 7 — Assistant Terrain Core

## Architecture

Le moteur est indépendant de React et de tout canal de messagerie.

```text
Message
  → interprétation déterministe
  → résolution des entités par outils autorisés
  → validation Zod stricte
  → brouillon persistant pending
  → confirmation explicite
  → RPC métier sécurisée
  → résultat et audit privé
```

La console `/dashboard/agent/assistant` est uniquement un client du moteur dans `src/lib/assistant`.

## Outils autorisés

- `search_pharmacies`
- `get_pharmacy_summary`
- `get_next_visit`
- `get_today_agenda`
- `get_recent_interactions`
- `prepare_interaction`
- `prepare_task`
- `prepare_interaction_with_next_action`
- `confirm_draft`
- `cancel_draft`

Aucun accès SQL générique et aucune écriture métier directe ne sont exposés au moteur.

## Persistance et sécurité

- `assistant_action_drafts` stocke les propositions pendant 30 minutes.
- `assistant_contexts` stocke un contexte temporaire par utilisateur et marque.
- `assistant_audit_logs` stocke un audit privé à métadonnées limitées.
- Les tables sont protégées par RLS et en lecture seule pour `authenticated`.
- Les mutations passent par des RPC qui dérivent l’organisation, la marque, l’utilisateur et la pharmacie autorisée.
- La confirmation verrouille le brouillon, revalide les droits et l’expiration, appelle les RPC métier existantes et mémorise l’identifiant final.
- Une deuxième confirmation renvoie le même résultat sans créer de doublon.

## Interprétation

Le MVP utilise un interpréteur déterministe sans dépendance IA externe. Il sépare :

1. l’intention ;
2. la résolution de pharmacie ;
3. la validation métier ;
4. la préparation du brouillon ;
5. la confirmation ;
6. l’exécution.

Les dates naturelles sont converties en ISO avec timezone avant création du brouillon. Une pharmacie ambiguë doit être sélectionnée explicitement.

## Validation

- Reconstruction : 7 migrations et seed.
- pgTAP : 266 tests.
- Vitest : 62 tests.
- E2E : 11 scénarios, dont 3 Sprint 7.
- DB lint et advisors : aucune erreur.
- Lint et build : réussis.
- `images.unoptimized=true` : conservé.

`npm audit --omit=dev --json` n’a pas pu joindre `registry.npmjs.org` à cause du DNS. Aucune dépendance n’a été ajoutée ou modifiée pendant ce sprint ; le risque runtime reste donc identique au Security Gate précédent.

## Hors périmètre

Aucun connecteur WhatsApp, webhook, audio, photo, OCR, commande conversationnelle ou message sortant n’a été développé.

