import { describe, expect, it } from 'vitest';
import { adaptExposure, gradeUniforms, lightStateAt, stepBlend, type LightBlend } from '../../../src/engine/view/grade';
import type { LightData } from '../../../src/engine/view/sceneSchema';
import { toMilli } from '../../../src/shared/milli';
import { expectSameTwice } from '../../support/determinism';
import { G, GA, HB, NONE, V0, V0pts, withGain } from '../../support/street_grade';

const L: LightData = { src: 'test', steps: [{ fromMinute: 420, state: 'heureBleue' }], blendMs: { v: 2000, src: 'test', status: 'sourced' } };   // H.4 : une seule marche

describe('lumière et étalonnage par monde', () => {
  it.each([[420, false, 'heureBleue'], [1319, false, 'heureBleue'], [1320, false, 'heureBleue'], [600, true, 'nuit']] as const)('test_light_%i_%s', (m, slept, st) => {
    expect(lightStateAt(m, slept, L)).toBe(st);
  });
  it('test_a_daytime_step_is_data_only', () => {
    expect(lightStateAt(660, false, { ...L, steps: [L.steps[0]!, { fromMinute: 600, state: 'jour' }] })).toBe('jour');
  });
  it('test_blend_progress_and_retarget_without_a_jump', () => {
    let b: LightBlend = { from: 'heureBleue', to: 'heureBleue', t: 1 };
    b = stepBlend(b, 'nuit', 1000, 2000);
    expect(b).toEqual({ from: 'heureBleue', to: 'nuit', t: 0.5 });
    b = stepBlend(b, 'heureBleue', 0, 2000);
    expect(b.from).toBe('nuit');
    expect(b.t).toBe(0.5);
  });
  it('test_grain_blends_between_states_by_the_art_bible_table', () => {   // (3,5 + 4,5) / 2 = 4,0
    expect(gradeUniforms({ light: { from: 'heureBleue', to: 'nuit', t: 0.5 }, ws: V0, ws0: V0, offset: NONE }, G).grain).toBeCloseTo(4.0, 9);
    expect(gradeUniforms({ light: { from: 'nuit', to: 'nuit', t: 1 }, ws: V0, ws0: V0, offset: NONE }, G).vignetteIL).toBe(-0.7);
  });
  it('test_world_drift_moves_the_uniform_only_through_a_written_gain', () => {
    const ws = { ...V0, unrest: toMilli(V0pts.unrest + 20) };
    expect(gradeUniforms({ light: HB, ws, ws0: V0, offset: NONE }, G).grain).toBe(3.5);   // gain null : aucun effet
    expect(gradeUniforms({ light: HB, ws, ws0: V0, offset: NONE }, withGain(G, 'grain', 'unrest', 0.5)).grain).toBeCloseTo(3.6, 9);   // 0,5 x 20 / 100 = 0,1
  });
  it('test_arrival_offset_shifts_veil', () => {
    const o = { axes: [{ var: 'surveillance' as const, signed: toMilli(10) }] };
    expect(gradeUniforms({ light: HB, ws: V0, ws0: V0, offset: o }, withGain(G, 'veil', 'surveillance', 2)).veil).toBeCloseTo(0.2, 9);   // 2 x 10 / 100
  });
  it('test_exposure_rises_faster_than_it_falls', () => {
    const rise = adaptExposure(1, 2, 100, GA) - 1;
    const fall = 2 - adaptExposure(2, 1, 100, GA);
    expect(rise).toBeGreaterThan(fall);
    expect(rise).toBeCloseTo(0.15, 9);   // 1,5 x 0,1 s x écart 1
    expect(fall).toBeCloseTo(0.05, 9);   // 0,5 x 0,1 s x écart 1
  });
  it('test_exposure_never_overshoots_its_target', () => { expect(adaptExposure(1, 2, 60_000, GA)).toBe(2); });
  it('test_grade_is_pure', () => { expectSameTwice(() => gradeUniforms({ light: HB, ws: V0, ws0: V0, offset: NONE }, G)); });
});
