/** Aides de test du questionnaire : clés, réponses d'une ligne, poussées en points [R-01.3]. */
import { parseQuestionnaire } from '../../src/data/schema/questionnaire';
import { SEL_ORDER } from '../../src/questionnaire';
import { toMilli } from '../../src/shared/milli';
import { answersOf, isQuestionKey, type AnswerKey, type Answers, type QuestionKey } from '../../src/shared/types';
import type { PushVector } from '../../src/shared/types/world';
import { qRaw } from '../fixtures/data/factories';

const Q = parseQuestionnaire(qRaw);

/** `key('Q11')` : clé de question typée ; lève si la forme est mauvaise. */
export function key(k: string): QuestionKey {
  if (!isQuestionKey(k)) throw new Error(`clé de question invalide : ${k}`);
  return k;
}

/** `ans('ACBACBACAAD')` : une lettre par question, dans l'ordre de SEL_ORDER [GDD 01 §7] ; lève si une lettre n'existe pas. */
export function ans(line: string): Answers {
  if (line.length !== SEL_ORDER.length) throw new Error(`ligne de ${line.length} lettres, ${SEL_ORDER.length} attendues`);
  const o: Record<string, AnswerKey> = {};
  SEL_ORDER.forEach((k, i) => {
    const letter = line[i] as AnswerKey;
    const question = Q.questions.find((x) => x.key === k);
    if (!question?.answers.some((a) => a.key === letter)) throw new Error(`réponse inconnue : ${k} ${letter}`);
    o[k] = letter;
  });
  return answersOf(o);
}

/** `p(ap, or, ab, fr, su, un)` : poussée en points vers millièmes, dans l'ordre des variables du monde. */
export function p(ap: number, or: number, ab: number, fr: number, su: number, un: number): PushVector {
  return {
    aiPower: toMilli(ap), order: toMilli(or), abundance: toMilli(ab),
    freedom: toMilli(fr), surveillance: toMilli(su), unrest: toMilli(un),
  };
}
