# Staging TR1 Pharma — flux simple

Le staging sert à tester `main` sans toucher à la production.

- Supabase staging doit être distinct du projet de production `zhifmehctuflwfexlvkz`.
- Vercel staging utilise le projet dédié configuré dans l'environnement GitHub `staging`.
- La release staging vérifie localement le code, applique les migrations sur la base staging, déploie sur Vercel staging et exécute le smoke test.
- Aucun statut CI GitHub préalable n'est requis pour lancer le staging.
- La production n'est jamais déployée par ce workflow.
