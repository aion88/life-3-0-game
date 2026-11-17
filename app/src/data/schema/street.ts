/**
 * Bloc `street` d'un fichier de monde : horloge, moments, Registre, regards, checkpoint, lignes, PNJ, compteur du mur
 * [GDD 05 §3.1 ; bible w10 §5.0, §5.2 c, §7.1, §7.3, §7.4, §8.4 ; plan 02b T1]. Schéma strict : une clé inconnue ou une
 * valeur hors grille lève une `DataLoadError` avec son chemin. Les valeurs vivent dans le JSON, jamais dans le moteur.
 * Ce fichier est le chargeur : `Math.cos` y est permis pour dériver `cos2Milli` (le moteur ne l'a pas, R-02b.4).
 */
import { z } from 'zod';
import { addCrossIssue } from './common';
import { CLOSING_MINUTE, MORNING_MINUTE, RIGHT_IDS, type DayIndex, type MomentId, type RightId } from '../../shared/types/street';
import type { PalierId } from './world';
import { parseGuided, type GuidedData } from './guided';

/** Horloge entière : 12 s réelles par heure de jeu (w10, playtest 2026-11-03 §3 A, borne haute du design §4.4), de 7 h à 22 h [GDD 05 §3.1, bible w10 §5.0]. */
export interface ClockData { readonly msPerHour: number; readonly dayStartMinute: number; readonly dayEndMinute: number }

/** Bornes des moments : midi (limite de la rue aller) et début du soir [GDD 05 §3.1, R-C5]. Les six fenêtres sont dérivées par le moteur. */
export interface MomentsData { readonly noonMinute: number; readonly eveningMinute: number }

/** Jours où le Registre est fermé, et jours où la relecture est ouverte [GDD 05 §3.1, bible w10 §8.2 bis]. */
export interface RegistreData { readonly closedDays: readonly DayIndex[]; readonly relectureDays: readonly DayIndex[] }

/** Nacelles et regards [bible w10 §5.0, §7.1, §7.3]. `cos2Milli` est DÉRIVÉ de `coneDeg` au chargement, jamais écrit dans les données. */
export interface GazeData {
  readonly coneDeg: number; readonly cos2Milli: number; readonly holdMs: number; readonly rangeM: number; readonly rangeWideM: number;
  readonly widePaliers: readonly PalierId[]; readonly nacelleZ: readonly number[];
}

/** Les trois façons de passer le checkpoint [bible w10 §7.4]. */
export interface CheckpointData {
  readonly z: number; readonly drawAnchorHour: number;
  readonly forcedWords: { readonly comply: number; readonly buy: number };
  readonly minutes: { readonly comply: number; readonly buy: number; readonly bypass: number; readonly closedGate: number; readonly patrol: number };
  readonly bypassWeights: readonly [number, number, number]; readonly guideWeights: readonly [number, number];
  readonly closedGateWeights: readonly [number, number, number]; readonly informant: readonly [number, number];
  readonly bonsPrice: { readonly normal: number; readonly closedGate: number };
}

/** Un PNJ ou un signal de rue : jours, plage horaire, paliers où il est là (`null` = tous) [bible w10 §8.4, §7.1]. Aucune position. */
export interface NpcData {
  readonly id: string; readonly days: readonly DayIndex[]; readonly fromMinute: number; readonly toMinute: number;
  readonly paliers: readonly PalierId[] | null; readonly lineKeys: readonly string[];
  /** Mots que le PNJ peut vendre sur la semaine (étal de Nadia : 40, bible w10 l.766) ; absent = pas d'étal. */
  readonly stock?: number;
}

/** Compteur du mur de téléviseurs [bible w10 §5.2 c]. */
export interface WallCounterData { readonly start: number; readonly perFlag: number }

/** Réplique du joueur : coût en mots en DONNÉE, jamais le décompte de la chaîne [plan 02b, Global Constraints]. */
export interface SayLine { readonly key: string; readonly words: number; readonly question: boolean; readonly flaggedWords: number }
/** Ligne de dossier lue à la relecture d'un jour ; `whenEntry` est l'entrée de la jauge qui la déclenche, ou `null` [R-02b.7]. */
export interface RelectureLine { readonly key: string; readonly whenEntry: string | null }
/** Jours de relecture ouverte. */
export type RelectureDay = '1' | '2' | '4' | '5' | '6';

/** Règle d'écho : un acte de ce `kind` dont l'id vaut `idPrefix` ou commence par `idPrefix.` pousse la clé `key` de `routineEcho.table` [R-02b.41]. */
export interface EchoEntry { readonly kind: 'use' | 'choice'; readonly idPrefix: string; readonly key: string }

/**
 * Trace du lendemain d'une option [GDD 05 §3.3, F4 ; D133] : `key` est la clé de la chaîne qui la dit (le texte peut manquer, dette du
 * world-builder), `day` le jour où elle se voit. Pour un choix ouvert plusieurs jours, `day` est celui du premier jour plus un.
 */
export interface TraceData { readonly key: string; readonly day: DayIndex }
/**
 * Option d'un choix à prix [R-02b.48, R-02b.52, R-02b.54]. `priceRef` : RÉFÉRENCE À LA BIBLE du prix (`§7.4`, `§8.1`…) ou `neutre` (V9) ;
 * `priceLineKey` : clé de la ligne de prix dite avant confirmation, `null` tant que la spec n'écrit aucune ligne (V3b, dette du writer).
 * `words` : coût en mots de l'option (0 par défaut). `entries` : sources d'entrée de relevé que l'option écrit, lues dans `survival.entries`.
 * `kitEvent` : événement de kit que l'option déclenche (un élément de `KIT_EVENTS`). `trace` : trace du lendemain, `null` si la bible n'en
 * écrit pas (dette). `neutral` : geste neutre, sans prix ni trace due (`priceRef` vaut `neutre`).
 */
export interface ChoiceOptionData {
  readonly id: string; readonly isRefusal: boolean; readonly priceRef: string; readonly priceLineKey: string | null; readonly words: number;
  readonly entries?: readonly string[]; readonly kitEvent?: string; readonly trace: TraceData | null; readonly neutral: boolean;
}
/** Nature d'un choix : `offer` est une offre de jalon (J2 à J5, une par jour au plus, GDD 04 §3.4), `gesture` un geste de rue. */
export type ChoiceKind = 'offer' | 'gesture';
/**
 * Choix à prix [GDD 05 §3.4]. `day` : le jour où le moteur l'ouvre (`null` = tout jour de `days`). `days` : les jours où il est offert
 * (V2, V12). `blocksExit` : tant qu'il n'est pas confirmé, on ne sort pas du logement (la porte du J2, D138). Chaque choix a une
 * option de refus au même rang [R-C3].
 */
export interface ChoiceData {
  readonly id: string; readonly kind: ChoiceKind; readonly day: DayIndex | null; readonly days: readonly DayIndex[]; readonly blocksExit: boolean;
  readonly options: readonly ChoiceOptionData[];
}
/** Condition d'un jalon : le choix `choiceId` est confirmé avec l'une des `options` (le joueur était absent à 10 h au J2, D138). */
export interface JalonRequires { readonly choiceId: string; readonly options: readonly string[] }
/**
 * Jalon du monde qui vient [R-C4 ; bible w10 §8.1]. `atMinute` : heure de repli (`null` = pas d'heure) ; `waitsFor` : le jalon attend la
 * sortie de l'immeuble (`exitBuilding`) ou le retour à la porte (`door`) ; `requires` : condition sur un choix (`null` = aucune).
 */
export interface JalonData {
  readonly id: string; readonly kind: 'world'; readonly day: DayIndex; readonly atMinute: number | null;
  readonly waitsFor: 'exitBuilding' | 'door' | null; readonly requires: JalonRequires | null;
}

/**
 * Contact d'un droit avec le joueur [bible w10 §4.5 ; GDD 05 §3.3]. `moment` : le moment daté de la ligne (`null` = au premier moment libre) ;
 * `latestMinute` : au plus tard à cette minute du jour `day` (`null` = pas d'heure) ; `conditional` : le contact attend un drapeau
 * (permis demandé, liste lue) et prend le premier moment libre [R-02b.51].
 */
export interface RightContact {
  readonly right: RightId; readonly day: DayIndex; readonly moment: MomentId | null; readonly latestMinute: number | null; readonly conditional: boolean;
}
/** Bloc des droits : le calendrier des huit contacts, les textes vivent sous `w10.right.<id>` [R-02b.51]. */
export interface RightsData { readonly contacts: readonly RightContact[] }

/** Micro-situation disponible un jour donné : une entrée par jour de disponibilité ; `traceKey` : trace du lendemain, `null` si aucune (trois sur cinq au moins, V6) [bible w10 §8.2]. */
export interface MicroData { readonly id: string; readonly day: DayIndex; readonly traceKey: string | null }
/** Type d'une case de la grille des axes : décision, constat, dette nommée, exception de jour de clôture [GDD 05 §3.6]. */
export type AxisCellType = 'D' | 'G' | 'V' | 'E';
/** Une case de la grille jour par axe ; `owner` est le propriétaire d'une dette (case D), vide sinon [GDD 05 §3.6]. */
export interface AxisCell { readonly day: DayIndex; readonly axis: 'vie' | 'travail' | 'rue' | 'liens' | 'pouvoir' | 'ia'; readonly type: AxisCellType; readonly owner: string }
/** Objet cliquable de la rue et la clé de la chaîne qui lui répond [bible w10 §5.0 ; R-L1]. */
export interface ClickableData { readonly id: string; readonly responseKey: string }
/** Exception nommée : un jour de clôture ou l'absence de jour libre, avec sa source [GDD 05 §3.2, §3.6]. */
export interface ExceptionData { readonly id: string; readonly day: DayIndex | null; readonly source: string }

/** Une ligne du soir : la clé de chaîne dite quand l'axe a un geste (`fait`), celle dite sinon (`rien`) [GDD 05 §3.5]. */
export interface EveningLineData { readonly axis: 'vie' | 'travail' | 'rue' | 'liens' | 'pouvoir' | 'ia'; readonly fait: string; readonly rien: string }
/** Relevé du soir : l'axe de chaque geste (id de choix ou `checkpoint`) et les six lignes [GDD 05 §3.5, §3.6 ; R-02b.54 (b)]. */
export interface EveningData { readonly gestureAxis: Readonly<Record<string, EveningLineData['axis']>>; readonly lines: readonly EveningLineData[] }

/** Donnée de rue d'un monde [plan 02b]. Toutes les clés sont obligatoires. */
export interface StreetData {
  readonly clock: ClockData;
  readonly moments: MomentsData;
  readonly registre: RegistreData;
  readonly gaze: GazeData;
  readonly checkpoint: CheckpointData;
  readonly lines: {
    readonly say: Readonly<Record<string, SayLine>>;
    readonly relecture: Readonly<Record<RelectureDay, readonly [RelectureLine, RelectureLine]>>;
  };
  /** T4 (checkpoint, portes), T11 (le reste). */ readonly choices: readonly ChoiceData[];
  /** T4. */ readonly jalons: readonly JalonData[];
  /** T11. */ readonly micro: readonly MicroData[];
  /** T9. */ readonly rights: RightsData;
  /** T11 : la grille des 42 cases (7 jours, 6 axes) [GDD 05 §3.6]. */ readonly axes: readonly AxisCell[];
  /** T12. */ readonly evening: EveningData;
  readonly npcs: readonly NpcData[];
  /** T11. */ readonly clickables: readonly ClickableData[];
  /** T3. */ readonly echo: readonly EchoEntry[];
  /** T11 : le jour de clôture E-J7 [GDD 05 §3.6]. */ readonly exceptionJour: ExceptionData | null;
  /** T11 : l'exception « aucun jour libre » du monde [GDD 05 §3.2]. */ readonly exceptionJourLibre: ExceptionData | null;
  readonly wallCounter: WallCounterData;
  /** Journées guidées de la rue (scènes, choix, chaînes) ; `null` tant que le monde n'en porte pas [rue guidée T1]. */ readonly guided: GuidedData | null;
}

const nonEmpty = z.string().min(1);
const dayIndex = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);
const minute = z.number().int().min(0).max(1440);
const count = z.number().int().min(0).max(1000);
const palierId = z.enum(['courtesy', 'thanks', 'patience', 'appointment']);
const echoKey = z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/);
const echoSchema = z.array(z.strictObject({ kind: z.enum(['use', 'choice']), idPrefix: echoKey, key: echoKey }));
const idKey = z.string().regex(/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)*$/);
const optionId = z.string().regex(/^[A-Za-z][A-Za-z0-9]*(:[A-Za-z][A-Za-z0-9]*)?$/);
const momentId = z.enum(['lever', 'rueAller', 'travail', 'rueMidi', 'soir', 'nuit']);
const rightsSchema = z.strictObject({
  contacts: z.array(z.strictObject({
    right: z.enum(RIGHT_IDS as [RightId, ...RightId[]]), day: dayIndex, moment: momentId.nullable(), latestMinute: minute.nullable(), conditional: z.boolean(),
  })),
}).superRefine((r, ctx) => {
  r.contacts.forEach((c, i) => {
    if (r.contacts.findIndex((x) => x.right === c.right) !== i) addCrossIssue(ctx, ['contacts', i, 'right'], 'droit en double : un contact par droit');
    if (c.moment === null && !c.conditional && c.latestMinute === null) {
      addCrossIssue(ctx, ['contacts', i, 'moment'], 'un contact sans moment est conditionnel ou porte une heure limite');
    }
  });
});
const axisEnum = z.enum(['vie', 'travail', 'rue', 'liens', 'pouvoir', 'ia']);
const eveningSchema = z.strictObject({
  gestureAxis: z.record(idKey, axisEnum),
  lines: z.array(z.strictObject({ axis: axisEnum, fait: nonEmpty, rien: nonEmpty })),
}).superRefine((e, ctx) => {
  const order = ['vie', 'travail', 'rue', 'liens', 'pouvoir', 'ia'];
  if (e.lines.length !== order.length || e.lines.some((l, i) => l.axis !== order[i])) {
    addCrossIssue(ctx, ['lines'], 'six lignes, une par axe, dans l\'ordre vie, travail, rue, liens, pouvoir, ia attendues');
  }
});

const RAD_PER_DEG = Math.PI / 180;
/** `cos²(coneDeg / 2)` en millièmes, arrondi une fois, au chargement : 40 degrés donnent 883 [calculé à la main : cos² 20° = 0,8830]. */
function cos2MilliOf(coneDeg: number): number {
  return Math.round(1000 * Math.cos((coneDeg / 2) * RAD_PER_DEG) ** 2);
}

const traceSchema = z.strictObject({ key: nonEmpty, day: dayIndex });
const choiceOptionSchema = z.strictObject({
  id: optionId, isRefusal: z.boolean(), priceRef: z.string().regex(/^§\d+\.\d+$|^neutre$/, 'référence bible « §n.n » ou « neutre »'), priceLineKey: nonEmpty.nullable(), words: count.default(0),
  entries: z.array(nonEmpty).optional(), kitEvent: nonEmpty.optional(), trace: traceSchema.nullable(), neutral: z.boolean(),
});
const choiceSchema = z.strictObject({
  id: idKey, kind: z.enum(['offer', 'gesture']), day: dayIndex.nullable(), days: z.array(dayIndex).min(1), blocksExit: z.boolean().default(false),
  options: z.array(choiceOptionSchema).min(1),
}).superRefine((c, ctx) => {
  c.options.forEach((o, i) => {
    if (c.options.findIndex((x) => x.id === o.id) !== i) addCrossIssue(ctx, ['options', i, 'id'], 'option en double');
  });
  c.days.forEach((d, i) => {
    const prev = c.days[i - 1];
    if (prev !== undefined && d <= prev) addCrossIssue(ctx, ['days', i], 'jours croissants et sans doublon attendus');
  });
  if (c.day !== null && !(c.days.length === 1 && c.days[0] === c.day)) addCrossIssue(ctx, ['days'], '`days` vaut [day] quand le choix est ouvert un seul jour');
});
const choicesSchema = z.array(choiceSchema).superRefine((cs, ctx) => {
  cs.forEach((c, i) => {
    if (cs.findIndex((x) => x.id === c.id) !== i) addCrossIssue(ctx, [i, 'id'], 'choix en double');
  });
});
const microSchema = z.array(z.strictObject({ id: idKey, day: dayIndex, traceKey: nonEmpty.nullable() })).superRefine((ms, ctx) => {
  ms.forEach((m, i) => {
    if (ms.findIndex((x) => x.id === m.id && x.day === m.day) !== i) addCrossIssue(ctx, [i, 'day'], 'micro-situation en double pour ce jour');
  });
});
const AXIS_IDS = ['vie', 'travail', 'rue', 'liens', 'pouvoir', 'ia'] as const;
/** La grille est lue par les validateurs V1 et V5 : le chargeur ne refuse ni case vide ni dette sans propriétaire, il laisse le signal au validateur. */
const axesSchema = z.array(z.strictObject({ day: dayIndex, axis: z.enum(AXIS_IDS), type: z.enum(['D', 'G', 'V', 'E']), owner: z.string() })).superRefine((cells, ctx) => {
  cells.forEach((c, i) => {
    if (cells.findIndex((x) => x.day === c.day && x.axis === c.axis) !== i) addCrossIssue(ctx, [i, 'axis'], 'case en double : un jour et un axe, une seule case');
  });
});
const clickablesSchema = z.array(z.strictObject({ id: idKey, responseKey: nonEmpty })).superRefine((cs, ctx) => {
  cs.forEach((c, i) => {
    if (cs.findIndex((x) => x.id === c.id) !== i) addCrossIssue(ctx, [i, 'id'], 'objet cliquable en double');
  });
});
const exceptionSchema = z.strictObject({ id: nonEmpty, day: dayIndex.nullable(), source: nonEmpty });
const jalonSchema = z.strictObject({
  id: idKey, kind: z.literal('world'), day: dayIndex, atMinute: minute.nullable(),
  waitsFor: z.enum(['exitBuilding', 'door']).nullable(),
  requires: z.strictObject({ choiceId: idKey, options: z.array(optionId).min(1) }).nullable(),
}).superRefine((j, ctx) => {
  if (j.atMinute === null && j.waitsFor === null) addCrossIssue(ctx, ['atMinute'], 'un jalon a une heure ou une attente, au moins une');
});
const jalonsSchema = z.array(jalonSchema).superRefine((js, ctx) => {
  js.forEach((j, i) => {
    if (js.findIndex((x) => x.id === j.id) !== i) addCrossIssue(ctx, [i, 'id'], 'jalon en double');
  });
});

const clockSchema = z.strictObject({
  msPerHour: z.number().int().min(1).max(600_000),
  dayStartMinute: minute,
  dayEndMinute: minute,
}).superRefine((c, ctx) => {
  if (c.dayStartMinute !== MORNING_MINUTE) addCrossIssue(ctx, ['dayStartMinute'], `début du jour = ${MORNING_MINUTE} (MORNING_MINUTE) attendu, reçu ${c.dayStartMinute}`);
  if (c.dayEndMinute !== CLOSING_MINUTE) addCrossIssue(ctx, ['dayEndMinute'], `fin du jour = ${CLOSING_MINUTE} (CLOSING_MINUTE) attendue, reçu ${c.dayEndMinute}`);
});

const momentsSchema = z.strictObject({ noonMinute: minute, eveningMinute: minute }).superRefine((m, ctx) => {
  if (!(MORNING_MINUTE < m.noonMinute && m.noonMinute < m.eveningMinute && m.eveningMinute < CLOSING_MINUTE)) {
    addCrossIssue(ctx, ['eveningMinute'], 'début du jour < midi < soir < fin du jour attendu');
  }
});

const registreSchema = z.strictObject({ closedDays: z.array(dayIndex), relectureDays: z.array(dayIndex) }).superRefine((r, ctx) => {
  const all = [...r.closedDays, ...r.relectureDays].sort();
  if (all.length !== 7 || all.some((d, i) => d !== i + 1)) addCrossIssue(ctx, [], 'chaque jour de 1 à 7 est fermé ou en relecture ouverte, une seule fois');
});

const gazeSchema = z.strictObject({
  coneDeg: z.number().int().min(1).max(179),
  holdMs: z.number().int().min(1).max(60_000),
  rangeM: z.number().int().min(1).max(200),
  rangeWideM: z.number().int().min(1).max(200),
  widePaliers: z.array(palierId),
  nacelleZ: z.array(z.number().int().min(-100).max(100)).min(1),
}).superRefine((g, ctx) => {
  if (g.rangeWideM < g.rangeM) addCrossIssue(ctx, ['rangeWideM'], 'portée longue inférieure à la portée de base');
  if (new Set(g.widePaliers).size !== g.widePaliers.length) addCrossIssue(ctx, ['widePaliers'], 'palier en double');
}).transform((g): GazeData => ({ ...g, cos2Milli: cos2MilliOf(g.coneDeg) }));

const weight = z.number().int().min(0).max(100);
const checkpointSchema = z.strictObject({
  z: z.number().int().min(-100).max(100),
  drawAnchorHour: z.number().int().min(0).max(23),
  forcedWords: z.strictObject({ comply: count, buy: count }),
  minutes: z.strictObject({
    comply: z.number().int().min(1).max(600), buy: z.number().int().min(1).max(600),
    bypass: z.number().int().min(1).max(600), closedGate: z.number().int().min(1).max(600), patrol: z.number().int().min(1).max(600),
  }),
  bypassWeights: z.tuple([weight, weight, weight]),
  guideWeights: z.tuple([weight, weight]),
  closedGateWeights: z.tuple([weight, weight, weight]),
  informant: z.tuple([z.number().int().min(1).max(100), z.number().int().min(2).max(100)]),
  bonsPrice: z.strictObject({ normal: z.number().int().min(1).max(1000), closedGate: z.number().int().min(1).max(1000) }),
}).superRefine((c, ctx) => {
  for (const k of ['bypassWeights', 'guideWeights', 'closedGateWeights'] as const) {
    if (c[k].reduce((a, b) => a + b, 0) <= 0) addCrossIssue(ctx, [k], 'somme des poids nulle : aucun tirage possible');
  }
  if (c.informant[0] >= c.informant[1]) addCrossIssue(ctx, ['informant'], 'numérateur < dénominateur attendu');
  if (c.bonsPrice.closedGate < c.bonsPrice.normal) addCrossIssue(ctx, ['bonsPrice', 'closedGate'], 'prix porte fermée inférieur au prix normal');
  if (c.forcedWords.buy > c.forcedWords.comply) addCrossIssue(ctx, ['forcedWords', 'buy'], 'acheter coûte plus de mots que se plier');
});

const sayLineSchema = z.strictObject({ key: nonEmpty, words: count, question: z.boolean(), flaggedWords: count }).superRefine((l, ctx) => {
  if (l.flaggedWords > l.words) addCrossIssue(ctx, ['flaggedWords'], 'plus de mots signalés que de mots');
});
const relectureLine = z.strictObject({ key: nonEmpty, whenEntry: nonEmpty.nullable() });
const linesSchema = z.strictObject({
  say: z.record(nonEmpty, sayLineSchema),
  relecture: z.partialRecord(z.enum(['1', '2', '4', '5', '6']), z.tuple([relectureLine, relectureLine])),
});

const npcSchema = z.strictObject({
  id: nonEmpty,
  days: z.array(dayIndex).min(1),
  fromMinute: minute,
  toMinute: minute,
  paliers: z.array(palierId).min(1).nullable(),
  /** Vide permis au statut `skeleton` : T11 complète. */
  lineKeys: z.array(nonEmpty),
  stock: z.number().int().min(1).optional(),
}).superRefine((n, ctx) => {
  if (n.fromMinute >= n.toMinute) addCrossIssue(ctx, ['toMinute'], 'plage horaire vide ou inversée');
  if (n.fromMinute < MORNING_MINUTE) addCrossIssue(ctx, ['fromMinute'], `avant le début du jour (${MORNING_MINUTE})`);
  if (n.toMinute > CLOSING_MINUTE) addCrossIssue(ctx, ['toMinute'], `après la fin du jour (${CLOSING_MINUTE})`);
  n.days.forEach((d, i) => {
    const prev = n.days[i - 1];
    if (prev !== undefined && d <= prev) addCrossIssue(ctx, ['days', i], 'jours croissants et sans doublon attendus');
  });
  if (n.paliers !== null && new Set(n.paliers).size !== n.paliers.length) addCrossIssue(ctx, ['paliers'], 'palier en double');
});

const streetBlockSchema = z.strictObject({
  clock: clockSchema,
  moments: momentsSchema,
  registre: registreSchema,
  gaze: gazeSchema,
  checkpoint: checkpointSchema,
  lines: linesSchema,
  choices: choicesSchema,
  jalons: jalonsSchema,
  micro: microSchema,
  rights: rightsSchema,
  axes: axesSchema,
  evening: eveningSchema,
  npcs: z.array(npcSchema),
  clickables: clickablesSchema,
  echo: echoSchema,
  exceptionJour: exceptionSchema.nullable(),
  exceptionJourLibre: exceptionSchema.nullable(),
  wallCounter: z.strictObject({ start: z.number().int().min(0).max(1_000_000), perFlag: z.number().int().min(0).max(1000) }),
  guided: z.unknown().optional(),
}).superRefine((s, ctx) => {
  s.npcs.forEach((n, i) => {
    if (s.npcs.findIndex((o) => o.id === n.id) !== i) addCrossIssue(ctx, ['npcs', i, 'id'], 'PNJ en double');
    if (n.fromMinute < s.clock.dayStartMinute) addCrossIssue(ctx, ['npcs', i, 'fromMinute'], 'avant le début du jour de la rue');
    if (n.toMinute > s.clock.dayEndMinute) addCrossIssue(ctx, ['npcs', i, 'toMinute'], 'après la fin du jour de la rue');
  });
}).transform((s, ctx): StreetData => {
  const { guided, ...rest } = s;
  const base = rest as unknown as Omit<StreetData, 'guided'>;
  if (guided === undefined) return { ...base, guided: null };
  try {
    return { ...base, guided: parseGuided(guided, base) };
  } catch (e) {
    ctx.addIssue({ code: 'custom', path: ['guided'], message: e instanceof Error ? e.message : String(e), params: { kind: 'schema' } });
    return z.NEVER;
  }
});

/** Les clés du bloc encore vides : à zéro avant le passage du monde en `content`. */
export function unfilledStreetKeys(s: StreetData): readonly string[] {
  const out: string[] = [];
  if (Object.keys(s.lines.say).length === 0 || Object.keys(s.lines.relecture).length < 5) out.push('lines');
  for (const k of ['choices', 'jalons', 'micro', 'rights', 'axes', 'evening', 'clickables'] as const) {
    if (Object.keys(s[k]).length === 0) out.push(k);
  }
  if (s.echo.length === 0) out.push('echo');
  return out;
}

/**
 * Schéma du bloc `street`. Les clés inconnues sont rendues une par une avec leur chemin (`street.clockx`), pas au chemin
 * du parent, pour que l'erreur nomme la clé fautive.
 */
export const streetSchema = z.record(z.string(), z.unknown()).transform((raw, ctx): StreetData => {
  const r = streetBlockSchema.safeParse(raw);
  if (r.success) return r.data as unknown as StreetData;
  for (const issue of r.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        ctx.issues.push({ code: 'custom', path: [...issue.path, key], message: `Unrecognized key: "${key}"`, input: raw } as unknown as (typeof ctx.issues)[number]);
      }
    } else {
      ctx.issues.push(issue as unknown as (typeof ctx.issues)[number]);
    }
  }
  return z.NEVER;
});
