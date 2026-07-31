# Checklist staging v0.11.0

- [ ] Dépôt privé synchronisé et pull request relue.
- [ ] CI GitHub Actions verte sur le commit candidat.
- [ ] Tag annoté `v0.11.0` créé après CI.
- [ ] Projet Supabase staging séparé créé.
- [ ] Variables staging configurées sans secret de production.
- [ ] Douze migrations appliquées dans l’ordre.
- [ ] Seed de démonstration utilisé uniquement si l’environnement le permet.
- [ ] Bucket `onboarding-imports` privé et policies vérifiées.
- [ ] `npm audit --omit=dev` obtenu et alertes runtime revues.
- [ ] Domaine staging sous HTTPS configuré.
- [ ] Comptes de démonstration fictifs contrôlés.
- [ ] Logs sans token, cookie, contenu CSV ni URL signée.
- [ ] Procédure de rollback testée.
- [ ] Sauvegarde DB disponible avant migration d’un staging persistant.

Variables requises :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`

Variables WhatsApp optionnelles : `WHATSAPP_ENABLED=false` par défaut, avec secrets staging distincts si le connecteur doit être testé.
