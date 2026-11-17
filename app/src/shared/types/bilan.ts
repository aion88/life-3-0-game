import type { ActRecord, DayIndex, KitItemState, RightId } from './street';
import type { OtherLife, Projection, RunResult, TracebackLine } from './run';
import type { MomentReading, WeekOutput } from './week';
import type { AnswerKey, QuestionKey } from './questionnaire';
import type { ArrivalWorldId, WorldId, WorldVar, WorldVector } from './world';
import type { Milli } from '../milli';
import type { PalierId } from '../../data/schema/world';

/** Entrée du bilan [GDD 06 §3.1]. */
export type BilanEntry = 'weekEnd' | 'earlyEnd' | 'extinction';

/** Rapport de survie, produit par le plan 01 [GDD 06 §3.12]. */
export interface SurvivalReport {
  readonly endKind: 'derivedThreshold' | 'worldBound' | 'names'; readonly endId: string; readonly endDay: DayIndex;
  readonly pricesPaid: readonly { readonly id: string; readonly day: DayIndex; readonly cls: 'full' | 'half' }[];
  readonly comfortsTaken: readonly { readonly id: string; readonly day: DayIndex }[];
}

/** Entrée pure du bilan. */
export interface BilanInput {
  readonly entry: BilanEntry; readonly run: RunResult; readonly week: WeekOutput | null;
  readonly survival: SurvivalReport | null; readonly acts: readonly ActRecord[];
}

// --- Plan 03, tâche 2 : le contrat de sortie du bilan [GDD 06 §3.3 à §3.12]. Ce plan est le seul écrivain de ce fichier.
// Aucun texte joueur ici : un texte est une clé i18n, le writer la remplit.

/** Origine d'une ligne de la fiche, dans l'ordre de priorité de GDD 06 §3.3. */
export type DayLineOrigin = 'name' | 'milestone' | 'milestoneFact' | 'paidGesture' | 'otherChoice' | 'evening';
export interface DayLine { readonly day: DayIndex; readonly dateKey: string; readonly textKey: string; readonly origin: DayLineOrigin }
export interface KitRow { readonly itemId: string; readonly labelKey: string; readonly state: KitItemState; readonly stateKey: string }
export interface FateLine { readonly kind: 'end' | 'price' | 'comfort'; readonly textKey: string; readonly day: DayIndex }
export interface BilanSheet {
  readonly computedWorld: WorldId; readonly livedWorld: ArrivalWorldId; readonly redirected: boolean;
  readonly days: readonly DayLine[]; readonly kit: readonly KitRow[]; readonly fate: readonly FateLine[];
  /** Palier du dernier relevé de la partie (le message du bracelet), `null` sans relevé [plan UI-C T10 ; GD point 2]. */
  readonly lastMessage: PalierId | null;
}

/** Cas de bascule de GDD 06 §3.4 ; `none` : aucune projection disponible, hors table. */
export type BasculeCase = 'a' | 'b' | 'c' | 'd' | 'e' | 'none';
export interface Bascule {
  readonly case: BasculeCase; readonly yearWith: number | null; readonly yearWithout: number | null;
  readonly shiftYears: number | null; readonly direction: 'forward' | 'back' | null;
}
/** Se dessine, ne s'écrit jamais. */
export interface GateDraw { readonly gateId: string; readonly var: WorldVar; readonly threshold: Milli; readonly current: Milli }
export interface BilanCurve {
  readonly historyWorld: WorldId; readonly lifeWorld: ArrivalWorldId | null;
  readonly fastForward: readonly WorldVector[]; readonly choiceMark: WorldVector | null;
  readonly street: readonly WorldVector[] | null; readonly withEcho: Projection | null; readonly withoutEcho: Projection | null;
  readonly bascule: Bascule; readonly emphasized: readonly WorldVar[]; readonly momentReading: MomentReading | null;
  readonly gate: GateDraw | null; readonly ruptureYear: number | null; readonly projectedExtinctionYear: number | null;
}

/** Les huit droits de la pièce 5 : `lineKey` est la clé existante `w10.right.<id>`. */
export interface RightLine { readonly right: RightId; readonly lineKey: string; readonly carriedBy: TracebackLine | null }

export type SourceLabel = 'sourced' | 'unreopened' | 'extrapolated' | 'gameHypothesis';
export interface SourceRow { readonly label: SourceLabel; readonly textKey: string }
/** Les sept réponses `hypothesis: true`, dites par intitulé et libellé, jamais par clé [GDD 06 §3.8 point 4]. */
export interface HypothesisRow { readonly question: QuestionKey; readonly answer: AnswerKey }
export interface SourcesScreen {
  readonly world: WorldId; readonly worldRows: readonly SourceRow[] | null; readonly hypotheses: readonly HypothesisRow[];
  readonly noteKeys: readonly string[]; readonly rareLineKey: string;
  readonly shares: { readonly total: number; readonly rows: readonly { readonly world: ArrivalWorldId; readonly count: number }[] };
}

export interface NameLine { readonly personKey: string; readonly day: DayIndex }
export interface FileLine { readonly lineKey: string; readonly day: DayIndex; readonly outcome: 'flagged' | 'dismissed' }
/** Quatre mentions du dossier [GDD 06 §3.10]. */
export type DossierMention = 'savedByName' | 'twoNamesThenArrested' | 'declaredLeaver' | 'radioFromInside';
export interface DossierBlock {
  readonly names: readonly NameLine[]; readonly answer: 'all' | 'none' | 'silence' | null;
  readonly files: readonly FileLine[]; readonly flaggedCount: number; readonly mentions: readonly DossierMention[];
}

/** « Les autres » : `locked` est vrai quand il n'y a aucune ligne, la trajectoire était verrouillée [R-03.20, D139]. */
export interface BilanOthers { readonly lines: readonly OtherLife[]; readonly locked: boolean }
export interface BilanRedirect { readonly computed: ArrivalWorldId; readonly lived: ArrivalWorldId }

/**
 * Sortie pure du bilan, écrite en entier [R-03.14]. `sheet`, `rights` et `dossier` sont nuls pour une extinction (pas de rue) ;
 * `redirect` est nul hors redirection et toujours nul en extinction [D140] ; `worldBlockId` nomme le bloc propre au monde vécu.
 */
export interface BilanData {
  readonly entry: BilanEntry; readonly softened: boolean;
  readonly sheet: BilanSheet | null; readonly curve: BilanCurve; readonly others: BilanOthers;
  readonly traceback: readonly TracebackLine[]; readonly rights: readonly RightLine[] | null;
  readonly worldBlockId: string | null; readonly sources: SourcesScreen;
  readonly redirect: BilanRedirect | null; readonly dossier: DossierBlock | null;
}

/** Réglages communs du bilan, comptes d'arrivée figés compris [GDD 06 §3.8 et §7]. */
export interface BilanCommon {
  readonly total: number;
  readonly counts: readonly { readonly world: WorldId; readonly count: number }[];
  readonly contentPoints: readonly string[];
  readonly noteKeys: readonly string[];
  readonly sigma100: number;
  readonly sheetMaxLines: number;
  readonly others: { readonly min: number; readonly max: number };
  readonly traceback: { readonly min: number; readonly max: number };
  readonly rightsCount: 8;
}
