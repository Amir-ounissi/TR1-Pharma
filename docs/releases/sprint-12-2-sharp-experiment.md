# Sprint 12.2A — Expérience Sharp 0.35

## Base

- Branche : `experiment/sharp-0-35-compatibility`.
- Point de départ : `e3cffdd880abd86bb423636832fbc892d6142e2b`.
- Arbre initial : `next@16.2.12 → sharp@0.34.5` optionnel runtime.
- Audit initial : 2 high, 0 critical.

## Tentative

Installation isolée de `sharp@0.35.3` sans `--force`, canary, downgrade, override ou édition manuelle du lockfile. Le premier essai a rencontré un cache npm corrompu ; le second a utilisé un cache isolé.

Arbre observé :

```text
next@16.2.12
└── sharp@0.34.5
sharp@0.35.3 extraneous
```

La contrainte `sharp ^0.34.5` de Next 16.2.12 n’accepte pas 0.35.x. npm conserve donc la version vulnérable imbriquée et l’audit runtime reste à 2 high. La résolution n’est pas propre et ne satisfait pas l’objectif sécurité ; la régression complète est arrêtée en fail-fast à ce gate.

## Décision

Cas B — non compatible. Aucun changement Sharp n’est intégré à la branche release. Next stable est conservé et le gate sécurité reste bloquant jusqu’à une version stable compatible ou une acceptation formelle du risque.
