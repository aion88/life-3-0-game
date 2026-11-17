/** Aides de test de l'étalonnage de la rue [plan 02a T3, errata R-02a.2, R-02a.10]. Un fichier, un écrivain. */
import { parseScene, type GradeData, type Sourced } from '../../src/engine/view/sceneSchema';
import type { LightBlend } from '../../src/engine/view/grade';
import w10SceneRaw from '../../src/street/data/w10.scene.json';
import { toMilli } from '../../src/shared/milli';
import type { ArrivalOffset } from '../../src/shared/types/run';
import type { WorldVar, WorldVector } from '../../src/shared/types/world';
import { ctxW10 } from './street';

/** Étalonnage réel de w10, tel que la donnée l'écrit (tous les gains `null`). */
export const G: GradeData = parseScene(w10SceneRaw, ctxW10().street).grade;

/** Taux d'adaptation de test : monter (sombre vers clair) plus vite que descendre [art bible §E.5]. Indépendant de la donnée de w10. */
export const GA: GradeData['exposure']['adapt'] = {
  upRatePerS: { v: 1.5, src: 'test', status: 'sourced' },
  downRatePerS: { v: 0.5, src: 'test', status: 'sourced' },
};

/** Monde de départ, en points. */
export const V0pts: Readonly<Record<WorldVar, number>> = { aiPower: 50, order: 50, abundance: 50, freedom: 50, surveillance: 50, unrest: 50 };
export const V0: WorldVector = Object.fromEntries(Object.entries(V0pts).map(([k, n]) => [k, toMilli(n)])) as unknown as WorldVector;

/** Fondu arrêté à l'heure bleue. */
export const HB: LightBlend = { from: 'heureBleue', to: 'heureBleue', t: 1 };
/** Aucun écart d'arrivée. */
export const NONE: ArrivalOffset = { axes: [] };

/** Copie de `g` avec un gain écrit `coef` pour `uniform` sur la variable `v`, provenance `test` [R-02a.10]. */
export function withGain(g: GradeData, uniform: keyof GradeData['gains'], v: WorldVar, coef: number): GradeData {
  const written: Sourced<number> = { v: coef, src: 'test', status: 'sourced' };
  return { ...g, gains: { ...g.gains, [uniform]: { [v]: written } } };
}
