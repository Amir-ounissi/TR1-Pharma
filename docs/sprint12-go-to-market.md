# Sprint 12 — Go-to-market et pilot readiness

## Positionnement

TR1 Pharma est une plateforme SaaS de pilotage commercial et d’exécution terrain dédiée aux marques qui se développent en pharmacie. Chaque marque cliente utilise un environnement séparé. Un agent ou intervenant peut travailler pour plusieurs marques, mais chaque contexte reste isolé et doit être sélectionné explicitement.

TR1 ne promet ni consolidation corporate, ni P&L transversal, ni marketplace ouverte. Les ressources terrain validées par TR1 complètent optionnellement l’organisation existante de la marque.

## Funnel

`Visiteur → clic CTA → formulaire commencé → formulaire envoyé → rendez-vous réservé → rendez-vous tenu → lead qualifié → pilote proposé → pilote actif → client`

Les événements publics disponibles sont `landing_view`, `primary_cta_click`, `product_tab_view`, `lead_form_start`, `lead_form_validation_error`, `lead_form_submit`, `thank_you_view` et `booking_click`. L’abstraction reste inactive sans `NEXT_PUBLIC_ANALYTICS_PROVIDER`. Les noms, e-mails, sociétés, notes, messages et téléphones sont supprimés des propriétés avant émission.

## Capture et qualification

- Le formulaire public demande uniquement le nom, l’e-mail professionnel et la marque ou le laboratoire.
- Une Server Action valide et normalise les données, vérifie un honeypot et calcule des clés hachées de déduplication et de limitation avec `LEAD_CAPTURE_SALT`.
- L’écriture passe par une RPC réservée à `service_role`; les visiteurs et utilisateurs de marque ne disposent d’aucun accès de lecture.
- La console `/dashboard/admin/leads` est réservée au rôle global `super_admin` et journalise les changements dans un historique append-only.

## Préparation pilote

Un lead doit être qualifié et une confirmation explicite est obligatoire. `prepare_pilot_project` crée uniquement un brouillon. L’approbation réutilise `create_brand_onboarding` du Sprint 11, relie le lead, le pilote, l’organisation et la marque, puis conserve l’organisation et la marque en brouillon avec la marque inactive jusqu’à la checklist.

## Démonstration reproductible

Le seed local utilise uniquement des données fictives. `Dermavita` est le scénario marketing principal : Pharmacie République, produit Dermacalm, manager, agent, intervenante, commandes, visite, mission, rapport et prochaine action. `Nutrilab` sert uniquement aux preuves d’isolation et de changement de contexte, jamais à une promesse de pilotage corporate.

```bash
npm run db:start
npm run db:reset
npm run db:test
```

Le reset applique treize migrations puis charge `supabase/seed.sql`. Les comptes de démonstration sont documentés dans le README.

## Séparation staging / production

- Utiliser deux projets Supabase et deux projets ou environnements Vercel distincts.
- Ne jamais recopier les secrets de production en Preview ou Development.
- Configurer un `LEAD_CAPTURE_SALT` aléatoire distinct par environnement.
- Maintenir `WHATSAPP_ENABLED=false` et `WHATSAPP_SIMULATOR_ENABLED=false` sur un staging public.
- Ne charger que le seed fictif en local ou sur une démonstration explicitement isolée, jamais en production.

## Rollback et smoke tests

1. Conserver le dernier déploiement Vercel sain et le promouvoir en cas d’échec applicatif.
2. Sauvegarder la base staging avant migration et restaurer le projet staging si une migration irréversible échoue.
3. Vérifier `/`, `/connexion`, `/merci`, une connexion manager, une connexion agent et l’accès TR1 à `/dashboard/admin/leads`.
4. Soumettre un lead fictif, confirmer son apparition, puis l’archiver logiquement.
5. Vérifier qu’un compte de marque obtient un refus sur la console leads.

## Gate sécurité et décision

La production publique reste bloquée tant qu’une vulnérabilité runtime élevée n’est pas corrigée ou formellement acceptée, que les mentions légales ne sont pas finalisées et que le staging distant n’a pas été déployé puis testé. Le code fonctionnel peut être démontré localement, mais ces prérequis empêchent de déclarer le produit prêt pour un pilote réel.
