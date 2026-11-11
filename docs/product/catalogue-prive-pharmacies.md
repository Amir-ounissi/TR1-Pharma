# TR1 PHARMA — catalogue prive des pharmacies invitees

## Perimetre de la branche
Cette fonctionnalite est **separee** des modules existants de gestion de commandes, HubSpot, missions et CRM. Aucune table existante n'est modifiee.

URL provisoire dans l'application : **/catalogue** (acces pharmacie) et **/catalogue/administration** (super-admin). Le sous-domaine \`catalogue.tr1pharma.com\` n'est **pas configure** par ce code : il necessite une configuration DNS/Vercel et une strategie de routage avant publication.

### Fonctionnel en MVP (apres migration et configuration Auth)
- Auth Supabase existante, mais espace prive distinct, sans inscription libre.
- Invitation par un administrateur de plateforme, liaison 1 compte = 1 pharmacie.
- Attribution manuelle de marques a chaque pharmacie; publication independante.
- Fiches produit avec prix HT et TVA explicitement saisis.
- Prix special par officine (surclasse le prix produit).
- Demande de commande par **marque unique**, prix recalcules cote serveur et quantites controlees.
- Historique des demandes avec statut; administration permet de mettre a jour ce statut.
- Isolation via API privee et tables RLS sans policies, sans privileges anon/authenticated.
- Aucune commande n'est envoyee a un laboratoire, aucun paiement ou facture n'est declenche.

### Hors MVP / non operationnel
- Import produit CSV, photos, documents, fiches PDF, EAN recherche.
- Gratuités, offres par paliers, remises cumulees, remises de groupements.
- Notifications email de nouvelles demandes/confirmation.
- Reassort en 1 clic, panier multimarque, suivi des livraisons.
- Gestion avancee de plusieurs utilisateurs par officine et revocation depuis l'interface.
- Connexion du catalogue au CRM, aux commandes internes et aux laboratoires.
- Verification automatique du SIRET/RPPS et des qualifications.

### A executer avant la demonstration invitee
1. Appliquer **uniquement sur Supabase staging** la migration \`20261111110000_private_pharmacy_catalog.sql\`. Ne pas toucher a la production sans validation.
2. Verifier que Vercel preview utilise exclusivement l'URL et les secrets **staging** de Supabase.
3. Configurer dans Supabase Auth staging le template d'invitation afin que l'utilisateur arrive sur
   \`/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/catalogue/activer\`.
   Tester le format effectif de la variable dans le template en contexte Supabase.
4. Configurer les URLs de redirection autorisees pour le domaine de preview utilise.
5. Creer une pharmacie **fictive**, une marque **fictive** et des produits de test en staging, puis autoriser la marque et inviter une adresse email de test controlee.
6. Tester depuis 2 comptes de pharmacies fictives l'impossibilite d'acceder aux marques, produits et demandes de l'autre.
7. Tester les quantites, tarifs personnalises, controle du role admin et historique.
8. Executer les tests unitaires, le typecheck, la CI et les controles de securite/advisors.
9. Obtenir une validation utilisateur explicite avant toute fusion/release en production, configuration DNS ou invitation reelle.

### Points de vigilance
- Le formulaire d'invitation **envoie immediatement un email** lorsque l'administrateur clique dessus. Aucun envoi n'est effectue par un simple deploy.
- L'URL de redirection vient de \`resolveAppUrl()\`; confirmer que \`NEXT_PUBLIC_APP_URL\` pointe vers le domaine du bon environnement.
- L'ensemble des lectures et ecritures du catalogue passe par une connexion \`service_role\` strictement serveur et des controles explicites d'authentification/autorisation. Ne jamais exposer cette cle dans le navigateur.
- Les tables \`private_catalog_*\` sont RLS et interdites aux roles \`anon\` et \`authenticated\`. Ne pas retirer ces protections pour contourner une erreur de code.
- Les prix/quantites sont recalcules depuis la base; la page produit n'a aucune autorite sur le tarif.
- L'application de cette migration a la production est un changement de schema a planifier apres controles et validation.
- Ne publier que des marques et visuels dont les autorisations commerciales sont confirmees (par ex. VK SWISS). Aucune reference commerciale inventee n'est prechargee.
