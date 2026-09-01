# Sprint 12.2A — Informations juridiques attendues

Le propriétaire doit faire valider puis fournir :

- raison sociale ;
- forme juridique ;
- capital social ;
- adresse du siège ;
- numéro d’immatriculation ;
- numéro de TVA ;
- directeur de publication ;
- email de contact ;
- responsable du traitement ;
- contact d’exercice des droits ;
- nom et adresse de l’hébergeur ;
- durée de conservation des leads ;
- base juridique du traitement ;
- date de mise à jour de la politique.

Correspondance des variables : `.env.example` et `.env.staging.example`.

- Local et staging : placeholders visibles et warning de validation.
- Production : `APP_ENV=production npm run build` et `npm run legal:check:production` échouent tant qu’un champ manque.
- Formulaire : information neutre, sans consentement marketing ajouté.
