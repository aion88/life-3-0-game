import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { otherLives, remontee, singleReplacements } from '../../../src/fastforward';
import { replaceOne } from '../../../src/questionnaire';
import { ans } from '../../support/answers';
import { destinationOf, runOf } from '../../support/run';

const core = loadCore();

const others = (line: string) => {
  const a = ans(line);
  return otherLives(core, a, remontee(core, a)).map((o) => [o.question, o.displayedRank, o.answer, o.destination]);
};

describe('Les autres, D139 [plan 01 T9]', () => {
  it('test_27_replacements_each_resimulated', () => {
    const r = singleReplacements(core, ans('ACBACBACAAD'));
    expect(r.length).toBe(27); // F1 [GDD 06 §4]
    for (const o of r) expect(o.destination).toBe(destinationOf(runOf(replaceOne(ans('ACBACBACAAD'), o.question, o.answer))));
  });
  it('test_w10_line_one_neighbour', () => { expect(others('ACBACBACAAD')).toEqual([['Q11', 1, 'B', 'w11']]); });
  it('test_extinction_neighbour_is_a_line', () => { // w07 : une vie voisine éteinte en w12
    expect(others('CBCCBDBACCD')).toEqual([['Q15', 7, 'A', 'w01'], ['Q15', 7, 'D', 'w12']]);
  });
  it('test_locked_trajectory_zero_lines', () => { expect(others('CBCCBCCABBD')).toEqual([]); }); // ligne canonique de w01
  it('test_more_than_four_reads_remontee_first_and_skips_empty', () => {
    // AAAAAABACCB : Gatekeeper, M = w01 w03 w06 w10 w11 ; remontée Q21, Q05 (sans monde neuf, sautée), Q14
    expect(others('AAAAAABACCB')).toEqual([['Q21', 5, 'A', 'w03'], ['Q21', 5, 'C', 'w10'], ['Q21', 5, 'D', 'w11'], ['Q14', 2, 'D', 'w06']]);
  });
  it('test_other_lives_rank_is_display_order', () => { // Review Focus 4 [D139, GDD 06 §3.5]
    expect(others('DBCAAACBDAD')).toContainEqual(['Q21', 5, 'A', 'w05']);
    expect(others('ABACBCBCAAA')).toContainEqual(['Q07', 11, 'C', 'w01']);
  });
  it('test_redirected_player_counts_against_computed_world', () => { // [D140 (3)]
    // AAAAAAAAAAA arrive en w03 et vit w10 : une vie voisine en w10 reste une ligne
    const a = ans('AAAAAAAAAAA');
    expect(runOf('AAAAAAAAAAA').outcome).toMatchObject({ computedWorld: 'w03', livedWorld: 'w10' });
    expect(otherLives(core, a, remontee(core, a)).every((o) => o.destination !== 'w03')).toBe(true);
  });
});
