# Photos fournisseur – V2

## Audit du 24/11/2026
- 185 fiches produits sur V2, 53 photographies renseignées avant import.
- 74 nouvelles URL d'images en brouillon, soit 127 références avec photo ; 58 encore sans photo.
- Beauty of Joseon : 22 photographies (22/42 au total), Biodance : 25 (25/29), Dr. Althea : 14 (14/20).
- Nōto : 12 (12/20), Bloomster : 1 (4/5).
- 74 références inscrites dans `product_media_audit`, statut `pending`, rapprochement par titre sur le site officiel et URL image vérifiée HTTP 200. **L'EAN et le format photographié ne sont pas confirmés automatiquement.**
- Les autres photos déjà renseignées n'ont pas d'attestation dans ce registre.
- Révision propriétaire : `/app/medias`, approbation explicite ou rejet révoquant l'URL si toujours identique.
- Photo vérifiée ne vaut ni homologation produit, ni autorisation de publier, ni prix fournisseur confirmé.
- 0 produit publié, domaine V2 séparé de la production historique.
- Sources d'images fabricant : `beautyofjoseon.com`, `biodance.com`, `doctoraltheaglobal.com`, `notocbd.com`, `bloomster.fr`. Les images restent sur leurs URL d'origine ; hébergement pérenne / permissions fournisseur à traiter ultérieurement.

## Règle tarifaire officine
Sur la gamme documentaire Althesia non bloquée, le coefficient multiplicateur est :
`PVC TTC / (PA HT * unités payées / (unités payées + UG))`.
Il est affiché par palier et distinct du taux de marque HT. Les tarifs sont historiques et doivent être reconfirmés avant commande.
