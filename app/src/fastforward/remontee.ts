/** Remontée : les réponses 2026 qui ont le plus pesé, par oscillation ω [GDD 06 §3.6, §4 F3 ; D139 ; D140]. */
import type { CoreData } from '../data/schema/core';
import { dist2 } from '../engine/vector';
import { pushOf, replaceOne, SEL_ORDER } from '../questionnaire';
import type { AnswerKey, Answers, QuestionKey, TracebackLine } from '../shared/types';
import { questionNumber } from '../shared/types';
import type { WorldVector } from '../shared/types/world';
import { simulateFastForward, type FastForwardRun } from './simulate';

/** Nombre maximal de lignes de la remontée : les trois premières questions de ω non nul [GDD 06 §3.6]. */
export const TRACEBACK_MAX_LINES = 3;

/**
 * Vecteur de comparaison d'une vie : celui du pas `at`, ou son dernier vecteur si la vie s'arrête avant [GDD 06 §3.6].
 * `at` vaut le pas de choix, ou t0 (début du run du joueur) quand la partie du joueur finit en extinction.
 */
function vectorAt(ff: FastForwardRun, at: number): WorldVector {
  const steps = ff.trajectory.steps;
  return steps[Math.min(at, steps.length - 1)]!;
}

/** Référence du joueur : vecteur et pas de comparaison (t0 s'il y a extinction, sinon le pas de choix). */
function referenceOf(core: CoreData, answers: Answers): { readonly at: number; readonly v: WorldVector } {
  const ff = simulateFastForward(pushOf(core.questionnaire, answers), core.engine);
  const at = ff.extinction ? ff.extinction.runStartStep : core.engine.steps.choiceStep;
  return { at, v: vectorAt(ff, at) };
}

/** ω_i avec la référence déjà connue : au plus 3 simulations (une par réponse alternative). */
function omegaFrom(core: CoreData, answers: Answers, key: QuestionKey, ref: { readonly at: number; readonly v: WorldVector }): number {
  const question = core.questionnaire.questions.find((q) => q.key === key);
  if (!question) throw new Error(`question inconnue : ${key}`);
  let best = 0;
  for (const alt of question.answers) {
    if (alt.key === answers[key]) continue;
    const other = replaceOne(answers, key, alt.key as AnswerKey);
    const ff = simulateFastForward(pushOf(core.questionnaire, other), core.engine);
    best = Math.max(best, dist2(ref.v, vectorAt(ff, ref.at)));
  }
  return best;
}

/** ω_i = max sur a' ≠ a_i de d²(V(A), V(A[i→a'])), en millièmes² [GDD 06 §4 F3]. */
export function omegaOf(core: CoreData, answers: Answers, key: QuestionKey): number {
  return omegaFrom(core, answers, key, referenceOf(core, answers));
}

/** La remontée : ω décroissant, puis numéro de question croissant, ω nul écarté, bornée à {@link TRACEBACK_MAX_LINES}. */
export function remontee(core: CoreData, answers: Answers): readonly TracebackLine[] {
  const ref = referenceOf(core, answers);
  return SEL_ORDER
    .map((question) => ({ question, omega: omegaFrom(core, answers, question, ref) }))
    .filter((x) => x.omega > 0)
    .sort((a, b) => b.omega - a.omega || questionNumber(a.question) - questionNumber(b.question))
    .slice(0, TRACEBACK_MAX_LINES)
    .map((x) => {
      const answer = answers[x.question];
      if (answer === undefined) throw new Error(`réponse manquante : ${x.question}`);
      return { question: x.question, answer };
    });
}
