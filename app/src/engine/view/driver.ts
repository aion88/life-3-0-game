/**
 * Le pilote de la rue : SEUL écrivain entre l'écran et le moteur [plan 02a T10 ; plan 02b rév. 4].
 * Un acte suit toujours le même chemin : `reduceAct` le calcule, et s'il est accepté, `sink.appendAct` l'enregistre, puis l'état en mémoire change.
 * Un acte refusé n'écrit rien. Pur : ni DOM, ni horloge murale, ni hasard (les dés sont `ctx.dice`).
 */
import type { Palier } from '../../survival/integrity';
import type { ActRecord } from '../../shared/types/street';
import type { CalendarHook, WeekState } from '../week';
import type { BilanInput } from '../../shared/types/bilan';
import { toBilanInput } from '../moments/bilan';
import { confirm as engineConfirm, designate as engineDesignate } from '../moments/choices';
import { activityOf, advance, type ActivityInput, type ClockState } from '../moments/clock';
import { EMPTY_GAZE, gazeRange, stepGaze, type GazeTracker } from '../moments/gaze';
import { presentAt } from '../moments/npcs';
import { replay } from '../moments/replay';
import { reduceAct } from '../moments/state';
import type { PriceLine, Rejected, StreetContext, StreetState, Vec2 } from '../moments/types';
import { PLAYER_BODY_ID } from './crowd';
import { aimOf, aimVector } from './gaze';
import { gradeUniforms, lightStateAt, stepBlend, type GradeUniforms, type LightBlend } from './grade';
import { choicesToPresent, resolveClick, type HitInfo, type PresentView, type Resolution } from './interactions';
import type { SceneData } from './sceneSchema';

/** Le puits d'écriture : `SaveStore` (plan 00) le satisfait structurellement. `appendAct` est synchrone et ne lève pas. */
export interface ActSink { appendAct(act: ActRecord): void; persistent(): boolean }
/** Le quartier, côté pilote : la voiture grise suit `presentAt` au crochet `morning` [R-02a.14]. */
export interface DistrictSink { setVisible(id: 'greyCar', visible: boolean): void }
export interface DriverDeps {
  readonly ctx: StreetContext; readonly sink: ActSink; readonly savedActs: readonly ActRecord[]; readonly scene: SceneData;
  readonly district?: DistrictSink;
}
export type DriverEvent =
  | { readonly type: 'hook'; readonly hook: CalendarHook }
  | { readonly type: 'glance'; readonly nacelleId: string }
  | { readonly type: 'rejected'; readonly rejected: Rejected }
  | { readonly type: 'unsaved' };
/** `live` : l'horloge de la session, jamais écrite. */
export interface ViewSnapshot { readonly street: StreetState; readonly week: WeekState; readonly live: ClockState }
export type ActResult = { readonly ok: true } | { readonly ok: false; readonly rejected: Rejected };
export type DesignateResult =
  | { readonly ok: true; readonly price: PriceLine | null }
  | { readonly ok: false; readonly reason: 'unknownChoice' | 'unavailable' };

export interface StreetDriver {
  state(): ViewSnapshot;
  tick(dtMs: number, input: ActivityInput, player: Vec2, passers: readonly { id: string; pos: Vec2 }[]):
    { readonly aims: ReadonlyMap<string, Vec2 | null>; readonly events: readonly DriverEvent[] };
  act(record: ActRecord): ActResult;
  /** Désigne une option (en mémoire, rien d'écrit). `optionId` nul : efface la désignation. Un id inconnu ne touche à rien. */
  designate(choiceId: string, optionId: string | null): DesignateResult;
  confirm(): ActResult | null;
  /** Vide et rend les événements en attente sans faire avancer l'horloge : l'écran s'en sert avant de naviguer vers le bilan [R-02a.20 g]. */
  drain(): readonly DriverEvent[];
  /** Un jalon (`pendingChoices`) n'est jamais désigné : l'acte `choice` passe directement par `reduceAct`. */
  choose(jalonId: string, option: string): ActResult;
  sleep(): ActResult;
  /** Avance l'horloge de SÉANCE jusqu'à `minute` (jamais en arrière, plafonnée à `dayEndMinute`). N'écrit aucun acte. */
  skipTo(minute: number): void;
  /** Seul geste d'une option narrative : l'équivalent de `designate` puis `confirm` en un appel (aucun prix à dire). Écrit l'acte `scene` (sceneId, optionId) à la minute de séance, par le seul chemin `apply`. */
  scene(sceneId: string, optionId: string): ActResult;
  /** Un clic : la résolution de `resolveClick`, et l'acte qu'elle demande posé à la minute de session. */
  click(hit: HitInfo, player: Vec2): { readonly resolution: Resolution; readonly acted: ActResult | null };
  /** Les choix à présenter ici, lus sur l'horloge de SESSION : le moteur ne date l'état qu'aux actes, une attente seule ne ferait jamais venir un jalon. */
  present(player: Vec2, view?: PresentView): readonly string[];
  /** Étalonnage du moment : fondu de lumière courant, monde courant, monde au départ (`ws0`) et écart d'arrivée. */
  grade(): GradeUniforms;
  finishDay(): BilanInput | null;
}

const COURTESY: Palier = 'courtesy';

export function createDriver(deps: DriverDeps): StreetDriver {
  const { sink, scene } = deps;
  const hooksBuffer: CalendarHook[] = [];
  const baseHook = deps.ctx.onHook;
  const ctx: StreetContext = { ...deps.ctx, onHook: (h) => { hooksBuffer.push(h); baseHook?.(h); } };

  // Le rejeu se fait sur le contexte d'origine : les crochets passés ne sont pas des événements de cette session.
  const resumed = replay(deps.savedActs, deps.ctx);
  const ws0 = replay([], deps.ctx).week.ws;
  const outcome = deps.ctx.run.outcome;
  const arrivalOffset = outcome.kind === 'arrival' ? outcome.offset : { axes: [] };   // l'extinction n'a pas d'écart d'arrivée
  let street: StreetState = resumed.state;
  let week: WeekState = resumed.week;
  let live: ClockState = { clock: street.clock, carry: 0 };
  let events: DriverEvent[] = resumed.rejected.map((rejected) => ({ type: 'rejected', rejected }));
  let wasPersistent = true;

  const nacelles = scene.nacelles.map((n, i) => ({
    id: n.id, pos: { x: n.x.v, z: deps.ctx.street.gaze.nacelleZ[i]! } as Vec2, rest: { x: n.restAim.v.x, z: n.restAim.v.z } as Vec2,
  }));
  let tracker: GazeTracker = trackerFrom(street);
  let blend: LightBlend = (() => { const s = lightStateAt(live.clock.minute, street.flags.slept === true, scene.light); return { from: s, to: s, t: 1 }; })();

  const palierOf = (s: StreetState): Palier => s.readings.at(-1)?.palier ?? COURTESY;
  const showGreyCar = (s: StreetState): void => deps.district?.setVisible('greyCar', presentAt('greyCar', s.day, s.clock.minute, palierOf(s), ctx.street));
  showGreyCar(street);

  function trackerFrom(s: StreetState): GazeTracker {
    const counted: Record<string, boolean> = {};
    for (const a of s.acts) if (a.kind === 'glance' && a.day === s.day) counted[a.id] = true;
    return { inside: EMPTY_GAZE.inside, counted };
  }

  /** LE chemin d'écriture : réduire, puis enregistrer si et seulement si accepté, puis avancer l'état. */
  function apply(a: ActRecord): ActResult {
    hooksBuffer.length = 0;
    const r = reduceAct(street, week, a, ctx);
    if ('reason' in r) { hooksBuffer.length = 0; events.push({ type: 'rejected', rejected: r }); return { ok: false, rejected: r }; }
    sink.appendAct(a);
    const newDay = r.state.day !== street.day;
    street = r.state; week = r.week;
    if (newDay) { tracker = trackerFrom(street); live = { clock: street.clock, carry: 0 }; }
    else if (street.clock.minute > live.clock.minute) live = { clock: street.clock, carry: 0 };
    for (const hook of hooksBuffer.splice(0)) {
      events.push({ type: 'hook', hook });
      if (hook.kind === 'morning') showGreyCar(street);
    }
    if (!sink.persistent() && wasPersistent) { wasPersistent = false; events.push({ type: 'unsaved' }); }
    return { ok: true };
  }

  const posed = (kind: string, id: string, option: string | null): ActRecord => ({ day: live.clock.day, minute: live.clock.minute, kind, id, option });

  return {
    state: () => ({ street, week, live }),

    tick(dtMs, input, player, passers) {
      const dt = Math.min(dtMs, scene.walk.maxDtMs.v);
      live = advance(live, dt, activityOf(street, input), ctx.street);
      blend = stepBlend(blend, lightStateAt(live.clock.minute, street.flags.slept === true, scene.light), dt, scene.light.blendMs.v);
      const range = gazeRange(palierOf(street), ctx.street);
      const targets = [...passers, { id: PLAYER_BODY_ID, pos: player }];
      const aims = new Map<string, Vec2 | null>();
      const gazers = nacelles.map((n) => {
        const target = aimOf(n, targets, range);
        aims.set(n.id, target === null ? null : target.pos);
        return { id: n.id, pos: n.pos, aim: aimVector(n.pos, target, n.rest) };
      });
      if (street.ended === null) {
        const g = stepGaze(tracker, { dtMs: dt, player, nacelles: gazers, rangeM: range }, ctx.street);
        tracker = g.tracker;
        if (g.glanced !== null && apply(posed('glance', g.glanced, null)).ok) events.push({ type: 'glance', nacelleId: g.glanced });
      }
      const out = events; events = [];
      return { aims, events: out };
    },

    act: (record) => apply(record),

    designate(choiceId, optionId) {
      if (optionId === null) {
        if (street.designated !== null) street = { ...street, phase: 'idle', designated: null };
        return { ok: true, price: null };
      }
      if (!ctx.street.choices.some((c) => c.id === choiceId)) return { ok: false, reason: 'unknownChoice' };
      try {
        const d = engineDesignate(street, ctx, choiceId, optionId);
        street = d.state;
        return { ok: true, price: d.price };
      } catch {
        return { ok: false, reason: 'unavailable' };        // option inconnue, choix fermé ou pas ouvert ce jour : le moteur lève, l'écran ne doit pas
      }
    },

    confirm() {
      const c = engineConfirm(street, ctx, live.clock);
      if (c.act === null) return null;                      // l'état rendu par `confirm` est ignoré : seul `reduceAct` l'applique, une fois
      const r = apply(c.act);
      // `reduceAct` referme le panneau sur un acte `choice` mais pas sur un acte `lane` : le choix est confirmé, rien n'est plus désigné.
      if (r.ok && street.phase === 'designated') street = { ...street, phase: 'idle', designated: null };
      return r;
    },

    drain() { const out = events; events = []; return out; },

    choose: (jalonId, option) => apply(posed('choice', jalonId, option)),
    sleep: () => apply(posed('sleep', 'night', null)),
    scene: (sceneId, optionId) => apply(posed('scene', sceneId, optionId)),

    skipTo(minute) {
      const m = Math.min(Math.max(live.clock.minute, minute), ctx.street.clock.dayEndMinute);
      live = { clock: { day: live.clock.day, minute: m }, carry: 0 };
      const target = lightStateAt(m, street.flags.slept === true, scene.light);
      blend = { from: target, to: target, t: 1 };
    },

    click(hit, player) {
      const resolution = resolveClick(hit, player, street, ctx, scene);
      const acted = resolution.type === 'act' ? apply(posed(resolution.kind, resolution.id, resolution.option)) : null;
      return { resolution, acted };
    },

    present: (player, view) => choicesToPresent({ ...street, clock: live.clock }, player, ctx, scene, view),

    grade: () => gradeUniforms({ light: blend, ws: week.ws, ws0, offset: arrivalOffset }, scene.grade),

    finishDay: () => (street.ended !== null ? toBilanInput(street, week, ctx) : null),
  };
}
