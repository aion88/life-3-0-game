/**
 * Entrée du bilan et lectures de la rue pour lui [plan 02b T13 ; bible w10 §5.2 c, §7.6 ; GDD 05 §3.3, AC-F5, D136, D137 ; GDD 06 §5].
 * Lecture seule : l'audition du J7 (fin, nuit 7) est écrite par `reduceAct` [R-02b.27]. Pur : aucun JSON, aucune horloge, aucun hasard.
 * Tout nombre vient des données du monde (`street.wallCounter`, `street.lines.relecture`) ou d'une constante nommée ci-dessous.
 */
import type { StreetData } from '../../data/schema/street';
import type { BilanInput } from '../../shared/types/bilan';
import type { ActRecord, DayIndex, NightLedger } from '../../shared/types/street';
import { survivalReport, type IntegrityConfig } from '../../survival';
import { weekOutput, type WeekState } from '../week';
import { EARLY_END_ID } from './state';
import type { StreetContext, StreetState } from './types';

/** Clé d'une chaîne de ligne de dossier (`w10.doc.relecture.jN.k`). */
export type LineKey = string;

/** Préfixe des ids des choix de relecture (`relecture.jN`) [w10.json, R-02b.62]. */
export const RELECTURE_CHOICE_PREFIX = 'relecture.';
/** Option d'une relecture qui signale la ligne ; `pass` laisse passer [D136, R-02b.62]. */
export const FLAG_OPTION = 'flag';

/** Nombre de relectures signalées : les choix `relecture.*` d'option `flag` [D136]. */
export function flaggedLines(acts: readonly ActRecord[]): number {
  return acts.filter((a) => a.kind === 'choice' && a.id.startsWith(RELECTURE_CHOICE_PREFIX) && a.option === FLAG_OPTION).length;
}

/**
 * Compteur du mur de téléviseurs : départ + incrément × lignes signalées de la semaine, tous deux lus dans `street.wallCounter`.
 * Cumulé sur la semaine, il ne baisse jamais ; l'incrément et l'absence d'autre source de signalement sont supposés [bible w10 §5.2 c ; supposé: game-designer].
 */
export function wallCounterOf(s: Pick<StreetState, 'acts'>, ctx: Pick<StreetContext, 'street'>): number {
  const { start, perFlag } = ctx.street.wallCounter;
  return start + perFlag * flaggedLines(s.acts);
}

/**
 * Ligne de dossier du jour : la spec en garde deux par jour de lecture sans en désigner une [GDD 05 §3.3]. Règle sans tirage : la première
 * dont la donnée `whenEntry` figure dans `ledger.entries`, sinon la ligne sans condition (quelle que soit sa place), sinon la première. J3, J7 (jours sans lecture) : `null`, lignes en réserve.
 */
export function relectureLineOf(day: DayIndex, ledger: NightLedger, street: Pick<StreetData, 'lines'>): LineKey | null {
  const lines = (street.lines.relecture as Readonly<Partial<Record<string, StreetData['lines']['relecture']['1']>>>)[String(day)];
  if (lines === undefined) return null;
  const sources = new Set(ledger.entries.map((e) => e.source));
  const hit = lines.find((l) => l.whenEntry !== null && sources.has(l.whenEntry));
  return (hit ?? lines.find((l) => l.whenEntry === null) ?? lines[0]).key;   // sans l'entrée : la ligne SANS condition, où qu'elle soit [R-02b.63]
}

/**
 * Entrée du plan 03. `weekEnd` : la semaine est allée à l'audition (courbe complète, `curve.length === 1 + readings.length`).
 * `earlyEnd` : arrêté avant l'audition, semaine PARTIELLE sur les pas faits, `curve.length === readings.length` [R-02b.28, R-02b.33].
 * `week` est `null` seulement si aucune nuit n'a été close. La réponse à l'audition et les lignes signalées voyagent dans `acts`.
 */
export function toBilanInput(state: StreetState, week: WeekState, ctx: StreetContext): BilanInput {
  if (state.ended === null) throw new Error('toBilanInput : la partie n\'est pas finie');
  const closed = state.readings.length > 0;
  return {
    entry: state.ended.endId === EARLY_END_ID ? 'earlyEnd' : 'weekEnd',
    run: ctx.run,
    week: closed ? weekOutput(week, ctx.world) : null,
    survival: closed ? survivalReport(state.readings, state.ledgers, ctx.world.survival as unknown as IntegrityConfig) : null,
    acts: state.acts,
  };
}
