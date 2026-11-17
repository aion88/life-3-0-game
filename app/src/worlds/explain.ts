/** Explain the real questionnaire model; do not invent a causal link from one answer to an authored scene. */
import type { CoreData } from '../data/schema/core';
import type { Answers, QuestionKey, WorldVar, WorldId } from '../shared/types';
import { pushOf } from '../questionnaire';
import { simulateFastForward } from '../fastforward/simulate';
import { arrivalOutcome } from '../fastforward/arrival';
import { SHORT_WORLDS } from './routing';

export const AXIS_LABELS: Record<WorldVar, string> = { aiPower: 'puissance de l’IA', order: 'ordre', abundance: 'abondance', freedom: 'liberté', surveillance: 'surveillance', unrest: 'tensions' };
/** The three selected answers with greatest absolute contribution to this world's relevant axes. */
export function contributions(core: CoreData, answers: Answers, axes: readonly WorldVar[]) {
  return core.questionnaire.questions.flatMap(q => {
    const choice = q.answers.find(a => a.key === answers[q.key]);
    if (!choice) return [];
    const deltas = axes.map(axis => ({ axis, value: choice.push[axis] / 1000 })).filter(d => d.value !== 0);
    return [{ question: q.key, answer: choice.key, deltas, magnitude: deltas.reduce((sum, d) => sum + Math.abs(d.value), 0) }];
  }).sort((a, b) => b.magnitude - a.magnitude).slice(0, 3);
}
/** A real single-answer counterfactual. Null means no alternative here changes the computed destination. */
export function alternative(core: CoreData, answers: Answers, question: QuestionKey, current: WorldId): { answer: string; world: WorldId } | null {
  const q = core.questionnaire.questions.find(item => item.key === question);
  for (const answer of q?.answers ?? []) {
    if (answer.key === answers[question]) continue;
    const changed = { ...answers, [question]: answer.key };
    const ff = simulateFastForward(pushOf(core.questionnaire, changed), core.engine);
    const world = ff.extinction ? ff.extinction.world : arrivalOutcome(ff.atChoice, { ...core, build: { ...core.build, streetWorlds: SHORT_WORLDS } }).computedWorld;
    if (world !== current) return { answer: answer.key, world };
  }
  return null;
}
