/** Monde d'arrivée, écart d'arrivée et redirection de la tranche [GDD 02 §3.6 ; D111, D41, D140]. */
import { dist2 } from '../engine/vector';
import { nearestArrival } from '../engine/nearest';
import type { CoreData } from '../data/schema/core';
import type { Milli } from '../shared/milli';
import type { ArrivalOffset, RunOutcome } from '../shared/types/run';
import { WORLD_VARS, type WorldVar, type WorldVector } from '../shared/types/world';

/** Seuil d'écart : un axe n'est gardé que s'il dépasse 15 points, soit 15 000 millièmes [D41, GDD 02 §3.6]. */
export const OFFSET_AXIS_THRESHOLD: Milli = 15_000 as Milli;
/** Nombre d'axes d'écart gardés au plus : les deux plus grands [D41, GDD 02 §3.6]. */
export const OFFSET_AXES_KEPT = 2;

/** Monde d'arrivée le plus proche : défini dans le moteur (la projection du bilan en dépend), ré-exporté ici [D111]. */
export { nearestArrival };

/** Les deux plus grands |écart| au-dessus du seuil ; égalité départagée par l'ordre de `WORLD_VARS` (tri stable). */
function farAxes(v: WorldVector, world: WorldVector): ArrivalOffset['axes'] {
  const all = WORLD_VARS.map((k: WorldVar) => ({ var: k, signed: (v[k] - world[k]) as Milli }));
  return all
    .filter((a) => Math.abs(a.signed) > OFFSET_AXIS_THRESHOLD)
    .sort((a, b) => Math.abs(b.signed) - Math.abs(a.signed))
    .slice(0, OFFSET_AXES_KEPT);
}

/** Issue d'arrivée : monde calculé, monde vécu (redirection D140), distance² et écart contre le monde calculé. */
export function arrivalOutcome(atChoice: WorldVector, core: CoreData): Extract<RunOutcome, { kind: 'arrival' }> {
  const { catalogue, engine, build } = core;
  const computedWorld = nearestArrival(atChoice, catalogue, undefined, engine.axisWeights);
  const livedWorld = nearestArrival(atChoice, catalogue, build.streetWorlds, engine.axisWeights);
  const target = catalogue.byId[computedWorld].vector as WorldVector;
  const distanceSq = dist2(atChoice, target); // sans poids
  const far = distanceSq > engine.farArrivalDistance ** 2; // sans racine
  return {
    kind: 'arrival', computedWorld, livedWorld, redirected: computedWorld !== livedWorld,
    distanceSq, offset: { axes: far ? farAxes(atChoice, target) : [] },
  };
}
