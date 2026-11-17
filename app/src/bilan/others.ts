/** « Les autres » et remontée du bilan : mise en forme des lignes que le moteur a rejouées [GDD 06 §3.5, §3.6 ; D139 ; B-V3, B-V12]. */
import type { CoreData } from '../data/schema/core';
import { otherLives, remontee, singleReplacements } from '../fastforward';
import type { I18n } from '../i18n/i18n';
import type { Answers, OtherLife, TracebackLine } from '../shared/types';
import type { BilanOthers } from '../shared/types/bilan';
import type { WorldId } from '../shared/types/world';

/** La remontée du bilan : de deux à trois lignes, les réponses qui ont le plus pesé [GDD 06 §3.6]. */
export function bilanTraceback(core: CoreData, answers: Answers): readonly TracebackLine[] {
  return remontee(core, answers);
}

/**
 * « Les autres » : chaque ligne est un remplacement unique rejoué par le simulateur, dans l'ordre de lecture B-V12 que
 * le moteur impose (remontée d'abord, puis numéro croissant). Aucune ligne n'est inventée : `locked` dit zéro ligne [R-03.20].
 */
export function bilanOthers(core: CoreData, answers: Answers, traceback: readonly TracebackLine[]): BilanOthers {
  const lines = otherLives(core, answers, traceback);
  return { lines, locked: lines.length === 0 };
}

/** Le monde que le simulateur donne en rejouant ce seul remplacement ; lève si la ligne n'est pas un remplacement possible [B-V3]. */
export function replayedDestination(core: CoreData, answers: Answers, line: Pick<OtherLife, 'question' | 'answer'>): WorldId {
  const found = singleReplacements(core, answers).find((o) => o.question === line.question && o.answer === line.answer);
  if (!found) throw new Error(`remplacement inconnu : ${line.question} ${line.answer}`);
  return found.destination;
}

/** Vrai si le monde annoncé par la ligne est celui que le rejeu donne [B-V3]. */
export function isReplayed(core: CoreData, answers: Answers, line: OtherLife): boolean {
  try { return replayedDestination(core, answers, line) === line.destination; } catch { return false; }
}

/** Texte d'une ligne de « Les autres » : libellé de la réponse, intitulé de la question, nom du monde, jamais un code [U-1]. */
export function otherLineText(i18n: I18n, line: OtherLife): string {
  return i18n.t('bilan.others.line', {
    label: i18n.t(`q.${line.question}.${line.answer}.label`),
    title: i18n.t(`q.${line.question}.title`),
    world: i18n.t(`world.${line.destination}.name`),
  });
}

/** Texte d'une ligne de remontée : `bilan.trace.<q>.<a>`, sinon la clé de coût `q.<q>.<a>.cost` avec `fallback` levé [B-V ligne de base]. */
export function traceText(i18n: I18n, line: TracebackLine): { readonly key: string; readonly text: string; readonly fallback: boolean } {
  const own = `bilan.trace.${line.question}.${line.answer}`;
  if (i18n.has(own)) return { key: own, text: i18n.t(own), fallback: false };
  const cost = `q.${line.question}.${line.answer}.cost`;
  return { key: cost, text: i18n.t(cost), fallback: true };
}
