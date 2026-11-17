/**
 * Types partagés du moteur des moments de la rue [plan 02b, « Interfaces produites »]. Aucune valeur de jeu ici,
 * seulement les formes que les tâches suivantes et le plan 02a lisent. Les formes de DONNÉES (`NpcData`, `GazeData`,
 * `CheckpointData`, `WallCounterData`) vivent dans le schéma du chargeur et sont ré-exportées.
 */
import type { CoreData } from '../../data/schema/core';
import type { StreetData } from '../../data/schema/street';
export type {
  BeatLine, ChainLink, ChainSpec, GuidedData, GuidedDay, GuidedEnding, LinkAt, LinkedBeat, LinkVariant, NarrativeOption, SceneActor, SceneAsk, SceneBeat, SceneSpec, SpeechMode, TransitAct, Voice,
} from '../../data/schema/guided';
export { isLinkedBeat } from '../../data/schema/guided';
import type { WorldData } from '../../data/schema/world';
import type { Dice } from '../../shared/dice';
import type { RunResult } from '../../shared/types/run';
import type {
  ActRecord, DayIndex, DayState, GameClock, KitItemState, LedgerEntry, MomentId, NightLedger, RightId, SurvivalState,
} from '../../shared/types/street';
import type { NightReading } from '../../survival';
import type { CalendarHook } from '../week';

export type {
  CheckpointData, ClockData, GazeData, MomentsData, NpcData, RegistreData, RelectureDay, RelectureLine, RightContact, RightsData, SayLine,
  StreetData, WallCounterData,
} from '../../data/schema/street';

/** Phase d'un choix à prix : au repos, désigné (prix lu), confirmé [GDD 05 §3.2]. */
export type ChoicePhase = 'idle' | 'designated' | 'confirmed';

/** Le prix d'une option, dit avant confirmation ; `inventoryParams` ne porte que des nombres d'inventaire [D141]. */
export interface PriceLine {
  readonly choiceId: string; readonly optionId: string; readonly textKey: string; readonly isRefusal: boolean;
  readonly inventoryParams: Readonly<Record<string, number>>;
}

/** Les six axes du soir, dans cet ordre, toujours [GDD 05 §3.6]. */
export type Axis = 'vie' | 'travail' | 'rue' | 'liens' | 'pouvoir' | 'ia';
/** Les six axes, dans l'ordre du GDD [GDD 05 §3.6]. */
export const AXES: readonly Axis[] = ['vie', 'travail', 'rue', 'liens', 'pouvoir', 'ia'];

/** Ce qui fait courir l'horloge : la marche la fige [bible w10 §5.0]. */
export type Activity = 'walk' | 'queue' | 'scene' | 'wait';
/** Où se tient la joueuse. */
export type Location = 'home' | 'street' | 'registre';

/** Repère de la rue, en mètres [bible w10 §5.0]. */
export interface Vec2 { readonly x: number; readonly z: number }

/** Drapeaux d'état de rue : `left`, `workDone`, `slept` (T2) ; `hidden`, `permitBookHalved` (T8) ; `gateClosed`, `guide` (T7, R-02b.45) ; `permitRequested`, `listRead` (T9, R-02b.51) ; tous écrits par T10 [R-02b.7]. */
export type StreetFlag = 'left' | 'workDone' | 'slept' | 'hidden' | 'permitBookHalved' | 'gateClosed' | 'guide' | 'permitRequested' | 'listRead';

/** Raison d'un refus d'acte, jamais une levée d'exception [R-02b.7]. `invalidAct` : refusé par `isValidAct` (minute hors 420..1320, forme). */
export type RejectReason =
  | 'invalidAct' | 'unknownKind' | 'unknownChoice' | 'unknownOption' | 'choiceClosed' | 'outOfOrder' | 'dayGap' | 'exitBlocked'
  | 'auditionPending' | 'stallClosed' | 'registreClosed' | 'bonsInsufficient' | 'stallEmpty' | 'ended'
  | 'unknownLine';        // `say` d'une réplique absente de `lines.say` [R-02b.49]

/** Contexte immuable d'un calcul de rue. `onHook` observe les crochets de la semaine rejoués [plan 01]. */
export interface StreetContext {
  readonly street: StreetData; readonly world: WorldData; readonly core: CoreData; readonly run: RunResult; readonly dice: Dice;
  readonly onHook?: (h: CalendarHook) => void;
}

/**
 * Ce que le jour en cours a écrit au relevé en dehors des actes eux-mêmes : entrées des options confirmées et des voies
 * (`found7`, `bribe`, `patrol`, `absentRegistre`…), mots du `comply` imposé après une patrouille. Posé une seule fois à l'acte
 * [R-02b.52 (3)], versé au relevé de la nuit, remis à zéro au matin. Ajouté par T10 : sans lui, une voie passée ne laisse aucune trace
 * que `buildLedger` puisse relire, puisque `laneOutcome` dépend de l'état de l'instant (kit, bons, porte).
 */
/** `orders` : consignes du jour hors actes (patrouille, retour à la file) ; absent = 0 [N9, bible w10 l. 534, l. 363]. */
export interface DayExtra { readonly entries: readonly LedgerEntry[]; readonly spent: number; readonly orders?: number }

/** État de la rue : se recalcule en rejouant les actes dans l'ordre, rien de plus n'est sauvé [plan 00, Sauvegarde]. */
export interface StreetState {
  readonly day: DayIndex; readonly clock: GameClock; readonly carry: number; readonly moment: MomentId; readonly location: Location;
  readonly phase: ChoicePhase; readonly designated: { readonly choiceId: string; readonly optionId: string } | null;
  readonly acts: readonly ActRecord[]; readonly confirmed: Readonly<Record<string, string>>;      // `${jour}.${choiceId}` vers optionId
  readonly kit: Readonly<Record<string, KitItemState>>; readonly bons: number;
  readonly rightsMet: readonly RightId[]; readonly rightLines: Readonly<Record<string, RightId>>;  // `${jour}.${moment}` vers le droit dit dans ce moment
  readonly survival: SurvivalState; readonly readings: readonly NightReading[]; readonly ledgers: readonly NightLedger[];
  readonly flags: Readonly<Partial<Record<StreetFlag, boolean>>>; readonly ended: DayState['ended'];
  readonly dayExtra: DayExtra;
}

/** Un acte écarté par le rejeu, avec sa raison. */
export interface Rejected { readonly act: ActRecord; readonly reason: RejectReason }
