# TR1 PHARMA — Import MS ONLINE & Laboratoires NYM (staging uniquement)

Date : 12 novembre 2026. **Aucun catalogue fournisseur publié à destination des officines.**
Environnement : Supabase staging `ehptapmuzckazyxmnmnm`.
Super-administration : `/catalogue/administration/imports`.

## Sources

- MS ONLINE : email « Fwd: catalogue EXCEL MS Online », reçu le 3 novembre 2026 ;
  `MS_ONLINE_CATALOGUE_EXCEL.xlsx`, déclaré par l'expéditeur comme la version
  **complète et à jour**, qui annule et remplace le précédent fichier.
- MS ONLINE : email « Fwd: catalogue MS ONLINE », 3 novembre 2026 ;
  `CATALOGUE_MS_ONLINE_2026_PHARMACIExCONSO (1).pdf` (64 pages) et
  `GRILLE TARIFAIRE MS ONLINE-FR (2).xlsx` antérieure. Cette dernière
  n'a **pas** été substituée à la version actualisée.
- NYM : email « NYM x Amir : suite de notre échange », 6 novembre 2026 ;
  `Plaquette NYM Oct 2026.pdf`, bon de commande p. 4 (tarif général 2026).
  Les 3 chevalets PLV à 0 € et les nouveautés annoncées « à venir » sont
  exclus de l'import des produits commercialisables.

## Résultat vérifié en SQL

| Indicateur | MS ONLINE | NYM |
|---|---:|---:|
| Marque créée en brouillon | Oui | Oui |
| Produits importés en brouillon | 157 | 14 |
| Paliers / prix fournisseurs confidentiels | 219 | 14 |
| Produits publiés | 0 | 0 |
| TVA sans source, à confirmer | 157 | 14 |
| EAN non certifiés (valeur publique laissée vide) | 20 | 0 |
| Accès pharmacie accordé | 0 | 0 |

MS ONLINE comporte 17 catégories sources. Les prix/quantités des 219
paliers sont conservés dans `public.private_catalog_supplier_tiers`,
table verrouillée par RLS super-administrateur. Ils ne constituent PAS les
fourchettes indicatives ni les prix contractuels pour les officines.
Tous les prix sont ceux du document source, en HT, non actualisés.

## Qualité et anomalies sources

- **6** EAN MS ONLINE avec clé de contrôle GTIN invalide.
- **6 couples** de références MS ONLINE qui partagent un même EAN (12 lignes).
- **2** références sans EAN source.
- **7** libellés de quantité composites (« 12/48 », « 576+ », etc.) non
  convertis en pas de commande confirmé. Une ligne supplémentaire possède
  un prix mais ne précise pas la quantité.
- Les prix d'achat MS ONLINE au millième/10 000e (ex. 0,0350 €)
  sont stockés sans arrondi dans `numeric(12,4)`.
- La grille des TVA n'est fournie dans aucun des deux documents : `vat_rate`
  reste **NULL**, jamais présumé 0 %, 5,5 % ou 20 %.
- Les minimums issus du fournisseur sont indicatifs lorsque le palier est
  simple ; le pas de commande enregistré (1) est un placeholder **non
  validé**, et la fiche porte `requires_review=true`.
- La présence de photos dans la feuille Excel MS ONLINE ne vaut pas
  autorisation d'exploitation. Aucun packshot MS ONLINE ou NYM non validé
  n'a été rendu public.

## Garde-fous techniques

- Marques `ms-online` et `nym` : `active=false`.
- Fiches importées : `active=false`, `requires_review=true`.
- Contrainte en base : une fiche ne peut devenir active si sa TVA est
  inconnue ou si `requires_review` est toujours vrai.
- Aucune règle d'accès pharmacie, aucun palier indicatif clientèle,
  aucun contrat particulier, aucune commande réelle créée.
- La table fournisseur est limitée au rôle `super_admin` par RLS ;
  test SQL avec utilisateur authentifié non autorisé = **0 ligne visible**.
- L'ancienne fiche VK SWISS et le site public en production sont inchangés.
- Le back-office permet de consulter et filtrer ces imports mais ne publie
  automatiquement aucune marque.

## Avant d'ouvrir à une pharmacie

1. Valider avec les marques le droit de distribution, les visuels et les
   fiches produit ; vérifier les produits effectivement commercialisables.
2. Confirmer EAN (20 anomalies MS ONLINE), TVA, quantités/colisage et
   éventuelles restrictions de vente.
3. Vérifier les prix à jour et franco de port ; le franco 150 € figurait
   dans l'ancienne grille MS ONLINE, **non automatiquement applicable**.
4. Définir les prix clients autorisés, les paliers et les accords par
   officine sans confondre coût fournisseur, commission d'agent et
   prix de vente B2B.
5. Compléter les fiches, lever explicitement les flags de revue après
   contrôle et activer chaque référence puis chaque marque.
6. Tester avec au moins deux officines, les droits de visibilité, panier,
   devis/commande et emails de confirmation avant production.
