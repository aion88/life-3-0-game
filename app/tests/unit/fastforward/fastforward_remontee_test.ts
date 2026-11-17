import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import type { CoreData } from '../../../src/data/schema/core';
import { omegaOf, remontee } from '../../../src/fastforward/remontee';
import type { QuestionKey } from '../../../src/shared/types';
import { ans, key } from '../../support/answers';

const core = loadCore();

/**
 * Aide de test [R-01.3] : copie du noyau (par propagation, sans mutation) où, sauf pour `keepKeys`,
 * chaque réponse reçoit la poussée de la réponse A de sa question.
 */
function withCollapsedQuestions(c: CoreData, keepKeys: readonly string[]): CoreData {
  const keep = new Set<string>(keepKeys);
  return {
    ...c,
    questionnaire: {
      ...c.questionnaire,
      questions: c.questionnaire.questions.map((q) => {
        if (keep.has(q.key)) return q;
        const a = q.answers.find((x) => x.key === 'A')!;
        return { ...q, answers: q.answers.map((x) => ({ ...x, push: a.push })) };
      }),
    },
  };
}

const rem = (line: string) =>
  remontee(core, ans(line)).map((r) => [r.question, omegaOf(core, ans(line), r.question) / 1e6]);

describe('remontee', () => {
  it('test_remontee_w10_line', () => {
    expect(rem('ACBACBACAAD')).toEqual([['Q11', 932], ['Q21', 907], ['Q05', 814]]);
  });

  it('test_remontee_extinction_compares_at_run_start', () => { // w07, t0 = 37
    expect(rem('CBCCBDBACCD')).toEqual([['Q11', 928.25], ['Q15', 889.25], ['Q05', 795.25]]);
  });

  it('test_remontee_w12_line', () => { // t0 = 47
    expect(rem('CBCCBDDACCD')).toEqual([['Q04', 2333.5], ['Q18', 2034.5], ['Q11', 1852.25]]);
  });

  it('test_remontee_fewer_lines_when_omega_zero', () => {
    const forged = withCollapsedQuestions(core, ['Q11', 'Q14']);
    expect(remontee(forged, ans('ACBACBACAAD')).length).toBe(2);
  });

  it('test_traceback_answer_is_players_answer', () => {
    expect(remontee(core, ans('ACBACBACAAD'))[0]).toEqual({ question: key('Q11') as QuestionKey, answer: 'C' });
  });
});
