/**
 * `reduceAct` : le seul chemin d'un acte vers l'état de la rue, en direct comme au rejeu [GDD 05 §3.4 ; plan 02b T10].
 * Pur : aucun JSON, aucune horloge système, aucun hasard hors du dé injecté. Ne mute jamais son entrée et ne lève pas sur un acte
 * mal formé ou hors de propos : il rend un `Rejected` avec sa raison. Un acte ne touche jamais la jauge, seul le relevé de la nuit le fait [D89].
 *
 * Ordre des contrôles : fin de partie, `kind`, forme, jour, minute, puis la règle du verbe. L'horloge passée aux calculs est celle de l'ACTE.
 * Ordre des crochets du plan 01 à `sleep` : `nightEnd` du jour, puis `morning` du lendemain ; l'arrestation de la nuit coupe avant `morning`
 * [R-02b.28]. Le choix `audition.j7` exécute la nuit 7 : `nightEnd 7` puis `closing` [R-02b.27].
 */
import type { ChoiceData, ChoiceOptionData } from '../../data/schema/street';
import { isValidAct } from '../../shared/acts';
import {
  CLOSING_MINUTE, MORNING_MINUTE, type ActRecord, type DayIndex, type DayMode, type DayState, type GameClock, type KitItemState,
  type LedgerEntry, type NightLedger,
} from '../../shared/types/street';
import { closeNight, NAMES_COUNTER, startSurvival, survivalEntry, type IntegrityConfig, type Palier, type SurvivalEnding } from '../../survival';
import {
  gateStatuses, pushRoutine, stepWeek, WEEK_STEPS, type CalendarHook, type WeekState,
} from '../week';
import { lanesOpen, laneOutcome } from './checkpoint';
import { canExit, DOOR_FORCING, DOOR_NOON, pendingChoices } from './choices';
import { momentOf, startDay } from './clock';
import { KIT_EVENT_BY_ENTRY, KIT_EVENTS, KIT_FLAG_BY_EVENT, kitAfter } from './kit';
import { rightLineFor } from './rights';
import type { DayExtra, Rejected, RejectReason, StreetContext, StreetFlag, StreetState } from './types';
import { echoKeyOf, knownActKinds, streetActKinds } from './verbs';
import { buildLedger, NAME_OPTION } from './words';

/** Résultat d'un acte accepté : le nouvel état de rue et la nouvelle semaine de monde. */
export interface Reduced { readonly state: StreetState; readonly week: WeekState }
/** Un acte accepté ou refusé. */
export type ReduceResult = Reduced | Rejected;

// Vocabulaire du jeu (ids d'actes, de lieux, de portes) : ce ne sont pas des valeurs de jeu, leurs jours et leurs durées sont des données.
const HOME = 'home';
const REGISTRE = 'registre';
const CHECKPOINT_LANE = 'checkpoint';
const SLEEP_ID = 'night';
const STALL_NPC = 'nadia';
/** Bons de parole crédités par mot acheté chez Nadia : « un bon est un mot » [bible w10 l.449, l.766 ; arbitrage du directeur 2026-11-07]. */
export const BONS_PER_WORD = 1;
/** Porte du monde dont la fermeture passe le checkpoint en « porte fermée » : `gateClosed` s'écrit au crochet `morning`, nulle part ailleurs [R-02b.45]. */
const GATE_CHECKPOINT = 'vault-checkpoint';
/** `endId` d'une arrestation dans la nuit, avant l'audition : l'entrée du bilan est alors `earlyEnd` [R-02b.28]. */
export const EARLY_END_ID = 'arrested';
/** Jalon de l'audition du J7 [R-02b.27]. */
export const AUDITION_JALON = 'audition.j7';
/** Options de la porte de midi qui forcent la voie `comply` au checkpoint [R-02b.52 (2) ; le refus aussi : design/ui/2026-11-02-porte-midi-refus-gd.md]. */
/** Entrée écrite au plus une fois par jour, quel que soit le nombre de chemins qui y mènent [R-02b.52 (2)]. */
const ABSENT_ENTRY = 'absentRegistre';
/** Choix de lecture de la liste de Berenice, qui arme le droit 5 [R-02b.51, R-02b.59, R-02b.62 ; id lu dans les données de T11]. */
const LIST_READ_CHOICE = 'm4.list';
/** Événement de kit de l'échange avec Yusuf : pose `guide` quand le composant passe de `kept` à `handedOver` [R-02b.66]. */
const GUIDE_EVENT = 'm5.exchange';
/** Événement de kit de la demande de permis : arme le droit 2 [R-02b.51]. */
const PERMIT_REQUEST_EVENT = 'permit.request';
/** Voies d'achat reconnues par `laneOutcome`. */
const BUY_OPTIONS: ReadonlySet<string> = new Set(['buy:bons', 'buy:permission', 'buy:component']);
/** Voies que l'acte `lane` accepte [R-02b.49, R-02b.52] ; `refuse` est le demi-tour, jamais une voie. */
const PLAIN_LANES: ReadonlySet<string> = new Set(['comply', 'bypass', 'courtesy', 'refuse']);
/** Drapeaux qui ne durent qu'un jour : remis à zéro au matin (`gateClosed` est recalculé au crochet `morning`). */
const DAILY_FLAGS: readonly StreetFlag[] = ['left', 'workDone', 'slept', 'gateClosed'];
const EMPTY_EXTRA: DayExtra = { entries: [], spent: 0 };

type Step = { readonly s: StreetState; readonly week: WeekState } | Rejected;

const cfgOf = (ctx: StreetContext): IntegrityConfig => ctx.world.survival as unknown as IntegrityConfig;
const closeKey = (day: number, id: string): string => `${day}.${id}`;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const reject = (act: ActRecord, reason: RejectReason): Rejected => ({ act, reason });

/** Dit le droit du moment s'il y en a un et que personne ne l'a dit : la ligne est un effet du moment, pas d'un acte [R-L3]. */
function withRight(s: StreetState, ctx: StreetContext): StreetState {
  const right = rightLineFor(s, ctx);
  if (right === null) return s;
  return { ...s, rightsMet: [...s.rightsMet, right], rightLines: { ...s.rightLines, [closeKey(s.day, s.moment)]: right } };
}

/** État de départ : J1 à l'ouverture de la rue, au logement, kit sur soi, jauge à sa valeur de départ. */
export function createStreet(ctx: StreetContext): StreetState {
  const base: StreetState = {
    day: 1, clock: startDay(1, ctx.street).clock, carry: 0, moment: 'lever', location: 'home', phase: 'idle', designated: null,
    acts: [], confirmed: {}, kit: Object.fromEntries(ctx.world.kit.map((k) => [k.id, 'kept' as KitItemState])), bons: 0,
    rightsMet: [], rightLines: {}, survival: startSurvival(cfgOf(ctx)), readings: [], ledgers: [], flags: {}, ended: null, dayExtra: EMPTY_EXTRA,
  };
  return withRight(base, ctx);
}

/** Ajoute des sources au relevé du jour, une fois chacune pour `absentRegistre`. */
function addEntries(extra: DayExtra, sources: readonly string[], at: GameClock, ctx: StreetContext): DayExtra {
  const cfg = cfgOf(ctx);
  const entries = [...extra.entries];
  for (const source of sources) {
    if (source === ABSENT_ENTRY && entries.some((e) => e.source === source)) continue;
    entries.push(survivalEntry(source, at, cfg));
  }
  return { ...extra, entries };
}

/**
 * Relevé du jour `day` : celui des actes (`buildLedger`) plus ce que le jour a versé en dehors d'eux (`dayExtra`). Un nom donné par une
 * option à `entries` crédite `perName` comme l'option `name` [bible w10 §7.2] ; les entrées sont triées comme dans `buildLedger` [R-02b.17].
 */
export function ledgerOf(s: StreetState, day: DayIndex, ctx: StreetContext): NightLedger {
  const base = buildLedger(day, s.acts, ctx);
  if (s.day !== day) return base;
  const cfg = cfgOf(ctx);
  const names = s.dayExtra.entries.filter((e) => cfg.entries[e.source]?.counter === NAMES_COUNTER).length;
  const entries: LedgerEntry[] = [...base.entries, ...s.dayExtra.entries]
    .sort((x, y) => x.at.day - y.at.day || x.at.minute - y.at.minute || cmp(x.source, y.source));
  return { ...base, entries, wordsSpent: base.wordsSpent + s.dayExtra.spent, wordsCredited: base.wordsCredited + names * cfg.words.perName, orders: base.orders + (s.dayExtra.orders ?? 0) };
}

/**
 * Palier du relevé que la nuit du jour courant donnera, sans rien muter : `closeNight` pur sur le relevé du jour [UI-C D3].
 * Le soir s'affiche avant le coucher : `readings.at(-1)` donnerait le palier de la veille. Même appel que `onSleep` et `onAudition`.
 */
export function eveningPalier(s: StreetState, ctx: StreetContext): Palier {
  return closeNight(s.survival, ledgerOf(s, s.day, ctx), cfgOf(ctx)).reading.palier;
}

/** Passe d'un crochet du plan 01, observé par `ctx.onHook`. */
function hook(week: WeekState, h: CalendarHook, at: GameClock, ctx: StreetContext): WeekState {
  ctx.onHook?.(h);
  return stepWeek(week, ctx.world, ctx.core, h, at);
}

function checkpointPassed(s: StreetState): boolean {
  return s.acts.some((a) => a.day === s.day && a.kind === 'lane' && a.id === CHECKPOINT_LANE && a.option !== 'refuse');
}
function laneDone(s: StreetState): boolean {
  return s.acts.some((a) => a.day === s.day && a.kind === 'lane' && a.id === CHECKPOINT_LANE);
}

/** Lit l'acte dans l'état : acte ajouté, horloge avancée à l'acte (`carry` perdu si l'horloge a bougé). */
function took(at: StreetState, a: ActRecord, patch: Partial<StreetState> = {}): StreetState {
  return { ...at, acts: [...at.acts, a], ...patch };
}

// --- verbes -----------------------------------------------------------------------------------------------------------------------

function onExit(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  if (a.id === HOME) {
    if (at.location !== HOME) return reject(a, 'outOfOrder');
    if (!canExit(at, ctx).ok) return reject(a, 'exitBlocked');
    return { s: took(at, a, { location: 'street', flags: { ...at.flags, left: true } }), week };
  }
  if (a.id === REGISTRE) {
    if (at.location !== REGISTRE) return reject(a, 'outOfOrder');
    return { s: took(at, a, { location: 'street', flags: { ...at.flags, workDone: true } }), week };      // workDone = sorti du Registre [R-02b.47]
  }
  return reject(a, 'invalidAct');
}

function onEnter(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  if (a.id === REGISTRE) {
    if (ctx.street.registre.closedDays.includes(at.day)) return reject(a, 'registreClosed');
    if (at.location !== 'street' || !checkpointPassed(at)) return reject(a, 'outOfOrder');
    return { s: took(at, a, { location: REGISTRE }), week };
  }
  if (a.id === HOME) {
    if (at.location !== 'street') return reject(a, 'outOfOrder');
    return { s: took(at, a, { location: HOME }), week };
  }
  return reject(a, 'invalidAct');
}

function onSay(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  if (ctx.street.lines.say[a.id] === undefined) return reject(a, 'unknownLine');
  return { s: took(at, a), week };
}

function onUse(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  if (!ctx.world.kit.some((k) => k.id === a.id)) return reject(a, 'invalidAct');
  if (at.kit[a.id] !== 'kept') return reject(a, 'outOfOrder');                    // l'objet n'est pas sur soi
  const key = echoKeyOf(a, ctx.street);
  return { s: took(at, a), week: key === null ? week : pushRoutine(week, ctx.world, key) };
}

function onBuyWords(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  if (a.id !== STALL_NPC) return reject(a, 'invalidAct');
  const stall = ctx.street.npcs.find((n) => n.id === STALL_NPC);
  if (stall === undefined || !stall.days.includes(at.day)) return reject(a, 'stallClosed');
  const n = Number(a.option);
  if (!Number.isInteger(n) || n <= 0) return reject(a, 'unknownOption');
  // Le stock de l'étal borne les mots vendus sur toute la semaine (bible w10 l.766) ; il vit dans les données du PNJ.
  const sold = at.acts.reduce((t, x) => (x.kind === 'buyWords' && x.id === STALL_NPC ? t + Number(x.option) : t), 0);
  if (stall.stock !== undefined && sold + n > stall.stock) return reject(a, 'stallEmpty');
  return { s: took(at, a, { bons: at.bons + n * BONS_PER_WORD }), week };
}

function onLane(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  if (a.id !== CHECKPOINT_LANE) return reject(a, 'invalidAct');
  const opt = a.option;
  if (opt === null || !(PLAIN_LANES.has(opt) || BUY_OPTIONS.has(opt))) return reject(a, 'unknownOption');
  if (at.location !== 'street') return reject(a, 'outOfOrder');
  if (laneDone(at)) return reject(a, 'choiceClosed');
  // La porte de midi « go » ou « refuse » force la voie comply, quelle que soit l'option [R-02b.52 (2)] ; la voie gardée dans `acts` est l'option EFFECTIVE (`door.noon go` range `comply`), jamais celle qui a été jouée.
  const eff: ActRecord = DOOR_FORCING.has(at.confirmed[closeKey(at.day, DOOR_NOON)] ?? '') ? { ...a, option: 'comply' } : a;
  if (eff.option === 'courtesy' && !lanesOpen(at, ctx).includes('courtesy')) return reject(a, 'unknownOption');
  if (eff.option === 'buy:component' && at.kit['component'] !== 'kept') return reject(a, 'unknownOption');
  const price = ctx.street.checkpoint.bonsPrice[at.flags.gateClosed === true ? 'closedGate' : 'normal'];
  if (eff.option === 'buy:bons' && at.bons < price) return reject(a, 'bonsInsufficient');

  const out = laneOutcome(at, ctx, eff);
  // Patrouille : retour à la file puis « se plier » (14 mots, fouille) ; les deux heures perdues sont déjà celles de la patrouille [bible w10 §7.4].
  const then = out.forcedComply ? laneOutcome(at, ctx, { ...eff, option: 'comply' }) : null;
  const sources = [...out.entries, ...(then?.entries ?? [])];
  let kit = at.kit;
  for (const e of sources) { const ev = KIT_EVENT_BY_ENTRY[e]; if (ev !== undefined) kit = kitAfter(kit, ev); }
  if (eff.option === 'buy:component') kit = kitAfter(kit, 'buy:component');
  // Patrouille : « retour à la file puis se plier » (bible w10 l. 534) ; la voix de la file donne la consigne (l. 363), comme `comply` [N9].
  const queued = then === null ? at.dayExtra : { ...at.dayExtra, orders: (at.dayExtra.orders ?? 0) + 1 };
  const extra = addEntries({ ...queued, spent: at.dayExtra.spent + (then?.words ?? 0) + (eff.option === 'buy:bons' ? price : 0) }, sources, { day: a.day, minute: a.minute }, ctx);
  const minute = Math.min(a.minute + out.minutes, ctx.street.clock.dayEndMinute);
  // Le guide ne vaut que pour « un passage » : effacé après la première voie `bypass` acceptée [R-02b.66 ; à confirmer: world-builder].
  const flags = eff.option === 'bypass' && at.flags.guide === true ? Object.fromEntries(Object.entries(at.flags).filter(([k]) => k !== 'guide')) : at.flags;
  const s = took(at, eff, {
    kit, flags, dayExtra: extra, bons: eff.option === 'buy:bons' ? at.bons - price : at.bons,
    clock: { day: a.day, minute }, carry: out.minutes === 0 ? at.carry : 0,
    confirmed: { ...at.confirmed, [closeKey(at.day, `checkpoint.j${at.day}`)]: eff.option as string },
  });
  return { s, week };
}

/** Nuit 7 et fin : l'issue vient du relevé de la nuit 6 [R-02b.27]. */
function auditionEnd(s: StreetState, ctx: StreetContext): string | null {
  const ending: SurvivalEnding | null | undefined = s.readings.find((r) => r.day === cfgOf(ctx).lastNight)?.ending;
  if (ending === undefined || ending === null) return null;
  return ending.kind === 'arrested' ? 'arrestedAudition' : ending.kind;
}

function onChoice(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  const c: ChoiceData | undefined = ctx.street.choices.find((x) => x.id === a.id);
  const jalon = ctx.street.jalons.find((j) => j.id === a.id);
  if ((c === undefined && jalon === undefined) || a.id.startsWith('checkpoint.')) return reject(a, 'unknownChoice');   // le checkpoint s'écrit `lane`
  if (closeKey(at.day, a.id) in at.confirmed) return reject(a, 'choiceClosed');
  // Porte de midi et jalons : dus seulement à leur heure ; les autres choix : ouverts le jour que la donnée dit [pendingChoices ne liste que les premiers].
  const gated = a.id === DOOR_NOON || jalon !== undefined;
  const open = gated ? pendingChoices(at, ctx).includes(a.id) : c!.days.includes(at.day);   // la liste `days` fait foi [R-02b.64]
  if (!open) return reject(a, 'unknownChoice');
  if (a.option === null) return reject(a, 'unknownOption');
  const option: ChoiceOptionData | undefined = c?.options.find((o) => o.id === a.option);
  if (c !== undefined && option === undefined) return reject(a, 'unknownOption');

  const at2 = { day: a.day, minute: a.minute };
  let extra = at.dayExtra;
  if (option?.entries !== undefined && a.option !== NAME_OPTION) extra = addEntries(extra, option.entries, at2, ctx);   // `name` : buildLedger l'écrit déjà
  let kit = at.kit;
  let flags = at.flags;
  const ev = option?.kitEvent !== undefined && KIT_EVENTS.has(option.kitEvent) ? option.kitEvent : null;   // l'option ne déclenche que l'événement qu'elle déclare
  if (ev !== null) {
    kit = kitAfter(kit, ev);
    const flag = KIT_FLAG_BY_EVENT[ev];
    if (flag !== undefined) flags = { ...flags, [flag]: true };
    if (ev === PERMIT_REQUEST_EVENT) flags = { ...flags, permitRequested: true };
    // Le guide naît de l'échange seul, et seulement quand le composant change vraiment de mains [R-02b.66 ; bible w10 l.531, l.744].
    if (ev === GUIDE_EVENT && at.kit['component'] === 'kept' && kit['component'] === 'handedOver') flags = { ...flags, guide: true };
  }
  if (a.id === LIST_READ_CHOICE && option?.isRefusal !== true) flags = { ...flags, listRead: true };
  const key = echoKeyOf(a, ctx.street);
  const w = key === null ? week : pushRoutine(week, ctx.world, key);
  const s = took(at, a, {
    phase: 'idle', designated: null, confirmed: { ...at.confirmed, [closeKey(at.day, a.id)]: a.option }, kit, flags, dayExtra: extra,
  });
  return a.id === AUDITION_JALON ? onAudition(s, w, a, ctx) : { s, week: w };
}

/** `choice audition.j7` : pose la fin depuis le relevé de la nuit 6 puis joue la nuit 7 (relevé, `nightEnd 7`, `closing`) [R-02b.27]. */
/** Choix narratif d'une scène guidée : l'acte est posé, rien d'autre ne bouge (les mots passent au relevé, les marques au plan rue guidée). */
function onScene(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  const scene = ctx.street.guided?.scenes.find((x) => x.id === a.id);
  if (scene === undefined) return reject(a, 'unknownChoice');
  if (scene.ask.kind !== 'narrative' || a.option === null || !scene.ask.options.some((o) => o.id === a.option)) return reject(a, 'unknownOption');
  if (scene.day !== at.day) return reject(a, 'outOfOrder');
  if (at.acts.some((x) => x.day === at.day && x.kind === 'scene' && x.id === a.id)) return reject(a, 'choiceClosed');
  return { s: took(at, a), week };
}

function onAudition(s: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  const endId = auditionEnd(s, ctx);
  if (endId === null) return reject(a, 'outOfOrder');                              // aucune nuit 6 relevée : l'audition n'a pas de sujet
  const ledger = ledgerOf(s, s.day, ctx);
  const { state: survival, reading } = closeNight(s.survival, ledger, cfgOf(ctx));
  const night = { day: s.day, minute: CLOSING_MINUTE };
  let w = hook(week, { kind: 'nightEnd', day: s.day }, night, ctx);
  w = hook(w, { kind: 'closing' }, night, ctx);
  return {
    s: { ...s, survival, readings: [...s.readings, reading], ledgers: [...s.ledgers, ledger], ended: { endId, at: { day: a.day, minute: a.minute } } },
    week: w,
  };
}

function onSleep(at: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): Step {
  if (a.id !== SLEEP_ID) return reject(a, 'invalidAct');
  if (at.day >= WEEK_STEPS) return reject(a, 'auditionPending');                  // le J7 se clôt par l'audition ; après, tout est `ended`
  const s1 = took(at, a);
  const ledger = ledgerOf(s1, s1.day, ctx);
  const { state: survival, reading } = closeNight(s1.survival, ledger, cfgOf(ctx));
  const s2: StreetState = {
    ...s1, survival, readings: [...s1.readings, reading], ledgers: [...s1.ledgers, ledger], flags: { ...s1.flags, slept: true },
  };
  let w = hook(week, { kind: 'nightEnd', day: s2.day }, { day: s2.day, minute: CLOSING_MINUTE }, ctx);
  const e = reading.ending;
  if (e !== null && e.kind === 'arrested' && typeof e.at === 'number') {           // arrêté dans la nuit : pas de matin [R-02b.28]
    return { s: { ...s2, ended: { endId: EARLY_END_ID, at: { day: a.day, minute: a.minute } } }, week: w };
  }
  const next = (s2.day + 1) as DayIndex;
  w = hook(w, { kind: 'morning', day: next }, { day: next, minute: MORNING_MINUTE }, ctx);
  const closed = gateStatuses(w.ws, ctx.world).find((g) => g.id === GATE_CHECKPOINT)?.closed === true;
  const kept = Object.fromEntries(Object.entries(s2.flags).filter(([k]) => !DAILY_FLAGS.includes(k as StreetFlag)));
  const { clock } = startDay(next, ctx.street);
  return {
    s: { ...s2, day: next, clock, carry: 0, location: HOME, phase: 'idle', designated: null, flags: closed ? { ...kept, gateClosed: true } : kept, dayExtra: EMPTY_EXTRA },
    week: w,
  };
}

/**
 * Applique un acte. Rend l'état suivant et la semaine suivante, ou un `Rejected`. Le moment et la ligne de droit du moment se recalculent
 * à chaque acte accepté ; le panneau de choix est refermé par tout acte de choix (`phase` `idle`, `designated` `null`).
 */
export function reduceAct(s: StreetState, week: WeekState, a: ActRecord, ctx: StreetContext): ReduceResult {
  if (s.ended !== null) return reject(a, 'ended');
  if (!streetActKinds.has(a.kind)) return reject(a, 'unknownKind');
  if (!isValidAct(a, knownActKinds())) return reject(a, 'invalidAct');
  if (a.day > s.day) return reject(a, 'dayGap');
  if (a.day < s.day || a.minute < s.clock.minute) return reject(a, 'outOfOrder');
  const at: StreetState = { ...s, clock: { day: a.day, minute: a.minute }, carry: a.minute === s.clock.minute ? s.carry : 0 };
  let r: Step;
  switch (a.kind) {
    case 'sleep': r = onSleep(at, week, a, ctx); break;
    case 'exit': r = onExit(at, week, a, ctx); break;
    case 'enter': r = onEnter(at, week, a, ctx); break;
    case 'say': r = onSay(at, week, a, ctx); break;
    case 'use': r = onUse(at, week, a, ctx); break;
    case 'buyWords': r = onBuyWords(at, week, a, ctx); break;
    case 'lane': r = onLane(at, week, a, ctx); break;
    case 'choice': r = onChoice(at, week, a, ctx); break;
    case 'scene': r = onScene(at, week, a, ctx); break;
    default: r = { s: took(at, a), week };                                          // glance, obey : comptés au relevé, sans autre effet
  }
  if ('reason' in r) return r;
  const moved: StreetState = { ...r.s, moment: momentOf(r.s, ctx.street) };
  return { state: moved.ended === null ? withRight(moved, ctx) : moved, week: r.week };
}

/** Jour de bascule : un jalon du monde le date, l'audition exceptée (jour contraint) ; w10 n'a aucun jour libre [GDD 05 §3.2 ; à confirmer: game-designer]. */
function modeOf(day: DayIndex, ctx: StreetContext): DayMode {
  return ctx.street.jalons.some((j) => j.day === day && j.id !== AUDITION_JALON) ? 'bascule' : 'contraint';
}

/** La forme que lit le plan 02a : un `DayState` du jour courant, tiré de l'état de rue et de la semaine. */
export function toDayState(s: StreetState, week: WeekState, ctx: StreetContext): DayState {
  return {
    clock: s.clock, mode: modeOf(s.day, ctx), moment: s.moment, ws: week.ws, readings: week.readings, gates: gateStatuses(week.ws, ctx.world),
    ledger: ledgerOf(s, s.day, ctx), survival: s.survival, rightsMet: s.rightsMet, kit: s.kit, ended: s.ended,
  };
}
