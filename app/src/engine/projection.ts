/** Projection du bilan : dérive du monde vécu après la semaine, bascule, année et écart, extinction [GDD 03 §4 ; GDD 06 §3.4 ; D111, D116 (3), D123, D129, D140 (3)]. */
import type { CoreData } from '../data/schema/core';
import type { WorldData } from '../data/schema/world';
import { nearestArrival } from './nearest';
import { GridError } from '../shared/milli';
import type { Projection } from '../shared/types/run';
import { WORLD_VARS, type ArrivalWorldId, type Delta, type WorldVector } from '../shared/types/world';
import { holds } from './conditions';
import { applyCouplings } from './couplings';
import { addDelta, clampVector } from './vector';

/** Année du pas 0 de la projection [GDD 03 §4, formule A ; D129]. */
export const PROJECTION_BASE_YEAR = 2030;
/** Décalage en pas ajouté au pas de bascule avant la division : A = 2030 + ⌊(s* + 2)/12⌋ [GDD 03 §4 ; D129]. */
export const BASCULE_STEP_OFFSET = 2;
/** Pas par an [GDD 03 §4 ; D129]. */
export const STEPS_PER_YEAR = 12;

/** Année de bascule A = 2030 + ⌊(s* + 2)/12⌋ [GDD 03 §4 ; D129]. */
export function basculeYear(switchStep: number): number {
  return PROJECTION_BASE_YEAR + Math.floor((switchStep + BASCULE_STEP_OFFSET) / STEPS_PER_YEAR);
}

/**
 * Écart N = (s*_sans − s*_avec)/12, arrondi au plus proche, le demi vers zéro [GDD 03 §4 ; D129].
 * Sur les entiers : pour d = |diff|, ⌊(2d + 12 − 1)/24⌋ ; aucun flottant ne décide d'un demi.
 */
export function shiftYears(switchWithout: number, switchWith: number): number {
  const diff = switchWithout - switchWith;
  const n = Math.floor((2 * Math.abs(diff) + STEPS_PER_YEAR - 1) / (2 * STEPS_PER_YEAR));
  return n === 0 ? 0 : Math.sign(diff) * n;
}

/** Dérive × σ en millièmes : σ entier > 0, produit entier sinon `GridError` (même contrat que l'échelle des couplages). */
function scaledDrift(drift: Delta, sigma100: number): Delta {
  if (!Number.isInteger(sigma100) || sigma100 <= 0) throw new RangeError(`sigma100 doit être un entier > 0 : ${sigma100}`);
  const out: Partial<Record<(typeof WORLD_VARS)[number], number>> = {};
  for (const k of WORLD_VARS) {
    const d = drift[k];
    if (d === undefined) continue;
    if ((d * sigma100) % 100 !== 0) throw new GridError(`dérive × σ non entière pour ${k} : ${d} × ${sigma100} / 100`);
    out[k] = (d * sigma100) / 100;
  }
  return out as Delta;
}

/**
 * Pas de rupture de la première extinction déclarée tenue `hold` pas consécutifs, ou null [GDD 02 §3.5, §4.3 ; GDD 06 §3.4].
 * Règle du fast-forward (`advance` de simulate.ts, non exportée, donc réécrite au minimum) : rupture = début du run + hold − 1 ;
 * `fromStep` ignoré, la projection partant après 2030 ; le pas 0 est le départ, évalué à partir du pas 1.
 */
function extinctionStepOf(trajectory: readonly WorldVector[], world: WorldData, core: CoreData): number | null {
  let best: number | null = null;
  for (const rule of core.engine.extinctions) {
    if (!world.engine.projectionExtinctions.includes(rule.id)) continue;
    let len = 0;
    for (let step = 1; step < trajectory.length; step++) {
      len = rule.all.every((c) => holds(trajectory[step]!, c)) ? len + 1 : 0;
      if (len >= rule.hold) {
        if (best === null || step < best) best = step;
        break;
      }
    }
  }
  return best;
}

/**
 * Projette le bilan : un pas = dérive × σ avec clamp, couplages séquentiels avec clamp après chacun, écho figé avec clamp [GDD 03 §4 ; D123].
 * `switchStep` : premier pas s ≥ 0 où le plus proche (D111), parmi le monde vécu et les cibles de ses pentes, n'est plus le monde vécu
 * [D140 (3) « la bascule de 1984 » ; à confirmer: game-designer] ; s = 0 permis, `steps` vaut alors `[start]`.
 * `steps` s'arrête au pas de bascule ; la recherche d'extinction court jusqu'à `projectionHorizon` [GDD 06 §3.4].
 */
export function project(start: WorldVector, frozenEcho: Delta, world: WorldData, core: CoreData, sigma100: number): Projection {
  const drift = scaledDrift(world.engine.drift, sigma100);
  const candidates: ArrivalWorldId[] = [world.id, ...world.engine.slopes.map((s) => s.to)];
  const nearest = (v: WorldVector): ArrivalWorldId => nearestArrival(v, core.catalogue, candidates, core.engine.axisWeights);
  const trajectory: WorldVector[] = [start];
  let switchStep: number | null = null;
  let toWorld: ArrivalWorldId | null = null;
  const first = nearest(start);
  if (first !== world.id) { switchStep = 0; toWorld = first; }
  for (let step = 1; step <= core.engine.projectionHorizon; step++) {
    const drifted = clampVector(addDelta(trajectory[step - 1]!, drift));
    const coupled = applyCouplings(drifted, core.engine.couplings, 'sequential', world.engine.couplingScale100);
    const next = clampVector(addDelta(coupled, frozenEcho));
    trajectory.push(next);
    if (switchStep === null) {
      const here = nearest(next);
      if (here !== world.id) { switchStep = step; toWorld = here; }
    }
  }
  return {
    steps: switchStep === null ? trajectory : trajectory.slice(0, switchStep + 1),
    switchStep, toWorld, extinctionStep: extinctionStepOf(trajectory, world, core),
  };
}
