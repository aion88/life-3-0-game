/**
 * Jauge Intégrité de w10 : relevé de nuit sur les sommes du jour [bible w10 §7.2 à §7.5 ; D89, D19, D86].
 * Pure : aucun import de moteur, aucune lecture de `ws` [GDD 03 §2.5], aucun hasard, aucune horloge.
 * Unité : millièmes ; tous les termes sont des entiers et les seuils tombent à n + 0,5, donc aucune égalité.
 */
import type { IntegrityConfig, IntegrityEntry, PalierId } from '../data/schema/world';
import type { Milli } from '../shared/milli';
import { ledgerOverrun, ledgerRemaining } from '../shared/ledger';
import type { DayIndex, GameClock, LedgerEntry, NightLedger, SurvivalState } from '../shared/types/street';

export type { IntegrityConfig };

/** Palier de lecture, de la voie courtoisie au rendez-vous [bible w10 §7.1]. */
export type Palier = PalierId;

/** Issue de la semaine [bible w10 §7.5, D19]. `at` : la nuit d'arrestation, ou l'audition qui suit la nuit 6. */
export type SurvivalEnding =
  | { readonly kind: 'arrested'; readonly at: number | 'audition' }
  | { readonly kind: 'recruited' }
  | { readonly kind: 'released' };

/** Lecture d'une nuit : valeur, termes, palier, issue éventuelle, mentions au dossier. */
export interface NightReading {
  readonly day: number;
  readonly value: Milli;
  readonly terms: Readonly<Record<string, Milli>>;
  readonly palier: Palier;
  readonly ending: SurvivalEnding | null;
  readonly mentions: readonly string[];
}

/** Compteur des noms donnés [bible w10 §7.5 : recruté si deux ou plus]. */
export const NAMES_COUNTER = 'names';
/** Un point vaut mille millièmes ; les barèmes de mots (silence) se comptent en points entiers. */
const MILLI_PER_POINT = 1000;

const m = (n: number): Milli => n as Milli;
const carryKey = (night: number): string => `carry.${night}`;

/** État de départ : la valeur initiale des données, aucun compteur. */
export function startSurvival(cfg: IntegrityConfig): SurvivalState {
  return { value: cfg.start, counters: {} };
}

function entryOf(source: string, cfg: IntegrityConfig): IntegrityEntry {
  const e = cfg.entries[source];
  if (!e) throw new Error(`entrée de survie inconnue : ${source}`);
  return e;
}

/** Ligne de relevé pour une faute, une offre ou une relecture ; son delta est lu dans les données. */
export function survivalEntry(source: string, at: GameClock, cfg: IntegrityConfig): LedgerEntry {
  const e = entryOf(source, cfg);
  return { source, delta: e.zeroOnDays?.includes(at.day) ? m(0) : e.delta, at };
}

/** Palier : le premier seuil que la valeur atteint [bible w10 §7.1]. */
export function palierOf(value: Milli, cfg: IntegrityConfig): Palier {
  const hit = cfg.paliers.find((p) => value >= p.from);
  return (hit ?? cfg.paliers[cfg.paliers.length - 1]!).id;
}

function dossierTerm(day: number, cfg: IntegrityConfig): Milli {
  return m(cfg.dossierPerNight * day);
}

function glancesTerm(l: NightLedger, cfg: IntegrityConfig): Milli {
  const g = cfg.glances;
  return m(g.perGlance * Math.min(g.cap, Math.max(g.floor, l.glances)));
}

function ordersTerm(l: NightLedger, cfg: IntegrityConfig): Milli {
  return m(Math.min(cfg.orders.perDayCap, l.orders * cfg.orders.value)); // « +2 par consigne, plafond +2 par jour » [bible w10 §7.3]
}

/** Restant qui paie encore le sommeil la nuit `day` : un nombre, ou la valeur du jour dans un tableau (le J7 prend la dernière). */
export function sleepMaxRemaining(cfg: IntegrityConfig, day: number): number {
  const m = cfg.words.sleep.maxRemaining;
  return typeof m === 'number' ? m : m[Math.min(day, m.length) - 1] ?? 0;
}

function wordsTerm(l: NightLedger, cfg: IntegrityConfig): Milli {
  const w = cfg.words;
  const over = ledgerOverrun(l);
  const rem = ledgerRemaining(l);
  const silent = rem > w.silence.freeUpTo;
  const silence = silent ? -Math.min(w.silence.cap, Math.ceil((rem - w.silence.freeUpTo) / w.silence.per) * MILLI_PER_POINT) : 0;
  const sleep = over === 0 && rem <= sleepMaxRemaining(cfg, l.day) ? w.sleep.value : 0;
  return m(over * w.overrunPerWord + silence + sleep);
}

function entriesTerm(l: NightLedger): Milli {
  return m(l.entries.reduce((sum, e) => sum + e.delta, 0));
}

function carryTerm(state: SurvivalState, day: number): Milli {
  return m(state.counters[carryKey(day)] ?? 0);
}

/** Les termes de la nuit `l.day`, un par ligne du relevé [bible w10 §7.2, §7.3]. */
function nightTerms(state: SurvivalState, l: NightLedger, cfg: IntegrityConfig): Record<string, Milli> {
  return {
    dossier: dossierTerm(l.day, cfg), glances: glancesTerm(l, cfg), orders: ordersTerm(l, cfg),
    words: wordsTerm(l, cfg), entries: entriesTerm(l), carry: carryTerm(state, l.day),
  };
}

/** Deux sources des mêmes mots finiraient par diverger : base et crédit du relevé doivent être ceux des données. */
function assertLedgerWords(l: NightLedger, cfg: IntegrityConfig): void {
  const expectedBase = cfg.words.base[l.day - 1];
  if (l.wordsBase !== expectedBase) throw new Error(`relevé du jour ${l.day} : base de mots ${l.wordsBase}, données ${expectedBase}`);
  const names = l.entries.filter((e) => entryOf(e.source, cfg).counter === NAMES_COUNTER).length;
  if (l.wordsCredited !== cfg.words.perName * names) {
    throw new Error(`relevé du jour ${l.day} : ${l.wordsCredited} mots crédités pour ${names} nom(s)`);
  }
}

function nextCounters(state: SurvivalState, l: NightLedger, cfg: IntegrityConfig): Record<string, number> {
  const out: Record<string, number> = { ...state.counters };
  for (const e of l.entries) {
    const def = entryOf(e.source, cfg);
    if (def.counter) out[def.counter] = (out[def.counter] ?? 0) + 1;
    if (def.carry && def.carry.night > l.day) out[carryKey(def.carry.night)] = (out[carryKey(def.carry.night)] ?? 0) + def.carry.delta;
  }
  return out;
}

function endingOf(value: Milli, day: number, names: number, cfg: IntegrityConfig): SurvivalEnding | null {
  if (value < cfg.arrest.nightBelow) return { kind: 'arrested', at: day };
  if (day < cfg.lastNight) return null;
  if (value < cfg.arrest.auditionBelow) return { kind: 'arrested', at: 'audition' };
  return names >= cfg.recruitNames ? { kind: 'recruited' } : { kind: 'released' };
}

function mentionsOf(l: NightLedger, cfg: IntegrityConfig): string[] {
  const out = new Set<string>();
  for (const e of l.entries) {
    const text = entryOf(e.source, cfg).mention;
    if (text) out.add(text);
  }
  // D86 « concours apporté » : contrefactuel (semaine rejouée sans le nom), calculé au bilan, plan 03.
  return [...out].sort();
}

/**
 * Relevé de la nuit : l'Intégrité ne bouge qu'ici, depuis les sommes du jour [D89]. Le dossier est clos à la nuit
 * `lastNight` : après elle, la valeur ne change pas et la lecture ne porte que des mentions [bible w10 §7.5].
 */
export function closeNight(state: SurvivalState, ledger: NightLedger, cfg: IntegrityConfig): { state: SurvivalState; reading: NightReading } {
  const day = ledger.day as DayIndex;
  if (day > cfg.lastNight) {
    const reading = { day, value: state.value, terms: {}, palier: palierOf(state.value, cfg), ending: null, mentions: mentionsOf(ledger, cfg) };
    return { state, reading };
  }
  assertLedgerWords(ledger, cfg);
  const terms = nightTerms(state, ledger, cfg);
  const raw = Object.values(terms).reduce<number>((a, b) => a + b, state.value);
  const value = m(Math.min(cfg.cap, Math.max(cfg.floor, raw)));
  const counters = nextCounters(state, ledger, cfg);
  const names = counters[NAMES_COUNTER] ?? 0;
  const ending = endingOf(value, day, names, cfg);
  const reading = { day, value, terms, palier: palierOf(value, cfg), ending, mentions: mentionsOf(ledger, cfg) };
  return { state: { value, counters }, reading };
}
