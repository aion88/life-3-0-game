/** Aide de test : points vers `WorldVector`, sans valeur de jeu [R-01.3]. */
import { toAxisMilli } from '../../src/shared/milli';
import type { WorldVector } from '../../src/shared/types/world';

/** `v(ap, or, ab, fr, su, un)` en points, dans l'ordre des variables du monde. */
export function v(ap: number, or: number, ab: number, fr: number, su: number, un: number): WorldVector {
  return {
    aiPower: toAxisMilli(ap), order: toAxisMilli(or), abundance: toAxisMilli(ab),
    freedom: toAxisMilli(fr), surveillance: toAxisMilli(su), unrest: toAxisMilli(un),
  };
}
