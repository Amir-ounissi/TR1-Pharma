# Staging trigger

Le déploiement staging peut être déclenché en déplaçant la branche `staging-release` sur le SHA `main` à tester. Le workflow de release reste staging-only et conserve ses gardes Supabase.

Le SHA ciblé doit disposer d'une exécution CI terminée avec succès avant que la release staging puisse appliquer les migrations et déployer.

Release production UG classification — 2026-09-24.
