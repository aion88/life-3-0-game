/**
 * Réponses de questionnaire figées pour l'atelier de monde (`?atelier=monde&monde=wNN`).
 * Plan : production/session-state/plan-semaine-1984-3d.md, lot S1.
 * Chaque ligne a onze lettres, une par question, dans l'ordre de `SEL_ORDER`. Elle a été trouvée une fois
 * (lignes canoniques de `tests/fixtures/canonical-lines.ts` ; w09 par recherche du motif `D{a}{b}ACBB{c}C{d}C`)
 * puis figée en données : `outcome.computedWorld` (que lit `runtime.ts`) vaut le monde demandé.
 */
import type { ArrivalWorldId, AnswerKey, Answers } from '../shared/types';
import { answersOf } from '../shared/types';
import { SEL_ORDER } from '../questionnaire';

/** Mondes ouvrables par l'atelier : les dix mondes d'arrivée jouables. */
export type AtelierWorldId = ArrivalWorldId;

/** Une ligne de onze lettres par monde. */
export const ATELIER_LINES: Readonly<Record<AtelierWorldId, string>> = {
  w01: 'CBCCBCCABBD', w02: 'DBCAAACBDAD', w03: 'BAABBACBBAD', w04: 'ABBBACCBABD', w05: 'BBAAABBBDAA',
  w06: 'DBCAADBCCCD', w08: 'BBABBBCBDAB', w09: 'DBCACBBBCBC', w10: 'ACBACBACAAD', w11: 'AAABBCACBBD',
};

/** Vrai si `id` est un monde que l'atelier sait ouvrir. */
export function isAtelierWorld(id: string | null): id is AtelierWorldId {
  return id !== null && Object.prototype.hasOwnProperty.call(ATELIER_LINES, id);
}

/**
 * Réponses complètes qui mènent au monde demandé.
 * @param world Identifiant du monde (`w01` à `w11`, sans `w07`).
 * @returns Les onze réponses, prêtes pour `runFastForward`.
 */
export function atelierAnswers(world: AtelierWorldId): Answers {
  const line = ATELIER_LINES[world];
  const entries: Record<string, AnswerKey> = {};
  SEL_ORDER.forEach((key, index) => { entries[key] = line[index] as AnswerKey; });
  return answersOf(entries);
}
