/** Aides de test de la survie de w10 [R-01.3, plan 01 Task 14]. */
import { integrityOf, parseWorld, type IntegrityConfig } from '../../src/data/schema/world';
import { closeNight, startSurvival, survivalEntry, type NightReading } from '../../src/survival';
import { realInput, w10Raw, cat } from '../fixtures/data/factories';
import survivalOracle from '../fixtures/survival.oracle.json';
import type { ContentInput } from '../../src/validate/content';
import type { Milli } from '../../src/shared/milli';
import type { DayIndex, GameClock, LedgerEntry, NightLedger, SurvivalState } from '../../src/shared/types/street';

/** Un cas de l'oracle : entrées nuit par nuit, valeurs en points, issue. */
export interface OracleCase {
  readonly profile?: string;
  readonly words: readonly number[];
  readonly names: readonly number[];
  readonly permit: number | null;
  readonly found: number | null;
  readonly absent: readonly number[];
  readonly nights: readonly number[];
  readonly end: string;
}
export interface SurvivalOracle {
  readonly profiles: Readonly<Record<string, OracleCase>>;
  readonly d134: Readonly<Record<string, OracleCase>>;
  readonly grid: readonly OracleCase[];
}

/** `oracle('survival')` : import JSON statique, aucun accès disque [R-01.3]. */
export function oracle(name: 'survival'): SurvivalOracle {
  if (name !== 'survival') throw new Error(`oracle inconnu : ${name}`);
  return survivalOracle as unknown as SurvivalOracle;
}

const CFG0: IntegrityConfig = integrityOf(parseWorld(w10Raw, cat));

/** Relevé du jour `day` : sommes d'un joueur dans le couloir (mots = base, 3 regards, une consigne), crédit selon les noms. */
export function ledgerOf(day: number, entries: readonly LedgerEntry[], cfg: IntegrityConfig = CFG0): NightLedger {
  const base = cfg.words.base[day - 1] ?? cfg.words.base[0]!;
  const names = entries.filter((e) => cfg.entries[e.source]?.counter === 'names').length;
  return { day: day as DayIndex, wordsBase: base, wordsCredited: cfg.words.perName * names, wordsBought: 0, wordsSpent: base, glances: 3, orders: 1, entries };
}

/** Rejoue un cas de l'oracle nuit par nuit, par `survivalEntry` et `closeNight` ; s'arrête à la première fin. */
export function playReadings(c: OracleCase, cfg: IntegrityConfig): { readings: NightReading[]; state: SurvivalState; ledgers: NightLedger[] } {
  let state = startSurvival(cfg);
  const readings: NightReading[] = [];
  const ledgers: NightLedger[] = [];
  for (let n = 1; n <= cfg.lastNight; n++) {
    const at: GameClock = { day: n as DayIndex, minute: 600 };
    const src: string[] = [];
    if (n >= 2 && n <= 5) src.push(c.names.includes(n) ? 'offer.named' : `offer.refused.j${n}`);
    if (c.permit === n) src.push('permit');
    if (c.found === n) src.push('found7');
    if (c.absent.includes(n)) src.push('absentRegistre');
    const base = ledgerOf(n, src.map((s) => survivalEntry(s, at, cfg)), cfg);
    const ledger = { ...base, wordsSpent: c.words[n - 1]! };
    ledgers.push(ledger);
    const out = closeNight(state, ledger, cfg);
    state = out.state;
    readings.push(out.reading);
    if (out.reading.ending !== null) break;
  }
  return { readings, state, ledgers };
}

/** Issue lisible : `released`, `recruited`, `arrested:4`, `arrested:audition`. */
function endOf(r: NightReading | undefined): string {
  const e = r?.ending;
  if (!e) throw new Error('pas de fin');
  return e.kind === 'arrested' ? `arrested:${e.at}` : e.kind;
}

/** `playCase` : valeurs par nuit en points et issue. */
export function playCase(c: OracleCase, cfg: IntegrityConfig): { nights: number[]; end: string } {
  const { readings } = playReadings(c, cfg);
  return { nights: readings.map((r) => r.value / 1000), end: endOf(readings.at(-1)) };
}

/** Dernière lecture d'un cas. */
export function lastReading(c: OracleCase, cfg: IntegrityConfig): NightReading {
  return playReadings(c, cfg).readings.at(-1)!;
}

/** État après les six nuits du profil « Zéro nom ». */
export function sixNightsCouloir(cfg: IntegrityConfig): SurvivalState {
  return playReadings(oracle('survival').profiles['Zéro nom']!, cfg).state;
}

const gridOf = (profile: string, found: number | null): OracleCase[] =>
  oracle('survival').grid.filter((c) => c.profile === profile && c.found === found);

/** Comptes `${nombre de noms}:${issue}` sur la grille d'un profil de mots. */
export function gridCounts(profile: string, found: number | null, cfg: IntegrityConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of gridOf(profile, found)) {
    const k = `${c.names.length}:${playCase(c, cfg).end}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Plus basse valeur finale (six nuits jouées) par nombre de noms. */
export function gridMinFinal(profile: string, found: number | null, cfg: IntegrityConfig): Record<number, number> {
  const out: Record<number, number> = {};
  for (const c of gridOf(profile, found)) {
    const r = playCase(c, cfg);
    if (r.nights.length < cfg.lastNight) continue;
    const last = r.nights[cfg.lastNight - 1]!;
    out[c.names.length] = Math.min(out[c.names.length] ?? Infinity, last);
  }
  return out;
}

/** Toutes les permutations d'une liste. */
export function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/** Données forgées : `report` posé sur la config [le fichier de w10 les laisse vides]. */
export function withReport(cfg: IntegrityConfig, report: { prices: Record<string, 'full' | 'half'>; comforts: string[] }): IntegrityConfig {
  return { ...cfg, report };
}

/** Données forgées : plancher et plafond de jauge en points. */
export function withClamp(cfg: IntegrityConfig, clamp: { floor: number; cap: number }): IntegrityConfig {
  return { ...cfg, floor: (clamp.floor * 1000) as Milli, cap: (clamp.cap * 1000) as Milli };
}

/** JSON de w10 avec le bloc `survival` fusionné (points). */
export function withSurvival(raw: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const r = structuredClone(raw);
  r['survival'] = { ...(r['survival'] as Record<string, unknown>), ...patch };
  return r;
}

/** Entrée de `validateContent` avec ce JSON de w10. */
export function contentWith(raw: Record<string, unknown>): ContentInput {
  return { ...realInput(), worlds: [parseWorld(raw, cat)] };
}

/** Entrée de relevé sans delta (aide du rapport). */
export function e2(source: string, day = 4, minute = 900): LedgerEntry {
  return { source, delta: 0 as Milli, at: { day: day as DayIndex, minute } };
}
