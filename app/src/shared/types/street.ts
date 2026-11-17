import type { Milli } from '../milli';
import type { GateStatus } from './week';
import type { WorldVector } from './world';

/** Jour de la semaine, 1 à 7. */
export type DayIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Mode d'un jour [GDD 05 §3.2]. */
export type DayMode = 'contraint' | 'libre' | 'bascule';

/** Cinq moments, six fenêtres [GDD 05 §3.1]. */
export type MomentId = 'lever' | 'rueAller' | 'travail' | 'rueMidi' | 'soir' | 'nuit';

/** Minute du matin : 7 h [GDD 03 §3.2 ; GameClock]. */
export const MORNING_MINUTE = 420;
/** Minute de clôture : 22 h, fin de la journée jouable [D121 (1) ; minute : lead-programmer]. */
export const CLOSING_MINUTE = 1320;

/** Horloge du jeu ; minute du jour, 420 (7 h) à 1320 (22 h). */
export interface GameClock { readonly day: DayIndex; readonly minute: number }

/** Les huit droits de D134. */
export type RightId = 'move' | 'leave' | 'stay' | 'speak' | 'read' | 'assemble' | 'privacy' | 'work';

/** Les huit droits de D134, dans cet ordre. */
export const RIGHT_IDS: readonly RightId[] = ['move', 'leave', 'stay', 'speak', 'read', 'assemble', 'privacy', 'work'];

/** État d'un objet du kit [GDD 06 §3.3, extrapolé]. */
export type KitItemState = 'kept' | 'left' | 'seized' | 'handedOver' | 'declared';

/** Une ligne du relevé : source, variation signée et instant. */
export interface LedgerEntry { readonly source: string; readonly delta: Milli; readonly at: GameClock }

/** Sommes du jour lues au relevé de nuit [bible w10 §7.2]. */
export interface NightLedger {
  readonly day: DayIndex; readonly wordsBase: number; readonly wordsCredited: number; readonly wordsBought: number;
  readonly wordsSpent: number; readonly glances: number; readonly orders: number; readonly entries: readonly LedgerEntry[];
}

/** État de survie interne, jamais affiché ; w10 : counters.names. */
export interface SurvivalState { readonly value: Milli; readonly counters: Readonly<Record<string, number>> }

/** Un acte posé par la joueuse. */
export interface ActRecord {
  readonly day: DayIndex; readonly minute: number; readonly kind: string; readonly id: string; readonly option: string | null;
}

/** État d'un jour de la rue [GDD 05, GDD 06]. */
export interface DayState {
  readonly clock: GameClock; readonly mode: DayMode; readonly moment: MomentId;
  readonly ws: WorldVector;
  /** Clé `${slopeId}.${WorldVar}`, ou `neutral.${WorldVar}` ; avec h [GDD 03 §3.4]. */
  readonly readings: Readonly<Record<string, boolean>>;
  readonly gates: readonly GateStatus[]; readonly ledger: NightLedger; readonly survival: SurvivalState;
  readonly rightsMet: readonly RightId[]; readonly kit: Readonly<Record<string, KitItemState>>;
  readonly ended: { readonly endId: string; readonly at: GameClock } | null;
}
