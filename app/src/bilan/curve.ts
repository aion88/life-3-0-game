/** Pièce 2 du bilan : la courbe des six variables et le moment de la bascule [GDD 06 §3.4 ; D116, D121, D129, D31, D140 (3)]. Pur, aucun texte. */
import type { CoreData } from '../data/schema/core';
import type { WorldData } from '../data/schema/world';
import { project, basculeYear } from '../engine/projection';
import { yearOfStep } from '../fastforward/headlines';
import type { BilanCurve, BilanInput, GateDraw } from '../shared/types/bilan';
import type { Projection } from '../shared/types/run';
import type { WeekOutput } from '../shared/types/week';
import type { WorldVar } from '../shared/types/world';
import { bascule } from './bascule';

/**
 * Ce que `buildCurve` lit du contexte du bilan (`BilanContext` de la tâche 11 l'inclut structurellement).
 * `sigma100` vient de `bilan.json`.
 */
export interface CurveContext {
  readonly core: CoreData; readonly lived: WorldData | null; readonly sigma100: number;
}

/**
 * Porte ouverte la plus proche de se fermer (distance la plus courte, égalité : ordre des données), ou null s'il n'en reste aucune.
 * Le seuil sort en millièmes POUR LE DESSIN, jamais comme texte [GDD 06 §3.4 « Portes »].
 */
export function nearestOpenGate(week: WeekOutput, world: WorldData): GateDraw | null {
  let best: { draw: GateDraw; distance: number } | null = null;
  for (const status of week.gates) {
    if (status.closed) continue;
    const gate = world.engine.gates.find((g) => g.id === status.id);
    if (gate === undefined) continue;
    if (best === null || status.distance < best.distance) {
      best = { distance: status.distance, draw: { gateId: gate.id, var: gate.when.var, threshold: gate.when.threshold, current: week.finalWithEcho[gate.when.var] } };
    }
  }
  return best === null ? null : best.draw;
}

/**
 * La courbe : fast-forward jusqu'à l'arrivée (pas 0 à `arrivalStep`), repère du pas de choix, tracé de rue (la `curve` de la semaine telle quelle :
 * 1 + pas faits), deux projections partant des vecteurs finaux, bascule, variables épaissies, porte, années de rupture et d'extinction projetée.
 * Deux mondes, deux tracés : l'histoire (monde calculé) et la vie (monde vécu) ne se mêlent jamais [D140 (3)].
 * Une extinction n'a ni monde vécu, ni rue, ni projection : seulement le fast-forward jusqu'à la rupture.
 */
export function buildCurve(input: BilanInput, ctx: CurveContext): BilanCurve {
  const { run, week } = input;
  const out = run.outcome;
  if (out.kind === 'extinction') {
    return {
      historyWorld: out.world, lifeWorld: null, fastForward: run.trajectory.steps, choiceMark: null, street: null,
      withEcho: null, withoutEcho: null, bascule: bascule(null, null), emphasized: [], momentReading: null,
      gate: null, ruptureYear: yearOfStep(out.ruptureStep), projectedExtinctionYear: null,
    };
  }
  const { arrivalStep, choiceStep } = ctx.core.engine.steps;
  const lived = ctx.lived;
  let withEcho: Projection | null = null, withoutEcho: Projection | null = null;
  if (week !== null && lived !== null) {
    withEcho = project(week.finalWithEcho, week.frozenEcho, lived, ctx.core, ctx.sigma100);
    withoutEcho = project(week.finalWithoutEcho, {}, lived, ctx.core, ctx.sigma100);
  }
  const bilan = lived?.bilan;
  return {
    historyWorld: out.computedWorld, lifeWorld: out.livedWorld,
    fastForward: run.trajectory.steps.slice(0, arrivalStep + 1), choiceMark: run.trajectory.steps[choiceStep] ?? null,
    street: week === null ? null : week.curve,
    withEcho, withoutEcho, bascule: bascule(withEcho, withoutEcho),
    emphasized: bilan !== undefined && 'emphasis' in bilan ? (bilan.emphasis as readonly WorldVar[]) : [],
    momentReading: week === null ? null : week.momentReading,
    gate: week === null || lived === null ? null : nearestOpenGate(week, lived),
    ruptureYear: null,
    projectedExtinctionYear: withEcho === null || withEcho.extinctionStep === null ? null : basculeYear(withEcho.extinctionStep),
  };
}
