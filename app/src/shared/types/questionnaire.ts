/** Questionnaire : clés opaques et réponses [GDD 01]. */

/** Clé de question `^Q\d{2,3}$`, opaque : `order` est un champ à part, jamais déduit de la clé. */
export type QuestionKey = string & { readonly __q: unique symbol };

/** Réponse à une question [GDD 01]. */
export type AnswerKey = 'A' | 'B' | 'C' | 'D';

/** Réponses complètes : une par question active [GDD 01]. */
export type Answers = Readonly<Record<QuestionKey, AnswerKey>>;

const QUESTION_KEY = /^Q\d{2,3}$/;

/** Vrai si `s` a la forme d'une clé de question. */
export function isQuestionKey(s: string): s is QuestionKey {
  return QUESTION_KEY.test(s);
}

/** Numéro d'une clé : 'Q21' vers 21 ; départage, jamais l'ordre d'écran. */
export function questionNumber(k: QuestionKey): number {
  return Number(k.slice(1));
}

/** Seule porte d'entrée d'un littéral de réponses ; lève si une clé échoue {@link isQuestionKey}. */
export function answersOf(o: Readonly<Record<string, AnswerKey>>): Answers {
  for (const k of Object.keys(o)) {
    if (!isQuestionKey(k)) throw new Error(`clé de question invalide : ${k}`);
  }
  return o as Answers;
}
