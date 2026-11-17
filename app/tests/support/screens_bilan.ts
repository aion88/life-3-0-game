/** Aides de T12 : contexte du bilan avec w10 chargeable, entrées de bilan, faux canvas téléchargeable [plan 03 T12, R-03.25 (c)]. */
import type { AppContext } from '../../src/app/shell';
import type { BilanInput } from '../../src/shared/types/bilan';
import type { RunResult } from '../../src/shared/types/run';
import type { WorldData } from '../../src/data/schema/world';
import { fakeCtx } from './screens';
import { runOf } from './run';
import { W10, weekEndOf } from './bilan_build';

export { W10, weekEndOf };
export const EXT_RUN: RunResult = runOf('CBCCBDBACCD');
export const REDIRECTED_RUN: RunResult = runOf('AAAAAAAAAAA');

/** Monde w10 avec une taille d'image partageable fixée (ou nulle). */
export function w10WithShare(share: { width: number; height: number } | null): WorldData {
  return { ...W10, bilan: { ...W10.bilan, share: share ?? { width: null, height: null } } } as WorldData;
}

/** Contexte avec w10 disponible et chargeable ; `load` est espionnable par `loaded`. */
export function bilanCtx(world: WorldData = W10, over: Partial<AppContext> = {}): ReturnType<typeof fakeCtx> & { readonly loaded: string[] } {
  const loaded: string[] = [];
  const ctx = fakeCtx({ worlds: { available: () => ['w10'], load: (id) => { loaded.push(id); return Promise.resolve(world); } }, ...over });
  return Object.assign(ctx, { loaded });
}

export const extinctionInput = (run: RunResult = EXT_RUN): BilanInput => ({ entry: 'extinction', run, week: null, survival: null, acts: [] });
