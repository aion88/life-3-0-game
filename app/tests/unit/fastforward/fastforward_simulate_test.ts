import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { fastForwardStep, simulateFastForward } from '../../../src/fastforward/simulate';
import { pushOf } from '../../../src/questionnaire';
import oracleJson from '../../fixtures/fastforward.oracle.json';
import { ans, p } from '../../support/answers';
import { expectSameTwice } from '../../support/determinism';
import { v } from '../../support/vec';

const core = loadCore();
const Q = core.questionnaire;
const E = core.engine;
const O = oracleJson;
const run = (line: string) => simulateFastForward(pushOf(Q, ans(line)), E);

describe('fast-forward 48 pas [plan 01 T3]', () => {
  it('test_w10_line_every_step_matches_oracle', () => {
    const r = run('ACBACBACAAD');
    expect(r.trajectory.steps).toEqual(O.w10.steps); // 49 vecteurs, égalité exacte
    expect(r.atChoice).toEqual(v(1, 100, 43, 37, 93, 25)); // [rejoué: lead-programmer, d106.simulate02]
    expect(r.extinction).toBeNull();
  });
  it('test_f4_w07_run_37_rupture_60', () => { // [GDD 02 F4, bible w07 §2.3]
    const r = run('CBCCBDBACCD');
    expect(r.extinction).toEqual({ world: 'w07', runStartStep: 37, ruptureStep: 60 });
    expect(r.trajectory.steps).toEqual(O.w07.steps);
  });
  it('test_f3_t5_w12_run_47_rupture_70', () => { // [GDD 02 F3, GDD 03 T-5]
    const r = run('CBCCBDDACCD');
    expect(r.extinction).toEqual({ world: 'w12', runStartStep: 47, ruptureStep: 70 });
    expect(r.trajectory.steps[36]!.unrest).toBe(60_750); // condition partielle fausse au pas 36 [GDD 02 rév. 2h, §4.8]
    expect(r.trajectory.steps[37]).toEqual(O.w12.steps[37]); // aiPower 77, order 15,5, abundance 39,5, unrest 71
    expect(r.trajectory.steps[47]).toMatchObject({ aiPower: 77_000, order: 500, abundance: 24_500, unrest: 71_000 });
    expect(r.trajectory.steps[48]).toMatchObject({ aiPower: 77_000, order: 0, abundance: 23_000, unrest: 71_000 });
    expect(r.trajectory.steps[47]).toEqual(O.w12.steps[47]);
    expect(r.trajectory.steps[48]).toEqual(O.w12.steps[48]);
  });
  it('test_run_broken_after_48_reads_v48', () => { // Review Focus 2 [GDD 02 §5]
    const r = simulateFastForward(p(65, -22, 45, -5, 5, 45), E);
    expect(r.extinction).toBeNull();
    expect(r.trajectory.steps.length).toBe(49);
    expect(r.atChoice).toEqual(v(95, 30.5, 95, 60, 40, 63)); // [rejoué: lead-programmer, d106.simulate02]
  });
  it('test_gate_from_step_25', () => {
    expect(simulateFastForward(p(260, -100, 0, 0, 0, 160), E).extinction)
      .toEqual({ world: 'w07', runStartStep: 25, ruptureStep: 48 }); // [rejoué: lead-programmer, d106.simulate02, ext = 2]
  });
  it('test_t8_pure_step_composes_to_the_run', () => { // [GDD 03 T-8]
    const push = pushOf(Q, ans('ACBACBACAAD'));
    let x = E.v0;
    const folded = [x];
    for (let s = 1; s <= 48; s++) { x = fastForwardStep(x, s, push, E); folded.push(x); }
    expect(folded).toEqual(simulateFastForward(push, E).trajectory.steps);
  });
  it('test_f1_same_input_same_output', () => { expectSameTwice(() => run('CBCCBDDACCD')); });
  it('test_extinction_precedence_matches_oracle', () => {
    // d106.py simulate02 : ext = np.where(hsd, 1, np.where(hcq, 2, ext)) teste Autodestruction avant Conquérants.
    expect(E.extinctions.map((e) => e.id)).toEqual(['w12', 'w07']);
  });
});
