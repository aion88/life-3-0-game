/** Verified alternative questionnaires. A seed is a search starting point, never a forced destination. */
import type { CoreData } from '../data/schema/core';
import { arrivalOutcome } from '../fastforward/arrival';
import { simulateFastForward } from '../fastforward/simulate';
import { pushOf, SEL_ORDER } from '../questionnaire';
import type { Answers, AnswerKey, QuestionKey, WorldId } from '../shared/types';
import { SHORT_WORLDS } from './routing';

/** Production witnesses in SEL_ORDER. Each is replayed against the current model before use. */
const WITNESSES: Readonly<Record<WorldId, string>> = {
  w01: 'CBCCBCCABBD', w02: 'DBCAAACBDAD', w03: 'BAABBACBBAD', w04: 'ABBBACCBABD',
  w05: 'BBAAABBBDAA', w06: 'DBCAADBCCCD', w07: 'CBCCBDBACCD', w08: 'BBABBBCBDAB',
  w09: 'DCCACBBBCBC', w10: 'ACBACBACAAD', w11: 'AAABBCACBBD', w12: 'CBCCBDDACCD',
};

/** An actual changed answer, in questionnaire display order. */
export interface AlternativeChange { readonly question: QuestionKey; readonly from: AnswerKey; readonly to: AnswerKey }
/** One verified route, not a claim of globally minimal changes. The caller computes headlines from these answers. */
export interface AlternativePath {
  readonly targetWorld: WorldId;
  readonly answers: Answers;
  readonly changes: readonly AlternativeChange[];
  readonly method: 'unchanged' | 'single' | 'seed';
  readonly simulations: number;
}

/**
 * Finds a deterministic route to a target without modifying the original answers or any save.
 * Search: original, all one-answer edits, then a verified witness reduced by greedy reversions.
 * Greedy reversions only remove edits and repeat until none can be removed individually. This is
 * a local reduction, not a global optimum. Work is bounded by O(answer options + questions²)
 * simulations (fewer than 170 for the current eleven-question model), with no random sampling.
 * Returns null for invalid/incomplete inputs or a witness invalidated by future model changes.
 */
export function findAlternative(core: CoreData, originalAnswers: Answers, targetWorld: WorldId): AlternativePath | null {
  const questions = core.questionnaire.questions;
  if (!core.catalogue.byId[targetWorld] || questions.some(q => !q.answers.some(a => a.key === originalAnswers[q.key]))) return null;
  const original: Answers = { ...originalAnswers };
  const shortCore: CoreData = { ...core, build: { ...core.build, streetWorlds: SHORT_WORLDS } };
  let simulations = 0;
  const reaches = (answers: Answers): boolean => {
    simulations++;
    const simulation = simulateFastForward(pushOf(core.questionnaire, answers), core.engine);
    const destination = simulation.extinction?.world ?? arrivalOutcome(simulation.atChoice, shortCore).computedWorld;
    return destination === targetWorld;
  };
  const result = (answers: Answers, method: AlternativePath['method']): AlternativePath => {
    const changes = questions.filter(q => answers[q.key] !== original[q.key]).map(q => Object.freeze({ question: q.key, from: original[q.key]!, to: answers[q.key]! }));
    return Object.freeze({ targetWorld, answers: Object.freeze({ ...answers }), changes: Object.freeze(changes), method, simulations });
  };
  if (reaches(original)) return result(original, 'unchanged');
  for (const question of questions) {
    for (const answer of question.answers) {
      if (answer.key === original[question.key]) continue;
      const candidate = { ...original, [question.key]: answer.key };
      if (reaches(candidate)) return result(candidate, 'single');
    }
  }
  const line = WITNESSES[targetWorld];
  if (line === undefined || line.length !== SEL_ORDER.length) return null;
  let candidate: Answers = { ...original };
  for (const [index, key] of SEL_ORDER.entries()) {
    const value = line[index] as AnswerKey;
    const question = questions.find(q => q.key === key);
    if (!question?.answers.some(a => a.key === value)) return null;
    candidate = { ...candidate, [key]: value };
  }
  if (!reaches(candidate)) return null;
  let reduced: boolean;
  do {
    reduced = false;
    for (const question of questions) {
      if (candidate[question.key] === original[question.key]) continue;
      const restored = { ...candidate, [question.key]: original[question.key] };
      if (reaches(restored)) { candidate = restored; reduced = true; }
    }
  } while (reduced);
  // Verify the final candidate explicitly; never substitute the requested target into the outcome.
  if (!reaches(candidate)) return null;
  return result(candidate, 'seed');
}
