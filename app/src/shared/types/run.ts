import type { AnswerKey, Answers, QuestionKey } from './questionnaire';
import type { ArrivalWorldId, ExtinctionId, PushVector, WorldId, WorldVar, WorldVector } from './world';
import type { Milli } from '../milli';

/** Trajectoire du monde : steps[0] = V0 (pas 0, 2026) ; 1..48 pas, jusqu'à 71 en extinction [GDD 02 §3.2, §3.5]. */
export interface Trajectory { readonly steps: readonly WorldVector[] }

/** Une manchette déclenchée au pas `firedAtStep`. */
export interface HeadlineFire { readonly id: string; readonly firedAtStep: number }

/** Écart d'arrivée : 0 à 2 axes, vide si distance ≤ 60 [D41, D121]. */
export interface ArrivalOffset { readonly axes: readonly { readonly var: WorldVar; readonly signed: Milli }[] }

/** Issue d'une partie : arrivée dans un monde, ou extinction [GDD 02 §3.5]. */
export type RunOutcome =
  | {
      readonly kind: 'arrival'; readonly computedWorld: ArrivalWorldId; readonly livedWorld: ArrivalWorldId;
      readonly redirected: boolean; readonly distanceSq: number; readonly offset: ArrivalOffset;
    }
  | { readonly kind: 'extinction'; readonly world: ExtinctionId; readonly runStartStep: number; readonly ruptureStep: number };

/** Résultat complet d'une partie, sortie du plan 01 [GDD 02]. */
export interface RunResult {
  readonly answers: Answers; readonly push: PushVector; readonly seed: number; // seed = runSeed(answers)
  readonly trajectory: Trajectory; readonly outcome: RunOutcome;
  readonly headlines: readonly HeadlineFire[]; readonly softened: boolean;
}

/** Projection au-delà de la semaine ; switchStep et toWorld nuls ensemble ou définis ensemble [GDD 06 §3.4 D31]. */
export interface Projection {
  readonly steps: readonly WorldVector[]; readonly switchStep: number | null;
  readonly toWorld: WorldId | null; readonly extinctionStep: number | null;
}

/** Une autre vie : ce qu'une autre réponse aurait donné [D139]. */
export interface OtherLife {
  readonly question: QuestionKey; readonly answer: AnswerKey;
  readonly destination: WorldId; readonly displayedRank: number;
}

/** Une ligne de remontée : la réponse qui pèse le plus [D140 (3)]. */
export interface TracebackLine { readonly question: QuestionKey; readonly answer: AnswerKey }
