import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { rightHalves, rightLines, type RightCarriers } from '../../../src/bilan/rights';
import type { Questionnaire } from '../../../src/data/schema/questionnaire';
import { createI18n, type StringMeta } from '../../../src/i18n/i18n';
import { answersOf, type AnswerKey } from '../../../src/shared/types';
import { RIGHT_IDS } from '../../../src/shared/types/street';
import { parseWorld } from '../../../src/data/schema/world';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { ans } from '../../support/answers';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import meta from '../../../src/data/strings/meta.json';

const core = loadCore();
const w10 = parseWorld(w10Raw, cat);
const i18n = createI18n({ fr, en }, meta as StringMeta, 'fr', { mode: 'dev', report: () => undefined });

/** Questionnaire synthétique : une réponse par question, poussée sur `freedom`. */
function fake(pushes: Record<string, number>): { q: Questionnaire; a: ReturnType<typeof answersOf> } {
  const zero = { aiPower: 0, order: 0, abundance: 0, freedom: 0, surveillance: 0, unrest: 0 };
  const questions = Object.entries(pushes).map(([key, v], i) => ({
    key, order: i + 1, hypothesis: false,
    answers: [{ key: 'A', push: { ...zero, freedom: v }, hypothesis: false }],
  }));
  return { q: { questions } as unknown as Questionnaire, a: answersOf(Object.fromEntries(Object.keys(pushes).map((k) => [k, 'A' as AnswerKey]))) };
}
const carriers = (v: string, sign: 1 | -1): RightCarriers => Object.fromEntries(RIGHT_IDS.map((r) => [r, { var: v, sign }])) as RightCarriers;

describe('Les droits, bilan [plan 03 T9]', () => {
  const bilan = w10.bilan as unknown as { rights: { carriers: RightCarriers } };
  it('test_rights_has_eight_lines_one_per_right_id', () => {
    const lines = rightLines(core.questionnaire, ans('ACBACBACAAD'), bilan.rights.carriers, 'w10');
    expect(lines.map((l) => l.right)).toEqual([...RIGHT_IDS]);
    for (const l of lines) expect(l.lineKey).toBe(`w10.right.${l.right}`);
    expect(lines).toHaveLength(8);
  });
  it('test_right_line_is_carried_by_argmax_answer', () => {
    const { q, a } = fake({ Q04: 5, Q05: 12, Q07: 9 });
    const [first] = rightLines(q, a, carriers('freedom', 1), 'w10');
    expect(first!.carriedBy).toEqual({ question: 'Q05', answer: 'A' });
    const [neg] = rightLines(q, a, carriers('freedom', -1), 'w10');   // sens de la perte inversé : aucune poussée positive
    expect(neg!.carriedBy).toBeNull();
    const mixed = fake({ Q04: -30, Q05: 12 });
    expect(rightLines(mixed.q, mixed.a, carriers('freedom', -1), 'w10')[0]!.carriedBy).toEqual({ question: 'Q04', answer: 'A' });
  });
  it('test_right_tie_breaks_by_question_number', () => {
    const { q, a } = fake({ Q10: 7, Q04: 7, Q21: 7 });   // ordre d'insertion sans rapport avec le numéro
    expect(rightLines(q, a, carriers('freedom', 1), 'w10')[0]!.carriedBy!.question).toBe('Q04');
  });
  it('test_right_without_positive_push_has_no_carrier_label', () => {
    const { q, a } = fake({ Q04: 0, Q05: 0 });
    for (const l of rightLines(q, a, carriers('freedom', 1), 'w10')) expect(l.carriedBy).toBeNull();
  });
  it('test_right_halves_come_from_line_halves', () => {
    const lines = rightLines(core.questionnaire, ans('ACBACBACAAD'), bilan.rights.carriers, 'w10');
    for (const l of lines) {
      const h = rightHalves(i18n, l);
      expect(h.first).toMatch(/^Ici/);
      expect(h.second).toMatch(/^En 2026/);
    }
  });
  it('test_real_carrier_pushes_are_positive_in_loss_direction', () => {
    const lines = rightLines(core.questionnaire, ans('ACBACBACAAD'), bilan.rights.carriers, 'w10');
    expect(lines.some((l) => l.carriedBy)).toBe(true);
    for (const l of lines) if (l.carriedBy) {
      const c = bilan.rights.carriers[l.right];
      const ques = core.questionnaire.questions.find((x) => x.key === l.carriedBy!.question)!;
      const push = ques.answers.find((x) => x.key === l.carriedBy!.answer)!.push as unknown as Record<string, number>;
      expect(c.sign * push[c.var]!).toBeGreaterThan(0);
    }
  });
});
