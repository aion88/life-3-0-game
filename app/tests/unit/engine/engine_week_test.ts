import { expect, it } from 'vitest';
import w10Raw from '../../../src/data/worlds/w10.json';
import { loadCore } from '../../../src/data/load';
import { DataLoadError } from '../../../src/data/schema/common';
import { parseWorld } from '../../../src/data/schema/world';
import { CLOSING_MINUTE, WEEK_STEPS, applyMilestone, pushRoutine, startWeek, stepWeek, weekCalendar, weekOutput } from '../../../src/engine/week';
import type { WorldData } from '../../../src/data/schema/world';
import { WORLD_VARS } from '../../../src/shared/types';
import { expectSameTwice } from '../../support/determinism';
import { runOf } from '../../support/run';
import { v } from '../../support/vec';
import {
  MAX_ECHO, NONE, at, playWeek, playWeekUntil, runLivingIn, withDrift, withMilestoneNullCap, withMilestones, withSlopes, type Gestures,
} from '../../support/week';

const core = loadCore();
const W10 = parseWorld(w10Raw, core.catalogue);
const week = (world: WorldData, gestures: Gestures) => playWeek(runLivingIn(world.id), world, core, gestures);

it('test_w10_seven_steps_exact', () => { // [exécuté: gd-plancher-gdd03-7pas, GDD 03 §4]
  expect(week(W10, NONE).ws).toEqual(v(25, 90, 55, 13.6, 97.1, 54.1));
});

it('test_routine_echo_capped_excess_lost', () => { // T-6
  let s = startWeek(runLivingIn('w10'), W10, core);
  for (let k = 0; k < 3; k++) s = pushRoutine(s, W10, 'usePhone'); // tampon +1,2
  const after = stepWeek(s, W10, core, { kind: 'morning', day: 2 }, at(2, 420));
  expect(after.ws.surveillance).toBe(96_300); // 95 + 0,3 + 1 [plan 00 : usePhone +0,4, capPerStep 1, dérive +0,3]
  expect(after.buffer).toEqual({}); // vidé, l'excès de 0,2 est perdu
  expect(after.wsNoEcho.surveillance).toBe(95_300); // wsNoEcho suit dérive et couplages seulement
});

it('test_milestone_cap_per_trigger_no_weekly_cumul', () => {
  const w = withMilestones(W10, 2, [['m', { unrest: 3 }], ['n', { unrest: 3 }]]); // plafond forgé de 2 : la valeur w10 est une dette
  const s0 = startWeek(runLivingIn('w10'), w, core);
  const s1 = applyMilestone(s0, w, 'm'), s2 = applyMilestone(s1, w, 'n');
  expect([s1.ws.unrest, s2.ws.unrest]).toEqual([47_000, 49_000]); // [catalogue w10 unrest 45, plafond forgé 2]
  expect(s2.wsNoEcho).toEqual(s0.wsNoEcho); // un jalon est un écho : il n'entre pas dans le calcul sans écho
});

it('test_milestone_with_null_cap_throws', () => { // errata T11 : le schéma refuse, puis le moteur refuse hors parse
  expect(() => parseWorld(withMilestoneNullCap(w10Raw), core.catalogue)).toThrow(DataLoadError);
  const forged = withMilestones(W10, null, [['m', { unrest: 1 }]]);
  expect(() => applyMilestone(startWeek(runLivingIn('w10'), forged, core), forged, 'm')).toThrow();
});

it('test_t9_calendar_and_late_j7_gesture_hits_closing', () => {
  expect(weekCalendar().filter((h) => h.kind !== 'nightEnd').length).toBe(7);
  expect(weekCalendar().filter((h) => h.kind === 'nightEnd').map((h) => (h as { day: number }).day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(week(W10, { 7: { after7h: ['usePhone'] } }).ws.surveillance).toBe(week(W10, NONE).ws.surveillance + 400); // [plan 00 : usePhone +0,4]
  const s = startWeek(runLivingIn('w10'), W10, core);
  expect(stepWeek(s, W10, core, { kind: 'nightEnd', day: 1 }, at(1, 420))).toBe(s); // nightEnd ne touche pas ws
  expect(WEEK_STEPS).toBe(7);
  expect(CLOSING_MINUTE).toBe(1320);
});

it('test_same_lived_world_same_week_state', () => { // Review Focus 3, T-13
  const a = runOf('ACBACBACAAD'); // w10 à 41,33
  const b = runOf('AAAAAAAAAAA'); // calculé w03, vécu w10
  expect(b.outcome).toMatchObject({ computedWorld: 'w03', livedWorld: 'w10' });
  expect(playWeek(a, W10, core, NONE)).toEqual(playWeek(b, W10, core, NONE));
  expect(a.outcome.kind === 'arrival' && a.outcome.offset.axes).toEqual([]);
  expect(b.outcome.kind === 'arrival' && b.outcome.offset.axes.length).toBe(2);
});

it('test_t12_week_output_stable', () => {
  const o = expectSameTwice(() => weekOutput(playWeek(runOf('ACBACBACAAD'), W10, core, MAX_ECHO), W10));
  expect(o.curve.length).toBe(8);
  expect(o.worldSeed).toBe(9000);
});

it('test_early_end_curve_is_shorter', () => { // [GDD 06 §5]
  const lens = ([1, 3, 6, 7] as const).map((d) => weekOutput(playWeekUntil(runOf('ACBACBACAAD'), W10, core, NONE, d), W10).curve.length);
  expect(lens).toEqual([1, 3, 6, 7]);
  const part = weekOutput(playWeekUntil(runOf('ACBACBACAAD'), W10, core, NONE, 4), W10);
  expect(part.frozenEcho).toEqual({});
  expect(part.finalWithEcho).toEqual(part.curve[part.curve.length - 1]);
  expect(weekOutput(playWeek(runOf('ACBACBACAAD'), W10, core, NONE), W10).curve.length).toBe(8);
});

it('test_t6_every_step_stays_in_bounds', () => { // T-6 [GDD 03 T-6]
  const o = weekOutput(playWeek(runOf('ACBACBACAAD'), W10, core, MAX_ECHO), W10);
  for (const x of o.curve) for (const k of WORLD_VARS) { expect(x[k]).toBeGreaterThanOrEqual(0); expect(x[k]).toBeLessThanOrEqual(100_000); }
  expect(o.frozenEcho).toEqual({ surveillance: 1000 }); // écho appliqué, borné, du pas de clôture
  expect(o.finalWithoutEcho).toEqual(v(25, 90, 55, 13.6, 97.1, 54.1));
});

it('test_start_week_refuses_extinction', () => { // aucune semaine après une extinction
  expect(() => startWeek(runOf('CBCCBDBACCD'), W10, core)).toThrow();
});

it('test_moment_reading_tie_file_order_then_world_number', () => { // [GDD 03 §5.2]
  const first = (w: WorldData) => stepWeek(startWeek(runLivingIn('w10'), withDrift(w, { aiPower: 1 }), core), withDrift(w, { aiPower: 1 }), core, { kind: 'morning', day: 2 }, at(2, 420)).momentReading;
  // les deux pentes s'allument au même pas (aiPower 26 >= 26)
  const a = withSlopes(W10, [['toSix', 'w06', 'aiPower', '>=', 26], ['toThree', 'w03', 'aiPower', '>=', 26]]);
  const b = withSlopes(W10, [['toThree', 'w03', 'aiPower', '>=', 26], ['toSix', 'w06', 'aiPower', '>=', 26]]);
  expect(first(a)).toEqual({ slopeId: 'toSix', var: 'aiPower', day: 2, minute: 420 }); // ordre du fichier avant le numéro du monde (6 > 3)
  expect(first(b)).toEqual({ slopeId: 'toThree', var: 'aiPower', day: 2, minute: 420 });
});

it('test_moment_reading_hysteresis_flicker_counts_first_lighting_only', () => { // [GDD 03 §3.4]
  const base = withSlopes(W10, [['toSix', 'w06', 'aiPower', '>=', 26]]);
  const plan = [1, -0.5, -1, 2] as const; // 26 allume, 25,5 reste allumé (h = 1), 24,5 éteint, 26,5 rallume
  let s = startWeek(runLivingIn('w10'), base, core);
  const lit: boolean[] = [], moments: unknown[] = [];
  plan.forEach((d, i) => {
    const day = (i + 2) as 2 | 3 | 4 | 5;
    s = stepWeek(s, withDrift(base, { aiPower: d }), core, { kind: 'morning', day }, at(day, 420));
    lit.push(s.readings['toSix.aiPower']!); moments.push(s.momentReading);
  });
  expect(lit).toEqual([true, true, false, true]);
  expect(moments).toEqual(Array(4).fill({ slopeId: 'toSix', var: 'aiPower', day: 2, minute: 420 })); // le premier allumage seulement
  const already = withSlopes(W10, [['toSix', 'w06', 'aiPower', '>=', 25]]); // allumée dès le départ
  const s0 = startWeek(runLivingIn('w10'), already, core);
  expect(s0.readings['toSix.aiPower']).toBe(true);
  expect(stepWeek(s0, withDrift(already, { aiPower: 1 }), core, { kind: 'morning', day: 2 }, at(2, 420)).momentReading).toBeNull();
});

it('test_milestone_on_j1_moves_curve_start', () => {
  const w = withMilestones(W10, 2, [['m', { unrest: 1 }]]);
  const s = applyMilestone(startWeek(runLivingIn('w10'), w, core), w, 'm');
  expect(s.ws.unrest).toBe(46_000);
  expect(s.curve.length).toBe(1);
  expect(s.curve[0]).toEqual(s.ws);
});
