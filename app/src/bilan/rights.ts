/** Les huit droits de la pièce 5 : la réponse qui porte chacun [GDD 06 §3.7, §4 F7 ; D81]. */
import type { Questionnaire } from '../data/schema/questionnaire';
import { lineHalves } from '../engine/moments/rights';
import type { I18n } from '../i18n/i18n';
import type { Answers, TracebackLine } from '../shared/types';
import { questionNumber } from '../shared/types';
import type { RightLine } from '../shared/types/bilan';
import { RIGHT_IDS, type RightId } from '../shared/types/street';
import type { WorldId, WorldVar } from '../shared/types/world';

/** Variable porteuse d'un droit et sens de la perte, lus des données du monde (`bilan.rights.carriers`). */
export type RightCarriers = Readonly<Record<RightId, { readonly var: WorldVar | string; readonly sign: 1 | -1 }>>;

/**
 * Pour chaque droit, la réponse donnée dont la poussée signée sur la variable porteuse est la plus forte [F7] ;
 * si aucune n'est positive le droit n'a pas d'étiquette ; égalité : numéro de question croissant [D81].
 */
function carrierOf(q: Questionnaire, answers: Answers, c: { readonly var: string; readonly sign: 1 | -1 }): TracebackLine | null {
  let best: { line: TracebackLine; score: number } | null = null;
  const questions = [...q.questions].sort((a, b) => questionNumber(a.key) - questionNumber(b.key));
  for (const question of questions) {
    const given = answers[question.key];
    const chosen = question.answers.find((a) => a.key === given);
    if (!chosen) continue;
    const score = c.sign * Number((chosen.push as Readonly<Record<string, number>>)[c.var] ?? 0);
    if (score > 0 && (best === null || score > best.score)) best = { line: { question: question.key, answer: chosen.key }, score };
  }
  return best?.line ?? null;
}

/** Les huit lignes de droits, une par identifiant, dans l'ordre de `RIGHT_IDS` ; `lineKey` est `<monde>.right.<id>`. */
export function rightLines(q: Questionnaire, answers: Answers, carriers: RightCarriers, world: WorldId): readonly RightLine[] {
  return RIGHT_IDS.map((right) => ({ right, lineKey: `${world}.right.${right}`, carriedBy: carrierOf(q, answers, carriers[right]) }));
}

/** Les deux moitiés d'une ligne (« Ici », « 2026 ») lues de la chaîne traduite ; aucun numéro d'article [B-V ligne de droit]. */
export function rightHalves(i18n: I18n, line: RightLine): { readonly first: string; readonly second: string } {
  return lineHalves(i18n.t(line.lineKey));
}
