/**
 * Aides de test de la rue [R-01.3, plan 02b T1]. Aucune règle de jeu ici : les règles vivent dans `src/engine/moments`.
 * Seules les aides dont le corps ne dépend pas de `reduceAct` sont écrites ici (R-02b.15) ; T4, T9, T10, T13 y ajoutent les leurs.
 */
import { loadCore } from '../../src/data/load';
import type { StreetData } from '../../src/data/schema/street';
import { parseWorld } from '../../src/data/schema/world';
import { momentOf } from '../../src/engine/moments/clock';
import type { Location, Rejected, StreetContext, StreetState } from '../../src/engine/moments/types';
import type { StringMeta } from '../../src/i18n/i18n';
import metaJson from '../../src/data/strings/meta.json';
import { canonicalJson } from '../../src/shared/canonical';
import type { Dice } from '../../src/shared/dice';
import { RIGHT_IDS, type ActRecord, type DayIndex, type GameClock, type KitItemState, type MomentId, type RightId } from '../../src/shared/types/street';
import { cat, w10Raw } from '../fixtures/data/factories';
import { runLivingIn } from './week';
import { sleepMaxRemaining, startSurvival, type IntegrityConfig, type Palier } from '../../src/survival';
import { reduceAct, type ReduceResult } from '../../src/engine/moments/state';
import { startWeek, type WeekState } from '../../src/engine/week';

type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };

const core = loadCore();
const world = parseWorld(w10Raw, cat);

/** Un acte de la joueuse : `option` vaut `null` quand l'acte n'en a pas. */
export function act(day: DayIndex, minute: number, kind: string, id: string, option: string | null = null): ActRecord {
  return { day, minute, kind, id, option };
}

/** Dé de test : rend `values` dans l'ordre des appels, en boucle. Le dé réel est sans état, celui-ci compte les appels pour piloter un tirage précis. */
export function diceStub(values: readonly number[]): Dice {
  if (values.length === 0) throw new Error('diceStub : au moins une valeur');
  let i = 0;
  return { roll: () => values[i++ % values.length]! };
}

/** Contexte de rue de w10 : données réelles, partie vécue dans w10, dé à `[0]`. `street` remplace le bloc, par exemple celui de {@link withStreet}. */
export function ctxW10(street: StreetData = world.street, dice: Dice = diceStub([0])): StreetContext {
  return { street, world: { ...world, street }, core, run: runLivingIn('w10'), dice };
}

/** `meta.json` : les règles de chaînes par préfixe. */
export function loadMeta(): StringMeta {
  return metaJson as StringMeta;
}

/** Copie profonde du bloc `street` de w10 avec une mutation ; l'original n'est jamais touché. */
export function withStreet(mut: (draft: DeepMutable<StreetData>) => void): StreetData {
  const copy = structuredClone(world.street) as DeepMutable<StreetData>;
  mut(copy);
  return copy as StreetData;
}

/** JSON brut de w10 dont le bloc `street` reçoit `patch` clé par clé : pour les refus du chargeur. */
export function withStreetRaw(raw: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const r = structuredClone(raw);
  r['street'] = { ...(r['street'] as Record<string, unknown>), ...patch };
  return r;
}

/** Alias de `canonicalJson` [R-02b.12] : l'indépendance à l'ordre est dans le moteur, pas dans l'aide. */
export const canon = canonicalJson;

/** État littéral du J1 à 7 h : au logement, au repos, kit au statut `kept`, aucun acte, aucun drapeau [R-02b.39]. */
export function day1State(): StreetState {
  return {
    day: 1, clock: { day: 1, minute: world.street.clock.dayStartMinute }, carry: 0, moment: 'lever', location: 'home',
    phase: 'idle', designated: null, acts: [], confirmed: {},
    kit: Object.fromEntries(world.kit.map((k) => [k.id, 'kept' as const])), bons: 0,
    rightsMet: [], rightLines: {}, survival: startSurvival(world.survival as Parameters<typeof startSurvival>[0]),
    readings: [], ledgers: [], flags: {}, ended: null, dayExtra: { entries: [], spent: 0 },
  };
}

/** Alias de {@link day1State} : l'état du J1 à 7 h [R-02b.39]. */
export const J1 = day1State;

/**
 * Contexte de rue pour une langue [R-02b.39]. `StreetContext` ne porte aucune langue : le coût d'une réplique est sa donnée `words`,
 * jamais le décompte de la chaîne. Cette aide existe pour épingler cette indépendance : deux langues, un même contexte de données.
 */
export function ctxLang(lang: 'fr' | 'en'): StreetContext {
  void lang;                       // la langue ne change aucune donnée du contexte : c'est le point
  return ctxW10();
}

/** Horloge du jour `day` à la minute `minute` : le troisième argument de `confirm` [R-02b.39]. */
export function at(day: DayIndex, minute: number): GameClock {
  return { day, minute };
}

/** État du jour `day` à `minute`, à l'endroit `location` ; `left` suit l'endroit, le moment est celui de la règle de l'horloge [T4]. */
function placedAt(day: DayIndex, minute: number, location: Location, patch: Partial<StreetState> = {}): StreetState {
  const base = day1State();
  const flags = location === 'home' ? {} : { left: true };
  const clock = { day, minute };
  return { ...base, day, clock, location, flags, moment: momentOf({ clock, location, flags }, world.street), ...patch };
}

/** Au logement, au repos, le jour `day` à `minute`, aucun acte [R-02b.39]. */
export function homeAt(day: DayIndex, minute: number): StreetState {
  return placedAt(day, minute, 'home');
}

/** Choix de la porte du J2 confirmé avec `option`, au logement à 7 h : l'acte et la clé de fermeture sont posés comme `confirm` les pose. */
export function confirmJ2(option: string): StreetState {
  const h = homeAt(2, world.street.clock.dayStartMinute);
  return { ...h, acts: [act(2, h.clock.minute, 'choice', 'j2.component', option)], confirmed: { '2.j2.component': option }, phase: 'confirmed' };
}

/** Dans la rue (hors du logement), le jour `day` à `minute`, checkpoint non passé ; le J2, la porte est franchie : choix `keep` confirmé. */
export function streetAt(day: DayIndex, minute: number): StreetState {
  const s = placedAt(day, minute, 'street');
  if (day !== 2) return s;
  const j2 = confirmJ2('keep');
  return { ...s, acts: j2.acts, confirmed: j2.confirmed, phase: 'confirmed' };
}

/** Dans la rue le jour `day` à `minute`, checkpoint passé en se pliant (acte `lane` et clé fermée). */
export function passedAt(day: DayIndex, minute: number): StreetState {
  const s = streetAt(day, minute);
  const when = Math.min(minute, 600);
  return { ...s, acts: [...s.acts, act(day, when, 'lane', 'checkpoint', 'comply')], confirmed: { ...s.confirmed, [`${day}.checkpoint.j${day}`]: 'comply' }, phase: 'confirmed' };
}

/** Le J1 dans la rue, à 10 h, devant le checkpoint, rien de désigné ni de passé. */
export function atJ1Checkpoint(): StreetState {
  return streetAt(1, 600);
}

/** `n` répliques d'un mot (`say filler.1`) ajoutées aux actes du jour de l'état : fait baisser le restant de `n` [R-02b.42]. */
export function withSpent(s: StreetState, n: number): StreetState {
  const spent = Array.from({ length: n }, () => act(s.day, s.clock.minute, 'say', 'filler.1'));
  return { ...s, acts: [...s.acts, ...spent] };
}

/** Porte du checkpoint fermée (surveillance au-dessus de 96) : T10 pose ce drapeau au crochet `morning` [R-02b.45]. */
export function closedGate(s: StreetState): StreetState {
  return { ...s, flags: { ...s.flags, gateClosed: true } };
}

/** Yusuf guide la joueuse : les poids de contournement passent à `guideWeights` [R-02b.45]. */
export function withGuide(s: StreetState): StreetState {
  return { ...s, flags: { ...s.flags, guide: true } };
}

/** Palier courant `p`. `StreetState` n'a pas de champ palier : il se lit sur le dernier relevé, donc l'aide en pousse un synthétique. */
export function withPalier(s: StreetState, p: Palier): StreetState {
  const reading = { day: Math.max(1, s.day - 1), value: 0, terms: {}, palier: p, ending: null, mentions: [] };
  return { ...s, readings: [...s.readings, reading as unknown as StreetState['readings'][number]] };
}

/** Kit modifié : `patch` remplace l'état des objets nommés. */
export function withKit(s: StreetState, patch: Readonly<Record<string, KitItemState>>): StreetState {
  return { ...s, kit: { ...s.kit, ...patch } };
}

/** Bons en stock : `n`. */
export function withBons(s: StreetState, n: number): StreetState {
  return { ...s, bons: n };
}

const MOMENTS: readonly MomentId[] = ['lever', 'rueAller', 'travail', 'rueMidi', 'soir', 'nuit'];

/** Surcharges de {@link stateAt} : `pending` arme les contacts conditionnels, `met` remplit le carnet, `lines` les lignes dites, `minute` l'horloge [R-02b.51]. */
export interface RightsOverride {
  readonly pending?: readonly RightId[]; readonly met?: readonly RightId[]; readonly lines?: Readonly<Record<string, RightId>>; readonly minute?: number;
}

/** État du jour `day` dans le moment `moment` (posé tel quel, sans le dériver de l'horloge) pour les tests de droits [R-02b.51]. */
export function stateAt(moment: MomentId, day: DayIndex, over: RightsOverride = {}): StreetState {
  const flags = {
    ...(over.pending?.includes('leave') ? { permitRequested: true } : {}),
    ...(over.pending?.includes('read') ? { listRead: true } : {}),
  };
  return {
    ...day1State(), day, moment, clock: { day, minute: over.minute ?? world.street.clock.dayStartMinute },
    rightsMet: over.met ?? [], rightLines: over.lines ?? {}, flags,
  };
}

/** Droits déjà rencontrés avant `moment` du jour `day` (1 par défaut) selon le calendrier de la donnée, contacts conditionnels exclus. */
export function metBefore(moment: string, day: DayIndex = 1): readonly RightId[] {
  const at = MOMENTS.indexOf(moment as MomentId);
  return world.street.rights.contacts
    .filter((c) => !c.conditional && c.moment !== null && (c.day < day || (c.day === day && MOMENTS.indexOf(c.moment) < at)))
    .map((c) => c.right);
}

/** Les huit droits sauf `right` : tout est rencontré, ce droit reste à dire. */
export function allBut(right: RightId): readonly RightId[] {
  return RIGHT_IDS.filter((r) => r !== right);
}

/** État du J1 à 7 h dont le carnet porte `met`. */
export function withMet(met: readonly RightId[]): StreetState {
  return { ...day1State(), rightsMet: met };
}

// --- T10 : réduction, rejeu et scripts d'actes fixes [R-02b.14, R-02b.15, R-02b.39] -----------------------------------------------

/** Semaine de départ de la partie vécue dans w10 [R-02b.39]. */
export const week0: WeekState = startWeek(ctxW10().run, ctxW10().world, core);

/** Un résultat de `reduceAct` est-il un refus ? */
export function isRejected(x: unknown): x is Rejected {
  return typeof x === 'object' && x !== null && 'reason' in x;
}

/** Réduit l'acte `a` sur le logement du jour `day` à 7 h : un acte sur un état neuf [plan 02b, `reduceAt`]. */
export function reduceAt(day: DayIndex, a: ActRecord, ctx: StreetContext = ctxW10()): ReduceResult {
  return reduceAct(homeAt(day, ctx.street.clock.dayStartMinute), week0, a, ctx);
}

/** Réduit et déballe : l'état suivant, ou une erreur si l'acte est refusé. */
export function reduceOk(s: StreetState, a: ActRecord, ctx: StreetContext = ctxW10(), week: WeekState = week0): StreetState {
  const r = reduceAct(s, week, a, ctx);
  if (isRejected(r)) throw new Error(`acte refusé (${r.reason}) : ${JSON.stringify(a)}`);
  return r.state;
}

/** Joue un script d'actes à partir d'un état : état, semaine et refus, comme `replay` mais depuis `s`. */
export function playDay(s: StreetState, script: readonly ActRecord[], ctx: StreetContext = ctxW10(), week: WeekState = week0):
  { readonly state: StreetState; readonly week: WeekState; readonly rejected: readonly Rejected[] } {
  let state = s; let w = week; const rejected: Rejected[] = [];
  for (const a of script) {
    const r = reduceAct(state, w, a, ctx);
    if (isRejected(r)) rejected.push(r); else { state = r.state; w = r.week; }
  }
  return { state, week: w, rejected };
}

/** L'issue dans le vocabulaire de l'oracle : `arrested:${nuit}`, `arrested:audition`, `released`, `recruited`, `null` sans fin [R-02b.35]. */
export function endIdOf(s: StreetState): string | null {
  if (s.ended === null) return null;
  if (s.ended.endId === 'arrestedAudition') return 'arrested:audition';
  if (s.ended.endId !== 'arrested') return s.ended.endId;
  const e = s.readings.at(-1)?.ending;
  return e?.kind === 'arrested' ? `arrested:${e.at}` : 'arrested';
}

const SLEEP_MINUTE = 1300;
const FILL_MINUTE = 440;
const DAY_1_TO_6: readonly DayIndex[] = [1, 2, 3, 4, 5, 6];

/**
 * Les actes de `days` dormis l'un après l'autre : `phone` usages du téléphone (`true` vaut 1), une relecture du jour si `relecture`
 * (choix `relecture.jN`, option `flag`, à fournir par les données ou le test), puis `sleep`. Aucune autre action [plan 02b T10].
 */
export function sleepEachDay(days: readonly DayIndex[], opts: { readonly phone?: number | boolean; readonly relecture?: boolean } = {}): ActRecord[] {
  const phones = opts.phone === true ? 1 : opts.phone === false || opts.phone === undefined ? 0 : opts.phone;
  return days.flatMap((d) => [
    ...Array.from({ length: phones }, (_, i) => act(d, FILL_MINUTE + i, 'use', 'phone')),
    ...(opts.relecture === true ? [act(d, FILL_MINUTE + phones, 'choice', `relecture.j${d}`, 'flag')] : []),
    act(d, SLEEP_MINUTE, 'sleep', 'night'),
  ]);
}

/**
 * Les mots à dépenser un jour pour rester en vie sans rien faire d'autre : la base du jour moins le restant qui ne coûte rien
 * (`sleep.maxRemaining`). Données lues dans le monde, aucun nombre en dur [R-01.4].
 */
function fillersFor(day: DayIndex): ActRecord[] {
  const cfg = world.survival as unknown as IntegrityConfig;
  const n = cfg.words.base[day - 1]! - sleepMaxRemaining(cfg, day);
  return Array.from({ length: n }, () => act(day, FILL_MINUTE, 'say', 'filler.1'));
}

/** Les nuits J1 à J6, dormies avec juste assez de mots dépensés pour qu'aucune arrestation ne coupe la semaine. */
const NIGHTS_1_TO_6: readonly ActRecord[] = DAY_1_TO_6.flatMap((d) => [...fillersFor(d), act(d, SLEEP_MINUTE, 'sleep', 'night')]);

/** Le soir du J7, l'audition encore due : tout dormi jusque-là. */
export const TO_J7_EVENING: readonly ActRecord[] = NIGHTS_1_TO_6;

/** Sept jours sans autre geste que dormir (et dépenser le strict nécessaire de mots), puis l'audition sans parole. */
export const SEVEN_DAYS_SLEEP_ONLY: readonly ActRecord[] = [...NIGHTS_1_TO_6, act(7, 1100, 'choice', 'audition.j7', 'silence')];

/** Le début du J1 : téléphone pris, composant laissé, sortie du logement. Dernier acte à 430. */
export const SCRIPT_J1_PREFIX: readonly ActRecord[] = [
  act(1, 420, 'choice', 'j1.phone', 'take'), act(1, 421, 'choice', 'j1.component', 'leave'), act(1, 430, 'exit', 'home'),
];

/** Un J1 entier (checkpoint, Registre, nuit) puis le début du J2 (porte, sortie, téléphone). */
export const SCRIPT_J1_J2: readonly ActRecord[] = [
  ...SCRIPT_J1_PREFIX,
  act(1, 600, 'lane', 'checkpoint', 'comply'), act(1, 670, 'enter', 'registre'), act(1, 700, 'say', 'filler.1'), act(1, 1000, 'exit', 'registre'),
  act(1, SLEEP_MINUTE, 'sleep', 'night'),
  act(2, 420, 'choice', 'j2.component', 'hide'), act(2, 430, 'exit', 'home'), act(2, 440, 'use', 'phone'),
];
