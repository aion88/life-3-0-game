/**
 * État et règles de la semaine 1984 : mots, dossier, noms, relevé du soir, fin.
 * Logique pure : ni horloge, ni hasard, ni DOM. Toutes les valeurs viennent de `weekContent.ts`.
 *
 * Spec : production/session-state/plan-semaine-1984-3d.md §8.1, §9.1 ;
 * source : prototypes/semaine-1984-objets/index.html lignes 267-335, 445-450.
 * N'importe RIEN de `controlStationLedger.ts` (budget en lecture seule, une seule contestation).
 */

import type { Ending, TicketRow } from './weekContracts';
import {
  CONTESTS,
  EVENING,
  LABELS,
  DELTAS,
  NAMES,
  RULES,
  type ContestId,
  type ContestOutcome,
  type WeekName,
} from './weekContent';

/** Ligne écrite au dossier. */
export interface LedgerEntry {
  label: string;
  delta: number;
}

export type RouxAnswer = 'silent' | 'weather' | 'laugh';
/** Nom donné à Marlène au jour 2, ou `rien` si personne. */
export type MarleneAnswer = Exclude<WeekName, 'Marlène'> | 'rien';

/** L'état d'une partie. Les champs sont mutés par les fonctions de ce module et par `runWeek`. */
export interface WeekState {
  day: 1 | 2 | 3;
  /** Mots accordés aujourd'hui. */
  budget: number;
  /** Mots dits aujourd'hui. */
  said: number;
  /** Mots dits la veille. */
  yesterday: number;
  dossier: number;
  /** Dossier au début de la journée. */
  morning: number;
  /** Écritures du jour, dans l'ordre. */
  ledger: LedgerEntry[];
  names: WeekName[];
  /** null tant que la demande de garantie n'a pas été tranchée. */
  mother: boolean | null;
  /** Lettre gardée et non déclarée. */
  letter: boolean;
  roux: RouxAnswer | null;
  marlene: MarleneAnswer | null;
  /** Contestation du contrôle retenue au jour 1. */
  contested: boolean;
  /** Lignes de trace relues à l'audition, dans l'ordre. */
  traces: string[];
  /** Mots du lendemain, renseigné par `closeDay`, consommé par `openDay`. */
  tomorrow: number | null;
}

/** Crée une partie neuve : budget, dossier et mots dits de départ (plan §8.1). */
export function createWeek(): WeekState {
  return {
    day: 1,
    budget: RULES.startBudget,
    said: 0,
    yesterday: 0,
    dossier: RULES.startDossier,
    morning: RULES.startDossier,
    ledger: [],
    names: [],
    mother: null,
    letter: false,
    roux: null,
    marlene: null,
    contested: false,
    traces: [],
    tomorrow: null,
  };
}

/** Mots dits au-delà du compte du jour (0 si dans le compte). */
export function overrun(state: WeekState): number {
  return Math.max(0, state.said - state.budget);
}

/** Retire `words` mots du bracelet. Peut dépasser le compte : le dépassement est puni le soir. */
export function say(state: WeekState, words: number): void {
  state.said += words;
}

/** Écrit une ligne au dossier. */
export function write(state: WeekState, label: string, delta: number): void {
  state.ledger.push({ label, delta });
  state.dossier += delta;
}

/** Ajoute une ligne de trace relue à l'audition. */
export function remember(state: WeekState, text: string): void {
  state.traces.push(text);
}

/**
 * Donne un nom : +15 mots immédiats, `Nom partagé` +4 au dossier.
 * Un nom déjà donné ne rapporte rien et rend false.
 */
export function giveName(state: WeekState, name: WeekName): boolean {
  if (state.names.includes(name)) return false;
  state.names.push(name);
  state.budget += RULES.nameWords;
  write(state, LABELS.givenName, RULES.nameDossier);
  return true;
}

/** Signe le carnet : ajoute les noms manquants sans doublon, `Déposition complète` +5. Pas de mots. */
export function signNotebook(state: WeekState): void {
  for (const name of NAMES) if (!state.names.includes(name)) state.names.push(name);
  write(state, LABELS.notebook, RULES.notebookDossier);
}

/** Résultat d'une contestation. */
export interface ContestResult {
  outcome: ContestOutcome;
  /** Mots dits pour contester (0 si on laisse passer). */
  words: number;
  /** Écritures faites, dans l'ordre. */
  written: readonly LedgerEntry[];
}

/**
 * Applique une pièce à lire. `picked` = indice de la ligne touchée (titres exclus), -1 = laisser passer.
 * Ligne fausse : `upheld`. Autre ligne : `rejected`. -1 : `passed`.
 * Une contestation du contrôle retenue est notée (`contested`) et tracée.
 */
export function contest(state: WeekState, id: ContestId, picked: number): ContestResult {
  const rule = CONTESTS[id];
  const outcome: ContestOutcome = picked < 0 ? 'passed' : picked === rule.falseIndex ? 'upheld' : 'rejected';
  const words = outcome === 'passed' ? 0 : rule.words;
  say(state, words);
  const written = rule.ledger[outcome].map((entry) => ({ ...entry }));
  for (const entry of written) write(state, entry.label, entry.delta);
  if (id === 'refus' && outcome === 'upheld') {
    state.contested = true;
    if (rule.upheldTrace) remember(state, rule.upheldTrace);
  }
  return { outcome, words, written };
}

/** Mots accordés pour le lendemain selon le dossier du soir. */
export function wordsForTomorrow(dossier: number): number {
  for (const step of RULES.tomorrowSteps) if (dossier >= step.min) return step.words;
  return RULES.tomorrowFloor;
}

function signed(delta: number): string {
  return (delta > 0 ? '+' : '') + String(delta);
}

/** Relevé du soir prêt à afficher (beat `ticket`). */
export interface EveningStatement {
  title: string;
  rows: readonly TicketRow[];
  footer: string;
  tomorrow: number;
}

/**
 * Soir d'un jour 1 ou 2 : écrit, dans l'ordre, dépassement, silence, texte non déclaré, nuit ;
 * calcule les mots du lendemain et rend le relevé. Le jour ne change PAS : `openDay` le fait
 * quand le joueur a touché le papier.
 */
export function closeDay(state: WeekState): EveningStatement {
  const over = overrun(state);
  if (over > 0) write(state, LABELS.overrun, -over);
  if (state.said < RULES.silenceBelow) write(state, LABELS.silence, DELTAS.silence);
  if (state.letter) write(state, LABELS.undeclaredText, DELTAS.undeclaredText);
  write(state, LABELS.night, DELTAS.night);
  const tomorrow = wordsForTomorrow(state.dossier);
  state.tomorrow = tomorrow;
  const rows: TicketRow[] = [
    { label: EVENING.said, value: `${state.said} / ${state.budget}` },
    { label: EVENING.morning, value: String(state.morning) },
    ...state.ledger.map((entry) => ({ label: entry.label, value: signed(entry.delta) })),
    { label: EVENING.tonight, value: String(state.dossier), total: true },
    { label: EVENING.tomorrow, value: String(tomorrow) },
  ];
  const footer =
    state.day === 1 ? EVENING.footerDay1 : state.said < RULES.silenceBelow ? EVENING.footerSilent : EVENING.footerDefault;
  return { title: EVENING.title(state.day), rows, footer, tomorrow };
}

/** Passe au jour suivant après le relevé : budget = mots accordés, mots dits remis à zéro. */
export function openDay(state: WeekState): void {
  if (state.tomorrow === null) throw new Error('openDay appelé sans closeDay');
  if (state.day >= 3) throw new Error('openDay après le jour 3');
  state.day = (state.day + 1) as 2 | 3;
  state.yesterday = state.said;
  state.budget = state.tomorrow;
  state.morning = state.dossier;
  state.said = 0;
  state.ledger = [];
  state.tomorrow = null;
}

/** Fin de la partie : dossier sous le seuil = arrêté ; sinon assez de noms = recruté ; sinon relâché. */
export function endingOf(state: WeekState): Ending {
  if (state.dossier < RULES.threshold) return 'arrete';
  return state.names.length >= RULES.namesToRecruit ? 'recrute' : 'relache';
}
