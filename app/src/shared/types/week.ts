import type { Milli } from '../milli';
import type { DayIndex } from './street';
import type { Delta, WorldVar, WorldVector } from './world';

/** Lecture d'une pente à un moment de la semaine [GDD 03 §3.6]. */
export interface MomentReading { readonly slopeId: string; readonly var: WorldVar; readonly day: DayIndex; readonly minute: number }

/** État d'une porte ; distance 0 si fermée [GDD 03 §3.6]. */
export interface GateStatus { readonly id: string; readonly closed: boolean; readonly distance: Milli }

/** Sortie de la semaine de monde, produite par le plan 01 [GDD 03 §3.6, T-12]. */
export interface WeekOutput {
  /** Longueur 1 à 8 : départ canonique du J1, puis après chacun des pas joués [D121 ; GDD 06 §5]. */
  readonly curve: readonly WorldVector[];
  readonly momentReading: MomentReading | null;
  readonly finalWithEcho: WorldVector; readonly finalWithoutEcho: WorldVector;
  /** Écho appliqué, donc borné, du pas de clôture [GDD 03 §4]. */
  readonly frozenEcho: Delta;
  readonly gates: readonly GateStatus[]; readonly worldSeed: number;
}
