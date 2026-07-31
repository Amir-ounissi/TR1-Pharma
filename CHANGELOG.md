# Changelog

## [0.11.0] - Non publié

### Ajouté

- Santé commerciale, alertes de réassort et actions de suivi Sprint 9.
- Mesure de performance et d’impact différé des missions Sprint 10.
- Onboarding marque et imports contrôlés produits, pharmacies, territoires, utilisateurs et commandes Sprint 11.
- Reconstruction Supabase locale, tests pgTAP, Vitest, benchmark et E2E complets.
- CI GitHub Actions reproductible pour qualité applicative, base locale et E2E production.

### Sécurité

- Isolation tenant et Storage privé validés.
- Exports CSV neutralisés contre les formules tableur `=`, `+`, `-` et `@`.
- Scan de secrets et gate `images.unoptimized=true` automatisés.
- Valeurs sensibles exclues des variables `NEXT_PUBLIC_` et des journaux structurés.

### Limites connues

- Production publique non validée tant que `npm audit --omit=dev` n’a pas été rejoué et revu avec accès au registre.
- Optimisation d’image Next.js volontairement désactivée à cause du risque transitif Sharp.
- Connecteur WhatsApp désactivé par défaut et testé uniquement avec simulateur local.
