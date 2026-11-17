import { fnv1a32 } from './rng';
import { questionNumber } from './types';
import type { Answers, QuestionKey } from './types';

/** Chaîne canonique des réponses, triée par numéro de question croissant : 'Q04=B;Q21=A' [GDD 02 §4.7]. */
export function answersSeedString(answers: Answers): string {
  const keys = Object.keys(answers) as QuestionKey[];
  keys.sort((a, b) => questionNumber(a) - questionNumber(b));
  return keys.map((k) => `${k}=${answers[k]}`).join(';');
}

/** Graine de partie : FNV-1a de la chaîne canonique des réponses, indépendante de l'ordre de saisie [GDD 02 §4.7, F2]. */
export function runSeed(answers: Answers): number {
  return fnv1a32(answersSeedString(answers));
}
