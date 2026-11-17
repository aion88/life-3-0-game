import { beforeAll, describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { otherLives, remontee } from '../../../src/fastforward';
import { replaceOne } from '../../../src/questionnaire';
import { CANONICAL_LINES } from '../../fixtures/canonical-lines';
import bilanBv12 from '../../fixtures/bilan-bv12.oracle.json';
import gridOracle from '../../fixtures/grid.oracle.json';
import { ans } from '../../support/answers';
import {
  buildGrid, countWithExtinctNeighbourOtherThanOwn, neighbourCountAt, neighbourHistogram, otherLivesAt, type Grid,
} from '../../support/grid';
import { destinationOf, runOf } from '../../support/run';

const core = loadCore();
/** La grille entière coûte ~20 s : construite une fois, hors délai de test [errata T7]. */
const SLOW = { timeout: 120_000 };
let G: Grid;

/** `oracle('bilan-bv12')` : import JSON statique de `tests/fixtures/bilan-bv12.oracle.json` [R-01.3, errata T9]. */
const oracle = (name: 'bilan-bv12') => { if (name !== 'bilan-bv12') throw new Error(name); return bilanBv12; };

describe('D139 sur la grille [plan 01 T9]', () => {
  beforeAll(() => { G = buildGrid(core); }, 120_000);

  it('test_d139_distribution_exact', SLOW, () => {
    expect(neighbourHistogram(G)).toEqual([18066, 107554, 289813, 212012, 92597, 26122, 321, 11]); // 0 à 7 mondes
  });
  it('test_extinct_neighbour_other_than_own_1062', SLOW, () => { // [exécuté: gd-plancher, 2026-10-29, GDD 06 rév. 2 ter]
    expect(countWithExtinctNeighbourOtherThanOwn(G)).toBe(1062);
  });
  it('test_f11_every_displayed_line_is_resimulated', SLOW, () => { // F11 [GDD 02 F11, GDD 06 §3.5, D49]
    for (const [, line] of CANONICAL_LINES) {
      const a = ans(line);
      for (const o of otherLives(core, a, remontee(core, a)))
        expect(destinationOf(runOf(replaceOne(a, o.question, o.answer)))).toBe(o.destination);
    }
  });
  it('test_bv12_fixture_replayed_by_other_lives', SLOW, () => { // fixture consommée aussi par le plan 03 [GDD 06 §8.2 B-V12]
    const F = oracle('bilan-bv12');
    expect(F.cases.map((c) => c.id).sort()).toEqual(['fourth-place-split', 'rank-q07-is-11', 'rank-q21-is-5', 'same-world-first-kept', 'skipped-traceback-question']);
    for (const c of F.cases) {
      const a = ans(c.line);
      expect(remontee(core, a).map((t) => t.question)).toEqual(c.remontee);
      expect(otherLives(core, a, remontee(core, a)).map((o) => [o.question, o.displayedRank, o.answer, o.destination])).toEqual(c.others);
    }
  });
  it('test_other_lives_length_is_min_4_m_on_witnesses', SLOW, () => {
    for (const w of gridOracle.witnesses) expect(otherLivesAt(G, w.i).length).toBe(Math.min(4, neighbourCountAt(G, w.i)));
  });
});
