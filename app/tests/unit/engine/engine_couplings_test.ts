import { expect, it } from 'vitest';
import { applyCouplings, applyCouplingsTraced } from '../../../src/engine/couplings';
import { holds } from '../../../src/engine/conditions';
import { loadCore } from '../../../src/data/load';
import { GridError, type Milli } from '../../../src/shared/milli';
import { v } from '../../support/vec';

const C = loadCore().engine.couplings;

it('test_t15_case1_cascade_only_sequential', () => { // [GDD 03 T-15]
  expect(applyCouplings(v(50, 30, 50, 50, 50, 75), C, 'sequential', 100)).toEqual(v(50, 28.5, 48.5, 50, 50, 75));
  expect(applyCouplings(v(50, 30, 50, 50, 50, 75), C, 'simultaneous', 100)).toEqual(v(50, 28.5, 50, 50, 50, 75));
});

it('test_t15_case2_c2_disarms_c4_only_sequential', () => {
  expect(applyCouplings(v(50, 25, 86, 50, 50, 50), C, 'sequential', 100)).toEqual(v(50, 25, 84.5, 50, 50, 50));
  expect(applyCouplings(v(50, 25, 86, 50, 50, 50), C, 'simultaneous', 100)).toEqual(v(50, 25, 84.5, 50, 50, 49));
});

it('test_t15_case3_clamp_after_each', () => {
  expect(applyCouplings(v(50, 50, 90, 30, 80, 99.5), C, 'sequential', 100).unrest).toBe(99_000);
  expect(applyCouplings(v(50, 50, 90, 30, 80, 99.5), C, 'simultaneous', 100).unrest).toBe(99_500);
});

it('test_scale_80_exact', () => {
  expect(applyCouplings(v(50, 50, 50, 50, 50, 75), C, 'sequential', 80).order).toBe(48_800);
});

it('test_holds_strict_and_non_strict', () => {
  expect(holds(v(0, 0, 0, 0, 96, 0), { var: 'surveillance', cmp: '>', threshold: 96_000 as Milli })).toBe(false);
  expect(holds(v(0, 0, 0, 0, 96, 0), { var: 'surveillance', cmp: '>=', threshold: 96_000 as Milli })).toBe(true);
});

it('test_traced_reports_fired_in_file_order', () => {
  expect(applyCouplingsTraced(v(50, 30, 50, 50, 50, 75), C, 'sequential', 100).fired).toEqual([true, true, false, false]);
});

it('test_non_integer_effect_throws_grid_error', () => {
  expect(() => applyCouplings(v(50, 50, 50, 50, 50, 75), C, 'sequential', 0.5)).toThrow(GridError);
});
