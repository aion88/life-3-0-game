/** Couplages entre variables : simultanés (fast-forward) ou séquentiels (rue, projection) [GDD 03 §3.3, §4 ; D123]. */
import { GridError, clampAxis } from '../shared/milli';
import type { Coupling } from '../data/schema/engine';
import type { CouplingStrategy, WorldVector } from '../shared/types/world';
import { holds } from './conditions';
import { addDelta, clampVector } from './vector';

/** Effet entier d'un couplage : signe × magnitude × scale100 / 100, exact sinon `GridError`. */
function effectOf(c: Coupling, scale100: number): number {
  const e = (c.sign * c.magnitude * scale100) / 100;
  if (!Number.isInteger(e)) throw new GridError(`effet non entier pour ${c.id} : ${e}`);
  return e;
}

/**
 * Applique les couplages et dit lesquels ont tenu (dans l'ordre du fichier).
 * Simultané : conditions lues sur l'entrée, effets sommés, un seul clamp.
 * Séquentiel : conditions lues sur le vecteur courant, clamp après chaque effet.
 */
export function applyCouplingsTraced(
  v: WorldVector, couplings: readonly Coupling[], strategy: CouplingStrategy, scale100: number,
): { readonly v: WorldVector; readonly fired: readonly boolean[] } {
  const seq = strategy === 'sequential';
  let cur = v;
  const fired: boolean[] = [];
  for (const c of couplings) {
    const on = c.when.every((w) => holds(seq ? cur : v, w));
    fired.push(on);
    if (!on) continue;
    const next = addDelta(cur, { [c.target]: effectOf(c, scale100) });
    cur = seq ? { ...next, [c.target]: clampAxis(next[c.target]) } : next;
  }
  return { v: seq ? cur : clampVector(cur), fired };
}

/** Comme {@link applyCouplingsTraced}, sans la trace. */
export function applyCouplings(
  v: WorldVector, couplings: readonly Coupling[], strategy: CouplingStrategy, scale100: number,
): WorldVector {
  return applyCouplingsTraced(v, couplings, strategy, scale100).v;
}
