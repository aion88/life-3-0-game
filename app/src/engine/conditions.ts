/** Évaluation d'une condition sur un vecteur du monde [GDD 03 §3.3, §3.4]. */
import type { Condition } from '../data/schema/common';
import type { WorldVector } from '../shared/types/world';

/** Vrai si la condition tient sur `v` ; comparateurs `>`, `<`, `>=`, `<=`. */
export function holds(v: WorldVector, c: Condition): boolean {
  const x = v[c.var];
  switch (c.cmp) {
    case '>': return x > c.threshold;
    case '<': return x < c.threshold;
    case '>=': return x >= c.threshold;
    case '<=': return x <= c.threshold;
  }
}
