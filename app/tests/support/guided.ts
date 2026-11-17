/**
 * Aides de test des journées guidées [plan rue guidée J1-J2, T1]. Les fabriques partent de `fixtures/guided/minimal.json`
 * (deux scènes du J1 et une chaîne) et rendent une copie profonde modifiée : le JSON de base n'est jamais muté.
 */
import minimalJson from '../fixtures/guided/minimal.json';
import weekMinJson from '../fixtures/guided/week-min.json';
import weekMontageJson from '../fixtures/guided/week-montage.json';
import directorWeekJson from '../fixtures/guided/director-week.json';
import { w10Raw } from '../fixtures/data/factories';
import { streetSchema, type StreetData } from '../../src/data/schema/street';
import { NIGHT, parseGuided, type GuidedData, type SceneSpec, type SpeechModeId } from '../../src/data/schema/guided';
import type { PalierId } from '../../src/data/schema/world';
import { replay } from '../../src/engine/moments/replay';
import {
  CHECKPOINT_LANE, JALON_OPTION, enterStep, leaveStep, nominalLaneMinutes, pendingTransits, routeNext, type StepLocation,
} from '../../src/engine/moments/schedule';
import { marksOf } from '../../src/engine/moments/marks';
import { actsForGates, mustOpenOf as mustOpenOfGuided, pathsOf, picksOf, type GuidedPath } from '../../src/validate/guided';
import type { ActRecord, DayIndex } from '../../src/shared/types/street';
import type { StreetContext, StreetState } from '../../src/engine/moments/types';
import { act, ctxW10, homeAt, withStreet } from './street';
import { makeSink, type TestSink } from './street_driver';
import { SCENE } from './street_walk';
import onboardingRaw from '../../src/street/data/w10.onboarding.json';
import { parseOnboarding, type Onboarding } from '../../src/street/onboarding';
import { createDriver, type StreetDriver } from '../../src/engine/view/driver';
import { createDirector, type Beat, type Director } from '../../src/street/guided/director';
import type { Rejected } from '../../src/engine/moments/types';

type Raw = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON brut, la validité est ce que le test éprouve

/** Le bloc `street` brut de w10, sans `guided` : la base des fabriques, qui posent leur propre `guided` (`minimal.json`). */
export const w10WithoutGuided: Raw = Object.fromEntries(Object.entries(w10Raw.street as Raw).filter(([k]) => k !== 'guided'));

/** Parse un bloc `street` brut par le chargeur réel. */
export function parseStreetOf(rawStreet: unknown): StreetData {
  return streetSchema.parse(rawStreet);
}

/** Le `street` de w10, tel que `parseGuided` le reçoit en second argument. */
export const w10Street: Omit<StreetData, 'guided'> = parseStreetOf(w10WithoutGuided);

const base = (): Raw => structuredClone(minimalJson) as Raw;
const sceneOf = (g: Raw, id: string): Raw => g.scenes.find((s: Raw) => s.id === id);

/** Remplace le `ask` de la première scène ; `patch` surcharge d'autres champs de cette scène (par exemple `{ day: 1 }`). */
export function withAsk(ask: unknown, patch: Raw = {}): Raw {
  const g = base();
  Object.assign(g.scenes[0], patch, { ask });
  return g;
}
/** Fait pointer le `next` de la première scène sur `next`. */
export function withNext(next: string): Raw {
  return withAsk({ kind: 'none', next });
}
/** Pose l'heure d'ancrage de la première scène. */
export function withAnchor(anchorMinute: number): Raw {
  const g = base();
  g.scenes[0].anchorMinute = anchorMinute;
  return g;
}
/** Remplace le dernier maillon de la première chaîne : `link` surcharge ses champs. */
export function withNightLink(link: Raw): Raw {
  const g = base();
  Object.assign(g.chains[0].links.at(-1), link);
  return g;
}
/** Rend le choix narratif de `j1.roux` avec `n` options (mots 8, 5, 0 en boucle). */
export function withNarrativeOptions(n: number): Raw {
  const g = base();
  const ask = sceneOf(g, 'j1.roux').ask;
  const words = [8, 5, 0, 3];
  ask.options = Array.from({ length: n }, (_, i) => ({ id: `o${i}`, labelKey: `w10.scene.j1.roux.o${i}`, words: words[i % 4], next: 'night', replyKey: null }));
  return g;
}
/** Pose les mots des options de `j1.roux`, dans l'ordre. */
export function withNarrativeWords(words: readonly number[]): Raw {
  const g = base();
  const ask = sceneOf(g, 'j1.roux').ask;
  ask.options = words.map((w, i) => ({ id: `o${i}`, labelKey: `w10.scene.j1.roux.o${i}`, words: w, next: 'night', replyKey: null }));
  return g;
}
/** Remplace `speechModes`. */
export function withSpeechModes(speechModes: unknown): Raw {
  const g = base();
  g.speechModes = speechModes;
  return g;
}

/** Contexte de rue de w10 dont le bloc `street` porte `minimal.json` comme `guided` [plan rue guidée J1-J2, T2]. */
export const ctxGuided: StreetContext = ctxW10(withStreet((d) => { (d as { guided: unknown }).guided = parseGuided(base(), w10Street); }));
/** Le même contexte sans `guided` (bloc `street` de w10, `guided` retiré). */
export const ctxNoGuided: StreetContext = ctxW10(withStreet((d) => { (d as { guided: unknown }).guided = null; }));

/** Un acte `scene` : `id` = scène, `option` = option narrative choisie. */
export function sceneAct(day: DayIndex, minute: number, id: string, option: string): ActRecord {
  return act(day, minute, 'scene', id, option);
}
/** Au logement le jour `day` à `minute`, aucun acte. */
export function stateAt(day: DayIndex, minute: number): StreetState {
  return homeAt(day, minute);
}

/** Les actes `scene` à 0 mot des scènes de `minimal.json` (seule `j1.roux` porte un choix narratif : option `c`, 0 mot). */
export const silentSceneActsJ1J2: readonly ActRecord[] = [sceneAct(1, 450, 'j1.roux', 'c')];

/** Insère `extra` dans `acts` sans changer l'ordre de `acts` : chaque acte ajouté passe après tout acte de (jour, minute) <= le sien. */
export function interleave(acts: readonly ActRecord[], extra: readonly ActRecord[]): ActRecord[] {
  const out = [...acts];
  for (const e of extra) {
    let i = out.length;
    while (i > 0 && (out[i - 1]!.day > e.day || (out[i - 1]!.day === e.day && out[i - 1]!.minute > e.minute))) i -= 1;
    out.splice(i, 0, e);
  }
  return out;
}

// --- T5 : chemins du contenu réel de w10 [plan rue guidée J1-J2, T5 ; un seul nom par geste pour T5, T6, T7, T11] ------------------

type Path = { readonly acts: readonly ActRecord[] };

/** Première option déclarée de chaque étape, par id d'étape (narratif) ou de choix (`checkpoint.jN` pour la voie), comme `picksOf`. */
function firstOptions(street: StreetData): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of street.guided?.scenes ?? []) {
    const a = s.ask;
    if (a.kind === 'narrative') out[s.id] = a.options[0]!.id;
    if (a.kind === 'priced') out[a.choiceId] = street.choices.find((c) => c.id === a.choiceId)?.options[0]?.id ?? JALON_OPTION;
  }
  return out;
}

/** Les branches de route (`<scène>~<branche>`) du segment de clé d'un jour. */
const routeTokens = (dayKey: string): readonly (readonly [string, string])[] =>
  dayKey.slice(dayKey.indexOf(':') + 1).split('>').flatMap((t) => { const i = t.indexOf('~'); return i < 0 ? [] : [[t.slice(0, i), t.slice(i + 1)] as const]; });

/** Chaque branche de route du chemin vaut celle que `routeNext` lit dans les marques du chemin à la fin du jour de la route (décision 3). */
export function routeConsistent(street: StreetData, p: { readonly key: string; readonly acts: readonly ActRecord[] }): boolean {
  const g = street.guided as GuidedData;
  return p.key.split(' | ').every((dayKey) => routeTokens(dayKey).every(([id, branch]) => {
    const s = g.scenes.find((x) => x.id === id)!;
    return routeNext(s, marksOf(p.acts, { day: (s.day + 1) as DayIndex }, g, street.clock)).branch === branch;
  }));
}

/**
 * Le chemin de `pathsOf(street, throughDay)` dont l'option vaut `picks[id]` à chaque étape ou choix nommé, et la première option déclarée
 * ailleurs autant que possible, que le moteur rejoue sans refus (`pathsOf` ne lit pas l'état : bons, composant, jalon dû). Chaque jour est
 * pris parmi les segments de ce jour dans `pathsOf` (un chemin écarté par la mise en commun n'y est mené au bout que par le premier chemin
 * cohérent des jours suivants), puis la suite est rejouée ; une route garde la branche que les marques de la suite donnent (une suite qui
 * la contredit est écartée). À écart égal, l'ordre de `pathsOf`. Lève si aucune suite n'est acceptée.
 */
export function pathOf(street: StreetData, picks: Readonly<Record<string, string>>, throughDay: DayIndex = 2): { readonly key: string; readonly acts: readonly ActRecord[] } {
  const first = firstOptions(street);
  const ctx = ctxW10(street);
  const all = pathsOf(street, throughDay);
  const days = (street.guided?.days ?? []).map((d) => d.day).filter((d) => d <= throughDay).sort((a, b) => a - b);
  const segments = days.map((day, i) => {
    const seen = new Map<string, { readonly key: string; readonly acts: readonly ActRecord[]; readonly off: number }>();
    for (const p of all) {
      const key = p.key.split(' | ')[i]!;
      if (seen.has(key)) continue;
      const acts = p.acts.filter((a) => a.day === day);
      const got = picksOf({ acts });
      if (!Object.entries(picks).every(([id, o]) => !(id in got) || got[id] === o)) continue;   // un choix nommé d'un autre jour est jugé à la fin
      seen.set(key, { key, acts, off: Object.entries(got).filter(([id, o]) => !(id in picks) && first[id] !== o).length });
    }
    return [...seen.values()].sort((a, b) => a.off - b.off);
  });
  const named = Object.keys(picks);
  const walk = (i: number, key: readonly string[], acts: readonly ActRecord[]): { readonly key: string; readonly acts: readonly ActRecord[] } | null => {
    if (i === segments.length) {
      const got = picksOf({ acts });
      return named.every((id) => got[id] === picks[id]) ? { key: key.join(' | '), acts } : null;
    }
    for (const seg of segments[i]!) {
      const next = [...acts, ...seg.acts];
      if (!routeConsistent(street, { key: seg.key, acts: next })) continue;
      if (replay(next, ctx).rejected.length > 0) continue;
      const done = walk(i + 1, [...key, seg.key], next);
      if (done !== null) return done;
    }
    return null;
  };
  const found = walk(0, [], []);
  if (found === null) throw new Error(`pathOf : aucun chemin accepté par le moteur pour ${JSON.stringify(picks)}`);
  return found;
}

/** Les couples (étape, option) d'un chemin, préfixés du jour : chaque jeton de sa clé (`j1.a=x`, `checkpoint.j1=comply`, `j2.wake~*`, `m1.scan=-`…). */
export function pairsOfPath(p: { readonly key: string }): readonly string[] {
  return p.key.split(' | ').flatMap((dayKey) => { const i = dayKey.indexOf(':'); const day = dayKey.slice(0, i); return dayKey.slice(i + 1).split('>').map((t) => `${day}:${t}`); });
}

/**
 * Sous-ensemble déterministe de `pathsOf(street, throughDay, 'projection')` (ordre de `pathsOf`, glouton) où chaque couple (étape, option),
 * chaque branche de route et chaque voie du contrôle paraît au moins une fois : un chemin est pris s'il apporte un jeton de clé neuf.
 * Pour les tests qui rejouent le MOTEUR sur la semaine (le parcours entier est de l'ordre de 10 000 chemins).
 */
export function pairCover(street: StreetData, throughDay: DayIndex): readonly GuidedPath[] {
  const seen = new Set<string>();
  const out: GuidedPath[] = [];
  for (const p of pathsOf(street, throughDay, 'projection')) {
    const fresh = pairsOfPath(p).filter((t) => !seen.has(t));
    if (fresh.length === 0) continue;
    fresh.forEach((t) => seen.add(t));
    out.push(p);
  }
  return out;
}

/** L'acte posé par l'étape `s` dans `acts` (jour de l'étape), ou `undefined` (choix indisponible, ou étape sans question). */
function actOfStep(s: SceneSpec, acts: readonly ActRecord[]): ActRecord | undefined {
  const a = s.ask;
  if (a.kind === 'none' || a.kind === 'route') return undefined;
  if (a.kind === 'narrative') return acts.find((x) => x.day === s.day && x.kind === 'scene' && x.id === s.id);
  if (a.choiceId.startsWith(`${CHECKPOINT_LANE}.`)) return acts.find((x) => x.day === s.day && x.kind === 'lane' && x.id === CHECKPOINT_LANE);
  return acts.find((x) => x.day === s.day && x.kind === 'choice' && x.id === a.choiceId);
}

/** Ids des étapes jouées, dans l'ordre : le chemin est refait par `schedule.ts` (mêmes minutes que la preuve), `late` compris. */
export function sceneIdsOf(p: Path, street: StreetData = ctxW10().street): readonly string[] {
  const g = street.guided as GuidedData;
  const out: string[] = [];
  for (const d of g.days) {
    if (!p.acts.some((a) => a.day === d.day)) continue;
    let minute = street.clock.dayStartMinute;
    let location: StepLocation = 'home';
    let next = d.first;
    while (next !== NIGHT) {
      const t = pendingTransits(g.scenes.find((s) => s.id === next)!, location);
      location = t.location;
      const e = enterStep(g, next, minute);
      const s = g.scenes.find((x) => x.id === e.sceneId)!;
      if (e.lateLineKey !== null) location = pendingTransits(s, location).location;
      minute = e.minute;
      out.push(s.id);
      const done = actOfStep(s, p.acts);
      const lane = s.ask.kind === 'priced' && s.ask.choiceId.startsWith(`${CHECKPOINT_LANE}.`);
      const after = done === undefined ? minute : Math.min(minute + (lane ? nominalLaneMinutes(street, done.option!) : 0), street.clock.dayEndMinute);
      const option = s.ask.kind === 'none' ? null : s.ask.kind === 'route' ? routeNext(s, marksOf(p.acts, { day: (s.day + 1) as DayIndex }, g, street.clock)).branch : done?.option ?? null;   // route : la branche que lisent les marques du chemin
      const l = leaveStep(g, s.id, option, after);
      next = l.next; minute = l.minute;
    }
  }
  return out;
}

/** Rejoue `acts` depuis le J1 ; lève si un acte est refusé. */
export function stateAfter(acts: readonly ActRecord[], ctx: StreetContext): StreetState {
  const r = replay(acts, ctx);
  if (r.rejected.length > 0) throw new Error(`stateAfter : actes refusés ${JSON.stringify(r.rejected)}`);
  return r.state;
}

/** Index du `sleep` du jour `day` dans les actes du chemin. */
function sleepIndex(p: Path, day: DayIndex): number {
  const i = p.acts.findIndex((a) => a.day === day && a.kind === 'sleep');
  if (i < 0) throw new Error(`chemin sans nuit au jour ${day}`);
  return i;
}

/** Rejeu jusqu'au dernier acte du jour `day` avant son `sleep`. */
export function stateAtEvening(p: Path, day: DayIndex, ctx: StreetContext): StreetState {
  return stateAfter(p.acts.slice(0, sleepIndex(p, day)), ctx);
}

function readingOf(p: Path, day: DayIndex, ctx: StreetContext) {
  const r = stateAfter(p.acts.slice(0, sleepIndex(p, day) + 1), ctx).readings.find((x) => x.day === day);
  if (r === undefined) throw new Error(`aucun relevé pour la nuit ${day}`);
  return r;
}

/** Intégrité (en points) après la nuit `day`. */
export function nightValue(p: Path, day: DayIndex, ctx: StreetContext): number {
  return readingOf(p, day, ctx).value / 1000;
}

/** Palier du relevé de la nuit `day`, celui du jour suivant. */
export function palierAfter(p: Path, day: DayIndex, ctx: StreetContext): PalierId {
  return readingOf(p, day, ctx).palier;
}

/** Même contexte, toute option narrative à 0 mot. */
export function withNarrativeWordsZero(ctx: StreetContext): StreetContext {
  const g = ctx.street.guided;
  if (g === null) return ctx;
  const scenes = g.scenes.map((s) => (s.ask.kind === 'narrative' ? { ...s, ask: { ...s.ask, options: s.ask.options.map((o) => ({ ...o, words: 0 })) } } : s));
  const street = { ...ctx.street, guided: { ...g, scenes } };
  return { ...ctx, street, world: { ...ctx.world, street } };
}

/** Même contexte, une consigne payée `value` points (`survival.orders.value`) ; 0 rend le moteur d'avant N8 sur la rue (aucun `obey` posé). */
export function withOrderValue(ctx: StreetContext, value: number): StreetContext {
  const survival = ctx.world.survival as unknown as { readonly orders: Raw };
  return { ...ctx, world: { ...ctx.world, survival: { ...survival, orders: { ...survival.orders, value } } as unknown as typeof ctx.world.survival } };
}

// --- T7 : le metteur en scène joué sur le pilote réel de w10 [plan rue guidée J1-J2, T7] -----------------------------------------------

/** Un metteur en scène monté sur un pilote réel, son puits mémoire et le journal des appels qu'IL fait au pilote (`calls` ; `trace` : avec les arguments, `designate("checkpoint.j2","comply")`). */
export interface DirectorRig { readonly dir: Director; readonly drv: StreetDriver; readonly sink: TestSink; readonly calls: string[]; readonly trace: string[] }

/** L'accueil de w10, lu par le chargeur réel. */
export const obW10: Onboarding = parseOnboarding(onboardingRaw, ctxW10().street);

/**
 * Pilote réel de w10 (`savedActs` rejoués) et metteur en scène branché sur un MANDATAIRE du pilote qui note chaque méthode appelée :
 * le `designate` du panneau, lui, passe par le pilote nu (`rig.drv`) et n'est pas noté.
 */
export function directorRig(savedActs: readonly ActRecord[] = [], ctx: StreetContext = ctxW10()): DirectorRig {
  const sink = makeSink();
  const drv = createDriver({ ctx, sink, savedActs, scene: SCENE });
  const calls: string[] = [];
  const trace: string[] = [];
  const spied = new Proxy(drv, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv) as unknown;
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        calls.push(String(prop)); trace.push(`${String(prop)}(${args.map((a) => JSON.stringify(a)).join(',')})`);
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { dir: createDirector(spied, ctx.street.guided as GuidedData, obW10, ctx), drv, sink, calls, trace };
}

/** Le metteur en scène d'une reprise : pilote neuf sur `acts` sauvegardés. */
export const driverFrom = (acts: readonly ActRecord[]): DirectorRig => directorRig(acts);

/** Les actes `rejected` que le pilote a notés (au rejeu ou depuis), vidés au passage. */
export const rejectedOf = (r: DirectorRig): readonly Rejected[] =>
  r.drv.drain().flatMap((e) => (e.type === 'rejected' ? [e.rejected] : []));

/** Clé de choix d'un temps `choice`, comme `picksOf` : id de la scène (narratif), id du choix ou du jalon (à prix). */
const pickKey = (b: Extract<Beat, { kind: 'choice' }>): string => b.view.id;

/**
 * Joue le choix courant : `picks[clé]` sinon la première option disponible ; un choix de `street.choices` passe par le `designate` du
 * panneau (pilote nu) puis `dir.choose`, comme le montage T14. Lève si le choix est refusé.
 */
export function chooseHere(r: DirectorRig, picks: Readonly<Record<string, string>> = {}): string {
  const b = r.dir.current();
  if (b.kind !== 'choice') throw new Error(`chooseHere : temps ${b.kind}, pas un choix`);
  const opt = picks[pickKey(b)] ?? b.view.options[0]!.id;
  if (b.priced) r.drv.designate(b.view.id, opt);
  const res = r.dir.choose(opt);
  if (!res.ok) throw new Error(`chooseHere : ${b.view.id}=${opt} refusé (${res.rejected.reason})`);
  return opt;
}

/** Un pas : un choix est joué (`picks`, sinon la première option), tout autre temps est passé. */
export function stepOnce(r: DirectorRig, picks: Readonly<Record<string, string>> = {}): void {
  if (r.dir.current().kind === 'choice') chooseHere(r, picks); else r.dir.advance();
}

/**
 * Les temps rencontrés jusqu'à ce que `stop` dise vrai sur le temps courant (non compris), jusqu'à `demoEnd` (non compris) ou jusqu'à
 * `end` (compris : la fin de semaine est un temps montré). Borné.
 */
export function playPath(r: DirectorRig, picks: Readonly<Record<string, string>>, stop: (b: Beat, r: DirectorRig) => boolean = () => false): Beat[] {
  const seen: Beat[] = [];
  for (let i = 0; i < 2000; i++) {
    const b = r.dir.current();
    if (stop(b, r) || b.kind === 'demoEnd') return seen;
    seen.push(b);
    if (b.kind === 'end') return seen;
    stepOnce(r, picks);
  }
  throw new Error('playPath : plus de 2000 temps');
}

/** Les `n` premiers temps, en passant chacun (un choix arrête la lecture). */
export function beats(r: DirectorRig, n: number): Beat[] {
  const out: Beat[] = [];
  while (out.length < n) {
    const b = r.dir.current();
    out.push(b);
    if (b.kind === 'choice' || b.kind === 'demoEnd') break;
    r.dir.advance();
  }
  return out;
}

/** Joue le chemin par défaut jusqu'au choix de la scène `sceneId` (courant au retour). */
export function playUntil(r: DirectorRig, sceneId: string, picks: Readonly<Record<string, string>> = {}): Beat[] {
  const seen = playPath(r, picks, (b) => b.kind === 'choice' && b.sceneId === sceneId);
  if (r.dir.current().kind !== 'choice') throw new Error(`playUntil : ${sceneId} jamais présentée`);
  return seen;
}

/** Joue jusqu'au choix de `sceneId`, choisit `option`, rend les actes écrits. */
export function playUntilChoice(r: DirectorRig, sceneId: string, option: string): readonly ActRecord[] {
  playUntil(r, sceneId);
  chooseHere(r, { [sceneId]: option });
  return [...r.sink.saved];
}

/** Le chemin par défaut jusqu'au premier temps `wait` de file (courant au retour). */
export function playUntilQueue(r: DirectorRig): void {
  playPath(r, {}, (b) => b.kind === 'wait' && b.label === 'queue');
}

/** Toute la démonstration par défaut (premières options), jusqu'à `demoEnd` ou `end`. */
export const playAllDefault = (r: DirectorRig): Beat[] => playPath(r, {});
/** Le J1 par défaut jusqu'à son relevé (courant au retour). */
export const playAllDefaultDay1 = (r: DirectorRig): Beat[] => playPath(r, {}, (b) => b.kind === 'recap');

/** Minute de fin de la voie passée : l'horloge du moteur après l'acte `lane` (`onLane` : minute de l'acte + minutes de la voie). */
export const laneEnd = (drv: StreetDriver): number => drv.state().street.clock.minute;

/** Les actes de la marche libre du J1 : téléphone et composant pris, sortie, voie `comply` ; aucun acte `scene`. */
export const freeWalkJ1Acts: readonly ActRecord[] = [
  act(1, 430, 'choice', 'j1.phone', 'take'), act(1, 431, 'choice', 'j1.component', 'take'), act(1, 432, 'exit', 'home'), act(1, 441, 'lane', 'checkpoint', 'comply'),
];

/**
 * Joue la démonstration en suivant à la lettre les choix du chemin `p` de `pathsOf` : `null` seulement si le metteur en scène présente
 * une étape à prix que le chemin a marquée indisponible (`<choix>=-` dans sa clé) alors que le moteur l'ouvre (sur-ensemble de `pathsOf` :
 * `ifUnavailable` pris là où le jalon est dû). Tout autre choix que le chemin ne nomme pas lève : aucun reclassement silencieux.
 */
export function playPicks(r: DirectorRig, p: { readonly key: string; readonly acts: readonly ActRecord[] }): { readonly acts: readonly ActRecord[] } | null {
  const picks = picksOf(p);
  const marks = new Set(p.key.split(/ \| |>|:/));
  const lastDay = Math.max(...p.key.split(' | ').map((k) => Number(k.slice(1, k.indexOf(':')))));
  for (let i = 0; i < 2000; i++) {
    const b = r.dir.current();
    if (b.kind === 'demoEnd' || b.kind === 'end') return { acts: [...r.sink.saved] };
    // chemin plus court que la démonstration (`pathsOf(…, 2)` quand le J3 est écrit) : arrêté à la première étape d'un jour qu'il ne porte pas
    if (b.kind === 'choice' && Number(b.sceneId.slice(1, b.sceneId.indexOf('.'))) > lastDay) return { acts: r.sink.saved.filter((a) => a.day <= lastDay) };
    if (b.kind === 'choice' && !(pickKey(b) in picks)) {
      const pricedStep = b.sceneId !== b.view.id;
      if (pricedStep && marks.has(`${b.view.id}=-`)) return null;
      throw new Error(`playPicks : ${b.sceneId} (${b.view.id}) présenté, ni choisi ni marqué indisponible par le chemin ${p.key}`);
    }
    stepOnce(r, picks);
  }
  throw new Error('playPicks : plus de 2000 temps');
}

/**
 * Les actes que le moteur posera sur le chemin `p` de `pathsOf` [N7] : chaque jour, l'horloge de la porte que le moteur lit au matin
 * (`flags.gateClosed` après rejeu des jours d'avant). `gate` : le premier jour où le chemin ne vaut que pour l'autre état de la porte
 * (une lecture de l'heure y a séparé les horloges), ou `null`.
 */
export function engineActsOf(p: GuidedPath, ctx: StreetContext): { readonly acts: readonly ActRecord[]; readonly gate: DayIndex | null } {
  const closed = new Set<number>();
  const days = [...new Set(p.acts.map((a) => a.day))].sort((a, b) => a - b);
  for (const d of days) {
    const st = replay(actsForGates(p, closed).filter((a) => a.day < d), ctx).state;
    const shut = st.day === d && st.flags.gateClosed === true;
    if (shut) closed.add(d);
    const only = p.gates[d];
    if (only !== undefined && (only === 'closed') !== shut) return { acts: actsForGates(p, closed), gate: d as DayIndex };
  }
  return { acts: actsForGates(p, closed), gate: null };
}

/** Le chemin a une voie aux minutes nominales : l'horloge du moteur après chaque `lane` vaut sa minute + `nominalLaneMinutes` (ni patrouille tirée, ni porte fermée). */
export function nominalLanes(p: Path, ctx: StreetContext): boolean {
  return p.acts.every((a, i) => {
    if (a.kind !== 'lane') return true;
    const after = replay(p.acts.slice(0, i + 1), ctx).state.clock.minute;
    return after === Math.min(a.minute + nominalLaneMinutes(ctx.street, a.option!), ctx.street.clock.dayEndMinute);
  });
}

// --- Rue guidée J3-J7, T1 : fabriques de la semaine (partent de `fixtures/guided/week-min.json`) --------------------------------------

const weekBase = (): Raw => structuredClone(weekMinJson) as Raw;

/** `week-min.json` tel quel. */
export const weekMin = (): Raw => weekBase();
/** Pose un `ask` de route sur la scène `at` (défaut `j2.a`, la scène de route de la base). */
export function withRoute(route: Raw, opts: { readonly at?: string } = {}): Raw {
  const g = weekBase();
  sceneOf(g, opts.at ?? 'j2.a').ask = { kind: 'route', ...route };
  return g;
}
/** Remplace la réplique de `j2.b` par une réplique selon le maillon `byLink` (voix `person`) ; `host` choisit une autre scène. */
export function withLinkedBeat(byLink: Raw, opts: { readonly host?: string } = {}): Raw {
  const g = weekBase();
  sceneOf(g, opts.host ?? 'j2.b').beats = [{ voice: 'person', lit: null, byLink }];
  return g;
}
/** Donne à B1 (chaîne B) l'id `linkId`, déjà pris par la chaîne A. */
export function withDuplicateLinkAcrossChains(linkId: string): Raw {
  const g = weekBase();
  g.chains[1].links[0].id = linkId;
  return g;
}
/** Pose `opensBy` sur la chaîne `chain` (`A` ou `B`). */
export function withOpensBy(chain: string, day: number | null): Raw {
  const g = weekBase();
  g.chains.find((c: Raw) => c.id === `chain.${chain}`).opensBy = day;
  return g;
}
/** Pose le droit du jour `day`. */
export function withDayRight(day: number, right: string | null): Raw {
  const g = weekBase();
  g.days.find((d: Raw) => d.day === day).right = right;
  return g;
}
/** Remplace `ending.outcomes`. */
export function withEnding(outcomes: Raw): Raw {
  const g = weekBase();
  g.ending.outcomes = outcomes;
  return g;
}

// --- Semaine condensée, T1 : fabriques des jours de montage (partent de `fixtures/guided/week-montage.json`) ------------------------------

const montageBase = (): Raw => structuredClone(weekMontageJson) as Raw;
const dayOf = (g: Raw, day: number): Raw => g.days.find((d: Raw) => d.day === day);

/** `week-montage.json` tel quel : le J2 est un jour de montage (carte, étape `j2.b` présentée, B2 rangé, fait de A sur la carte). */
export const weekMontage = (): Raw => montageBase();
/** Pose `kind` et `montage` sur le jour `day` de `week-min.json` (le J2 n'a pas de montage dans cette base). */
export function withDayKind(day: number, kind: string, montage: unknown): Raw {
  const g = weekBase();
  Object.assign(dayOf(g, day), { kind, montage });
  return g;
}
/** `n` lignes S1 sur la carte du jour `day` ; `fact: false` retire le fait de la carte (chaîne A). */
export function withMontageLines(day: number, n: number, opts: { readonly fact: boolean }): Raw {
  const g = montageBase();
  dayOf(g, day).montage.lines = Array.from({ length: n }, (_, i) => ({ voice: 'narrator', key: `w10.montage.d${day}.${i + 1}`, lit: null }));
  if (!opts.fact) g.chains[0].fact.shownOn = null;
  return g;
}
/** Remplace `montage.asks` du jour `day`. */
export function withMontageAsks(day: number, asks: readonly string[]): Raw {
  const g = montageBase();
  dayOf(g, day).montage.asks = [...asks];
  return g;
}
/** Pose l'option `option` de l'étape `step` pour la posture `posture`. */
export function withMontagePick(day: number, posture: string, step: string, option: string): Raw {
  const g = montageBase();
  dayOf(g, day).montage.picks[posture][step] = option;
  return g;
}
/** Remet B2 (étape `j2.c`, non présentée) parmi les maillons de la chaîne B. */
export function withLinkOnHiddenStep(): Raw {
  const g = montageBase();
  g.chains[1].links.push(...g.setAsideLinks['chain.B']);
  g.setAsideLinks = {};
  return g;
}
/** E3 : maillon de jalon (`j2.agentReturn`, option unique `go`, scène `j2.agent`, hors `asks`) après la carte présentée `j2.b`. */
export function withJalonLinkAfterAsk(): Raw {
  const g = montageBase();
  g.scenes.push({
    id: 'j2.agent', day: 2, stage: 'evening', place: 'unit.9-D', anchorMinute: 1020, costMin: 10, late: null, actor: null, beats: [],
    ask: { kind: 'priced', choiceId: 'j2.agentReturn', next: { go: 'night' }, ifUnavailable: 'night' }, transit: [], waitKind: 'none',
  });
  const v = { recapKey: 'w10.recap.E3.go', personKey: null, saidKey: null, nameKey: null };
  g.chains[1].links.push({ id: 'E3', day: 2, at: { kind: 'choice', id: 'j2.agentReturn' }, absent: { ...v, recapKey: 'w10.recap.E3.absent' }, variants: { go: v } });
  return g;
}
/** Pose `fact.shownOn` sur la chaîne `chain` (`A` ou `B`), à partir de `week-min.json`. */
export function withFactShownOn(chain: string, shownOn: Raw | null): Raw {
  const g = weekBase();
  g.chains.find((c: Raw) => c.id === `chain.${chain}`).fact.shownOn = shownOn;
  return g;
}

// --- Rue guidée J3-J7, T4 : le metteur en scène de la semaine -------------------------------------------------------------------------

/** `director-week.json` brut : J1 à J7 minimaux (route et réplique selon A1 au J2, choix à prix lu par une route le même jour au J3, audition au J7). */
export const directorWeekRaw = (): Raw => structuredClone(directorWeekJson) as Raw;
/** `ctx` dont `survival.arrest.nightBelow` vaut `points` (le monde chargé le tient en millièmes). */
export function withNightBelow(ctx: StreetContext, points: number): StreetContext {
  const survival = ctx.world.survival as unknown as { readonly arrest: Raw };
  return { ...ctx, world: { ...ctx.world, survival: { ...survival, arrest: { ...survival.arrest, nightBelow: points * 1000 } } as unknown as typeof ctx.world.survival } };
}

/**
 * Contexte de rue de w10 dont le bloc `street` porte `director-week.json` comme `guided`. Les journées minimales ne disent presque rien :
 * l'Intégrité tombe (mesuré, rejeu de `pathsOf` : 48, 33, 16, 0 aux nuits 1 à 4) et le seuil livré (0,5) arrêterait dans la nuit 4.
 * `nightBelow` 0 : aucune nuit n'arrête (la jauge ne passe pas sous 0), la semaine va à l'audition, qui rend `arrestedAudition` (0 < 24,5).
 */
export const ctxDirWeek: StreetContext = withNightBelow(
  ctxW10(withStreet((d) => { (d as { guided: unknown }).guided = parseGuided(directorWeekRaw(), w10Street); })), 0);

/** Les choix de la semaine de `director-week.json` : `m2.nadia` passé (aucun bon dépensé), audition `none` ; `over` l'emporte. */
export const weekPicks = (over: Readonly<Record<string, string>>): Readonly<Record<string, string>> => ({ 'm2.nadia': 'pass', 'audition.j7': 'none', ...over });

/** Le temps `outcome` des temps joués ; lève s'il n'y en a pas. */
export function outcomeOf(seen: readonly Beat[]): Extract<Beat, { kind: 'outcome' }> {
  const b = seen.find((x): x is Extract<Beat, { kind: 'outcome' }> => x.kind === 'outcome');
  if (b === undefined) throw new Error('outcomeOf : aucun temps outcome');
  return b;
}

/** Clés des lignes à partir du temps courant, chaque temps passé, jusqu'au premier choix, relevé, nuit ou fin (non compris). Borné. */
export function linesUntilChoice(r: DirectorRig): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < 500; i++) {
    const b = r.dir.current();
    if (b.kind === 'choice' || b.kind === 'recap' || b.kind === 'night' || b.kind === 'end' || b.kind === 'demoEnd') return out;
    if (b.kind === 'line') out.push(b.key);
    r.dir.advance();
  }
  throw new Error('linesUntilChoice : plus de 500 temps');
}

/**
 * Contexte w10 réel dont `survival.arrest.nightBelow` est relevé pour arrêter le chemin par défaut dans la nuit `day` (motif de
 * `survival_integrity_test.ts`). Seuil CALCULÉ sur le chemin par défaut (premières options, `playAllDefault`, le même que
 * `pathOf(street, {})`) : sa valeur la nuit `day`, plus 0,5 ; lève si une nuit d'avant n'est pas au-dessus (le chemin s'arrêterait plus tôt).
 * Avant N8, le seuil était épinglé à 20 (nuits 35 puis 18) ; N8 (la file du contrôle compte une consigne, +2 les jours de file) donne
 * 37 puis 22, donc 22,5 [mesuré, T14].
 */
export function ctxArrestNight(day: DayIndex): StreetContext {
  const r = directorRig();
  playAllDefault(r);
  const nights = ([1, 2, 3, 4, 5, 6] as const).filter((d) => d <= day).map((d) => nightValue({ acts: r.sink.saved }, d, ctxW10()));
  const below = nights[day - 1]! + 0.5;
  if (nights.slice(0, day - 1).some((v) => v < below)) throw new Error(`ctxArrestNight : le chemin par défaut passe sous ${below} avant la nuit ${day} (${nights.join(', ')})`);
  return withNightBelow(ctxW10(), below);
}

// --- T9 à T13 : aides des tâches de jour de la semaine guidée [plan rue guidée J3-J7, gabarit commun] ------------------------------------

/** Chaînes exigées ouvertes sur tout chemin de w10 écrit jusqu'au jour `throughDay` (`mustOpenOf` de la preuve, sur les données livrées). */
export const mustOpenOf = (throughDay: DayIndex): readonly string[] => mustOpenOfGuided(ctxW10().street.guided as GuidedData, throughDay);

/**
 * Nombre de chemins distincts du jour `day` : les segments `jN:` des clés de `pathsOf(street, day)` (mémoire par défaut). Sans route,
 * c'est le nombre de suites du jour seul (toutes les voies du contrôle, `ifUnavailable` compris) ; avec une route, une branche que les
 * marques de la veille contredisent n'y est pas.
 */
export function dayPathCount(street: StreetData, day: DayIndex): number {
  return new Set(pathsOf(street, day).map((p) => p.key.split(' | ').find((k) => k.startsWith(`j${day}:`)))).size;
}

/** Les refus d'un rejeu hors `ended` : un refus après une arrestation de nuit n'est pas une faute de données. */
export const rejectedBeforeEnd = (rejected: readonly Rejected[]): readonly Rejected[] => rejected.filter((x) => x.reason !== 'ended');

/**
 * Chemin couloir de la semaine (mode de parole du milieu chaque jour, 40 à 60 mots ; `chooseHere`, clés de `picksOf`). J1 et J2 : un
 * chemin de `pathsOf(w10, 2)` à 48 et 40 mots, contrôle `comply` les deux jours, sans refus ni arrestation [mesuré, T9] ; J3 à J7 :
 * `DAY_PICKS[3|4|5|6|7].couloir` du plan J3-J7 (T14), 43, 44, 44, 24 et 45 mots (conception §6) ; audition `none`.
 */
export const COULOIR_PICKS: Readonly<Record<string, string>> = {
  'j1.phone': 'take', 'j1.component': 'take', 'j1.roux': 'laugh', 'j1.marlene': 'nod', 'j1.street': 'straight', 'checkpoint.j1': 'comply',
  'm4.list': 'read', 'relecture.j1': 'flag',
  'j2.component': 'hide', 'j2.marlene': 'banal', 'checkpoint.j2': 'comply', 'relecture.j2': 'flag',
  'j3.pylone': 'recite', 'j3.after': 'cantine', 'checkpoint.j3': 'comply', 'j3.cantine': 'work', 'j3.marlene': 'name', 'j3.who': 'theodore',
  'j4.door': 'go', 'j4.neighbour': 'silent', 'j4.daughter': 'truth', 'checkpoint.j4': 'comply', 'relecture.j4': 'flag', 'j4.evening': 'home',
  'j5.daughter': 'long', 'checkpoint.j5': 'comply', 'relecture.j5': 'flag', 'j5.bruno.door': 'go', 'j5.bruno.talk': 'silent', 'j5.bruno': 'refuse',
  'j6.marlene': 'banal', 'checkpoint.j6': 'comply', 'j6.guichet': 'roux', 'relecture.j6': 'flag', 'j6.cut': 'listen',
  'j7.daughter': 'some', 'audition.j7': 'none',
};

/**
 * Contexte w10 réel dont `guided.endOfDemo` vaut `{ afterDay: day }` (clés de l'ancien écran `demoEnd`) : la fin de démo d'un monde
 * partiel, pour les cas qui la jouaient sur w10 avant que la semaine n'aille au J7 (`endOfDemo: null`, T13).
 */
export function ctxW10DemoAfter(day: DayIndex): StreetContext {
  return ctxW10(withStreet((d) => {
    (d as { guided: unknown }).guided = { ...(d.guided as GuidedData), endOfDemo: { afterDay: day, titleKey: 'w10.demo.title', lineKey: 'w10.demo.line' } };
  }));
}

// --- Semaine condensée, T2 : chemins de B-1 déplacés de `guided_b1_week_test.ts` (R-2, corps inchangés), fabriques du montage ----------

/** Choix d'un chemin, par clé de `picksOf` (id de scène narrative, id de choix ou de jalon). */
export type Picks = Readonly<Record<string, string>>;

/** Contexte w10 dont le `street.guided` est celui du JSON de monde brut `raw`, lu par le chargeur réel. */
export const ctxOfRaw = (raw: Raw): StreetContext =>
  ctxW10(withStreet((d) => { (d as { guided: unknown }).guided = parseGuided((raw.street as Raw).guided, w10Street); }));

/**
 * Choix du brief T14 (J3 à J7), chaque id vérifié contre w10.json (aucun écart trouvé) ; deux retouches du calibrage T14 (§3.1), dites en ligne. J1 et J2 : chemins du même mode que ceux du plan
 * J1-J2 (T5 Step 4 bis), muet 14 et 14, couloir 48 et 40, bavard 70 et 70.
 */
export const DAY_PICKS: Readonly<Record<number, Readonly<Record<SpeechModeId, Picks>>>> = {
  // `j1.component: leave` : le domaine de §7.5 exclut #7 sur soi (bible l. 540) ; `take` pose `found7` (-10) au contrôle du J1 [calibrage T14 §1.2].
  1: { muet: { 'j1.component': 'leave', 'j1.roux': 'silent', 'j1.marlene': 'ignore' }, couloir: { 'j1.component': 'leave', 'j1.roux': 'laugh', 'j1.marlene': 'nod' },
       bavard: { 'j1.component': 'leave', 'j1.roux': 'laugh', 'j1.marlene': 'answer' } },
  2: { muet: { 'j2.marlene': 'silent' }, couloir: { 'j2.marlene': 'banal' }, bavard: { 'j2.marlene': 'talk' } },
  // Muet J3 : il passe le contrôle comme le muet de la grille (bible l. 510 : 14 forcés + 8 de banalités = 22), pas `home` (8 mots, silence -7).
  3: { muet: { 'j3.pylone': 'silent', 'j3.after': 'cantine', 'checkpoint.j3': 'comply', 'j3.cantine': 'silent', 'j3.marlene': 'banal' },
       couloir: { 'j3.pylone': 'recite', 'j3.after': 'cantine', 'checkpoint.j3': 'comply', 'j3.cantine': 'work', 'j3.marlene': 'name', 'j3.who': 'theodore' },
       bavard: { 'j3.pylone': 'warn', 'j3.after': 'cantine', 'checkpoint.j3': 'comply', 'j3.cantine': 'long', 'j3.marlene': 'name', 'j3.who': 'nadia' } },
  4: { muet: { 'j4.neighbour': 'silent', 'j4.daughter': 'silent', 'checkpoint.j4': 'comply', 'relecture.j4': 'pass', 'j4.evening': 'home' },
       couloir: { 'j4.neighbour': 'silent', 'j4.daughter': 'truth', 'checkpoint.j4': 'comply', 'j4.evening': 'home' },
       bavard: { 'j4.neighbour': 'name', 'j4.who': 'yusuf', 'j4.daughter': 'truth', 'checkpoint.j4': 'comply', 'j4.evening': 'yusuf', 'j4.yusuf': 'roux' } },
  5: { muet: { 'j5.daughter': 'silent', 'checkpoint.j5': 'comply', 'j5.bruno.talk': 'silent', 'j5.bruno': 'refuse' },
       couloir: { 'j5.daughter': 'long', 'checkpoint.j5': 'comply', 'j5.bruno.talk': 'silent', 'j5.bruno': 'refuse' },
       bavard: { 'j5.daughter': 'long', 'checkpoint.j5': 'comply', 'j5.bruno.talk': 'roux', 'j5.bruno': 'name', 'j5.who': 'berenice' } },
  6: { muet: { 'j6.marlene': 'silent', 'checkpoint.j6': 'comply', 'j6.guichet': 'nothing', 'j6.cut': 'listen' },
       couloir: { 'j6.marlene': 'banal', 'checkpoint.j6': 'comply', 'j6.guichet': 'roux', 'j6.cut': 'listen' },
       bavard: { 'j6.marlene': 'talk', 'checkpoint.j6': 'comply', 'j6.guichet': 'roux', 'j6.cut': 'remark' } },
  7: { muet: { 'j7.daughter': 'silent' }, couloir: { 'j7.daughter': 'some' }, bavard: { 'j7.daughter': 'all' } },
};

/**
 * Sommes re-dérivées à la main depuis les `words` de w10.json (document §1) ; jamais copiées d'une mesure.
 * J3 muet 22 : `silent` 0 + `cantine` 0 + 14 + `silent` 0 + `banal` 8. J5 bavard 78 (décision 14 : `roux` 26) ; J6 bavard 49, pas 54 (N6 v3 : `talk` 21).
 */
export const EXPECTED: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [14, 48, 70], 2: [14, 40, 70], 3: [22, 43, 71], 4: [14, 44, 80], 5: [14, 44, 78], 6: [14, 24, 55], 7: [0, 45, 72],
};

/**
 * Joue `picks` (amendant le chemin couloir) au metteur en scène, horloge vive ; actes posés et temps vus. `raw` : un JSON de monde
 * brut dont le `street.guided` remplace celui de w10 (ex. `withMontageDay(w10Raw, 5)`) ; défaut w10 tel quel.
 */
export function playOf(picks: Picks, raw?: Raw) {
  const r = directorRig([], raw === undefined ? ctxW10() : ctxOfRaw(raw));
  const seen = playPath(r, { ...COULOIR_PICKS, ...picks });
  return { acts: r.sink.saved as readonly ActRecord[], seen };
}

/** Offres des jours 3 à 5 : clé, option qui nomme, refus, et la personne nommée choisie ici (ni Marlène ni la fille, pour ne pas sceller de route). */
const OFFERS: Readonly<Record<3 | 4 | 5, { readonly choice: string; readonly refuse: string; readonly who: readonly [string, string] }>> = {
  3: { choice: 'j3.marlene', refuse: 'banal', who: ['j3.who', 'theodore'] },
  4: { choice: 'j4.neighbour', refuse: 'silent', who: ['j4.who', 'yusuf'] },
  5: { choice: 'j5.bruno', refuse: 'refuse', who: ['j5.who', 'berenice'] },
};
export const withNames = (picks: Picks, days: readonly number[]): Picks => {
  const out: Record<string, string> = { ...picks };
  for (const d of [3, 4, 5] as const) {
    const o = OFFERS[d];
    if (days.includes(d)) { out[o.choice] = 'name'; out[o.who[0]] = o.who[1]; } else out[o.choice] = o.refuse;
  }
  return out;
};

/** Une semaine d'un seul mode, noms donnés les jours `names` (J3, J4, J5). */
export const weekOf = (mode: SpeechModeId, opts: { readonly names: readonly number[] }): Picks =>
  withNames(Object.assign({}, ...[1, 2, 3, 4, 5, 6, 7].map((d) => DAY_PICKS[d]![mode])), opts.names);

/** Étapes présentées sur chaque carte de montage de w10 (plan semaine condensée, T5, table des cartes). */
export const MONTAGE_ASKS: Readonly<Record<2 | 3 | 5 | 6, readonly string[]>> = {
  2: ['j2.wake'], 3: ['j3.marlene', 'j3.who'], 5: ['j5.bruno', 'j5.who'], 6: [],
};
const MODE_IDS: readonly SpeechModeId[] = ['muet', 'couloir', 'bavard'];
const w10Scenes = (): readonly SceneSpec[] => parseGuided((w10Raw.street as Raw).guided, w10Street).scenes;

/** Clé de `picksOf` d'une étape : id de la scène (narratif), id du choix ou du jalon (à prix) ; `null` pour une route ou une étape sans question. */
export function pickKeyOf(s: SceneSpec): string | null {
  return s.ask.kind === 'narrative' ? s.id : s.ask.kind === 'priced' ? s.ask.choiceId : null;
}
/** Option jouée faute de choix nommé, comme `chooseHere` : la première option déclarée (narratif, `street.choices`), `go` d'un jalon. */
function firstOptionOf(s: SceneSpec): string {
  const a = s.ask;
  if (a.kind === 'narrative') return a.options[0]!.id;
  if (a.kind !== 'priced') throw new Error(`firstOptionOf : ${s.id} sans question`);
  return w10Street.choices.find((c) => c.id === a.choiceId)?.options[0]?.id ?? JALON_OPTION;
}
/** Un enregistrement par id de scène (`picks`, `cardDefaults`) remis aux clés de `picksOf`, pour `playOf` et `chooseHere`. */
export function asPickKeys(bySceneId: Picks): Picks {
  const scenes = w10Scenes();
  return Object.fromEntries(Object.entries(bySceneId).map(([id, o]) => [pickKeyOf(scenes.find((s) => s.id === id)!)!, o]));
}

/**
 * Le `MontageSpec` du jour `day` de w10, SOURCE UNIQUE des données de T5 (R-2). Clés par id de SCÈNE (le schéma de T1 le veut :
 * `checkpoint.j2` devient `j2.checkpoint`). `picks[m]` : chaque étape à question du jour hors `asks`, option de la base de `playOf`,
 * `{ ...COULOIR_PICKS, ...DAY_PICKS[day][m] }`, à la lettre, ou la première option comme `chooseHere` (ex. `j2.agentReturn: go`) ;
 * `cardDefaults[m]` : les étapes `asks` dans la même base ; `expectedWords[m]` : `EXPECTED[day]`. Lignes et clés de texte factices.
 */
export function montageSpecOf(day: 2 | 3 | 5 | 6): Raw {
  const asks = MONTAGE_ASKS[day];
  const steps = w10Scenes().filter((s) => s.day === day && pickKeyOf(s) !== null);
  const byMode = (m: SpeechModeId, inAsks: boolean): Record<string, string> => {
    const base: Picks = { ...COULOIR_PICKS, ...DAY_PICKS[day]![m] };
    return Object.fromEntries(steps.filter((s) => asks.includes(s.id) === inAsks).map((s) => [s.id, base[pickKeyOf(s)!] ?? firstOptionOf(s)]));
  };
  const rec = <T>(f: (m: SpeechModeId, i: number) => T): Record<SpeechModeId, T> => Object.fromEntries(MODE_IDS.map((m, i) => [m, f(m, i)])) as Record<SpeechModeId, T>;
  return {
    lines: [{ voice: 'narrator', key: `w10.montage.j${day}.1`, lit: null }],
    postureKeys: rec((m) => `w10.montage.posture.${m}`),
    posture: 'inherit',
    asks: [...asks],
    picks: rec((m) => byMode(m, false)),
    expectedWords: rec((_, i) => EXPECTED[day]![i]!),
    cardDefaults: rec((m) => byMode(m, true)),
  };
}

/**
 * JSON de monde brut `raw` dont le jour `day` passe en `montage` (`montageSpecOf(day)`), en mémoire : les maillons du jour posés sur une
 * étape non présentée (hors `asks`, hors suite de jalon après la première étape présentée, règle `guided.linkHidden` de T1) partent en
 * `setAsideLinks` sous l'id de leur chaîne. Les données de w10 ne sont pas touchées (T5).
 */
export function withMontageDay(raw: Raw, day: 2 | 3 | 5 | 6): Raw {
  const r = structuredClone(raw);
  const g = (r.street as Raw).guided as Raw;
  const spec = montageSpecOf(day);
  Object.assign(g.days.find((d: Raw) => d.day === day), { kind: 'montage', montage: spec });
  const scenes: Raw[] = g.scenes;
  const asked = scenes.filter((s) => spec.asks.includes(s.id));
  const firstAsk = Math.min(...asked.map((s) => s.anchorMinute));
  const jalons = new Set(w10Street.jalons.map((j) => j.id));
  const hidden = (l: Raw): boolean => {
    if (l.day !== day || l.at.kind === 'night') return false;
    const step = l.at.kind === 'scene' ? scenes.find((s) => s.id === l.at.id) : scenes.find((s) => s.day === day && s.ask.kind === 'priced' && s.ask.choiceId === l.at.id);
    if (step === undefined) return true;
    const jalonTail = step.ask.kind === 'priced' && jalons.has(step.ask.choiceId) && asked.length > 0 && step.anchorMinute >= firstAsk;
    return !spec.asks.includes(step.id) && !jalonTail;
  };
  g.setAsideLinks = { ...(g.setAsideLinks ?? {}) };
  for (const c of g.chains as Raw[]) {
    const out = (c.links as Raw[]).filter(hidden);
    if (out.length === 0) continue;
    c.links = (c.links as Raw[]).filter((l) => !hidden(l));
    g.setAsideLinks[c.id] = [...(g.setAsideLinks[c.id] ?? []), ...out];
  }
  return r;
}

/** Le jour `day` remis `played` (`montage: null`), pour la référence d'égalité une fois w10 basculé (T5). */
export function withPlayedDay(raw: Raw, day: number): Raw {
  const r = structuredClone(raw);
  Object.assign(((r.street as Raw).guided as Raw).days.find((d: Raw) => d.day === day), { kind: 'played', montage: null });
  return r;
}
