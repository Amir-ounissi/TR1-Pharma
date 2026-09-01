# Checklist staging Sprint 12

- [ ] Dépôt privé synchronisé et pull request relue.
- [ ] CI GitHub Actions verte sur le commit candidat.
- [ ] Tag de release créé après CI.
- [ ] Projet Supabase staging séparé créé.
- [ ] Variables staging configurées sans secret de production.
- [ ] Treize migrations appliquées dans l’ordre.
- [ ] Seed de démonstration utilisé uniquement si l’environnement le permet.
- [ ] Bucket `onboarding-imports` privé et policies vérifiées.
- [ ] `npm audit --omit=dev` obtenu et alertes runtime revues.
- [ ] Domaine staging sous HTTPS configuré.
- [ ] Comptes de démonstration fictifs contrôlés.
- [ ] Logs sans token, cookie, contenu CSV ni URL signée.
- [ ] Procédure de rollback testée.
- [ ] Sauvegarde DB disponible avant migration d’un staging persistant.
- [ ] Landing et formulaire public testés sans donnée réelle.
- [ ] Console leads refusée aux comptes de marque.
- [ ] Mentions légales et durées de conservation finalisées.
- [ ] `npm run staging:check-env` réussi dans un shell staging sécurisé.
- [ ] `LEAD_CAPTURE_ENABLED=false` tant que juridique ou sécurité restent bloquants.
- [ ] SHA du déploiement identique au SHA validé par GitHub Actions.
- [ ] Smoke tests exécutés sur l’URL HTTPS distante, jamais sur localhost.

Variables requises :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `LEAD_CAPTURE_SALT`, aléatoire et distinct de la production

Variables d’acquisition optionnelles : `BOOKING_URL` doit être une URL HTTPS réelle ; `NEXT_PUBLIC_ANALYTICS_PROVIDER` reste vide tant qu’aucun fournisseur n’est approuvé.

Variables WhatsApp optionnelles : `WHATSAPP_ENABLED=false` par défaut, avec secrets staging distincts si le connecteur doit être testé.

Rollback : promouvoir le dernier déploiement Vercel sain, restaurer la sauvegarde staging si la migration doit être annulée, puis rejouer les smoke tests `/`, `/connexion`, `/merci`, manager, agent et console leads TR1.
