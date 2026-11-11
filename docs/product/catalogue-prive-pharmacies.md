# TR1 PHARMA — catalogue prive des pharmacies invitees

## Perimetre de la branche
Cette fonctionnalite est **separee** des modules existants de gestion de commandes, HubSpot, missions et CRM. Aucune table existante n'est modifiee.

URL provisoire dans l'application : **/catalogue** (acces pharmacie) et **/catalogue/administration** (super-admin). Le sous-domaine \`catalogue.tr1pharma.com\` n'est **pas configure** par ce code : il necessite une configuration DNS/Vercel et une strategie de routage avant publication.

### Fonctionnel en MVP (apres migration et configuration Auth)
- Auth Supabase existante, mais espace prive distinct, sans inscription libre.
- Invitation par un administrateur de plateforme, liaison 1 compte = 1 pharmacie.
- Attribution manuelle de marques a chaque pharmacie; publication independante.
- Fiches produit avec **prix de reference interne, non transmis aux pharmacies**, TVA et quantites.
- Fourchettes de prix HT indicatives par reference et palier de volume (independantes des prix internes), visibles uniquement par les officines autorisees pour la marque.
- Visibilite parametree par pharmacie ET marque : **indicative par defaut** ; prix exacts uniquement pour les accords configures sur la reference.
- Paliers contractuels par pharmacie, produit et quantite. Compatibilite conservee avec l'ancien prix fixe personnalise.
- Si l'officine ne dispose pas d'un prix exact sur toutes les lignes, la demande est une **demande de conditions / devis**, sans total HT fictif. Sinon, demande de commande avec prix fermes recalcules au serveur.
- Demandes **mono-marque**, quantites et autorisations controlees au serveur.
- Historique des demandes avec statut; administration permet de mettre a jour ce statut.
- Isolation via API privee et tables RLS sans policies, sans privileges anon/authenticated.
- Aucune commande n'est envoyee a un laboratoire, aucun paiement ou facture n'est declenche.

### Hors MVP / non operationnel
- Import produit CSV, photos, documents, fiches PDF, EAN recherche.
- Gratuites, remises cumulees, remises de groupements, conditions de franco de port. Les paliers de prix simples sont geres ; les offres conditionnelles complexes ne le sont pas.
- Notifications email de nouvelles demandes/confirmation.
- Reassort en 1 clic, panier multimarque, suivi des livraisons.
- Gestion avancee de plusieurs utilisateurs par officine et revocation depuis l'interface.
- Connexion du catalogue au CRM, aux commandes internes et aux laboratoires.
- Verification automatique du SIRET/RPPS et des qualifications.

### A executer avant la demonstration invitee
1. Migrations **appliquees sur Supabase staging uniquement** : \`20261111100242_private_pharmacy_catalog.sql\` et \`20261111143935_private_catalog_pricing_tiers.sql\`. Ne pas toucher a la production sans validation.
2. **Bloquant connu** : les logs Vercel ont signale \`Invalid API key\`. L'URL et la cle publique Preview pointent bien vers Supabase staging, mais \`SUPABASE_SECRET_KEY\` doit etre configuree avec la cle secrete du projet staging, limitee a la preview/branche. Ne pas remplacer la cle production. Les previews continueront d'echouer pour la page admin tant que ce point n'est pas corrige.
3. Configurer dans Supabase Auth staging le template d'invitation afin que l'utilisateur arrive sur
   \`/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/catalogue/activer\`.
   Tester le format effectif de la variable dans le template en contexte Supabase.
4. Configurer les URLs de redirection autorisees pour le domaine de preview utilise.
5. Creer une pharmacie **fictive**, une marque **fictive** et des produits de test en staging, puis autoriser la marque et inviter une adresse email de test controlee.
6. Tester depuis 2 comptes de pharmacies fictives l'impossibilite d'acceder aux marques, produits et demandes de l'autre.
7. Tester les quantites, les deux types de paliers, les modes par marque, les appels sans tarif exact (devis nul), la confidentialite des prix internes, les refus d'acces et l'historique.
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

### Contrat des prix
- \`private_catalog_products.price_ht\` : prix interne, ne jamais inclure dans le payload du composant pharmacie.
- \`private_catalog_indicative_tiers\` : seuil minimum + borne basse/haute de prix HT publiable, independants du prix interne.
- \`private_catalog_access.pricing_mode\` : \`indicative\` par defaut ; \`contractual\` n'expose que les prix contractuels explicites pour les produits concernes.
- \`private_catalog_contract_tiers\` : prix exact selon le volume, limite a une pharmacie et un produit ; l'ancien \`private_catalog_prices\` sert de fallback pour les accords deja renseignes.
- Pour une demande mixte (un produit sans prix ferme), enregistrer \`request_kind='quote'\`, \`total_ht=NULL\` et des lignes sans montant, plutot que de retourner une somme partielle ou inventee.
- Les fourchettes ne sont jamais des prix garantis. La saisie par l'administrateur doit etre approuvee par la marque ; ne pas saisir automatiquement les prix planchers reels.
