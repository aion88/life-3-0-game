Moteur pur (sans DOM, sans hasard ni horloge non injectés). Propriétaire : plans 01 et 02b.

## moments

Moteur des moments de rue (plan 02b, `moments/`). Surface publique : `moments/index.ts`, rien d'autre ne s'importe depuis l'extérieur.
Trois règles : un seul chemin d'un acte vers l'état, `reduceAct` (ni `confirm` ni l'interface n'écrivent l'état) ; le rejeu est un pli de `reduceAct` sur les actes ; l'horloge vient des actes, jamais d'une montre.
