/** Contexte de rue pur du bilan et de la reprise [plan 03 T5, R-03.17, R-03.25 a] : copie de la construction de `street/runtime.ts`. */
import type { WorldData } from '../../../src/data/schema/world';
import { describe, expect, it } from 'vitest';
import { streetContextOf } from '../../../src/bilan/streetContext';
import { createProductionWorldLoader, loadCore } from '../../../src/data/load';
import { createDice } from '../../../src/shared/dice';
import { runLivingIn } from '../../support/week';

const core = loadCore();
const w10World = (): Promise<WorldData> => createProductionWorldLoader(core.catalogue).load('w10');

describe('contexte de rue', () => {
  it('test_street_context_carries_street_world_core_run', async () => {
    const run = runLivingIn('w10');
    const world = await w10World();
    const ctx = streetContextOf(core, world, run);
    expect(ctx.street).toBe(world.street);
    expect(ctx.world).toBe(world);
    expect(ctx.core).toBe(core);
    expect(ctx.run).toBe(run);
  });

  it('test_street_context_dice_is_the_run_seed_dice', async () => {
    const run = runLivingIn('w10');
    const ctx = streetContextOf(core, await w10World(), run);
    const ref = createDice(run.seed);
    for (const [d, h, k] of [[1, 8, 'a'], [3, 12, 'b.c'], [7, 20, 'z']] as const) {
      expect(ctx.dice.roll('street', d, h, k)).toBe(ref.roll('street', d, h, k));
    }
  });

  it('test_street_context_has_no_hook_by_default', async () => {
    expect(streetContextOf(core, await w10World(), runLivingIn('w10')).onHook).toBeUndefined();
  });
});
