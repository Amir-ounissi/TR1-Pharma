# Sprint 12.1 — Runbook staging

## Préconditions

- Utiliser uniquement la branche et le SHA validés par GitHub Actions.
- Créer un projet Supabase dédié au staging, sans donnée client réelle.
- Utiliser un projet Vercel Preview ou staging distinct de la production.
- Maintenir `WHATSAPP_ENABLED=false` et `WHATSAPP_SIMULATOR_ENABLED=false`.
- Ne pas déployer tant que `npm audit --omit=dev --audit-level=high` échoue, sauf acceptation formelle du risque.

## Variables

Configurer dans l’hébergeur sans les écrire dans Git :

`APP_ENV=staging`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, `LEAD_CAPTURE_SALT`, `LEAD_CAPTURE_ENABLED`, puis éventuellement `BOOKING_URL` et `NEXT_PUBLIC_ANALYTICS_PROVIDER`.

Les variables `LEGAL_*` et `PRIVACY_*` sont obligatoires avant collecte publique. Vérifier la configuration dans un environnement shell sécurisé avec `npm run staging:check-env`. Aucune variable secrète ne doit commencer par `NEXT_PUBLIC_`.

## Base staging

```bash
npx supabase login
npx supabase link --project-ref <STAGING_PROJECT_REF>
npx supabase db push --dry-run
npx supabase db push
```

Vérifier que les treize migrations sont enregistrées dans `supabase_migrations.schema_migrations`. Le seed fictif ne doit être chargé que sur un projet de démonstration explicitement isolé et après accord du propriétaire :

```bash
psql "$STAGING_DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/seed.sql
```

Ne jamais utiliser cette commande sur la production. Vérifier RLS, buckets privés, fonctions, RPC et historique append-only avant déploiement applicatif.

## Déploiement applicatif

1. Relever le SHA avec `git rev-parse HEAD`.
2. Vérifier la CI GitHub sur ce SHA.
3. Déployer ce SHA vers le projet Vercel staging.
4. Relever URL, SHA, date, Node, Next.js et résultat du build dans le rapport de clôture.
5. Ne jamais promouvoir ce déploiement vers Production pendant Sprint 12.1.

## Smoke tests distants

Depuis l’URL HTTPS réelle, vérifier `/`, `/merci`, `/connexion`, `/mentions-legales`, `/politique-de-confidentialite` et une URL inexistante. Tester desktop, mobile, clavier, CTA, onglets produit, validation du formulaire, soumission idempotente et absence de PII dans le réseau.

Avec des comptes staging distincts, vérifier la console leads TR1, qualification, attribution, prochaine action, préparation de pilote, refus des rôles de marque, périmètres Agent et Intervenant, changement de marque autorisé, cookie modifié, URL modifiée, requête directe et stockage privé.

## Rollback

- **Application** : redéployer ou promouvoir le dernier SHA staging connu sain. Ne jamais utiliser une branche flottante comme cible de rollback.
- **Migration additive Sprint 12** : désactiver d’abord le formulaire avec `LEAD_CAPTURE_ENABLED=false`. Ne supprimer aucune table contenant des leads sans export chiffré, validation du propriétaire et fenêtre de maintenance.
- **Migration destructive** : aucune inversion automatique n’est promise. Restaurer une sauvegarde staging prise avant migration.
- **Réservation** : supprimer `BOOKING_URL` pour revenir au fallback de contact.
- **Secret compromis** : désactiver le formulaire, révoquer et renouveler la clé côté Supabase/Vercel, remplacer `LEAD_CAPTURE_SALT`, auditer les logs puis redéployer.
- **Supabase indisponible** : désactiver la capture, afficher le message générique avec référence technique, conserver les logs sans PII et restaurer seulement après validation de santé.

## Preuves à conserver

SHA, URL, run GitHub, build Vercel, historique des migrations, résultat des smoke tests, captures sans PII, audit npm et décision de risque. Ne jamais archiver de token, cookie, clé, URL signée ou donnée personnelle réelle.
