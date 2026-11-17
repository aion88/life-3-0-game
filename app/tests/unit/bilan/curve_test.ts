import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCurve, nearestOpenGate } from '../../../src/bilan/curve';
import { basculeYear, project } from '../../../src/engine/projection';
import { yearOfStep } from '../../../src/fastforward/headlines';
import type { WorldData } from '../../../src/data/schema/world';
import type { Milli } from '../../../src/shared/milli';
import type { WeekOutput } from '../../../src/shared/types/week';
import { expectSameTwice } from '../../support/determinism';
import { ctxOf, core, fullWeek, inputOf, inputWithRun, partialWeek, W10, SIGMA100 } from '../../support/bilan_curve';
import { stableVectorOf, withProjectionExtinctions, withoutCouplings, withoutDrift } from '../../support/projection';
import { runOf } from '../../support/run';
import { v } from '../../support/vec';

const LINE = 'ACBACBACAAD';
const week = fullWeek();
const input = inputOf('weekEnd', LINE, week);
const m = (n: number) => n as Milli;

describe('buildCurve : tracés', () => {
  it('test_curve_fast_forward_has_39_steps_before_arrival_and_choice_mark_is_step_48', () => {
    const c = buildCurve(input, ctxOf());
    const steps = input.run.trajectory.steps;
    expect(core.engine.steps.arrivalStep).toBe(39);
    expect(c.fastForward).toEqual(steps.slice(0, 40)); // pas 0 (2026) puis 39 pas
    expect(c.fastForward.length).toBe(core.engine.steps.arrivalStep + 1);
    expect(c.choiceMark).toEqual(steps[core.engine.steps.choiceStep]);
    expect(core.engine.steps.choiceStep).toBe(48);
  });
  it('test_street_trace_is_null_without_week', () => {
    const c = buildCurve(inputOf('earlyEnd', LINE, null), ctxOf());
    expect(c.street).toBeNull();
    expect(c.withEcho).toBeNull();
    expect(c.withoutEcho).toBeNull();
    expect(c.gate).toBeNull();
    expect(c.bascule.case).toBe('none');
    expect(c.momentReading).toBeNull();
  });
  it('test_street_length_is_8_for_full_week', () => {
    const c = buildCurve(input, ctxOf());
    expect(c.street).toHaveLength(8); // départ canonique + sept pas [R-03.14 : 1 + readings.length]
    expect(c.street).toEqual(week.curve);
  });
  it('test_early_end_partial_week_curve_is_shorter_than_8', () => {
    const w = partialWeek(3);
    const c = buildCurve(inputOf('earlyEnd', LINE, w), ctxOf());
    expect(c.street!.length).toBe(w.curve.length); // R-03.14 : earlyEnd = les pas faits, sans pas de clôture
    expect(c.street!.length).toBeLessThan(8);
    expect(c.street!.length).toBeGreaterThan(1);
    expect(c.withoutEcho).not.toBeNull(); // la projection part du vecteur du jour de la fin [GDD 06 §5]
  });
  it('test_redirected_curve_has_two_worlds_and_two_traces', () => {
    const run = runOf('AAAAAAAAAAA');
    expect(run.outcome).toMatchObject({ kind: 'arrival', computedWorld: 'w03', livedWorld: 'w10', redirected: true });
    const c = buildCurve({ entry: 'weekEnd', run, week, survival: null, acts: [] }, ctxOf());
    expect(c.historyWorld).toBe('w03');
    expect(c.lifeWorld).toBe('w10');
    const shared = c.fastForward.filter((p) => c.street!.some((q) => JSON.stringify(q) === JSON.stringify(p)));
    expect(shared).toEqual([]); // deux mondes ne se mêlent pas dans un seul tracé
    expect(c.street).toEqual(week.curve);
  });
  it('test_not_redirected_history_and_life_are_the_same_world', () => {
    const c = buildCurve(input, ctxOf());
    expect([c.historyWorld, c.lifeWorld]).toEqual(['w10', 'w10']);
  });
  it('test_curve_in_extinction_has_no_life_world_and_no_street', () => {
    const run = runOf('CBCCBDBACCD');
    expect(run.outcome).toMatchObject({ kind: 'extinction', world: 'w07', ruptureStep: 60 });
    const c = buildCurve({ entry: 'extinction', run, week: null, survival: null, acts: [] }, ctxOf(null));
    expect(c).toMatchObject({ historyWorld: 'w07', lifeWorld: null, street: null, withEcho: null, withoutEcho: null, gate: null, choiceMark: null, projectedExtinctionYear: null });
    expect(c.bascule.case).toBe('none');
    expect(c.emphasized).toEqual([]);
    expect(c.fastForward).toEqual(run.trajectory.steps); // jusqu'à la rupture
    expect(c.ruptureYear).toBe(yearOfStep(60));
  });
  it('test_rupture_year_null_outside_extinction', () => {
    expect(buildCurve(input, ctxOf()).ruptureYear).toBeNull();
  });
});

describe('buildCurve : projections et bascule', () => {
  it('test_two_projections_start_at_final_vectors_with_and_without_echo', () => {
    const c = buildCurve(input, ctxOf());
    expect(c.withEcho).toEqual(project(week.finalWithEcho, week.frozenEcho, W10, core, SIGMA100));
    expect(c.withoutEcho).toEqual(project(week.finalWithoutEcho, {}, W10, core, SIGMA100));
  });
  it('test_bascule_is_compared_from_the_two_projections', () => {
    const c = buildCurve(input, ctxOf());
    const y = (p: typeof c.withEcho) => (p?.switchStep == null ? null : basculeYear(p.switchStep));
    expect(c.bascule.yearWith).toBe(y(c.withEcho));
    expect(c.bascule.yearWithout).toBe(y(c.withoutEcho));
  });
  it('test_bascule_case_c_when_neither_projection_tips', () => {
    const flat = withoutDrift(W10);
    const calm: WeekOutput = { ...week, finalWithEcho: stableVectorOf(W10), finalWithoutEcho: stableVectorOf(W10), frozenEcho: {} };
    const c = buildCurve(inputWithRun('weekEnd', calm), { core: withoutCouplings(core), lived: flat, sigma100: SIGMA100 });
    expect(c.bascule.case).toBe('c');
  });
  it('test_projected_extinction_year_from_extinction_step', () => {
    const lived = withoutDrift(withProjectionExtinctions(W10, ['w12']));
    const hot: WeekOutput = { ...week, finalWithEcho: v(50, 10, 10, 50, 50, 80), finalWithoutEcho: v(50, 10, 10, 50, 50, 80), frozenEcho: {} };
    const c = buildCurve(inputWithRun('weekEnd', hot), { core: withoutCouplings(core), lived, sigma100: SIGMA100 });
    expect(c.withEcho!.extinctionStep).toBe(24);
    expect(c.projectedExtinctionYear).toBe(basculeYear(24)); // jamais un seuil intermédiaire
  });
  it('test_projected_extinction_year_null_when_step_null', () => {
    const calm: WeekOutput = { ...week, finalWithEcho: stableVectorOf(W10), finalWithoutEcho: stableVectorOf(W10), frozenEcho: {} };
    const c = buildCurve(inputWithRun('weekEnd', calm), { core: withoutCouplings(core), lived: withoutDrift(W10), sigma100: SIGMA100 });
    expect(c.withEcho!.extinctionStep).toBeNull();
    expect(c.projectedExtinctionYear).toBeNull();
  });
  it('test_no_lived_world_data_means_no_projection', () => {
    const c = buildCurve(input, ctxOf(null));
    expect(c).toMatchObject({ withEcho: null, withoutEcho: null, gate: null, emphasized: [], projectedExtinctionYear: null });
    expect(c.bascule.case).toBe('none');
  });
  it('test_moment_reading_is_carried_from_the_week', () => {
    const reading = { slopeId: 'to-w06', var: 'aiPower', day: 4, minute: 420 } as const;
    expect(buildCurve(inputOf('weekEnd', LINE, { ...week, momentReading: reading }), ctxOf()).momentReading).toEqual(reading);
    expect(buildCurve(input, ctxOf()).momentReading).toEqual(week.momentReading);
  });
});

describe('buildCurve : variables mises en avant', () => {
  it('test_emphasized_comes_from_bilan_emphasis_data', () => {
    expect(buildCurve(input, ctxOf()).emphasized).toEqual(['aiPower', 'freedom', 'abundance']);
    const bilan = { ...(W10.bilan as object), emphasis: ['unrest'] } as unknown as WorldData['bilan'];
    expect(buildCurve(input, ctxOf({ ...W10, bilan })).emphasized).toEqual(['unrest']);
  });
  it('test_emphasized_empty_for_world_without_bilan_block', () => {
    expect(buildCurve(input, ctxOf({ ...W10, bilan: {} })).emphasized).toEqual([]);
  });
});

describe('nearestOpenGate', () => {
  const gates = [
    { id: 'g-far', when: { var: 'surveillance', cmp: '>', threshold: m(96000) } },
    { id: 'g-near', when: { var: 'freedom', cmp: '<', threshold: m(30000) } },
    { id: 'g-shut', when: { var: 'order', cmp: '>', threshold: m(10000) } },
  ] as const;
  const world = (g: readonly (typeof gates)[number][]): WorldData => ({ ...W10, engine: { ...W10.engine, gates: g } });
  const w = (st: { id: string; closed: boolean; distance: number }[]): WeekOutput => ({
    ...week, finalWithEcho: v(50, 80, 50, 40, 70, 50), gates: st.map((s) => ({ ...s, distance: m(s.distance) })),
  });
  it('test_nearest_open_gate_picks_smallest_distance_among_open', () => {
    const r = nearestOpenGate(w([{ id: 'g-far', closed: false, distance: 26000 }, { id: 'g-near', closed: false, distance: 10000 }, { id: 'g-shut', closed: true, distance: 0 }]), world(gates));
    expect(r).toEqual({ gateId: 'g-near', var: 'freedom', threshold: 30000, current: 40000 });
  });
  it('test_nearest_open_gate_ignores_closed_even_if_nearer', () => {
    const r = nearestOpenGate(w([{ id: 'g-far', closed: false, distance: 26000 }, { id: 'g-near', closed: true, distance: 0 }, { id: 'g-shut', closed: true, distance: 0 }]), world(gates));
    expect(r?.gateId).toBe('g-far');
  });
  it('test_nearest_open_gate_tie_keeps_data_order', () => {
    const r = nearestOpenGate(w([{ id: 'g-far', closed: false, distance: 5000 }, { id: 'g-near', closed: false, distance: 5000 }]), world(gates));
    expect(r?.gateId).toBe('g-far');
  });
  it('test_nearest_open_gate_null_when_all_crossed', () => {
    expect(nearestOpenGate(w([{ id: 'g-far', closed: true, distance: 0 }, { id: 'g-near', closed: true, distance: 0 }]), world(gates))).toBeNull();
    expect(nearestOpenGate(w([]), world([]))).toBeNull();
  });
  it('test_nearest_open_gate_never_exposes_threshold_text', () => {
    const r = nearestOpenGate(w([{ id: 'g-far', closed: false, distance: 26000 }]), world(gates))!;
    expect(Object.keys(r).sort()).toEqual(['current', 'gateId', 'threshold', 'var']); // le seuil est un milli de dessin, pas une chaîne
    expect(typeof r.threshold).toBe('number');
    const src = readFileSync(new URL('../../../src/bilan/curve.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from '[^']*i18n|\.t\(/); // aucun texte n'est produit ici
  });
  it('test_curve_gate_is_the_real_w10_gate_when_open', () => {
    const c = buildCurve(input, ctxOf());
    const open = week.gates.some((g) => !g.closed);
    expect(c.gate === null).toBe(!open);
    if (c.gate) expect(c.gate).toMatchObject({ gateId: 'vault-checkpoint', var: 'surveillance', threshold: 96000 });
  });
});

describe('buildCurve : pureté', () => {
  it('test_curve_is_pure_same_input_same_output', () => {
    expectSameTwice(() => buildCurve(input, ctxOf()));
    expectSameTwice(() => buildCurve(inputOf('extinction', 'CBCCBDBACCD', null), ctxOf(null)));
  });
  it('test_curve_does_not_mutate_its_input', () => {
    const before = JSON.stringify(input);
    buildCurve(input, ctxOf());
    expect(JSON.stringify(input)).toBe(before);
  });
});
