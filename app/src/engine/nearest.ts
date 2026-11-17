/** Monde d'arrivée le plus proche, partagé par la projection du bilan et le fast-forward [GDD 02 §3.6 ; D111]. */
import type { Catalogue } from '../data/schema/catalogue';
import type { EngineConfig } from '../data/schema/engine';
import { worldNumber, type ArrivalWorldId, type WorldVector } from '../shared/types/world';
import { absSum, dist2 } from './vector';

/**
 * Monde d'arrivée le plus proche [D111] : d² minimal (pondéré par `weights`, 1 par défaut),
 * puis somme des écarts absolus minimale, puis `worldNumber` le plus bas. Un seul passage.
 */
export function nearestArrival(
  v: WorldVector,
  catalogue: Catalogue,
  among?: readonly ArrivalWorldId[],
  weights?: EngineConfig['axisWeights'],
): ArrivalWorldId {
  let best: { id: ArrivalWorldId; d: number; s: number; n: number } | null = null;
  for (const e of catalogue.entries) {
    if (e.kind !== 'arrival' || e.vector === null) continue;
    const id = e.id as ArrivalWorldId;
    if (among !== undefined && !among.includes(id)) continue;
    const cand = { id, d: dist2(v, e.vector, weights), s: absSum(v, e.vector), n: worldNumber(id) };
    if (best === null || cand.d < best.d || (cand.d === best.d && (cand.s < best.s || (cand.s === best.s && cand.n < best.n)))) {
      best = cand;
    }
  }
  if (best === null) throw new Error('nearestArrival : aucun monde d\'arrivée candidat');
  return best.id;
}
