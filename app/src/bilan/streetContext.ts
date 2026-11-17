/**
 * Contexte de rue pur, hors de `src/street` [plan 03 R-03.17, R-03.25 a] : copie de la construction de `street/runtime.ts`
 * (`{ street, world, core, run, dice }`), pour la reprise du fast-forward et le bilan, qui rejouent les actes sans monter la rue.
 * Aucun crochet de calendrier : un rejeu n'a rien à raconter.
 */
import type { CoreData } from '../data/schema/core';
import type { WorldData } from '../data/schema/world';
import type { StreetContext } from '../engine/moments/types';
import { createDice } from '../shared/dice';
import type { RunResult } from '../shared/types/run';

/** Contexte de rue de `run` dans `world` : le dé est celui de la graine de la partie, comme dans la rue vivante. */
export function streetContextOf(core: CoreData, world: WorldData, run: RunResult): StreetContext {
  return { street: world.street, world, core, run, dice: createDice(run.seed) };
}
