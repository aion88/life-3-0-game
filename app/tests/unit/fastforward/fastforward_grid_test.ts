import { beforeAll, describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { indexOf } from '../../../src/questionnaire';
import { CANONICAL_LINES } from '../../fixtures/canonical-lines';
import gridOracle from '../../fixtures/grid.oracle.json';
import { ans, key } from '../../support/answers';
import {
  assertValidCell, buildGrid, counterfactualPairs, farCounts, patternShare, ruptureHistogram, tally, tallyBy, tieStats,
  type Grid,
} from '../../support/grid';

const core = loadCore();
const Q = core.questionnaire;
const O = gridOracle;
/** La grille entière coûte une passe de 746 496 suites : elle est construite une fois, hors délai de test [errata T7]. */
const SLOW = { timeout: 120_000 };
let G: Grid;

describe('grille exhaustive 746 496 suites [plan 01 T7]', () => {
  beforeAll(() => { G = buildGrid(core); }, 120_000);

  it('test_destination_counts_exact', SLOW, () => {
    expect(G.size).toBe(746_496);
    expect(tally(G)).toEqual({
      w01: 90945, w02: 4088, w03: 108578, w04: 235696, w05: 11129, w06: 79969,
      w08: 5486, w09: 814, w10: 158635, w11: 51095, w12: 1, w07: 60,
    });
    expect(tally(G)).toEqual(O.counts);
  });

  it('test_counts_by_q21_answer_exact', SLOW, () => { // [rejoué: lead-programmer]
    expect(tallyBy(G, key('Q21'))).toEqual({
      A: { w01: 20328, w02: 95, w03: 51456, w04: 58942, w05: 11092, w06: 2806, w08: 425, w10: 37129, w11: 4351 },
      B: { w01: 33461, w02: 2932, w03: 26224, w04: 70791, w05: 24, w06: 17241, w07: 28, w08: 4966, w09: 28, w10: 25823, w11: 5106 },
      C: { w01: 9378, w02: 1011, w03: 2367, w04: 62246, w05: 11, w06: 41661, w07: 23, w08: 34, w09: 786, w10: 60767, w11: 8340 },
      D: { w01: 27778, w02: 50, w03: 28531, w04: 43717, w05: 2, w06: 18261, w07: 9, w08: 61, w10: 34916, w11: 33298, w12: 1 },
    });
    expect(tallyBy(G, key('Q21'))).toEqual(O.byQ21);
  });

  it('test_f10_ties_2416_and_708_changes', SLOW, () => {
    expect(tieStats(G, core.catalogue)).toEqual({ exactTies: 2416, changedVsFirstOfTable: 708 });
    expect(tieStats(G, core.catalogue)).toEqual(O.ties);
  });

  it('test_far_arrivals_39832_over_60_1719_over_70', SLOW, () => {
    expect(farCounts(G, core.catalogue, core.engine.farArrivalDistance)).toEqual({ over60: 39832, over70: 1719 });
    expect(farCounts(G, core.catalogue, core.engine.farArrivalDistance)).toEqual(O.far);
  });

  it('test_f9_ruptures_at_60_and_70_only', SLOW, () => {
    expect(ruptureHistogram(G)).toEqual({ 60: 60, 70: 1 });
    expect(ruptureHistogram(G)).toEqual(O.ruptures);
  });

  it('test_f8_no_outcome_leaves_the_game', SLOW, () => { // identifiant connu, 6 axes dans 0..100 000
    for (let i = 0; i < G.size; i++) assertValidCell(G, i);
  });

  it('test_witnesses_match_oracle', SLOW, () => {
    expect(O.witnesses).toHaveLength(2000);
    for (const w of O.witnesses) expect([G.destinationAt(w.i), G.atChoiceAt(w.i)]).toEqual([w.destination, w.v48]);
    // AAAAAAAAAAA (indice 0) : V(48) et distances² aux quatre mondes de la build à quatre mondes, en points² [plan T4, d² 6 084 contre 6 764]
    expect(G.atChoiceAt(0)).toEqual(O.fourWorlds.v48);
    for (const [id, d2] of Object.entries(O.fourWorlds.d2Points)) {
      const target = core.catalogue.byId[id as keyof typeof core.catalogue.byId].vector;
      expect(target).not.toBeNull();
      let s = 0;
      for (const k of Object.keys(O.fourWorlds.v48) as (keyof typeof O.fourWorlds.v48)[]) s += (O.fourWorlds.v48[k] - target![k]) ** 2;
      expect(s / 1_000_000).toBe(d2);
    }
  });

  it('test_gdd01_f8_canonical_lines', SLOW, () => { // [GDD 01 §7, F-8 ; rejoué: lead-programmer]
    for (const [world, line] of CANONICAL_LINES) expect(G.destinationAt(indexOf(Q, ans(line)))).toBe(world);
    expect(patternShare(G, 'D--ACBB-C-C', 'w09')).toEqual({ hit: 14, of: 81 });
  });

  it('test_gdd02_f6_w02_readings', SLOW, () => { // [GDD 02 F6 ; exécuté: gd-plancher, gdd02_onze]
    expect(patternShare(G, 'D--AAA--D-D', 'w02')).toEqual({ hit: 3, of: 324 });
    expect(patternShare(G, 'D--AAA--D--', 'w02')).toEqual({ hit: 171, of: 1296 });
  });

  it('test_f10_every_answer_has_a_counterfactual', SLOW, () => { // F-10 [GDD 01 §9, §5.10, D103]
    const c = counterfactualPairs(G, Q); // paires (suite, remplacement) qui changent la destination
    expect(Object.keys(c)).toHaveLength(O.counterfactual.answers);
    for (const k of Object.keys(c)) expect(c[k]).toBeGreaterThan(0);
    expect(c['Q18.B']).toBe(161699); // [rejoué: lead-programmer, décalage d'index]
    expect(c).toEqual(O.counterfactual.pairs);
  });
});
