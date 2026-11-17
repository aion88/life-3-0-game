import { expect, it } from 'vitest';
import { absSum, addDelta, clampVector, dist2 } from '../../../src/engine/vector';
import { WORLD_VARS, type WorldVar } from '../../../src/shared/types/world';
import type { Milli } from '../../../src/shared/milli';
import { v } from '../../support/vec';

it('test_dist2_exceeds_int32_without_overflow', () => {
  expect(dist2(v(0, 0, 0, 0, 0, 0), v(100, 100, 100, 100, 100, 100))).toBe(6e10);
});

it('test_dist2_weighted_counts_the_axis', () => {
  const w = Object.fromEntries(WORLD_VARS.map((k) => [k, k === 'freedom' ? 1 : 0])) as Record<WorldVar, number>;
  expect(dist2(v(0, 0, 0, 0, 0, 0), v(100, 100, 100, 10, 100, 100), w)).toBe(10_000 ** 2);
});

it('test_abs_sum_unweighted', () => {
  expect(absSum(v(10, 0, 0, 0, 0, 0), v(0, 5, 0, 0, 0, 0))).toBe(15_000);
});

it('test_add_delta_does_not_clamp', () => {
  expect(addDelta(v(99, 0, 0, 0, 0, 0), { aiPower: 5_000 as Milli, order: -1_000 as Milli }))
    .toEqual({ ...v(0, 0, 0, 0, 0, 0), aiPower: 104_000, order: -1_000 });
});

it('test_clamp_vector_bounds_each_axis', () => {
  const out = clampVector({ ...v(0, 0, 0, 0, 0, 0), aiPower: 104_000 as Milli, order: -1_000 as Milli });
  expect(out).toEqual(v(100, 0, 0, 0, 0, 0));
});
