/**
 * Words and dossier ledger for the embodied 1984 control-station slice.
 *
 * Pure state: no DOM, no storage, no timers. Every number comes from the caller
 * (content file), so tuning never requires touching this module.
 */

/** One line written to the player's dossier, with its signed effect. */
export interface LedgerEntry { label: string; delta: number }

/** Result of the single optional contest of the reader record. */
export type ContestState = 'none' | 'founded' | 'unfounded';

/** Mutable ledger owned by one play-through of the slice. */
export interface ControlStationLedger {
  readonly budget: number;
  said: number;
  dossier: number;
  contested: ContestState;
  readonly entries: LedgerEntry[];
}

/** Tuning of the reader-record contest; lives in the content file. */
export interface ContestRule {
  /** Words spent to contest any line. */
  cost: number;
  /** Index of the only line contradicted by the player's own bracelet log. */
  falseIndex: number;
  /** Number of contestable reader lines. */
  lineCount: number;
  /** Signed dossier effect of contesting an exact line. */
  penalty: number;
  /** Dossier label written with the penalty. */
  penaltyLabel: string;
}

/** Creates a fresh ledger: nothing said, nothing written, nothing contested. */
export function createLedger(budget: number, dossier: number): ControlStationLedger {
  return { budget, said: 0, dossier, contested: 'none', entries: [] };
}

/** Words still available today; negative once the player has overspent. */
export function wordsLeft(ledger: ControlStationLedger): number {
  return ledger.budget - ledger.said;
}

/** Spends words from the bracelet. */
export function say(ledger: ControlStationLedger, words: number): void {
  ledger.said += words;
}

/** Writes a line to the dossier and applies its effect immediately. */
export function write(ledger: ControlStationLedger, label: string, delta: number): void {
  ledger.entries.push({ label, delta });
  ledger.dossier += delta;
}

/**
 * Contests one reader line. Allowed once; a second call or an unknown line is ignored.
 * A founded contest costs words only. An unfounded one also writes the penalty.
 */
export function contestRecord(ledger: ControlStationLedger, index: number, rule: ContestRule): ContestState | 'ignored' {
  if (ledger.contested !== 'none' || !Number.isInteger(index) || index < 0 || index >= rule.lineCount) return 'ignored';
  say(ledger, rule.cost);
  if (index === rule.falseIndex) { ledger.contested = 'founded'; return 'founded'; }
  write(ledger, rule.penaltyLabel, rule.penalty);
  ledger.contested = 'unfounded';
  return 'unfounded';
}
