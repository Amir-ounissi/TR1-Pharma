# Sprint 6.1 — Agent UX Polish

## Modifications

- couche centralisée de libellés métier et suppression des enums techniques visibles ;
- formatage temporel relatif : aujourd’hui, demain, dans X jours, en retard de X jours et date absente ;
- carte prochaine visite compacte sur mobile avec contexte repliable ;
- Mode visite persistant dans `localStorage`, restauré après recharge et supprimé après validation ou abandon ;
- terminaison de visite ouvrant immédiatement le compte rendu prérempli avec l’heure de début ;
- navigation mobile sticky compatible avec les safe areas et zones tactiles de 44 px minimum ;
- tâches réellement distinctes conservées et différenciées par type, libellé et heure.

## Fichiers structurants

- `src/lib/presentation.ts`
- `src/lib/visit-mode.ts`
- `src/components/agent/agent-day-experience.tsx`
- `src/components/agent/quick-interaction.tsx`
- `src/components/app-shell.tsx`
- `e2e/sprint6-1-agent-ux.spec.ts`

## Validation

- reconstruction : 6 migrations et seed appliqués ;
- pgTAP : 228/228 ;
- Vitest : 38/38 ;
- E2E : 8/8 ;
- db lint : aucune erreur ;
- db advisors : aucun problème ;
- lint et build : réussis ;
- Security Gate : `images.unoptimized=true` et test `/_next/image` conservés.

## Risques ouverts

- aucun package n’a été ajouté ou mis à jour ;
- la régénération de `npm audit --omit=dev --json` reste bloquée par `ENOTFOUND registry.npmjs.org` ;
- le risque Sharp déjà qualifié reste mitigé par la désactivation de l’optimiseur Next.js ;
- le Mode visite reste volontairement local à l’appareil, sans synchronisation serveur ou géolocalisation.
