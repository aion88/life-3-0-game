/** Indice de grille : une réponse complète est un entier en base mixte sur l'ordre de sélection [GDD 01 §7]. */
import type { Questionnaire } from '../data/schema/questionnaire';
import type { AnswerKey, Answers, QuestionKey } from '../shared/types';
import { answersOf } from '../shared/types';

/**
 * Ordre de sélection : les dix questions d'origine par numéro, puis Q21 [GDD 01 §7 ; GDD 01 §3.1 règle 1].
 * C'est l'ordre des lettres d'une ligne canonique et des chiffres de l'indice de grille (le dernier varie le plus vite).
 * Constante de spec, distincte de l'ordre d'écran (`order`).
 */
export const SEL_ORDER: readonly QuestionKey[] =
  ['Q04', 'Q05', 'Q07', 'Q10', 'Q11', 'Q14', 'Q15', 'Q16', 'Q18', 'Q20', 'Q21'] as QuestionKey[];

function answersOfKey(q: Questionnaire, k: QuestionKey): readonly { readonly key: AnswerKey }[] {
  const found = q.questions.find((x) => x.key === k);
  if (!found) throw new Error(`question inconnue : ${k}`);
  return found.answers;
}

/** Indice de la réponse complète `a` dans la grille, base mixte sur {@link SEL_ORDER}, dernière question la plus rapide. */
export function indexOf(q: Questionnaire, a: Answers): number {
  let i = 0;
  for (const k of SEL_ORDER) {
    const opts = answersOfKey(q, k);
    const pos = opts.findIndex((x) => x.key === a[k]);
    if (pos < 0) throw new Error(`réponse manquante ou inconnue : ${k} ${String(a[k])}`);
    i = i * opts.length + pos;
  }
  return i;
}

/** Réponse complète à l'indice `i` de la grille ; lève hors de 0..taille-1. */
export function answersAt(q: Questionnaire, i: number): Answers {
  const sizes = SEL_ORDER.map((k) => answersOfKey(q, k).length);
  const total = sizes.reduce((n, s) => n * s, 1);
  if (!Number.isInteger(i) || i < 0 || i >= total) throw new RangeError(`indice hors grille : ${i}`);
  const out: Record<string, AnswerKey> = {};
  let rest = i;
  for (let n = SEL_ORDER.length - 1; n >= 0; n--) {
    const k = SEL_ORDER[n]!;
    const size = sizes[n]!;
    out[k] = answersOfKey(q, k)[rest % size]!.key;
    rest = Math.floor(rest / size);
  }
  return answersOf(out);
}

/** Copie de `a` avec la réponse de `key` changée en `to` ; `a` n'est pas modifié. */
export function replaceOne(a: Answers, key: QuestionKey, to: AnswerKey): Answers {
  return { ...a, [key]: to };
}
