/** Somme P des poussées et rang d'écran [GDD 01 §9.1]. Pur : aucune valeur de jeu, tout vient de `questionnaire.json`. */
import type { Milli } from '../shared/milli';
import type { Questionnaire } from '../data/schema/questionnaire';
import { WORLD_VARS, type PushVector } from '../shared/types/world';
import type { Answers, QuestionKey } from '../shared/types';

/** P = somme des poussées des réponses données, non bornée [GDD 01 §9.1] ; lève si une question active n'a pas de réponse valide. */
export function pushOf(q: Questionnaire, a: Answers): PushVector {
  const total: Record<string, number> = {};
  for (const k of WORLD_VARS) total[k] = 0;
  for (const question of q.questions) {
    const given = a[question.key];
    const chosen = question.answers.find((x) => x.key === given);
    if (!chosen) throw new Error(`réponse manquante ou inconnue : ${question.key} ${String(given)}`);
    for (const k of WORLD_VARS) total[k] = (total[k] ?? 0) + chosen.push[k];
  }
  return total as Record<string, Milli> as PushVector;
}

/** Rang d'écran d'une question : son `order` [GDD 01 §3.1 règle 4] ; lève si la clé est inconnue. */
export function displayRankOf(q: Questionnaire, key: QuestionKey): number {
  const found = q.questions.find((x) => x.key === key);
  if (!found) throw new Error(`question inconnue : ${key}`);
  return found.order;
}
