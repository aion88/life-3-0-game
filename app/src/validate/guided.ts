/**
 * Preuve des chaînes de la rue guidée [spec rue guidée J1-J2 §11.3, T4] : parcourt TOUTES les suites de choix des journées guidées,
 * pose leurs actes synthétiques (mêmes minutes que le metteur en scène, `engine/moments/schedule.ts`, aux deux bornes de la porte du
 * contrôle, voir plus bas), les plie par `marksOf`, et nomme ce qui casse : un jour sans maillon, une chaîne qui ne s'ouvre pas, une
 * variante absente, un mode de parole inatteignable, etc.
 * Pur : tout ce qui vient d'ailleurs que `street` (id du monde, clés de texte, questionnaire, mots du jour) est injecté par `GuidedRef`.
 *
 * Parcours : jour par jour depuis `days[d].first`, chaque option suivie (`narrative` : ses `next` ; `priced` : toutes les options du
 * choix s'il est ouvert, sa seule branche `ifUnavailable` (ou la nuit) sinon, règle du moteur [N7] : un jalon est dû par `jalonDue`, son
 * `requires` compris ; `late` : dans la preuve, branche ajoutée à la branche à l'heure). Le sur-ensemble ne peut que produire des issues
 * en trop, jamais en manquer ; `route` : chaque branche, écartée ensuite si elle contredit les marques).
 * Minutes [N7, revue T13 I-1] : la voie comply ou courtesy dure `comply` porte ouverte, `closedGate` porte fermée, et la porte vient de la
 * jauge, que la preuve ne porte pas. Chaque jour après le J1 a donc deux horloges ; chaque lecture de l'heure (`late`, `atMinute` d'un jalon)
 * se fait sur les deux, et un chemin où elles divergent se sépare en deux, chacun marqué de l'état de la porte où il vaut (`GuidedPath.gates`).
 * Hors de la preuve : les voies du contrôle fermées par l'état (bons, composant, palier) et la patrouille tirée au dé.
 * Les issues de jauge (libéré, arrêté, recruté) ne sont pas prouvées non plus : la preuve ne porte pas la jauge, et ce sont les archétypes
 * bloquants de `tests/unit/guided/guided_b1_week_test.ts` qui les portent.
 * Jours de montage [plan semaine condensée, T4, décision 6] : la preuve ne suit que `montage.picks[m]` hors des étapes présentées
 * (`asks`) et toutes les options de celles-ci, pour chacune des trois postures `m`. C'est un sur-ensemble des postures : la posture
 * réelle d'un jour de montage vient des mots du dernier jour joué, que la projection ne porte pas, donc les trois sont suivies sur
 * chaque jour de montage, combinaisons irréelles comprises (m-7). Un sur-ensemble ne peut qu'ajouter des issues ; une issue qui ne vient
 * que d'une combinaison irréelle se classe à part au rapport, elle n'est ni masquée ni corrigée en données sans ruling.
 * `guided.stageCount`, `guided.noLinkOnDay` et `guided.modeUnreachable` ne valent que pour les jours joués.
 * L'état porté d'un jour au suivant est, en mémoire `'marks'`, l'ensemble des variantes de maillons franchis ; en mémoire
 * `'projection'` (la preuve, et `pathsOf` au-delà du J2), seul ce qu'un jour plus tard lit (`projectionOf`, décision 1 du plan
 * J3-J7). Le jour suivant n'est relancé qu'une fois par état distinct.
 */
import {
  NIGHT, isLinkedBeat, modesOf, type ChainLink, type ChainSpec, type GuidedData, type MontageSpec, type SceneSpec, type SpeechModeId,
} from '../data/schema/guided';
import type { StreetData } from '../data/schema/street';
import type { WorldData } from '../data/load';
import { linksOfDay, marksOf, openedChains, type Mark } from '../engine/moments/marks';
import {
  CHECKPOINT_LANE, JALON_OPTION, ROUTE_OTHERWISE, enterStep, lateEntry, leaveStep, nightActs, nominalLaneMinutes, pendingTransits, routeNext,
  type StepLocation,
} from '../engine/moments/schedule';
import type { StreetContext } from '../engine/moments/types';
import { jalonDue } from '../engine/moments/choices';
import { buildLedger } from '../engine/moments/words';
import type { Issue } from '../shared/types/common';
import type { ActRecord, DayIndex } from '../shared/types/street';
import type { ContentInput, ValidationReport } from './content';

export type { SpeechModeId };
export interface GuidedProof {
  readonly paths: number; readonly perDayMin: Readonly<Record<number, number>>; readonly opened: readonly string[]; readonly completeMin: number;
  /** Modes atteints par au moins un chemin, par jour. */
  readonly modes: Readonly<Record<number, readonly SpeechModeId[]>>;
  /** Chemins d'un jour visités (contrôlés), tous jours : le coût de la preuve, déterministe (plafond de la semaine : 20 000, T13). */
  readonly visits: number;
}
/** Mémoire de la mise en commun : `'marks'` = toutes les variantes franchies (exacte, explose au-delà de quelques jours) ; `'projection'` = `projectionOf`. */
export type GuidedMemo = 'marks' | 'projection';
/** Ce que la preuve lit hors de `street` : injecté, jamais `w10` ni un fichier lu dans le code de la preuve. */
export interface GuidedRef {
  readonly worldId: string; readonly hasKey: (k: string) => boolean; readonly questionKeys: ReadonlySet<string>;
  /** Mots dits le jour `day` par les actes d'un chemin : `buildLedger(day, acts, ctx).wordsSpent` en vrai (choix à prix et scènes compris), une somme simple dans les fixtures. */
  readonly wordsOfDay: (day: DayIndex, acts: readonly ActRecord[]) => number;
  /** Fins du bilan du monde (`bilan.fate.ends`) : `ending.outcomes` n'en nomme pas d'autre. Absent : contrôle non fait (fixtures). */
  readonly endIds?: ReadonlySet<string>;
}
/** État de la porte du contrôle un jour donné (`gateClosed` du moteur, posé au crochet du matin par la jauge). */
export type GateState = 'open' | 'closed';
export interface GuidedPath {
  readonly key: string;
  /** Actes du chemin, minutes porte ouverte chaque jour (voie comply ou courtesy : `minutes.comply`). */
  readonly acts: readonly ActRecord[];
  /** Les mêmes actes, minutes porte fermée chaque jour où elle peut l'être (`minutes.closedGate` ; le J1, identiques à `acts`) [N7]. */
  readonly closedGateActs: readonly ActRecord[];
  /** Jours où le chemin ne vaut que pour un état de la porte : une lecture de l'heure y sépare les deux horloges [N7]. */
  readonly gates: Readonly<Record<number, GateState>>;
}

/** Les actes du chemin rejoué avec la porte fermée les jours `closedDays` et ouverte ailleurs : ceux que le moteur posera [N7]. */
export function actsForGates(p: GuidedPath, closedDays: ReadonlySet<number>): readonly ActRecord[] {
  return p.acts.map((a, i) => (closedDays.has(a.day) ? p.closedGateActs[i]! : a));
}

const MODES: readonly SpeechModeId[] = ['muet', 'couloir', 'bavard'];
/** Nombre de scènes (`stage` distincts consécutifs) d'un jour hors `late` [décision 11]. */
const MIN_STAGES = 3;
const MAX_STAGES = 5;
/** Chaînes complètes exigées sur chaque chemin le jour où la semaine est écrite [spec §11.3]. */
const MIN_COMPLETE_CHAINS = 3;
const WEEK_LAST_DAY = 7;
const ABSENT = 'absent';
const RESEARCH_PREFIX = 'research/';
/** Marque d'une étape sans acte posé (choix indisponible) dans la clé d'un chemin. */
const UNAVAILABLE = '-';
/** Mémoire `'marks'` : au-delà de ce nombre d'états distincts après un jour, elle lève (décision 2 du plan J3-J7). */
export const MARKS_MEMO_MAX_STATES = 2000;

// --- parcours d'un jour ----------------------------------------------------------------------------------------------------------------

/** Une branche de route suivie par un chemin du jour : la scène et la branche (variante de `next`, ou `ROUTE_OTHERWISE`). */
interface RouteTaken { readonly scene: SceneSpec; readonly branch: string }
/** Les deux horloges d'un jour : porte du contrôle ouverte, porte fermée (voie comply ou courtesy : `comply` ou `closedGate` minutes). */
interface Clocks { readonly open: number; readonly closed: number }
/** Une étape quittée par un chemin : id de scène, option (narratif, à prix), branche (route), `null` (sans question, choix fermé). */
type Played = readonly [string, string | null];
interface DayPath {
  readonly acts: readonly ActRecord[]; readonly closedActs: readonly ActRecord[]; readonly gate: GateState | null;
  readonly key: string; readonly stages: readonly string[]; readonly late: boolean; readonly routes: readonly RouteTaken[];
  /** Jour de montage : la posture suivie ; jour joué : `null`. */
  readonly posture: SpeechModeId | null;
  readonly played: readonly Played[];
  /** Étapes cachées d'un jour de montage atteintes sans `picks[posture]` (toutes leurs options sont alors suivies). */
  readonly uncovered: readonly string[];
}
interface Cursor {
  readonly t: Clocks; readonly location: StepLocation; readonly acts: readonly ActRecord[]; readonly closedActs: readonly ActRecord[];
  /** `null` : le chemin vaut porte ouverte (`acts`) comme porte fermée (`closedActs`) ; sinon le seul état de la porte où il vaut. */
  readonly gate: GateState | null;
  readonly key: readonly string[]; readonly stages: readonly string[]; readonly late: boolean; readonly seen: ReadonlySet<string>; readonly routes: readonly RouteTaken[];
  readonly played: readonly Played[]; readonly uncovered: readonly string[];
}

const sceneById = (g: GuidedData, id: string): SceneSpec => {
  const s = g.scenes.find((x) => x.id === id);
  if (s === undefined) throw new Error(`guided : scène inconnue « ${id} »`);
  return s;
};

/** Options d'un choix à prix : celles du moteur, ou l'option unique d'un jalon. */
function pricedOptions(street: StreetData, choiceId: string): readonly string[] {
  const c = street.choices.find((x) => x.id === choiceId);
  if (c !== undefined) return c.options.map((o) => o.id);
  return street.jalons.some((j) => j.id === choiceId) ? [JALON_OPTION] : [];
}

/**
 * Le choix à prix `choiceId` est ouvert quand l'étape se présente au point `c` du chemin : la règle du moteur (`availableOptions`,
 * `engine/moments/choices.ts`) sur ce qu'un chemin porte [N7, revue T13 I-2 et I-4]. Jalon : `jalonDue` (jour, `atMinute`, `waitsFor`
 * contre le lieu après les transits de l'étape, `requires` contre les choix confirmés du jour). Autre choix : ses jours. Les voies du
 * contrôle fermées par l'état (bons, composant, palier) n'y sont pas : elles viennent de la jauge et du stock, que la preuve ne porte pas.
 */
function pricedOpen(street: StreetData, day: DayIndex, choiceId: string, c: { readonly minute: number; readonly location: StepLocation; readonly acts: readonly ActRecord[] }): boolean {
  const j = street.jalons.find((x) => x.id === choiceId);
  if (j === undefined) return street.choices.find((x) => x.id === choiceId)?.days.includes(day) ?? false;
  const picked = picksOf({ acts: c.acts });   // les actes du jour seulement : `confirmed` se lit au jour courant (`closeKey`)
  return jalonDue(j, { day, minute: c.minute, location: c.location, picked: (id) => picked[id] });
}

/** L'acte du moteur pour l'option `option` du choix à prix `choiceId` : `lane checkpoint` au poste de contrôle, `choice` ailleurs (jalon compris). */
function pricedAct(day: DayIndex, minute: number, choiceId: string, option: string): ActRecord {
  return choiceId.startsWith(`${CHECKPOINT_LANE}.`)
    ? { day, minute, kind: 'lane', id: CHECKPOINT_LANE, option }
    : { day, minute, kind: 'choice', id: choiceId, option };
}

/**
 * Tous les chemins d'un jour, de `days[d].first` à `NIGHT`. `superset` : la branche `late` est ajoutée à la branche à l'heure (preuve).
 * Deux horloges [N7, revue T13 I-1] : la porte du contrôle peut être fermée tout jour après le J1 (`gateClosed` naît au crochet du matin,
 * `state.ts` ; le J1 s'ouvre sans crochet), et la preuve ne connaît pas la jauge. Chaque acte est posé aux deux minutes (`acts`, `closedActs`).
 * Toute lecture de l'heure (entrée `late`, `atMinute` d'un jalon) se fait sur les deux : si elles divergent, le chemin se sépare en deux
 * chemins d'une seule horloge, chacun marqué de l'état de la porte où il vaut (`gate`). En `superset`, l'entrée `late` prend déjà ses deux branches.
 */
function walkDay(street: StreetData, g: GuidedData, day: DayIndex, superset: boolean, posture: SpeechModeId | null = null): readonly DayPath[] {
  const spec = g.days.find((d) => d.day === day)!;
  const first = spec.first;
  const montage = posture === null ? null : spec.montage ?? null;
  /** Options suivies à l'étape `s` : toutes sur un jour joué ou une étape présentée ; sinon l'option de la posture (décision 6). */
  const restrict = (s: SceneSpec, options: readonly string[], c: Cursor): { readonly options: readonly string[]; readonly c: Cursor } => {
    if (montage === null || posture === null || montage.asks.includes(s.id)) return { options, c };
    const pick = montage.picks[posture][s.id];
    if (pick === undefined) return { options, c: { ...c, uncovered: [...c.uncovered, s.id] } };
    return { options: options.filter((o) => o === pick), c };
  };
  const canClose = day > 1;
  const end = street.clock.dayEndMinute;
  const out: DayPath[] = [];
  /** L'acte `make(minute)` posé aux deux horloges. */
  const post = (c: Cursor, make: (minute: number) => ActRecord): Cursor => ({ ...c, acts: [...c.acts, make(c.t.open)], closedActs: [...c.closedActs, make(c.t.closed)] });
  /** Le chemin réduit à l'horloge de `gate` : les deux suites d'actes deviennent la sienne. */
  const only = (c: Cursor, gate: GateState): Cursor => {
    const acts = gate === 'open' ? c.acts : c.closedActs;
    const m = gate === 'open' ? c.t.open : c.t.closed;
    return { ...c, gate, acts, closedActs: acts, t: { open: m, closed: m } };
  };
  /** Minutes d'une voie aux deux horloges : la porte du chemin si elle est fixée, sinon ouverte et fermée (fermée impossible au J1). */
  const laneAfter = (c: Cursor, o: string): Clocks => {
    const closed = (track: GateState): boolean => (c.gate ?? track) === 'closed' && canClose;
    return { open: Math.min(c.t.open + nominalLaneMinutes(street, o, closed('open')), end), closed: Math.min(c.t.closed + nominalLaneMinutes(street, o, closed('closed')), end) };
  };
  const transitActs = (s: SceneSpec, c: Cursor): Cursor => {
    const t = pendingTransits(s, c.location);
    let at = c;
    for (const x of t.transits) at = post(at, (minute) => ({ day, minute, kind: x.kind, id: x.id, option: null }));
    return { ...at, location: t.location };
  };
  const go = (next: string, c: Cursor): void => {
    if (next === NIGHT) {
      const o = nightActs(street, day, c.t.open, c.location);
      const k = nightActs(street, day, c.t.closed, c.location);
      out.push({
        acts: [...c.acts, ...o], closedActs: [...c.closedActs, ...k], gate: c.gate, key: c.key.join('>'), stages: c.stages, late: c.late, routes: c.routes,
        posture, played: c.played, uncovered: c.uncovered,
      });
      return;
    }
    if (c.seen.has(next)) throw new Error(`guided : boucle de scènes au jour ${day} (${[...c.seen, next].join(' -> ')})`);
    const s = sceneById(g, next);
    const at = transitActs(s, { ...c, seen: new Set([...c.seen, next]) });
    const eo = enterStep(g, next, at.t.open);
    const ec = enterStep(g, next, at.t.closed);
    type Entry = { readonly sceneId: string; readonly lateLineKey: string | null; readonly t: Clocks; readonly from: Cursor };
    const entries: Entry[] = [];
    if (superset && s.late !== null) {   // les deux branches, chacune aux deux horloges, dans l'ordre de l'horloge porte ouverte
      const onTime: Entry = { sceneId: next, lateLineKey: null, t: { open: Math.max(at.t.open, s.anchorMinute), closed: Math.max(at.t.closed, s.anchorMinute) }, from: at };
      const lo = lateEntry(g, s, onTime.t.open), lc = lateEntry(g, s, onTime.t.closed);
      const late: Entry = { sceneId: lo.sceneId, lateLineKey: lo.lateLineKey, t: { open: lo.minute, closed: lc.minute }, from: at };
      entries.push(...(eo.lateLineKey === null ? [onTime, late] : [late, onTime]));
    } else if ((eo.lateLineKey === null) === (ec.lateLineKey === null)) {
      entries.push({ sceneId: eo.sceneId, lateLineKey: eo.lateLineKey, t: { open: eo.minute, closed: ec.minute }, from: at });
    } else {   // l'heure d'entrée sépare les bornes : un chemin par état de la porte
      entries.push({ sceneId: eo.sceneId, lateLineKey: eo.lateLineKey, t: { open: eo.minute, closed: eo.minute }, from: only(at, 'open') });
      entries.push({ sceneId: ec.sceneId, lateLineKey: ec.lateLineKey, t: { open: ec.minute, closed: ec.minute }, from: only(at, 'closed') });
    }
    for (const e of entries) {
      if (e.lateLineKey === null) { play(s, { ...e.from, t: e.t }); continue; }
      const ls = sceneById(g, e.sceneId);
      const lc = transitActs(ls, { ...e.from, t: e.t, key: [...e.from.key, `${next}@late`], late: true, seen: new Set([...e.from.seen, ls.id]) });
      play(ls, lc);
    }
  };
  const play = (s: SceneSpec, c: Cursor): void => {
    const here: Cursor = { ...c, stages: [...c.stages, s.stage] };
    const leave = (option: string | null, after: Clocks, make: ((minute: number) => ActRecord) | null, label: string, from: Cursor = here): void => {
      const lo = leaveStep(g, s.id, option, after.open);
      const lc = leaveStep(g, s.id, option, after.closed);
      const posted = make === null ? from : post(from, make);
      go(lo.next, { ...posted, t: { open: lo.minute, closed: lc.minute }, key: [...from.key, label], played: [...from.played, [s.id, option]] });
    };
    const a = s.ask;
    if (a.kind === 'none') { leave(null, c.t, null, s.id); return; }
    if (a.kind === 'narrative') {
      const r = restrict(s, a.options.map((o) => o.id), here);
      for (const o of r.options) leave(o, c.t, (minute) => ({ day, minute, kind: 'scene', id: s.id, option: o }), `${s.id}=${o}`, r.c);
      return;
    }
    if (a.kind === 'route') {   // toutes les branches ; `enumerate` écarte celles que les marques du chemin contredisent (décision 3)
      for (const b of [...Object.keys(a.next).filter((k) => k !== ROUTE_OTHERWISE), ROUTE_OTHERWISE]) {
        leave(b, c.t, null, `${s.id}~${b}`, { ...here, routes: [...here.routes, { scene: s, branch: b }] });
      }
      return;
    }
    const offer = (h: Cursor, open: boolean): void => {
      if (!open) { leave(null, h.t, null, `${a.choiceId}=${UNAVAILABLE}`, h); return; }   // fermé : `ifUnavailable`, sinon la nuit
      const lane = a.choiceId.startsWith(`${CHECKPOINT_LANE}.`);
      const r = restrict(s, pricedOptions(street, a.choiceId), h);
      for (const o of r.options) leave(o, lane ? laneAfter(r.c, o) : r.c.t, (minute) => pricedAct(day, minute, a.choiceId, o), `${a.choiceId}=${o}`, r.c);
    };
    const oo = pricedOpen(street, day, a.choiceId, { minute: c.t.open, location: c.location, acts: c.acts });
    const oc = pricedOpen(street, day, a.choiceId, { minute: c.t.closed, location: c.location, acts: c.closedActs });
    if (oo === oc) { offer(here, oo); return; }
    offer(only(here, 'open'), oo);   // l'heure d'un jalon sépare les bornes : un chemin par état de la porte
    offer(only(here, 'closed'), oc);
  };
  go(first, {
    t: { open: street.clock.dayStartMinute, closed: street.clock.dayStartMinute }, location: 'home', acts: [], closedActs: [], gate: null,
    key: posture === null ? [] : [`@${posture}`], stages: [], late: false, seen: new Set(), routes: [], played: [], uncovered: [],
  });
  return out;
}

/** Le `MontageSpec` du jour `day`, `null` sur un jour joué. */
const montageOf = (g: GuidedData, day: DayIndex): MontageSpec | null => g.days.find((d) => d.day === day)?.montage ?? null;

/** Chemins d'un jour : un jour joué tel quel ; un jour de montage une fois par posture (sur-ensemble des postures, m-7), clé `@posture`. */
function dayPathsOf(street: StreetData, g: GuidedData, day: DayIndex, superset: boolean): readonly DayPath[] {
  return montageOf(g, day) === null ? walkDay(street, g, day, superset) : MODES.flatMap((m) => walkDay(street, g, day, superset, m));
}

/** Une boucle de scènes, quelle qu'elle soit (le schéma n'en laisse passer qu'entre ancres égales), ou `null`. */
/** Scènes suivantes possibles de `s`, toutes branches, entrée `late` comprise, nuit exclue. */
function successors(s: SceneSpec): readonly string[] {
  const a = s.ask;
  const out = a.kind === 'none' ? [a.next] : a.kind === 'narrative' ? a.options.map((o) => o.next) : a.kind === 'route' ? [...Object.values(a.next), a.otherwise] : [...Object.values(a.next), ...(a.ifUnavailable === null ? [] : [a.ifUnavailable])];
  if (s.late !== null) out.push(s.late.next);
  return out.filter((x) => x !== NIGHT);
}

/** `target` est atteignable depuis la scène `from` par le graphe des scènes (toutes branches), sans passer la nuit. */
function reaches(g: GuidedData, from: string, target: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === target) return true;
    if (id === NIGHT || seen.has(id)) continue;
    seen.add(id);
    const s = g.scenes.find((x) => x.id === id);
    if (s !== undefined) stack.push(...successors(s));
  }
  return false;
}

/** Scène qui suit l'option `option` de l'étape `s` (narratif : sa suite ; à prix : `next`, sinon `ifUnavailable`, sinon la nuit). */
function nextOf(s: SceneSpec, option: string): string {
  const a = s.ask;
  if (a.kind === 'narrative') return a.options.find((o) => o.id === option)?.next ?? NIGHT;
  if (a.kind === 'priced') return a.next[option] ?? a.ifUnavailable ?? NIGHT;
  if (a.kind === 'route') return a.next[option] ?? a.otherwise;
  return a.next;
}

function sceneCycle(g: GuidedData): readonly string[] | null {
  const succ = successors;
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string, stack: readonly string[]): readonly string[] | null => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'open') return [...stack.slice(stack.indexOf(id)), id];
    const s = g.scenes.find((x) => x.id === id);
    if (s === undefined) return null;
    state.set(id, 'open');
    for (const n of succ(s)) { const c = visit(n, [...stack, id]); if (c !== null) return c; }
    state.set(id, 'done');
    return null;
  };
  for (const s of g.scenes) { const c = visit(s.id, []); if (c !== null) return c; }
  return null;
}

// --- parcours de la semaine, mémoire par état de maillons ou par projection ------------------------------------------------------------

interface DayVisit { readonly day: DayIndex; readonly path: DayPath; readonly acts: readonly ActRecord[]; readonly marks: readonly Mark[]; readonly last: boolean; readonly key: string }

const crossed = (marks: readonly Mark[]): string => marks.filter((m) => m.variant !== ABSENT).map((m) => `${m.chainId}.${m.linkId}=${m.variant}`).sort().join(',');

/** Ce qu'une projection lit des données, par jour : calculé une fois par bloc `guided`. */
interface ProjectionPlan { readonly routeRead: readonly string[]; readonly lastLinks: readonly string[]; readonly nightFroms: readonly string[] }
const PLANS = new WeakMap<GuidedData, Map<number, ProjectionPlan>>();

function projectionPlan(g: GuidedData, afterDay: DayIndex): ProjectionPlan {
  const byDay = PLANS.get(g) ?? new Map<number, ProjectionPlan>();
  PLANS.set(g, byDay);
  const hit = byDay.get(afterDay);
  if (hit !== undefined) return hit;
  const links = new Map(g.chains.flatMap((c) => c.links.map((l) => [l.id, l] as const)));
  // (b) maillons lus par une route d'un jour plus tard, et pour un maillon de nuit son `from`, récursivement
  const read = new Set<string>();
  const addRead = (id: string): void => {
    if (read.has(id)) return;
    read.add(id);
    const l = links.get(id);
    if (l?.at.kind === 'night') addRead(l.at.from);
  };
  for (const s of g.scenes) if (s.day > afterDay && s.ask.kind === 'route') addRead(s.ask.link);
  // (d) `from` de chaque maillon de nuit d'un jour plus tard (daté après `afterDay`)
  const froms = new Set<string>();
  for (const c of g.chains) for (const l of c.links) if (l.at.kind === 'night' && l.day > afterDay) froms.add(l.at.from);
  const plan: ProjectionPlan = { routeRead: [...read].sort(), lastLinks: g.chains.map((c) => c.links.at(-1)!.id), nightFroms: [...froms].sort() };
  byDay.set(afterDay, plan);
  return plan;
}

/**
 * Projection d'un chemin complet après le jour `afterDay` (décision 1 du plan J3-J7) : la clé de mémoire de `'projection'`. Deux
 * chemins de même projection ont mêmes suites et mêmes issues (issues de la preuve : chaînes ouvertes, refus ; PAS les issues de jauge) : (a) les chaînes ouvertes ; (b) la variante de chaque maillon lu par une
 * route d'un jour plus tard (et, pour un maillon de nuit, celle de son `from`, récursivement) ; (c) la variante de chaque dernier
 * maillon (seule sa présence est lue, `lastLinkReached` ; la variante est un sur-ensemble) ; (d) la présence de chaque `from` d'un
 * maillon de nuit daté après `afterDay`. Les répliques S1 n'y entrent pas (elles ne changent ni un chemin ni un contrôle).
 * Exportée pour le test d'exactitude (`validate_guided_week_test.ts`).
 */
export function projectionOf(g: GuidedData, marks: readonly Mark[], afterDay: DayIndex): string {
  const plan = projectionPlan(g, afterDay);
  const byLink = new Map(marks.map((m) => [m.linkId, m] as const));
  const parts = [`open:${[...openedChains(marks)].sort().join(',')}`];   // (a)
  for (const id of plan.routeRead) { const m = byLink.get(id); if (m !== undefined) parts.push(`read:${id}=${m.variant}`); }   // (b)
  for (const id of plan.lastLinks) { const m = byLink.get(id); if (m !== undefined) parts.push(`last:${id}=${m.variant}`); }   // (c)
  for (const id of plan.nightFroms) { const m = byLink.get(id); if (m !== undefined) parts.push(`from:${id}=${m.variant === ABSENT ? 0 : 1}`); }   // (d)
  return parts.join(';');
}

const extend = (p: GuidedPath, day: DayIndex, path: DayPath): GuidedPath => ({
  key: p.key === '' ? `j${day}:${path.key}` : `${p.key} | j${day}:${path.key}`, acts: [...p.acts, ...path.acts], closedGateActs: [...p.closedGateActs, ...path.closedActs],
  gates: path.gate === null ? p.gates : { ...p.gates, [day]: path.gate },
});

/** Marques d'un chemin complet à la fin du jour `day` (maillons de nuit du jour compris). */
const marksAfter = (street: StreetData, g: GuidedData, acts: readonly ActRecord[], day: DayIndex): readonly Mark[] =>
  marksOf(acts, { day: (day + 1) as DayIndex }, g, street.clock);

/** Chaque branche de route du chemin du jour vaut celle que `routeNext` lit dans `marks` (décision 3 : celle du metteur en scène). */
const routesHold = (path: DayPath, marks: readonly Mark[]): boolean => path.routes.every((r) => routeNext(r.scene, marks).branch === r.branch);

/**
 * Parcourt les jours guidés jusqu'à `throughDay`, appelle `visit` sur chaque chemin de chaque jour (avant mise en commun) et rend les
 * chemins complets : un par état distinct (`memo`) et par chemin du dernier jour. Un chemin du jour dont une branche de route contredit
 * les marques du chemin complet est écarté (ni visité, ni gardé). `cover` : un chemin d'un jour écarté par la mise en commun est tout
 * de même mené au bout, une seule fois, par le premier chemin de chaque jour suivant cohérent avec SES marques (aucun choix d'un jour
 * ne disparaît de `pathsOf` ; borné par la somme des chemins de chaque jour, pas par leur produit). Les chemins couverts ne sont pas visités.
 * `'marks'` lève au-delà de `MARKS_MEMO_MAX_STATES` états d'un jour.
 */
function enumerate(street: StreetData, throughDay: DayIndex, superset: boolean, cover: boolean, memo: GuidedMemo, visit: (v: DayVisit) => void): readonly GuidedPath[] {
  const g = street.guided;
  if (g === null) return [];
  const days = g.days.map((d) => d.day).filter((d) => d <= throughDay).sort((a, b) => a - b);
  let states: readonly GuidedPath[] = [{ key: '', acts: [], closedGateActs: [], gates: {} }];
  let covered: GuidedPath[] = [];
  const finals: GuidedPath[] = [];
  days.forEach((day, i) => {
    const last = i === days.length - 1;
    const dayPaths = dayPathsOf(street, g, day, superset);
    const prolong = (p: GuidedPath): GuidedPath | null => {
      for (const path of dayPaths) {
        const q = extend(p, day, path);
        if (path.routes.length === 0 || routesHold(path, marksAfter(street, g, q.acts, day))) return q;
      }
      return null;
    };
    covered = covered.flatMap((p) => { const q = prolong(p); return q === null ? [] : [q]; });   // écartés les jours d'avant
    const next = new Map<string, GuidedPath>();
    for (const st of states) for (const path of dayPaths) {
      const p = extend(st, day, path);
      const marks = marksAfter(street, g, p.acts, day);
      if (!routesHold(path, marks)) continue;
      visit({ day, path, acts: p.acts, marks, last, key: p.key });
      if (last) { finals.push(p); continue; }
      const k = memo === 'marks' ? crossed(marks) : projectionOf(g, marks, day);
      if (!next.has(k)) {
        if (memo === 'marks' && next.size >= MARKS_MEMO_MAX_STATES) {
          throw new Error(`guided : mémoire 'marks' : plus de ${MARKS_MEMO_MAX_STATES} états après le jour ${day} (explosion, prendre 'projection')`);
        }
        next.set(k, p);
      } else if (cover) covered.push(p);
    }
    states = [...next.values()];
  });
  return [...finals, ...covered];
}

/**
 * Les chemins du parcours, chacun avec ses actes synthétiques COMPLETS et valides pour le moteur (transits, `lane`, `choice`, `scene`,
 * `sleep`, aux minutes que T7 poserait : `late` pris seulement quand l'heure le dit ; une route, la branche que ses marques donnent).
 * Un chemin par état distinct (`memo`) et par suite du dernier jour, plus chaque chemin d'un jour écarté par la mise en commun, mené au
 * bout par le premier chemin cohérent des jours suivants (le chemin que `pathOf` cherche). Utilisé par T5, T6, T11.
 * `memo` : par défaut `'marks'` jusqu'au J2 (épingles du plan J1-J2), `'projection'` au-delà (décision 2 du plan J3-J7).
 * Lève sur une boucle de scènes, et en `'marks'` au-delà de `MARKS_MEMO_MAX_STATES` états d'un jour. Les minutes d'une voie du poste de
 * contrôle sont celles de `nominalLaneMinutes`, porte ouverte dans `acts` et porte fermée dans `closedGateActs` (`actsForGates` choisit par
 * jour) : la patrouille tirée au dé n'y est pas.
 */
export function pathsOf(street: StreetData, throughDay: DayIndex, memo: GuidedMemo = throughDay <= 2 ? 'marks' : 'projection'): readonly GuidedPath[] {
  return enumerate(street, throughDay, false, true, memo, () => undefined);
}

/** Choix de chaque étape d'un chemin, par id d'étape ou de choix (`checkpoint.jN` pour la voie) : crochet de concordance T4 / T7 [ruling]. */
export function picksOf(p: { readonly acts: readonly ActRecord[] }): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const a of p.acts) {
    if (a.option === null) continue;
    if (a.kind === 'scene' || a.kind === 'choice') out[a.id] = a.option;
    if (a.kind === 'lane' && a.id === CHECKPOINT_LANE) out[`${CHECKPOINT_LANE}.j${a.day}`] = a.option;
  }
  return out;
}

// --- contrôles ------------------------------------------------------------------------------------------------------------------------

/** Options qu'un maillon doit couvrir d'une variante. */
function linkOptions(link: ChainLink, chain: ChainSpec, g: GuidedData, street: StreetData): readonly string[] {
  const at = link.at;
  switch (at.kind) {
    case 'scene': { const a = g.scenes.find((s) => s.id === at.id)?.ask; return a?.kind === 'narrative' ? a.options.map((o) => o.id) : []; }
    case 'choice': case 'lane': return pricedOptions(street, at.id);
    case 'night': { const from = chain.links.find((l) => l.id === at.from); return from === undefined ? [] : linkOptions(from, chain, g, street); }
  }
}

/** Clés de texte du bloc `guided`, chacune avec l'endroit qui la lit. */
function textKeys(g: GuidedData): readonly (readonly [string, string])[] {
  const out: [string, string][] = [];
  const add = (key: string | null, where: string): void => { if (key !== null) out.push([key, where]); };
  g.days.forEach((d) => add(d.goalKey, `days.${d.day}.goalKey`));
  for (const s of g.scenes) {
    const p = `scenes.${s.id}`;
    s.beats.forEach((b, i) => {
      if (!isLinkedBeat(b)) { add(b.key, `${p}.beats.${i}`); return; }
      Object.entries(b.byLink.keys).forEach(([k, key]) => add(key, `${p}.beats.${i}.byLink.keys.${k}`));
      add(b.byLink.otherwise, `${p}.beats.${i}.byLink.otherwise`);
    });
    if (s.actor !== null) { add(s.actor.nameKey, `${p}.actor.nameKey`); add(s.actor.actionKey, `${p}.actor.actionKey`); }
    if (s.late !== null) add(s.late.lineKey, `${p}.late.lineKey`);
    if (s.ask.kind === 'narrative') {
      add(s.ask.promptKey, `${p}.ask.promptKey`);
      for (const o of s.ask.options) { add(o.labelKey, `${p}.ask.options.${o.id}.labelKey`); add(o.replyKey, `${p}.ask.options.${o.id}.replyKey`); }
    }
  }
  for (const c of g.chains) {
    const p = `chains.${c.id}`;
    add(c.titleKey, `${p}.titleKey`); add(c.fact.key, `${p}.fact.key`); add(c.fact.sourceKey, `${p}.fact.sourceKey`);
    for (const [k, v] of Object.entries(c.question.linkKeys)) add(v, `${p}.question.linkKeys.${k}`);
    for (const l of c.links) for (const [name, v] of [[ABSENT, l.absent] as const, ...Object.entries(l.variants)]) {
      const q = `${p}.links.${l.id}.${name}`;
      add(v.recapKey, `${q}.recapKey`); add(v.personKey, `${q}.personKey`); add(v.saidKey, `${q}.saidKey`); add(v.nameKey, `${q}.nameKey`);
    }
  }
  if (g.endOfDemo !== null) { add(g.endOfDemo.titleKey, 'endOfDemo.titleKey'); add(g.endOfDemo.lineKey, 'endOfDemo.lineKey'); }
  if (g.ending !== null) {
    for (const [endId, o] of Object.entries(g.ending.outcomes)) {
      add(o.regimeKey, `ending.outcomes.${endId}.regimeKey`);
      for (const [n, key] of Object.entries(o.narratorKeys)) add(key, `ending.outcomes.${endId}.narratorKeys.${n}`);
    }
    add(g.ending.arrestedNightKey, 'ending.arrestedNightKey'); add(g.ending.weekButtonKey, 'ending.weekButtonKey');
  }
  return out;
}

/** Minute où l'acte d'un maillon tombe dans son jour (règle de `parseGuided`) : un maillon de nuit au matin (-1) ; `null` si aucune scène ne le porte. */
function linkMinute(g: GuidedData, l: ChainLink): number | null {
  const at = l.at;
  if (at.kind === 'night') return -1;
  if (at.kind === 'scene') return g.scenes.find((s) => s.id === at.id)?.anchorMinute ?? null;
  return g.scenes.find((s) => s.day === l.day && s.ask.kind === 'priced' && s.ask.choiceId === at.id)?.anchorMinute ?? null;
}

/**
 * S1 (réplique) et S2 (route) : le maillon lu existe, est antérieur à la scène (jour d'avant, ou même jour et minute d'ancrage plus tôt),
 * chaque clé est une de ses options, et aucune clé de route ne vaut `ROUTE_OTHERWISE` (elle serait masquée par `otherwise`). Double
 * contrôle, au niveau du contenu, de celui de `parseGuided` : la preuve suit les routes, une lecture fautive y fausserait les chemins.
 */
function linkRefIssues(street: StreetData, g: GuidedData, issue: (code: string, path: string, owner: string, message: string) => Issue): Issue[] {
  const out: Issue[] = [];
  const links = new Map(g.chains.flatMap((c) => c.links.map((l) => [l.id, { l, c }] as const)));
  const check = (s: SceneSpec, where: string, linkId: string, keys: readonly string[], route: boolean): void => {
    const path = `street.guided.scenes.${s.id}.${where}`;
    const hit = links.get(linkId);
    if (hit === undefined) { out.push(issue('guided.linkRef', path, 'narrative-director', `scène ${s.id} : maillon ${linkId} inconnu`)); return; }
    const earlier = hit.l.day < s.day || (hit.l.day === s.day && (linkMinute(g, hit.l) ?? Number.POSITIVE_INFINITY) < s.anchorMinute);
    if (!earlier) out.push(issue('guided.linkRef', path, 'narrative-director', `scène ${s.id} : le maillon ${linkId} (jour ${hit.l.day}) n'est pas antérieur (jour ${s.day}, minute ${s.anchorMinute})`));
    const options = linkOptions(hit.l, hit.c, g, street);
    for (const k of keys) {
      if (route && k === ROUTE_OTHERWISE) out.push(issue('guided.linkRef', `${path}.next.${k}`, 'narrative-director', `scène ${s.id} : la branche « ${k} » est masquée par otherwise`));
      else if (!options.includes(k)) out.push(issue('guided.linkRef', `${path}.${k}`, 'narrative-director', `scène ${s.id} : « ${k} » n'est pas une option du maillon ${linkId} (${options.join(', ') || 'aucune'})`));
    }
  };
  for (const s of g.scenes) {
    s.beats.forEach((b, i) => { if (isLinkedBeat(b)) check(s, `beats.${i}.byLink`, b.byLink.link, Object.keys(b.byLink.keys), false); });
    if (s.ask.kind === 'route') check(s, 'ask', s.ask.link, Object.keys(s.ask.next), true);
  }
  return out;
}

function staticIssues(street: StreetData, g: GuidedData, ref: GuidedRef, issue: (code: string, path: string, owner: string, message: string) => Issue): Issue[] {
  const out: Issue[] = [];
  const ids = new Set(g.chains.map((c) => c.id));
  for (const c of g.chains) {
    const p = `street.guided.chains.${c.id}`;
    for (const l of c.links) for (const o of linkOptions(l, c, g, street)) {
      if (l.variants[o] === undefined) out.push(issue('guided.variantMissing', `${p}.links.${l.id}.variants.${o}`, 'narrative-director', `maillon ${l.id} : l'option « ${o} » n'a pas de variante, la chaîne casse sur cette suite`));
    }
    const unknown = c.crosses.filter((x) => !ids.has(x));
    for (const x of unknown) out.push(issue('guided.crossMissing', `${p}.crosses.${x}`, 'narrative-director', `chaîne ${c.id} : croise « ${x} », qui n'est pas une chaîne`));
    if (unknown.length === 0 && !c.crosses.some((x) => ids.has(x))) out.push(issue('guided.crossMissing', `${p}.crosses`, 'narrative-director', `chaîne ${c.id} : ne croise aucune chaîne existante`));
    if (!ref.questionKeys.has(c.question.key)) out.push(issue('guided.questionUnknown', `${p}.question.key`, 'narrative-director', `chaîne ${c.id} : la question « ${c.question.key} » n'est pas au questionnaire`));
    const src = c.fact.source.trim();
    if (!(src.startsWith(`bible ${ref.worldId} §`) || src.startsWith(RESEARCH_PREFIX))) {
      out.push(issue('guided.factUnsourced', `${p}.fact.source`, 'world-builder', `chaîne ${c.id} : source « ${c.fact.source} » ni « bible ${ref.worldId} § » ni « ${RESEARCH_PREFIX} »`));
    }
  }
  out.push(...linkRefIssues(street, g, issue));
  if (g.ending !== null && ref.endIds !== undefined) {
    for (const endId of Object.keys(g.ending.outcomes)) {
      if (!ref.endIds.has(endId)) out.push(issue('guided.endingUnknown', `street.guided.ending.outcomes.${endId}`, 'narrative-director', `fin « ${endId} » absente des fins du bilan (${[...ref.endIds].join(', ')})`));
    }
  }
  const seen = new Set<string>();
  for (const [key, where] of textKeys(g)) {
    if (seen.has(key) || ref.hasKey(key)) continue;
    seen.add(key);
    out.push({ code: 'guided.keyMissing', file: 'strings/fr.json', path: key, owner: 'writer', message: `clé absente, lue par street.guided.${where}` });
  }
  return out;
}

/**
 * `guided.montagePostureWords` (B-3, R-1) : pour chaque jour de montage et chaque posture `m`, les mots du chemin de référence égalent
 * `montage.expectedWords[m]` (sommes épinglées, jamais la bande `speechModes` : le muet guidé du J3 en sort par construction, bible l.510).
 * Chemin de référence : `picks[m]`, `cardDefaults[m]` aux étapes présentées, chaque route S2 du jour en `otherwise`, à l'heure (comme
 * `playOf` avec les archétypes épinglés). Les autres branches de route ne sont pas comparées (`guided.montageUncovered` les couvre).
 */
function postureWordsIssues(street: StreetData, g: GuidedData, ref: GuidedRef, issue: (code: string, path: string, owner: string, message: string) => Issue): Issue[] {
  const out: Issue[] = [];
  for (const d of g.days) {
    const spec = d.montage ?? null;   // `?? null` : un bloc construit à la main (tests) peut ne pas porter le défaut du schéma
    if (spec === null) continue;
    for (const m of MODES) {
      const isRef = (p: DayPath): boolean => !p.late && p.routes.every((r) => r.branch === ROUTE_OTHERWISE)
        && p.played.every(([id, o]) => !spec.asks.includes(id) || spec.cardDefaults[m][id] === undefined || spec.cardDefaults[m][id] === o);
      const refs = walkDay(street, g, d.day, false, m).filter(isRef);
      const path = `street.guided.days.${d.day}.montage.expectedWords.${m}`;
      if (refs.length === 0) { out.push(issue('guided.montagePostureWords', path, 'game-designer', `jour ${d.day}, posture ${m} : aucun chemin de référence (picks, cardDefaults, routes en otherwise)`)); continue; }
      const bad = refs.map((p) => ({ p, w: ref.wordsOfDay(d.day, p.acts) })).filter((x) => x.w !== spec.expectedWords[m]);
      if (bad.length > 0) {
        out.push(issue('guided.montagePostureWords', path, 'game-designer', `jour ${d.day}, posture ${m} : ${bad[0]!.w} mots sur le chemin de référence, ${spec.expectedWords[m]} épinglés (${bad[0]!.p.key})`));
      }
    }
  }
  return out;
}

/** Semaine condensée : un jour de montage, ou un fait placé. `?? null` : un bloc construit à la main (tests) peut ne pas porter les défauts. */
const condensed = (g: GuidedData): boolean => g.days.some((d) => (d.montage ?? null) !== null) || g.chains.some((c) => (c.fact.shownOn ?? null) !== null);

/**
 * `guided.factPlacement` (décision 9) : dès qu'un jour est de montage ou qu'un fait a sa place, chaque fait est montré exactement une
 * fois, sur un écran qui existe : le relevé d'un jour joué qui en a un (pas le dimanche, décision 10), ou la carte d'un jour de montage.
 */
function factPlacementIssues(g: GuidedData, issue: (code: string, path: string, owner: string, message: string) => Issue): Issue[] {
  if (!condensed(g)) return [];
  const out: Issue[] = [];
  for (const c of g.chains) {
    const so = c.fact.shownOn ?? null;
    const path = `street.guided.chains.${c.id}.fact.shownOn`;
    if (so === null) { out.push(issue('guided.factPlacement', path, 'narrative-director', `chaîne ${c.id} : fait sans place, il serait montré à chaque relevé`)); continue; }
    const d = g.days.find((x) => x.day === so.day);
    const exists = d !== undefined && (so.on === 'card' ? (d.montage ?? null) !== null : (d.montage ?? null) === null && so.day !== WEEK_LAST_DAY);
    if (!exists) out.push(issue('guided.factPlacement', path, 'narrative-director', `chaîne ${c.id} : ${so.on} du jour ${so.day}, écran qui n'existe pas`));
  }
  return out;
}

const lastLinkReached = (c: ChainSpec, marks: readonly Mark[]): boolean => {
  const last = c.links.at(-1)!;
  return marks.some((m) => m.chainId === c.id && m.linkId === last.id && m.variant !== ABSENT);
};

/**
 * Prouve les chaînes sur toutes les suites de choix jusqu'à `throughDay` ; `mustOpen` : chaînes ouvertes sur chaque chemin.
 * `memo` : `'projection'` par défaut ; `'marks'` (mémoire complète) n'est là que pour le test d'exactitude de la projection.
 */
export function proveGuided(
  street: StreetData, opts: { readonly throughDay: DayIndex; readonly mustOpen: readonly string[]; readonly memo?: GuidedMemo }, ref: GuidedRef,
): { readonly proof: GuidedProof; readonly issues: readonly Issue[] } {
  const file = `worlds/${ref.worldId}.json`;
  const issue = (code: string, path: string, owner: string, message: string): Issue => ({ code, file, path, owner, message });
  const empty: GuidedProof = { paths: 0, perDayMin: {}, opened: [], completeMin: 0, modes: {}, visits: 0 };
  const g = street.guided;
  if (g === null) return { proof: empty, issues: [] };
  const issues = staticIssues(street, g, ref, issue);
  const cycle = sceneCycle(g);
  if (cycle !== null) {
    issues.push(issue('guided.sceneCycle', `street.guided.scenes.${cycle[0]}`, 'narrative-director', `boucle de scènes (le schéma ne la laisse passer qu'entre ancres égales) : ${cycle.join(' -> ')}`));
    return { proof: empty, issues };
  }

  issues.push(...postureWordsIssues(street, g, ref, issue), ...factPlacementIssues(g, issue));
  if (opts.throughDay === WEEK_LAST_DAY && condensed(g)) {   // semaine condensée : chaînes finies à l'audition [plan semaine condensée, T4]
    for (const c of g.chains) {
      const lastLink = c.links.at(-1)!;
      if (c.lastDay !== WEEK_LAST_DAY || lastLink.day !== WEEK_LAST_DAY) {
        issues.push(issue('guided.chainEndsEarly', `street.guided.chains.${c.id}.lastDay`, 'narrative-director', `chaîne ${c.id} : finit le jour ${c.lastDay} (dernier maillon ${lastLink.id}, jour ${lastLink.day}), pas à l'audition (jour ${WEEK_LAST_DAY})`));
      }
    }
  }
  const once = new Set<string>();
  const report = (tag: string, code: string, path: string, owner: string, message: string): void => {
    if (once.has(tag)) return;
    once.add(tag);
    issues.push(issue(code, path, owner, message));
  };
  const perDayMin: Record<number, number> = {};
  const modes = new Map<number, Set<SpeechModeId>>();
  let opened: readonly string[] | null = null;
  let completeMin = Number.POSITIVE_INFINITY;
  let visits = 0;
  /**
   * Jour de montage : `guided.montageUncovered` (étape cachée atteinte sans `picks[m]`) et `guided.askNotReached` (B-4) : la première
   * étape présentée est exigée sur tout chemin de chaque posture ; une suivante, seulement si l'option prise à la précédente y mène (graphe
   * des scènes). Une étape présentée dont le choix est fermé (`ifUnavailable`) compte comme non atteinte : la carte n'aurait pas de choix.
   * Une issue par étape et par état de la porte (`gate`, les deux horloges, R-5).
   */
  const montageVisit = (v: DayVisit, spec: MontageSpec): void => {
    const m = v.path.posture!;
    for (const step of v.path.uncovered) {
      report(`uncovered.${v.day}.${m}.${step}`, 'guided.montageUncovered', `street.guided.days.${v.day}.montage.picks.${m}.${step}`, 'game-designer', `jour ${v.day}, posture ${m} : étape ${step} atteinte sans option jouée (${v.key})`);
    }
    const taken = new Map(v.path.played);
    spec.asks.forEach((id, i) => {
      const prev = i === 0 ? null : spec.asks[i - 1]!;
      const prevOption = prev === null ? null : taken.get(prev) ?? null;
      const required = prev === null || (prevOption !== null && reaches(g, nextOf(sceneById(g, prev), prevOption), id));
      if (!required || (taken.get(id) ?? null) !== null) return;
      const gate = v.path.gate ?? 'deux horloges';
      const after = prev === null ? 'première étape de la carte' : `après ${prev}=${prevOption}`;
      report(`ask.${v.day}.${id}.${gate}`, 'guided.askNotReached', `street.guided.days.${v.day}.montage.asks.${id}`, 'narrative-director', `jour ${v.day}, posture ${m} : ${id} non atteinte, ${after} (porte : ${gate}) (${v.key})`);
    });
  };

  const finals = enumerate(street, opts.throughDay, true, false, opts.memo ?? 'projection', (v) => {
    visits += 1;
    const spec = montageOf(g, v.day);
    const played = spec === null;
    const n = linksOfDay(v.day, v.marks).filter((m) => m.variant !== ABSENT).length;
    perDayMin[v.day] = Math.min(perDayMin[v.day] ?? n, n);
    if (played && n === 0) report(`link.${v.day}`, 'guided.noLinkOnDay', `street.guided.days.${v.day}`, 'narrative-director', `jour ${v.day} : un chemin sans maillon (${v.key})`);
    if (spec !== null) montageVisit(v, spec);
    const stages = v.path.stages.filter((s, i, all) => i === 0 || s !== all[i - 1]).length;
    if (played && !v.path.late && (stages < MIN_STAGES || stages > MAX_STAGES)) {
      report(`stage.${v.day}`, 'guided.stageCount', `street.guided.days.${v.day}`, 'narrative-director', `jour ${v.day} : ${stages} scènes, ${MIN_STAGES} à ${MAX_STAGES} attendues (${v.path.key})`);
    }
    const m = g.speechModes[v.day];
    if (m !== undefined && played) { const set = modes.get(v.day) ?? new Set<SpeechModeId>(); modesOf(m, ref.wordsOfDay(v.day, v.acts)).forEach((x) => set.add(x)); modes.set(v.day, set); }
    if (!v.last) return;
    const open = openedChains(v.marks);
    opened = opened === null ? open : opened.filter((c) => open.includes(c));
    for (const c of opts.mustOpen) if (!open.includes(c)) report(`open.${c}`, 'guided.chainNotOpened', `street.guided.chains.${c}`, 'narrative-director', `chaîne ${c} fermée sur un chemin (${v.key})`);
    let complete = 0;
    for (const c of g.chains) {
      if (lastLinkReached(c, v.marks)) { complete += 1; continue; }
      if (opts.throughDay >= c.lastDay) report(`complete.${c.id}`, 'guided.chainIncomplete', `street.guided.chains.${c.id}`, 'narrative-director', `chaîne ${c.id} : dernier maillon non atteint (${v.key})`);
    }
    completeMin = Math.min(completeMin, complete);
    if (opts.throughDay === WEEK_LAST_DAY && complete < MIN_COMPLETE_CHAINS) {
      report('fewComplete', 'guided.fewCompleteChains', 'street.guided.chains', 'narrative-director', `${complete} chaînes complètes sur un chemin, ${MIN_COMPLETE_CHAINS} attendues (${v.key})`);
    }
  });

  const modesOut: Record<number, readonly SpeechModeId[]> = {};
  for (const [day, set] of modes) {
    modesOut[day] = MODES.filter((x) => set.has(x));
    for (const x of MODES) if (!set.has(x)) issues.push(issue('guided.modeUnreachable', `street.guided.speechModes.${day}.${x}`, 'game-designer', `jour ${day} : aucun chemin n'atteint le mode ${x}`));
  }
  const order = g.chains.map((c) => c.id);
  const proof: GuidedProof = {
    paths: finals.length, perDayMin, modes: modesOut,
    opened: order.filter((c) => (opened ?? []).includes(c)),
    completeMin: finals.length === 0 ? 0 : completeMin,
    visits,
  };
  return { proof, issues };
}

// --- branchement au contenu -----------------------------------------------------------------------------------------------------------

/** Référence de la preuve lue dans l'entrée : id du monde (celui qui porte `guided`, sinon le premier), clés de `fr.json`, clés du questionnaire, mots du jour par `buildLedger`. */
export function refOf(input: ContentInput, world?: WorldData): GuidedRef {
  const w = world ?? input.worlds.find((x) => x.street.guided !== null) ?? input.worlds[0];
  if (w === undefined) throw new Error('guided : aucun monde dans l\'entrée');
  // `buildLedger` ne lit que `world.survival` et `street` : la partie vécue et le dé n'entrent pas dans les mots du jour.
  const ctx = { street: w.street, world: w, core: input.core } as unknown as StreetContext;
  return {
    worldId: w.id,
    hasKey: (k) => (input.strings.fr[k] ?? '') !== '',
    questionKeys: new Set(input.core.questionnaire.questions.map((q) => q.key)),
    wordsOfDay: (day, acts) => buildLedger(day, acts, ctx).wordsSpent,
    endIds: new Set(Object.keys((w.bilan as { readonly fate?: { readonly ends?: Readonly<Record<string, string>> } }).fate?.ends ?? {})),
  };
}

/** Chaînes exigées ouvertes sur tout chemin quand la semaine est écrite jusqu'à `throughDay` : `opensBy`, sinon le jour du premier maillon, au plus `throughDay`. */
export function mustOpenOf(g: GuidedData, throughDay: DayIndex): readonly string[] {
  return g.chains.filter((c) => (c.opensBy ?? c.links[0]!.day) <= throughDay).map((c) => c.id);
}

/** Erreurs de la preuve pour chaque monde qui porte `guided` : jusqu'au dernier jour écrit, chaînes exigées par `mustOpenOf`. */
export function validateGuided(input: ContentInput): ValidationReport {
  const errors: Issue[] = [];
  for (const w of input.worlds) {
    const g = w.street.guided;
    if (g === null) continue;
    const throughDay = Math.max(...g.days.map((d) => d.day)) as DayIndex;
    const mustOpen = mustOpenOf(g, throughDay);
    errors.push(...proveGuided(w.street, { throughDay, mustOpen }, refOf(input, w)).issues);
  }
  return { errors, warnings: [] };
}
