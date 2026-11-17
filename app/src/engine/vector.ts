/** Arithmétique de vecteurs du monde, entière, en millièmes [GDD 03 §3.1, §4]. */
import { clampAxis, type Milli } from '../shared/milli';
import { WORLD_VARS, type Delta, type WorldVar, type WorldVector } from '../shared/types/world';

/** Construit un vecteur en appliquant `f` à chaque axe, dans l'ordre fixe des variables. */
function mapAxes(f: (k: WorldVar) => number): WorldVector {
  const out = {} as Record<WorldVar, Milli>;
  for (const k of WORLD_VARS) out[k] = f(k) as Milli;
  return out;
}

/** Ajoute une variation partielle, sans borner [GDD 03 §4]. */
export function addDelta(v: WorldVector, d: Delta): WorldVector {
  return mapAxes((k) => v[k] + (d[k] ?? 0));
}

/** Borne chaque axe à 0..100 000 ; un non-entier lève `GridError` [GDD 03 §4]. */
export function clampVector(v: WorldVector): WorldVector {
  return mapAxes((k) => clampAxis(v[k]));
}

/**
 * Distance au carré en millièmes², pondérée par axe (1 par défaut) [GDD 02 §3.6].
 * Peut dépasser int32 (jusqu'à 6e10) : nombres JS exacts jusqu'à 2^53.
 */
export function dist2(a: WorldVector, b: WorldVector, weights?: Readonly<Record<WorldVar, number>>): number {
  let s = 0;
  for (const k of WORLD_VARS) s += (weights?.[k] ?? 1) * (a[k] - b[k]) ** 2;
  return s;
}

/** Somme des écarts absolus par axe, sans poids, en millièmes [GDD 03 §4]. */
export function absSum(a: WorldVector, b: WorldVector): number {
  let s = 0;
  for (const k of WORLD_VARS) s += Math.abs(a[k] - b[k]);
  return s;
}
