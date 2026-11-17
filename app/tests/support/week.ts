/**
 * Aides de test de la semaine de monde [R-01.3] : gestes, rejeu du calendrier, mondes de test,
 * jalons forgés, lectures, écarts de pente, portes. Aucune règle de jeu ici : les règles vivent dans `src/engine`.
 */
import { loadCore } from '../../src/data/load';
import type { Catalogue } from '../../src/data/schema/catalogue';
import type { WorldData, WorldEngine } from '../../src/data/schema/world';
import { applyCouplingsTraced } from '../../src/engine/couplings';
import { nextReadings } from '../../src/engine/readings';
import { addDelta, clampVector } from '../../src/engine/vector';
import {
  CLOSING_MINUTE, MORNING_MINUTE, gateStatuses, pushRoutine, startWeek, stepWeek, weekCalendar, type WeekState,
} from '../../src/engine/week';
import { toMilli, type Milli } from '../../src/shared/milli';
import type { CoreData } from '../../src/data/schema/core';
import type { DayIndex, GameClock } from '../../src/shared/types/street';
import type { RunResult } from '../../src/shared/types/run';
import type { ArrivalWorldId, Delta, WorldVar, WorldVector } from '../../src/shared/types/world';
import { DOOR_GATES } from '../fixtures/door-table';
import { cat, w10Raw } from '../fixtures/data/factories';
import { parseWorld } from '../../src/data/schema/world';
import { runOf } from './run';

/** Gestes d'un jour : clés d'écho de routine posées après 7 h [GDD 03 §3.2, §4]. */
export interface DayGestures { readonly after7h?: readonly string[] }
/** Gestes de la semaine, par jour. */
export type Gestures = Readonly<Partial<Record<DayIndex, DayGestures>>>;

const DAYS: readonly DayIndex[] = [1, 2, 3, 4, 5, 6, 7];
const everyDay = (keys: readonly string[]): Gestures => Object.fromEntries(DAYS.map((d) => [d, { after7h: keys }])) as Gestures;

/** Aucun geste. */
export const NONE: Gestures = {};
/** Écho maximal : trois téléphones par jour, 1,2 posé, donc le plafond de 1 est atteint chaque jour [GDD 03 §5.7]. */
export const MAX_ECHO: Gestures = everyDay(['usePhone', 'usePhone', 'usePhone']);
/** Un téléphone par jour [GDD 03 §10.1]. */
export const PHONE_ONCE_A_DAY: Gestures = everyDay(['usePhone']);

/** L'horloge du jeu à un instant donné. */
export function at(day: DayIndex, minute: number): GameClock {
  return { day, minute };
}

const core: CoreData = loadCore();
/** Bloc `street` des mondes de test : celui de w10, que ces mondes ne lisent jamais (le plan 02b ne joue que w10). */
const W10_STREET = parseWorld(w10Raw, cat).street;

/** Une partie vécue dans `worldId` : la ligne de w10, issue remplacée ; seul w10 a des données réelles dans cette tranche. */
export function runLivingIn(worldId: ArrivalWorldId): RunResult {
  const base = runOf('ACBACBACAAD');
  if (base.outcome.kind !== 'arrival') throw new Error('la ligne de départ doit arriver');
  return { ...base, outcome: { ...base.outcome, livedWorld: worldId } };
}

/** Un état par instant observable : départ (J1), puis chaque pas joué, avec son jour. */
export interface Snapshot { readonly day: DayIndex; readonly state: WeekState }

/** Rejoue `weekCalendar()` : les gestes d'un jour tombent à la fin du jour, avant le pas suivant. */
function snapshots(
  run: RunResult, world: WorldData, c: CoreData, gestures: Gestures, lastDay: DayIndex, withClosing: boolean,
): readonly Snapshot[] {
  let s = startWeek(run, world, c);
  const out: Snapshot[] = [{ day: 1, state: s }];
  for (const hook of weekCalendar()) {
    if (hook.kind === 'closing' ? !withClosing : hook.day > lastDay) break;
    if (hook.kind === 'nightEnd') {
      for (const key of gestures[hook.day]?.after7h ?? []) s = pushRoutine(s, world, key);
      continue;
    }
    const day = hook.kind === 'morning' ? hook.day : 7;
    s = stepWeek(s, world, c, hook, at(day, hook.kind === 'morning' ? MORNING_MINUTE : CLOSING_MINUTE));
    out.push({ day, state: s });
  }
  return out;
}

/** La semaine complète : six matins puis la clôture. */
export function playWeek(run: RunResult, world: WorldData, c: CoreData, gestures: Gestures): WeekState {
  return snapshots(run, world, c, gestures, 7, true).at(-1)!.state;
}

/** La semaine jouée jusqu'à la fin du jour donné, sans clôture [GDD 06 §5]. */
export function playWeekUntil(run: RunResult, world: WorldData, c: CoreData, gestures: Gestures, day: DayIndex): WeekState {
  return snapshots(run, world, c, gestures, day, false).at(-1)!.state;
}

/** Premier jour où la porte 0 du monde est fermée, départ compris (J1) ; null si jamais [GDD 03 §5.7]. */
export function gateClosedOn(world: WorldData, gestures: Gestures): DayIndex | null {
  const hit = snapshots(runLivingIn(world.id), world, core, gestures, 7, true).find((x) => gateStatuses(x.state.ws, world)[0]!.closed);
  return hit?.day ?? null;
}

/** Valeur de la variable de la porte 0 après `steps` pas (6 : sans clôture, 7 : avec), sans écho ou à l'écho maximal. */
export function gateValueAfter(world: WorldData, steps: 6 | 7, echo: 'none' | 'max'): Milli {
  const all = snapshots(runLivingIn(world.id), world, core, echo === 'max' ? MAX_ECHO : NONE, 7, true);
  return all[steps]!.state.ws[world.engine.gates[0]!.when.var];
}

/** Dérive par jour (points) et échelle de couplage de chaque monde [GDD 03 §3.3, code v1 worlds/w01 à w11]. */
const DRIFT: Readonly<Record<ArrivalWorldId, { readonly drift: Partial<Record<WorldVar, number>>; readonly c: number }>> = {
  w01: { drift: { freedom: -0.3, abundance: -0.3, unrest: 0.4 }, c: 1 },
  w02: { drift: { unrest: 0.3 }, c: 0.8 },
  w03: { drift: { aiPower: 0.3, unrest: 0.2 }, c: 1 },
  w04: { drift: { unrest: 0.4, freedom: -0.1 }, c: 1 },
  w05: { drift: { aiPower: 0.1, surveillance: 0.2 }, c: 0.6 },
  w06: { drift: { unrest: 0.8, freedom: -0.2 }, c: 1.2 },
  w08: { drift: { abundance: 0.1, unrest: -0.1 }, c: 0.5 },
  w09: { drift: { freedom: -0.1, unrest: 0.3 }, c: 0.7 },
  w10: { drift: { surveillance: 0.3, freedom: -0.2, unrest: 0.3 }, c: 1 },
  w11: { drift: { abundance: 0.1, unrest: 0.1 }, c: 0.8 },
};

/** Points vers variation en millièmes. */
function delta(points: Partial<Record<WorldVar, number>>): Delta {
  return Object.fromEntries(Object.entries(points).map(([k, n]) => [k, toMilli(n)])) as Delta;
}

/** Monde de test : dérive et c du GDD 03 §3.3, porte du §5.7, écho `usePhone` +0,4 et `workTech` +0,3 sur la variable de porte si le §5.7 a une clé. */
export function testWorld(id: ArrivalWorldId): WorldData {
  const gate = DOOR_GATES.find((g) => g.world === id);
  if (!gate) throw new Error(`pas de porte de test pour ${id}`);
  const engine: WorldEngine = {
    drift: delta(DRIFT[id].drift),
    couplingScale100: DRIFT[id].c * 100,
    routineEcho: {
      capPerStep: toMilli(1),
      table: gate.echoKey ? { usePhone: delta({ [gate.gateVar]: 0.4 }), workTech: delta({ [gate.gateVar]: 0.3 }) } : {},
    },
    milestoneCapPerVar: null, milestones: [], events: [],
    gates: [{ id: `gate-${id}`, when: { var: gate.gateVar, cmp: '>', threshold: toMilli(gate.gateThreshold) } }],
    slopes: [], neutralReadings: [], projectionExtinctions: [],
  };
  return {
    status: 'skeleton', id, engine, forbiddenWords: [],
    calendar: DAYS.map((day) => ({ day, dateKey: `${id}.day.${day}.date`, mode: 'contraint' as const })),
    kit: [], survival: {}, street: W10_STREET, bilan: {},
  };
}

/** Le monde avec un plafond de jalon forgé (points, ou null) et des jalons `[id, variation en points]`, hors du validateur. */
export function withMilestones(w: WorldData, capPoints: number | null, list: readonly (readonly [string, Partial<Record<WorldVar, number>>])[]): WorldData {
  return {
    ...w,
    engine: {
      ...w.engine,
      milestoneCapPerVar: capPoints === null ? null : toMilli(capPoints),
      milestones: list.map(([id, d]) => ({ id, wsDelta: delta(d) })),
    },
  };
}

/** Le JSON brut d'un monde avec un plafond de jalon `null` et un jalon qui porte `wsDelta` : le schéma doit le refuser. */
export function withMilestoneNullCap<T extends { readonly engine: object }>(raw: T): T {
  return { ...raw, engine: { ...raw.engine, milestoneCapPerVar: null, milestones: [{ id: 'm', wsDelta: { unrest: 1 } }] } };
}

/** Réducteur de lectures : suite booléenne d'un indicateur `${pente}.${variable}` sur des vecteurs successifs, avec l'hystérésis du moteur. */
export function litSequence(world: WorldData, key: string): (acc: boolean[], ws: WorldVector) => boolean[] {
  return (acc, ws) => {
    const last = acc.at(-1);
    const next = nextReadings(last === undefined ? {} : { [key]: last }, ws, world, core.engine.hysteresis);
    if (!(key in next)) throw new Error(`indicateur inconnu : ${key}`);
    return [...acc, next[key]!];
  };
}

/** Milieu au demi-point entre deux valeurs en millièmes [GDD 03 §3.4, D121]. */
const midpointOf = (a: number, b: number): number => Math.round((a + b) / 2 / 500) * 500;

/** Écarts entre les seuils de pente des données et le milieu des deux mondes ; seuls les écarts sont listés [GDD 03 T-14, D121 (4)]. */
export function slopeGaps(world: WorldData, catalogue: Catalogue): readonly { slope: string; var: WorldVar; data: number; midpoint: number }[] {
  const own = catalogue.byId[world.id].vector!;
  return world.engine.slopes.flatMap((s) => s.readings.flatMap((r) => {
    const midpoint = midpointOf(own[r.var], catalogue.byId[s.to].vector![r.var]);
    return r.threshold === midpoint ? [] : [{ slope: s.id, var: r.var, data: r.threshold, midpoint }];
  }));
}

/** Le monde avec une autre dérive (points), hors du validateur. */
export function withDrift(w: WorldData, points: Partial<Record<WorldVar, number>>): WorldData {
  return { ...w, engine: { ...w.engine, drift: delta(points) } };
}

/** Le monde avec des pentes forgées `[id, cible, variable, comparateur, seuil en points]`, une lecture chacune, et sans autre lecture. */
export function withSlopes(
  w: WorldData, slopes: readonly (readonly [string, ArrivalWorldId, WorldVar, '>' | '<' | '>=' | '<=', number])[],
): WorldData {
  return {
    ...w,
    engine: {
      ...w.engine, neutralReadings: [],
      slopes: slopes.map(([id, to, variable, cmp, t]) => ({ id, to, readings: [{ var: variable, cmp, threshold: toMilli(t) }] })),
    },
  };
}

/** Un pas du matin de `stepWeek` depuis `start`, avec `echo` en tampon (borné par le moteur) ; rend le vecteur obtenu [GDD 03 §4, T-1a]. */
export function stepOnce(start: WorldVector, world: WorldData, echo: Delta): WorldVector {
  const state: WeekState = {
    ws: start, wsNoEcho: start, buffer: echo, stepsDone: 0, readings: {}, momentReading: null, lastAppliedEcho: {}, curve: [start],
  };
  return stepWeek(state, world, core, { kind: 'morning', day: 2 }, at(2, MORNING_MINUTE)).ws;
}

/** `n` pas sans écho (dérive clampée, puis couplages séquentiels à l'échelle du monde) ; les décisions [C1, C2, C3, C4] de chaque pas [GDD 03 T-1b]. */
export function firedSteps(start: WorldVector, world: WorldData, n: number): readonly (readonly boolean[])[] {
  let v = start;
  const out: (readonly boolean[])[] = [];
  for (let i = 0; i < n; i++) {
    const traced = applyCouplingsTraced(clampVector(addDelta(v, world.engine.drift)), core.engine.couplings, 'sequential', world.engine.couplingScale100);
    v = traced.v;
    out.push(traced.fired);
  }
  return out;
}
