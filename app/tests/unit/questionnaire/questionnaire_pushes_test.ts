import { describe, expect, it } from 'vitest';
import { assertContent, contentHashOf, parseQuestionnaire, type Questionnaire } from '../../../src/data/load';
import { answersAt, displayRankOf, indexOf, pushOf, replaceOne } from '../../../src/questionnaire';
import { createSaveStore } from '../../../src/save/save';
import { milliToPoints } from '../../../src/shared/milli';
import { answersOf, type Answers, type AnswerKey } from '../../../src/shared/types';
import { WORLD_VARS } from '../../../src/shared/types/world';
import oracleJson from '../../fixtures/questionnaire.oracle.json';
import { qRaw, withPush } from '../../fixtures/data/factories';
import { memStorage } from '../../fixtures/save/factories';
import { ans, key, p } from '../../support/answers';

const Q = parseQuestionnaire(qRaw);

/** Les 38 poussées en points, `{ Qxx: { A: [6 points], ... } }`, relues du questionnaire parsé. */
function pushTable(q: Questionnaire): Record<string, Record<string, number[]>> {
  const t: Record<string, Record<string, number[]>> = {};
  for (const x of q.questions) {
    t[x.key] = Object.fromEntries(x.answers.map((a) => [a.key, WORLD_VARS.map((k) => milliToPoints(a.push[k]))]));
  }
  return t;
}
/** Le contrôle que `createSaveStore` attend : la réponse existe pour la question. */
function validAnswer(q: Questionnaire): (k: ReturnType<typeof key>, a: AnswerKey) => boolean {
  return (k, a) => q.questions.some((x) => x.key === k && x.answers.some((y) => y.key === a));
}
/** Réponses relues d'une sauvegarde, complètes ou le test échoue. */
function complete(x: Readonly<Partial<Record<string, AnswerKey>>>): Answers {
  for (const k of Q.questions.map((y) => y.key)) expect(x[k]).toBeDefined();
  return answersOf(x as Record<string, AnswerKey>);
}

describe('questionnaire pushes', () => {
  it('test_content_status_and_oracle_pushes', () => {
    assertContent(Q, 'questionnaire.json');
    expect(pushTable(Q)).toEqual(oracleJson.pushes);              // une poussée mal recopiée casse ici
  });
  it('test_f2_every_answer_moves_3_and_weighs_4', () => {            // F-2 [GDD 01 §9.3]
    for (const q of Q.questions) for (const a of q.answers) {
      const xs = WORLD_VARS.map((k) => a.push[k]);
      expect(xs.filter((x) => x !== 0).length).toBeGreaterThanOrEqual(3);
      expect(xs.reduce((s, x) => s + Math.abs(x), 0)).toBeGreaterThanOrEqual(4000);
    }
  });
  it('test_push_reference_lines_exact', () => {                      // [rejoué : export_questionnaire.py, clé `lines`]
    expect(pushOf(Q, ans('ACBACBACAAD'))).toEqual(p(-29, 43, -7, -28, 58, -17));   // w10
    expect(pushOf(Q, ans('CBCCBDBACCD'))).toEqual(p(62, -38, 15, 21, -8, 35));     // w07
    expect(pushOf(Q, ans('CBCCBDDACCD'))).toEqual(p(47, -43, 9, 22, -5, 41));      // w12
    for (const [w, line] of Object.entries(oracleJson.lines)) {
      expect(pushOf(Q, ans(line.letters)), w).toEqual(p(...(line.p as [number, number, number, number, number, number])));
    }
  });
  it('test_display_rank_is_order', () => { expect(['Q21', 'Q07', 'Q11'].map((k) => displayRankOf(Q, key(k)))).toEqual([5, 11, 1]); });
  it('test_hypothesis_flags_exact', () => {                           // [GDD 01 §3.1 règle 6]
    const flagged = Q.questions.flatMap((q) => q.answers.filter((a) => a.hypothesis).map((a) => `${q.key}.${a.key}`));
    expect([...flagged].sort()).toEqual(['Q04.D', 'Q15.D', 'Q18.A', 'Q18.D', 'Q21.A', 'Q21.B', 'Q21.C']);
  });
  it('test_f4_display_order_all_keys', () => {                       // F-4 [GDD 01]
    expect([...Q.questions].sort((a, b) => a.order - b.order).map((q) => q.key))
      .toEqual(['Q11', 'Q14', 'Q05', 'Q10', 'Q21', 'Q04', 'Q15', 'Q18', 'Q16', 'Q20', 'Q07']);
  });
  it('test_index_roundtrip', () => {
    for (const i of [0, 1, 4, 186623, 746495]) expect(indexOf(Q, answersAt(Q, i))).toBe(i);
    const a = ans('ACBACBACAAD');
    expect(replaceOne(a, key('Q04'), 'B')[key('Q04')]).toBe('B');
    expect(a[key('Q04')]).toBe('A');                                 // l'original n'est pas modifié
  });
  it('test_push_edit_discards_saved_answers', () => {                // Review Focus 1 [GDD 01 F-11]
    const mem = memStorage();
    const s1 = createSaveStore(mem, contentHashOf(qRaw), validAnswer(Q)); s1.update({ answers: ans('ACBACBACAAD') });
    const s2 = createSaveStore(mem, contentHashOf(qRaw), validAnswer(Q));
    expect(pushOf(Q, complete(s2.load().data.answers))).toEqual(pushOf(Q, ans('ACBACBACAAD')));   // même P au rechargement
    const edited = withPush(qRaw, 'Q11', 'A', 'order', 5);
    expect(createSaveStore(mem, contentHashOf(edited), validAnswer(Q)).load().status).toBe('discarded-content');
  });
});
