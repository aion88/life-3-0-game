import { expect, it } from 'vitest';
import w10Raw from '../../../src/data/worlds/w10.json';
import { loadCore } from '../../../src/data/load';
import { GridError, type Milli } from '../../../src/shared/milli';
import type { Coupling } from '../../../src/data/schema/engine';
import { parseWorld } from '../../../src/data/schema/world';
import { basculeYear, project, shiftYears } from '../../../src/engine/projection';
import { weekOutput } from '../../../src/engine/week';
import { expectSameTwice } from '../../support/determinism';
import { stableVectorOf, withProjectionExtinctions, withoutCouplings, withoutDrift } from '../../support/projection';
import { runOf } from '../../support/run';
import { v } from '../../support/vec';
import { NONE, playWeekUntil } from '../../support/week';

const core = loadCore();
const W10 = parseWorld(w10Raw, core.catalogue);
const flat = withoutCouplings(core);

it('test_t11_w10_switch_54_with_drift_no_echo', () => { // [exécuté: gd-plancher-gdd03-7pas] ; référence tant que σ = 1 (Q3 b)
  expect(project(v(25, 90, 55, 13.6, 97.1, 54.1), {}, W10, core, 100).switchStep).toBe(54);
});
it('test_bascule_year_t11', () => { expect([52, 54, 57, 10].map(basculeYear)).toEqual([2034, 2034, 2034, 2031]); }); // [GDD 03 §4, formule A]
it('test_n_half_toward_zero', () => {
  expect([shiftYears(60, 54), shiftYears(54, 60), shiftYears(54, 72), shiftYears(54, 78)]).toEqual([0, 0, -1, -2]); // [GDD 03 §4, formule N]
});
it('test_holds_when_no_change_within_horizon', () => {
  expect(project(stableVectorOf(W10), {}, withoutDrift(W10), flat, 100)).toMatchObject({ switchStep: null, toWorld: null });
});
it('test_projection_switch_and_world_null_together', () => { // invariant de Projection
  const cases = [project(v(25, 90, 55, 13.6, 97.1, 54.1), {}, W10, core, 100), project(stableVectorOf(W10), {}, withoutDrift(W10), flat, 100)];
  for (const p of cases) expect(p.switchStep === null).toBe(p.toWorld === null);
  expect(cases[0]!.toWorld).not.toBeNull();
  expect(cases[1]).toMatchObject({ switchStep: null, toWorld: null });
});
it('test_projection_steps_start_at_input_and_end_at_switch', () => {
  const start = v(25, 90, 55, 13.6, 97.1, 54.1), p = project(start, {}, W10, core, 100);
  expect(p.steps[0]).toEqual(start);
  expect(p.steps.length).toBe(p.switchStep! + 1);
  const q = project(stableVectorOf(W10), {}, withoutDrift(W10), flat, 100);
  expect(q.steps.length).toBe(core.engine.projectionHorizon + 1);
});
it('test_extinction_step_is_rupture_of_the_held_rule', () => { // [calculé à la main : début au pas 1, tenue 24, rupture = début + 23, GDD 02 §3.5, §4.3]
  const w = withoutDrift(withProjectionExtinctions(W10, ['w12']));
  const p = project(v(50, 10, 10, 50, 50, 80), {}, w, flat, 100); // unrest ≥ 70, order ≤ 20, abundance ≤ 25, aiPower ≤ 85 dès le pas 1
  expect(p.extinctionStep).toBe(24);
});
it('test_extinction_step_null_when_not_declared_or_not_held', () => {
  const w = withoutDrift(W10);
  expect(project(v(50, 10, 10, 50, 50, 80), {}, withProjectionExtinctions(w, []), flat, 100).extinctionStep).toBeNull(); // w12 absent de projectionExtinctions
  expect(project(v(50, 10, 10, 50, 50, 60), {}, withProjectionExtinctions(w, ['w12']), flat, 100).extinctionStep).toBeNull(); // unrest 60 : condition fausse
});
it('test_projection_accepts_partial_week', () => { // [GDD 06 §5]
  for (const d of [1, 3, 7] as const) {
    const o = weekOutput(playWeekUntil(runOf('ACBACBACAAD'), W10, core, NONE, d), W10);
    const p = project(o.finalWithEcho, o.frozenEcho, W10, core, 100);
    expect(p.steps[0]).toEqual(o.finalWithEcho);
    expect(p.switchStep === null).toBe(p.toWorld === null);
  }
});
it('test_projection_deterministic', () => { expectSameTwice(() => project(v(25, 90, 55, 13.6, 97.1, 54.1), {}, W10, core, 100)); });
it('test_sigma_non_integer_throws', () => { // R-01 T13 : σ entier strictement positif
  const start = v(25, 90, 55, 13.6, 97.1, 54.1);
  expect(() => project(start, {}, W10, core, 50.5)).toThrow(RangeError);
  expect(() => project(start, {}, W10, core, 0)).toThrow(RangeError);
});
it('test_switch_origin_is_lived_world_not_start_nearest', () => { // D140 (3) ; [à confirmer: game-designer]
  const p = project(core.catalogue.byId.w06.vector!, {}, W10, core, 100);
  expect(p.switchStep).toBe(0);
  expect(p.toWorld).toBe('w06');
  expect(p.steps.length).toBe(1);
});
it('test_frozen_echo_applied_after_couplings_then_clamped', () => { // [GDD 03 §4 : dérive, couplages, puis écho ; calculé à la main]
  const coupling: Coupling = { id: 'probe', when: [{ var: 'unrest', cmp: '>', threshold: 70_000 as Milli }], target: 'order', sign: -1, magnitude: 10_000 as Milli };
  const one: typeof core = { ...core, engine: { ...core.engine, couplings: [coupling] } };
  const start = v(25, 90, 55, 13.6, 97.1, 69);
  const p = project(start, { unrest: 2_000 as Milli, surveillance: 5_000 as Milli }, withoutDrift(W10), one, 100);
  // couplage lu sur unrest 69 000 : ne tient pas ; écho ensuite : unrest 71 000 (l'ordre inverse aurait baissé order de 10 000), surveillance bornée à 100 000
  expect(p.steps[1]).toEqual(v(25, 90, 55, 13.6, 100, 71));
  expect(p.steps[1]!.surveillance).toBe(100_000);
});
it('test_grid_error_on_non_integer_drift_times_sigma', () => {
  const odd = { ...W10, engine: { ...W10.engine, drift: { unrest: 333 as Milli } } };
  expect(() => project(v(25, 90, 55, 13.6, 97.1, 54.1), {}, odd, core, 50)).toThrow(GridError);
});
