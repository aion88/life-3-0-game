/** Fast-forward 2026-2030 : 48 pas, extinctions émergentes (D40), continuation jusqu'à la rupture [GDD 02 §4.2, §4.3 ; D40]. */
import { holds } from '../engine/conditions';
import { applyCouplings } from '../engine/couplings';
import { addDelta, clampVector } from '../engine/vector';
import type { EngineConfig } from '../data/schema/engine';
import type { Trajectory } from '../shared/types/run';
import type { ExtinctionId, PushVector, WorldVector } from '../shared/types/world';

/** Résultat du fast-forward : trajectoire, vecteur au choix, extinction éventuelle. */
export interface FastForwardRun {
  readonly trajectory: Trajectory; // steps[0] = V0 ; jusqu'à choiceStep, ou jusqu'à la rupture
  readonly atChoice: WorldVector; // vecteur du pas choiceStep, ou dernier vecteur si la rupture vient avant
  readonly extinction: { readonly world: ExtinctionId; readonly runStartStep: number; readonly ruptureStep: number } | null;
}

/** Série d'une règle d'extinction : pas de début du run en cours et longueur (len 0 = fermée). */
interface Series { start: number; len: number }

/** Part de P aux pas de poussée (un quart pour les quatre pas du schéma), rien ailleurs ; exact car P est un entier ×1000. */
function quarterOf(push: PushVector, step: number, engine: EngineConfig): Partial<PushVector> {
  if (!engine.steps.pushSteps.includes(step)) return {};
  return Object.fromEntries(Object.entries(push).map(([k, x]) => [k, x / engine.steps.pushSteps.length]));
}

/** Un pas pur : quart de P, clamp, couplages simultanés à l'échelle 100, clamp [d106.simulate02, GDD 03 T-8]. */
export function fastForwardStep(v: WorldVector, step: number, push: PushVector, engine: EngineConfig): WorldVector {
  const pushed = clampVector(addDelta(v, quarterOf(push, step, engine)));
  return applyCouplings(pushed, engine.couplings, 'simultaneous', 100);
}

/** Met à jour les séries sur `v` ; rend l'index de la première règle (ordre de `extinctions`) arrivée à `hold`, ou -1. */
function advance(series: Series[], engine: EngineConfig, v: WorldVector, step: number): number {
  engine.extinctions.forEach((r, i) => {
    const s = series[i]!;
    const on = step >= r.fromStep && r.all.every((c) => holds(v, c));
    s.len = on ? s.len + 1 : 0;
    s.start = on ? (s.len === 1 ? step : s.start) : 0;
  });
  return engine.extinctions.findIndex((r, i) => series[i]!.len >= r.hold && series[i]!.start <= engine.steps.choiceStep);
}

/** Vrai si une série ouverte a commencé au plus tard au pas `choiceStep` : elle peut encore rompre. */
function pending(series: readonly Series[], choiceStep: number): boolean {
  return series.some((s) => s.len > 0 && s.start <= choiceStep);
}

/** Rejoue jusqu'au pas `choiceStep`, puis continue tant qu'une série éligible reste ouverte, jusqu'à `maxRuptureStep`. */
export function simulateFastForward(push: PushVector, engine: EngineConfig): FastForwardRun {
  const { choiceStep, maxRuptureStep } = engine.steps;
  const series: Series[] = engine.extinctions.map(() => ({ start: 0, len: 0 }));
  const steps: WorldVector[] = [engine.v0];
  for (let step = 1; step <= maxRuptureStep; step++) {
    steps.push(fastForwardStep(steps[step - 1]!, step, push, engine));
    const hit = advance(series, engine, steps[step]!, step);
    if (hit >= 0) {
      const extinction = { world: engine.extinctions[hit]!.id, runStartStep: series[hit]!.start, ruptureStep: step };
      return { trajectory: { steps }, atChoice: steps[Math.min(choiceStep, step)]!, extinction };
    }
    if (step >= choiceStep && !pending(series, choiceStep)) break;
  }
  const upToChoice = steps.slice(0, choiceStep + 1);
  return { trajectory: { steps: upToChoice }, atChoice: upToChoice[choiceStep]!, extinction: null };
}
