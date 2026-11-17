/** Aides de test de la courbe du bilan [plan 03 T7, R-03.25 (c)] : semaines réelles de w10, entrées et contexte. Aucune règle de jeu. */
import w10Raw from '../../src/data/worlds/w10.json';
import { loadBilanCommon } from '../../src/data/bilanLoad';
import { loadCore } from '../../src/data/load';
import { parseWorld, type WorldData } from '../../src/data/schema/world';
import type { CurveContext } from '../../src/bilan/curve';
import { weekOutput } from '../../src/engine/week';
import type { BilanEntry, BilanInput } from '../../src/shared/types/bilan';
import type { Projection } from '../../src/shared/types/run';
import type { WeekOutput } from '../../src/shared/types/week';
import type { DayIndex } from '../../src/shared/types/street';
import { NONE, playWeek, playWeekUntil, runLivingIn } from './week';
import { runOf } from './run';

export const core = loadCore();
export const W10: WorldData = parseWorld(w10Raw, core.catalogue);
export const SIGMA100 = loadBilanCommon().sigma100;

/** Contexte de la courbe : monde vécu w10 par défaut. */
export function ctxOf(lived: WorldData | null = W10, over: Partial<CurveContext> = {}): CurveContext {
  return { core, lived, sigma100: SIGMA100, ...over };
}

/** Semaine entière de w10 (sept pas), sans geste. */
export function fullWeek(line = 'ACBACBACAAD'): WeekOutput {
  return weekOutput(playWeek(runOf(line), W10, core, NONE), W10);
}

/** Semaine partielle : jouée jusqu'à la fin du jour donné, sans clôture [GDD 06 §5]. */
export function partialWeek(day: DayIndex, line = 'ACBACBACAAD'): WeekOutput {
  return weekOutput(playWeekUntil(runOf(line), W10, core, NONE, day), W10);
}

export function inputOf(entry: BilanEntry, line: string, week: WeekOutput | null): BilanInput {
  return { entry, run: runOf(line), week, survival: null, acts: [] };
}

/** Partie vécue dans w10 mais dont le run porte une issue de w10, pour une semaine forgée. */
export function inputWithRun(entry: BilanEntry, week: WeekOutput | null): BilanInput {
  return { entry, run: runLivingIn('w10'), week, survival: null, acts: [] };
}

/** Projection forgée, pour les cinq cas : seuls `switchStep` et `toWorld` comptent. */
export function proj(switchStep: number | null): Projection {
  return { steps: [], switchStep, toWorld: switchStep === null ? null : 'w06', extinctionStep: null };
}
