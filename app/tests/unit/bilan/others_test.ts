import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { bilanOthers, bilanTraceback, isReplayed, otherLineText, replayedDestination, traceText } from '../../../src/bilan/others';
import { readingOrder, singleReplacements } from '../../../src/fastforward';
import { createI18n, type StringMeta } from '../../../src/i18n/i18n';
import { replaceOne } from '../../../src/questionnaire';
import type { OtherLife } from '../../../src/shared/types';
import { questionNumber } from '../../../src/shared/types';
import { ans } from '../../support/answers';
import { destinationOf, runOf } from '../../support/run';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import meta from '../../../src/data/strings/meta.json';

const core = loadCore();
const LINES = ['ACBACBACAAD', 'AAAAAABACCB', 'CBCCBCCABBD', 'CBCCBDBACCD'];
const i18n = createI18n({ fr, en }, meta as StringMeta, 'fr', { mode: 'dev', report: () => undefined });

const othersOf = (line: string) => { const a = ans(line); return bilanOthers(core, a, bilanTraceback(core, a)); };
const brief = (line: string) => othersOf(line).lines.map((o) => [o.question, o.displayedRank, o.answer, o.destination]);

describe('Les autres, bilan [plan 03 T9]', () => {
  it('test_every_other_line_is_replayed_by_the_simulator', () => {
    for (const line of LINES) {
      const a = ans(line);
      for (const o of othersOf(line).lines) {
        expect(destinationOf(runOf(replaceOne(a, o.question, o.answer))), `${line} ${o.question}${o.answer}`).toBe(o.destination);
        expect(isReplayed(core, a, o)).toBe(true);
        expect(replayedDestination(core, a, o)).toBe(o.destination);
      }
    }
  });
  it('test_others_lengths', () => {
    expect(brief('ACBACBACAAD')).toEqual([['Q11', 1, 'B', 'w11']]);
    expect(othersOf('AAAAAABACCB').lines).toHaveLength(4);
    expect(othersOf('CBCCBCCABBD').lines).toHaveLength(0);
    expect(othersOf('CBCCBDBACCD').lines).toHaveLength(2);
  });
  it('test_others_locked_when_zero_lines', () => {
    expect(othersOf('CBCCBCCABBD').locked).toBe(true);
    for (const l of ['ACBACBACAAD', 'AAAAAABACCB', 'CBCCBDBACCD']) expect(othersOf(l).locked).toBe(false);
  });
  it('test_others_never_exceed_four', () => {
    for (const line of LINES) expect(othersOf(line).lines.length).toBeLessThanOrEqual(4);
  });
  it('test_traceback_has_two_or_three_lines', () => {
    const t = bilanTraceback(core, ans('ACBACBACAAD'));
    expect(t.map((x) => [x.question, x.answer])).toEqual([['Q11', 'C'], ['Q21', 'D'], ['Q05', 'C']]);
    for (const line of LINES.filter((l) => l !== 'CBCCBCCABBD')) {
      const n = bilanTraceback(core, ans(line)).length;
      expect(n, line).toBeGreaterThanOrEqual(2);
      expect(n, line).toBeLessThanOrEqual(3);
    }
  });
  it('test_traceback_text_falls_back_to_cost_key_and_warns', () => {
    const own = traceText(i18n, { question: 'Q11' as never, answer: 'C' });
    expect(own.fallback).toBe(false);
    expect(own.key).toBe(['bilan', 'trace', 'Q11', 'C'].join('.'));
    const partial = createI18n({ fr: { 'q.Q11.C.cost': 'Coût.' }, en: { 'q.Q11.C.cost': 'Cost.' } }, { 'q.Q11.C.cost': { policy: 'ui' } } as unknown as StringMeta,
      'fr', { mode: 'prod', report: () => undefined });
    const fb = traceText(partial, { question: 'Q11' as never, answer: 'C' });
    expect(fb).toEqual({ key: 'q.Q11.C.cost', text: 'Coût.', fallback: true });
  });
  it('test_b_v12_remontee_question_comes_first', () => {
    for (const line of ['ACBACBACAAD', 'AAAAAABACCB']) {
      const a = ans(line); const t = bilanTraceback(core, a);
      const order = readingOrder(t);
      expect(order.slice(0, t.length)).toEqual(t.map((x) => x.question));
      const lines = othersOf(line).lines;
      const idx = lines.map((o) => order.indexOf(o.question));
      expect([...idx].sort((x, y) => x - y)).toEqual(idx);   // lues dans l'ordre de lecture
    }
    expect(brief('AAAAAABACCB')[0]![0]).toBe('Q21');          // Q21 est en tête de la remontée
  });
  it('test_b_v12_remontee_question_without_distinct_world_is_skipped', () => {
    // AAAAAABACCB : remontée Q21, Q05, Q14 ; Q05 n'a aucun monde neuf
    const qs = othersOf('AAAAAABACCB').lines.map((o) => o.question);
    expect(bilanTraceback(core, ans('AAAAAABACCB')).map((t) => t.question)).toContain('Q05');
    expect(qs).not.toContain('Q05');
  });
  it('test_b_v12_collision_fixture_keeps_first', () => {
    // Trouvé par balayage déterministe de la grille (indices 0, 1009, 2018, ...) : AAAAAAAAAAA lit Q21 en tête, et Q21 C donne w10,
    // monde que Q11 C, Q05 C, Q04 D, Q16 B/C, Q20 B/C, Q07 B/C donnent aussi ; seule la première question de lecture est gardée.
    const lines = othersOf('AAAAAAAAAAA').lines;
    expect(lines.map((o) => [o.question, o.answer, o.destination])).toEqual([['Q21', 'C', 'w10'], ['Q21', 'D', 'w11']]);
    const a = ans('AAAAAAAAAAA');
    const reachW10 = singleReplacements(core, a).filter((o) => o.destination === 'w10').map((o) => o.question);
    expect(new Set(reachW10).size).toBeGreaterThan(1);       // la collision existe bien
    expect(lines.filter((o) => o.destination === 'w10')).toHaveLength(1);
  });
  it('test_b_v12_two_questions_same_world_keeps_first', () => {
    for (const line of LINES) {
      const a = ans(line); const lines = othersOf(line).lines;
      const order = readingOrder(bilanTraceback(core, a));
      const worlds = lines.map((o) => o.destination);
      expect(new Set(worlds).size).toBe(worlds.length);
      const all = singleReplacements(core, a);
      for (const kept of lines) {
        const earlier = all.filter((o) => o.destination === kept.destination && order.indexOf(o.question) < order.indexOf(kept.question));
        expect(earlier, `${line} ${kept.destination}`).toEqual([]);   // aucune question antérieure ne atteint ce monde
      }
    }
  });
  it('test_b_v12_same_question_two_worlds_orders_by_answer_rank_then_world_number', () => {
    // AAAAAABACCB : Q21 donne A w03, C w10, D w11 (lettre croissante)
    const q21 = othersOf('AAAAAABACCB').lines.filter((o) => o.question === 'Q21');
    expect(q21.map((o) => [o.answer, o.destination])).toEqual([['A', 'w03'], ['C', 'w10'], ['D', 'w11']]);
    for (const line of LINES) {
      const byQ = new Map<string, OtherLife[]>();
      for (const o of othersOf(line).lines) byQ.set(o.question, [...(byQ.get(o.question) ?? []), o]);
      for (const group of byQ.values()) for (let i = 1; i < group.length; i++) expect(group[i - 1]!.answer <= group[i]!.answer).toBe(true);
    }
  });
  it('test_b_v12_line_cites_displayed_rank', () => {
    expect(othersOf('DBCAAACBDAD').lines).toContainEqual(expect.objectContaining({ question: 'Q21', displayedRank: 5, answer: 'A', destination: 'w05' }));
    expect(othersOf('ABACBCBCAAA').lines).toContainEqual(expect.objectContaining({ question: 'Q07', displayedRank: 11, answer: 'C', destination: 'w01' }));
    expect(questionNumber('Q07' as never)).toBe(7);
  });
  it('test_b_v3_no_other_line_without_replay', () => {
    const a = ans('ACBACBACAAD');
    const invented: OtherLife = { question: 'Q11' as never, answer: 'B', destination: 'w02', displayedRank: 1 };
    expect(isReplayed(core, a, invented)).toBe(false);                                   // monde faux
    expect(isReplayed(core, a, { ...invented, answer: 'C' as never })).toBe(false);      // la réponse donnée n'est pas un remplacement
    expect(isReplayed(core, a, { ...invented, destination: 'w11' })).toBe(true);
  });
  it('test_other_line_text_names_world_and_answer_without_codes', () => {
    const o = othersOf('ACBACBACAAD').lines[0]!;
    const text = otherLineText(i18n, o);
    expect(text).toContain(i18n.t(`world.${o.destination}.name`));
    expect(text).not.toMatch(/\bQ\d|\bw\d\d\b/);
  });
});
