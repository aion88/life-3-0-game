import { describe, expect, it } from 'vitest';
import causesRaw from '../../../src/data/causes.json';
import headlinesRaw from '../../../src/data/headlines.json';
import { loadCore } from '../../../src/data/load';
import { parseCauses, type Beat, type CauseSet } from '../../../src/data/schema/causes';
import { parseHeadlines } from '../../../src/data/schema/headlines';
import enStrings from '../../../src/data/strings/en.json';
import frStrings from '../../../src/data/strings/fr.json';
import { causeEditions, lineOf } from '../../../src/fastforward/causes';
import { replaceOne } from '../../../src/questionnaire';
import { ans, key } from '../../support/answers';
import { runOf } from '../../support/run';

const core = loadCore();
const Q = core.questionnaire;
const H = parseHeadlines(headlinesRaw);
const CA = parseCauses(causesRaw);

/** Beat forgé : aiPower, sens +1, principale Q07 C, « aussi » dans l'ordre Q16 A puis Q05 B. */
const forgedBeat = (variable: Beat['var'] = 'aiPower'): Beat => ({
  id: 'forged', edition: 1, linkedHeadline: 'traj.m02', var: variable, sense: 1,
  main: { question: key('Q07'), answer: 'C' },
  also: [{ question: key('Q16'), answer: 'A' }, { question: key('Q05'), answer: 'B' }],
});
/** Q16 A et Q05 B poussent `unrest` de la même quantité (+3) : l'égalité se tranche à l'ordre d'écriture. */
const forgedBeatEqualPushes = (): Beat => forgedBeat('unrest');

/** CauseSet par spread, `CA` intact : le beat visé renvoie à un titre absent du jeu, donc jamais déclenché. */
function withNeverHeadlineOnBeat(set: CauseSet, world: 'w07' | 'w12', beat: number): CauseSet {
  return {
    ...set,
    byExtinction: {
      ...set.byExtinction,
      [world]: set.byExtinction[world].map((b) => (b.id === String(beat) ? { ...b, linkedHeadline: 'forged.never' } : b)),
    },
  };
}

const causeStrings = (): string[] =>
  [frStrings, enStrings].flatMap((t) => Object.entries(t).filter(([k]) => k.startsWith('cause.')).map(([, s]) => s as string));

const years = (line: string, set = CA) => causeEditions(runOf(line), H, set, Q).map((e) => e.year);

describe('écran des causes [plan 01 T10]', () => {
  it('test_f13_w07_editions_2028_2029_2031', () => { expect(years('CBCCBDBACCD')).toEqual([2028, 2029, 2031]); });
  it('test_f13_w12_editions_2030_2031_2032', () => { expect(years('CBCCBDDACCD')).toEqual([2030, 2031, 2032]); });
  it('test_last_edition_flagged_for_softened', () => {
    expect(causeEditions(runOf('CBCCBDBACCD'), H, CA, Q).map((e) => e.isLast)).toEqual([false, false, true]);
  });
  it('test_also_line_maximises_sense_times_push', () => {
    // Q07 B : pas de principale ; Q16 A (aiPower +9) et Q05 B (aiPower +11) allument le beat forgé
    const a = replaceOne(replaceOne(ans('ACBACBACAAD'), key('Q16'), 'A'), key('Q05'), 'B');
    expect(lineOf(forgedBeat(), a, Q)).toEqual({ question: 'Q05', answer: 'B' }); // 11 > 9 [D81]
    expect(lineOf(forgedBeatEqualPushes(), a, Q)).toEqual({ question: 'Q16', answer: 'A' }); // égalité : ordre de la bible
  });
  it('test_unfired_title_dates_nothing', () => {
    // beat 4 de w07 relié à un titre jamais déclenché ; les beats 5 et 6 datent encore l'édition 2
    expect(years('CBCCBDBACCD', withNeverHeadlineOnBeat(CA, 'w07', 4))).toEqual([2028, 2029, 2031]);
  });
  it('test_arrival_has_no_editions', () => { expect(causeEditions(runOf('ACBACBACAAD'), H, CA, Q)).toEqual([]); });
  it('test_every_linked_headline_id_exists', () => {
    const ids = new Set(H.headlines.map((h) => h.id));
    for (const beats of Object.values(CA.byExtinction)) for (const b of beats) expect(b.linkedHeadline === 'rupture' || ids.has(b.linkedHeadline), b.id + ' ' + b.linkedHeadline).toBe(true);
  });
  it('test_edition_year_null_when_no_lit_beat_dated', () => {
    const set = [4, 5, 6].reduce((acc, n) => withNeverHeadlineOnBeat(acc, 'w07', n), CA);
    const eds = causeEditions(runOf('CBCCBDBACCD'), H, set, Q);
    expect(eds.map((e) => e.year)).toEqual([2028, null, 2031]);
    expect(eds[1]!.beats.every((b) => b.lit)).toBe(true);
  });
  it('test_f15_beat_lines_carry_no_key_or_letter', () => {
    expect(causeStrings().length).toBeGreaterThan(0);
    for (const s of causeStrings()) expect(s).not.toMatch(/\bQ\d{2,3}\b|\b[A-D]\)/);
  });
});
