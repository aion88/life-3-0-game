/** Semaine de monde : sept pas, écho de routine borné, jalons, portes strictes, lectures [GDD 03 §3.1 à §3.4, §4, §5.2, §5.7 ; D116, D121, D123]. */
import type { CoreData } from '../data/schema/core';
import type { WorldData } from '../data/schema/world';
import type { Milli } from '../shared/milli';
import type { DayIndex, Delta, GameClock, GateStatus, MomentReading, RunResult, WeekOutput, WorldVector } from '../shared/types';
import { WORLD_VARS, worldSeedOf } from '../shared/types';
import { holds } from './conditions';
import { applyCouplings } from './couplings';
import { momentOf, nextReadings, type Readings } from './readings';
import { addDelta, clampVector } from './vector';

/** Sept pas de monde : six matins (J2 à J7) plus le pas de clôture [GDD 03 §3.2 ; D121]. */
export const WEEK_STEPS = 7;
// Minutes du matin (7 h) et de clôture (22 h) : définies une fois dans shared/types/street.ts, ré-exportées ici.
export { CLOSING_MINUTE, MORNING_MINUTE } from '../shared/types/street';

/** Un crochet du calendrier de la semaine [D121]. */
export type CalendarHook =
  | { readonly kind: 'morning'; readonly day: DayIndex } // pas de 7 h, J2 à J7
  | { readonly kind: 'nightEnd'; readonly day: DayIndex } // fin de la nuit : relevé de survie, aucun pas de monde
  | { readonly kind: 'closing' }; // pas de clôture, tampon du J7, avant le bilan

const CALENDAR: readonly CalendarHook[] = [
  { kind: 'nightEnd', day: 1 },
  ...([2, 3, 4, 5, 6, 7] as const).flatMap((day): CalendarHook[] => [{ kind: 'morning', day }, { kind: 'nightEnd', day }]),
  { kind: 'closing' },
];

/** nightEnd 1, morning 2, nightEnd 2, …, morning 7, nightEnd 7, closing. */
export function weekCalendar(): readonly CalendarHook[] {
  return CALENDAR;
}

/** État de la semaine : `ws` avec écho, `wsNoEcho` sans aucun écho, tampon de routine en attente [GDD 03 §3.6]. */
export interface WeekState {
  readonly ws: WorldVector;
  readonly wsNoEcho: WorldVector;
  readonly buffer: Delta;
  readonly stepsDone: number;
  /** Clés `${slopeId}.${WorldVar}` et `neutral.${WorldVar}`, avec hystérésis h. */
  readonly readings: Readings;
  readonly momentReading: MomentReading | null;
  /** Écho appliqué, donc borné, au dernier pas. */
  readonly lastAppliedEcho: Delta;
  /** Départ canonique, puis `ws` après chaque pas ; le dernier élément vaut toujours `ws`. */
  readonly curve: readonly WorldVector[];
}

/** Borne chaque variable d'une variation à ±`cap` ; l'excès est perdu, les variables nulles sont omises. */
function capDelta(d: Delta, cap: Milli): Delta {
  const out: Partial<Record<(typeof WORLD_VARS)[number], Milli>> = {};
  for (const k of WORLD_VARS) {
    const capped = Math.max(-cap, Math.min(cap, d[k] ?? 0)) as Milli;
    if (capped !== 0) out[k] = capped;
  }
  return out;
}

/** Temps 1 et 2 : dérive avec clamp, puis couplages séquentiels à l'échelle du monde, clamp après chacun [GDD 03 §4]. */
function slide(v: WorldVector, world: WorldData, core: CoreData): WorldVector {
  const drifted = clampVector(addDelta(v, world.engine.drift));
  return applyCouplings(drifted, core.engine.couplings, 'sequential', world.engine.couplingScale100);
}

/** Départ de la semaine : vecteur canonique du monde VÉCU, jamais celui du pas de choix [D116 (1), D121 (2), D140]. */
export function startWeek(run: RunResult, world: WorldData, core: CoreData): WeekState {
  if (run.outcome.kind !== 'arrival') throw new Error(`aucune semaine sans monde vécu : issue ${run.outcome.world}`);
  if (run.outcome.livedWorld !== world.id) throw new Error(`monde vécu ${run.outcome.livedWorld}, données de ${world.id}`);
  const start = core.catalogue.byId[world.id].vector;
  if (start === null) throw new Error(`pas de vecteur canonique pour ${world.id}`);
  const readings = nextReadings({}, start, world, core.engine.hysteresis);
  return { ws: start, wsNoEcho: start, buffer: {}, stepsDone: 0, readings, momentReading: null, lastAppliedEcho: {}, curve: [start] };
}

/** Un pas : dérive, couplages, puis écho de routine borné et tampon vidé ; `nightEnd` ne touche pas `ws` [GDD 03 §4 ; D121]. */
export function stepWeek(state: WeekState, world: WorldData, core: CoreData, hook: CalendarHook, at: GameClock): WeekState {
  if (hook.kind === 'nightEnd') return state;
  const echo = capDelta(state.buffer, world.engine.routineEcho.capPerStep); // temps 3 : borné par variable, excès perdu
  const ws = clampVector(addDelta(slide(state.ws, world, core), echo));
  const readings = nextReadings(state.readings, ws, world, core.engine.hysteresis);
  return {
    ws, readings, buffer: {}, lastAppliedEcho: echo, stepsDone: state.stepsDone + 1, curve: [...state.curve, ws],
    wsNoEcho: slide(state.wsNoEcho, world, core), // suit les deux premiers temps seulement
    momentReading: state.momentReading ?? momentOf(state.readings, readings, world, at),
  };
}

/** Ajoute la valeur de la clé d'écho au tampon, sans borne : le plafond s'applique au pas [GDD 03 §3.3]. */
export function pushRoutine(state: WeekState, world: WorldData, echoKey: string): WeekState {
  const d = world.engine.routineEcho.table[echoKey];
  if (d === undefined) throw new Error(`clé d'écho inconnue dans ${world.id} : ${echoKey}`);
  const buffer: Partial<Record<(typeof WORLD_VARS)[number], Milli>> = { ...state.buffer };
  for (const k of WORLD_VARS) if (d[k] !== undefined) buffer[k] = ((buffer[k] ?? 0) + d[k]) as Milli;
  return { ...state, buffer };
}

/** Jalon : immédiat, borné par variable et par déclenchement, sans cumul sur la semaine ; plafond `null` avec `wsDelta` lève [D116 (2), D123]. */
export function applyMilestone(state: WeekState, world: WorldData, milestoneId: string): WeekState {
  const m = world.engine.milestones.find((x) => x.id === milestoneId);
  if (m === undefined) throw new Error(`jalon inconnu dans ${world.id} : ${milestoneId}`);
  if (m.wsDelta === null) return state;
  const cap = world.engine.milestoneCapPerVar;
  if (cap === null) throw new Error(`jalon ${milestoneId} : plafond null, aucun wsDelta permis [GDD 03 Q7]`);
  const ws = clampVector(addDelta(state.ws, capDelta(m.wsDelta, cap)));
  return { ...state, ws, curve: [...state.curve.slice(0, -1), ws] }; // contrat : curve finit toujours sur ws, le jalon est porté par le point du jour courant (J1 : le départ)
}

/** Portes : `holds` strict, sans hystérésis ; distance = |valeur − seuil|, 0 si fermée [GDD 03 §3.4, §5.7]. */
export function gateStatuses(ws: WorldVector, world: WorldData): readonly GateStatus[] {
  return world.engine.gates.map((g) => {
    const closed = holds(ws, g.when);
    return { id: g.id, closed, distance: (closed ? 0 : Math.abs(ws[g.when.var] - g.when.threshold)) as Milli };
  });
}

/** Sortie vers le bilan ; de 1 à 7 pas joués. Sans clôture, l'écho figé est vide [GDD 03 §3.6, T-12 ; GDD 06 §5]. */
export function weekOutput(state: WeekState, world: WorldData): WeekOutput {
  if (state.stepsDone > WEEK_STEPS) throw new Error(`${state.stepsDone} pas joués, ${WEEK_STEPS} au plus`);
  return {
    curve: state.curve, momentReading: state.momentReading, finalWithEcho: state.ws, finalWithoutEcho: state.wsNoEcho,
    frozenEcho: state.stepsDone === WEEK_STEPS ? state.lastAppliedEcho : {},
    gates: gateStatuses(state.ws, world), worldSeed: worldSeedOf(world.id),
  };
}
