/** Fichier de monde : moteur (dérive, écho, portes, pentes), calendrier, kit [GDD 03 §3.3, §3.4 ; GDD 05 §3.2, R-L7]. */
import { z } from 'zod';
import {
  BOUNDS, DataLoadError, addCrossIssue, conditionSchema, dataStatusSchema, deltaSchema, milliPoints, runParse,
  worldIdSchema, EXTINCTION_IDS, type Condition, type DataStatus,
} from './common';
import type { Catalogue } from './catalogue';
import { streetSchema, unfilledStreetKeys, type StreetData } from './street';
import { bilanWorldSchema, type BilanWorldData } from './bilan';
import type { Milli } from '../../shared/milli';
import type { ArrivalWorldId, DayIndex, DayMode, Delta, ExtinctionId } from '../../shared/types';

/** Moteur propre à un monde [GDD 03 §3.3, §3.4]. */
export interface WorldEngine {
  readonly drift: Delta;
  readonly couplingScale100: number;
  readonly routineEcho: { readonly capPerStep: Milli; readonly table: Readonly<Record<string, Delta>> };
  /** null : aucun jalon ne peut porter de wsDelta [GDD 03 Q7]. */
  readonly milestoneCapPerVar: Milli | null;
  readonly milestones: readonly { readonly id: string; readonly wsDelta: Delta | null }[];
  /** Vide en v1 [D128]. */
  readonly events: readonly {
    readonly id: string;
    readonly wsEffect: Delta | null;
    readonly repeatable: boolean;
    readonly perOccurrenceCap: Milli | null;
    readonly maxPerWeek: number | null;
  }[];
  /** '>' ou '<' seulement [GDD 03 §3.4]. */
  readonly gates: readonly { readonly id: string; readonly when: Condition }[];
  readonly slopes: readonly { readonly id: string; readonly to: ArrivalWorldId; readonly readings: readonly Condition[] }[];
  readonly neutralReadings: readonly Condition[];
  readonly projectionExtinctions: readonly ExtinctionId[];
}

/** Les quatre paliers de lecture de la jauge Intégrité [bible w10 §7.1]. */
export type PalierId = 'courtesy' | 'thanks' | 'patience' | 'appointment';

/** Une faute, une offre ou une relecture, lue au relevé de nuit [bible w10 §7.3]. Delta en millièmes. */
export interface IntegrityEntry {
  readonly delta: Milli;
  /** Compteur incrémenté par l'entrée : `names` pour une dénonciation. */
  readonly counter?: string;
  /** Part du delta reportée sur une nuit ultérieure. */
  readonly carry?: { readonly night: number; readonly delta: Milli };
  /** Jours où l'entrée ne coûte rien. */
  readonly zeroOnDays?: readonly DayIndex[];
  /** Mention portée au dossier par la lecture du jour où l'entrée est posée, quel que soit le jour [bible w10 §7.5, §7.6, §7.7]. */
  readonly mention?: string;
}

/** Jauge de survie de w10, tous termes en millièmes sauf les comptes de mots et de regards [bible w10 §7.2 à §7.5]. */
export interface IntegrityConfig {
  readonly start: Milli;
  readonly floor: Milli;
  readonly cap: Milli;
  readonly dossierPerNight: Milli;
  readonly words: {
    /** Base de mots par nuit, une valeur par nuit. */
    readonly base: readonly number[];
    readonly perName: number;
    readonly overrunPerWord: Milli;
    readonly silence: { readonly freeUpTo: number; readonly per: number; readonly cap: Milli };
    /** `maxRemaining` : un nombre pour toutes les nuits, ou une valeur par nuit comme `base` (le J7 prend la dernière). */
    readonly sleep: { readonly value: Milli; readonly maxRemaining: number | readonly number[] };
  };
  readonly glances: { readonly perGlance: Milli; readonly floor: number; readonly cap: number };
  readonly orders: { readonly value: Milli; readonly perDayCap: Milli };
  readonly entries: Readonly<Record<string, IntegrityEntry>>;
  /** Du plus haut au plus bas ; le palier est le premier dont la valeur atteint `from`. */
  readonly paliers: readonly { readonly from: Milli; readonly id: PalierId }[];
  readonly arrest: { readonly nightBelow: Milli; readonly auditionBelow: Milli };
  readonly lastNight: number;
  readonly recruitNames: number;
  readonly report: {
    readonly prices: Readonly<Record<string, 'full' | 'half'>>;
    readonly comforts: readonly string[];
  };
}

/** Bloc `survival` d'un monde sans jauge propre. */
export type EmptySurvival = Readonly<Record<string, never>>;

/** Bloc `bilan` d'un monde sans données de bilan. */
export type EmptyBilan = Readonly<Record<string, never>>;

/** Donnée d'un monde d'arrivée [GDD 03, GDD 05]. */
export interface WorldData {
  readonly status: DataStatus;
  readonly id: ArrivalWorldId;
  readonly engine: WorldEngine;
  /** Nom de jauge et proches, refusés dans les chaînes du monde [GDD 05 R-L7]. */
  readonly forbiddenWords: readonly string[];
  /** Sept jours [GDD 05 §3.2]. */
  readonly calendar: readonly { readonly day: DayIndex; readonly dateKey: string; readonly mode: DayMode }[];
  readonly kit: readonly { readonly id: string; readonly labelKey: string }[];
  /** Plan 01 : la jauge du monde, ou `{}` pour un monde qui n'en a pas encore. */
  readonly survival: IntegrityConfig | EmptySurvival;
  /** Plan 02b : horloge, regards, checkpoint, PNJ, compteur du mur ; les blocs vides ne sont permis qu'au statut `skeleton`. */
  readonly street: StreetData;
  /** Plan 03 : le bloc du bilan, ou `{}` pour un monde qui n'en a pas encore. */
  readonly bilan: BilanWorldData | EmptyBilan;
}

const nonEmpty = z.string().min(1);

const scale = milliPoints({ grid: 10, min: BOUNDS.scale.min, max: BOUNDS.scale.max });

const engineSchema = z.strictObject({
  drift: deltaSchema,
  couplingScale: scale,
  routineEcho: z.strictObject({
    capPerStep: milliPoints({ min: 0, max: BOUNDS.delta.max }),
    table: z.record(nonEmpty, deltaSchema),
  }),
  milestoneCapPerVar: milliPoints({ min: 0, max: BOUNDS.delta.max }).nullable(),
  milestones: z.array(z.strictObject({ id: nonEmpty, wsDelta: deltaSchema.nullable() })),
  events: z.array(
    z.strictObject({
      id: nonEmpty,
      wsEffect: deltaSchema.nullable(),
      repeatable: z.boolean(),
      perOccurrenceCap: milliPoints({ min: 0, max: BOUNDS.delta.max }).nullable(),
      maxPerWeek: z.number().int().min(1).max(1000).nullable(),
    }),
  ),
  gates: z.array(z.strictObject({ id: nonEmpty, when: conditionSchema })),
  slopes: z.array(z.strictObject({ id: nonEmpty, to: worldIdSchema, readings: z.array(conditionSchema).min(1) })),
  neutralReadings: z.array(conditionSchema),
  projectionExtinctions: z.array(z.enum(EXTINCTION_IDS)),
});

const dayIndex = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]);

/** Grille du bloc `survival` : demi-point, donc seuils à n + 0,5 sans égalité possible [errata T14, bible w10 §7.2]. */
const SURVIVAL_GRID = 500;
const pts = (min: number, max: number) => milliPoints({ grid: SURVIVAL_GRID, min, max });
const wordCount = z.number().int().min(0).max(1000);

const integrityEntrySchema = z.strictObject({
  delta: pts(-100, 100),
  counter: nonEmpty.optional(),
  carry: z.strictObject({ night: z.number().int().min(1).max(7), delta: pts(-100, 100) }).optional(),
  zeroOnDays: z.array(dayIndex).optional(),
  mention: nonEmpty.optional(),
});

const integritySchema = z.strictObject({
  start: pts(0, 100),
  floor: pts(0, 100),
  cap: pts(0, 100),
  dossierPerNight: pts(-100, 0),
  words: z.strictObject({
    base: z.array(wordCount).min(1),
    perName: wordCount,
    overrunPerWord: pts(-100, 0),
    silence: z.strictObject({ freeUpTo: wordCount, per: z.number().int().min(1).max(1000), cap: pts(0, 100) }),
    sleep: z.strictObject({ value: pts(0, 100), maxRemaining: z.union([wordCount, z.array(wordCount).min(1)]) }),
  }),
  glances: z.strictObject({ perGlance: pts(-100, 0), floor: wordCount, cap: wordCount }),
  orders: z.strictObject({ value: pts(0, 100), perDayCap: pts(0, 100) }),
  entries: z.record(nonEmpty, integrityEntrySchema),
  paliers: z.array(z.strictObject({ from: pts(0, 100), id: z.enum(['courtesy', 'thanks', 'patience', 'appointment']) })).min(1),
  arrest: z.strictObject({ nightBelow: pts(0, 100), auditionBelow: pts(0, 100) }),
  lastNight: z.literal(6),
  recruitNames: z.number().int().min(1).max(10),
  report: z.strictObject({
    prices: z.record(nonEmpty, z.enum(['full', 'half'])),
    comforts: z.array(nonEmpty),
  }),
}).superRefine((c, ctx) => {
  if (!(c.floor < c.start && c.start <= c.cap)) addCrossIssue(ctx, ['start'], 'floor < start <= cap attendu');
  if (c.words.base.length !== c.lastNight) addCrossIssue(ctx, ['words', 'base'], `${c.lastNight} bases de mots attendues, reçu ${c.words.base.length}`);
  if (Array.isArray(c.words.sleep.maxRemaining) && c.words.sleep.maxRemaining.length !== c.lastNight) addCrossIssue(ctx, ['words', 'sleep', 'maxRemaining'], `${c.lastNight} valeurs attendues, reçu ${c.words.sleep.maxRemaining.length}`);
  if (c.glances.floor > c.glances.cap) addCrossIssue(ctx, ['glances', 'floor'], 'plancher de regards au-dessus du plafond');
  c.paliers.forEach((p, i) => {
    const prev = c.paliers[i - 1];
    if (prev && p.from >= prev.from) addCrossIssue(ctx, ['paliers', i, 'from'], 'paliers décroissants attendus');
  });
  if (new Set(c.paliers.map((p) => p.id)).size !== c.paliers.length) addCrossIssue(ctx, ['paliers'], 'palier en double');
  for (const [src, e] of Object.entries(c.entries)) {
    if (e.carry && e.carry.night > c.lastNight) addCrossIssue(ctx, ['entries', src, 'carry', 'night'], `report après la nuit ${c.lastNight}`);
  }
  for (const id of Object.keys(c.report.prices)) {
    if (!(id in c.entries)) addCrossIssue(ctx, ['report', 'prices', id], `prix ${id} absent de entries`, 'reference');
  }
  c.report.comforts.forEach((id, i) => {
    if (!(id in c.entries)) addCrossIssue(ctx, ['report', 'comforts', i], `confort ${id} absent de entries`, 'reference');
  });
});

/** `{}` pour un monde sans jauge, sinon la jauge complète ; les refus gardent leur chemin sous `survival`. */
const survivalSchema = z.record(z.string(), z.unknown()).transform((raw, ctx): IntegrityConfig | EmptySurvival => {
  if (Object.keys(raw).length === 0) return {};
  const r = integritySchema.safeParse(raw);
  if (r.success) return r.data as IntegrityConfig;
  for (const issue of r.error.issues) ctx.issues.push(issue as unknown as (typeof ctx.issues)[number]);
  return z.NEVER;
});

/** `{}` pour un monde sans bloc de bilan, sinon `bilanWorldSchema` strict et complet ; les refus gardent leur chemin sous `bilan`. */
const bilanSchema = z.record(z.string(), z.unknown()).transform((raw, ctx): BilanWorldData | EmptyBilan => {
  if (Object.keys(raw).length === 0) return {};
  const r = bilanWorldSchema.safeParse(raw);
  if (r.success) return r.data;
  for (const issue of r.error.issues) ctx.issues.push(issue as unknown as (typeof ctx.issues)[number]);
  return z.NEVER;
});

const worldSchemaBase = z.strictObject({
  status: dataStatusSchema,
  id: worldIdSchema,
  engine: engineSchema,
  forbiddenWords: z.array(nonEmpty),
  calendar: z.array(z.strictObject({ day: dayIndex, dateKey: nonEmpty, mode: z.enum(['contraint', 'libre', 'bascule']) })).length(7),
  kit: z.array(z.strictObject({ id: nonEmpty, labelKey: nonEmpty })),
  survival: survivalSchema,
  street: streetSchema,
  bilan: bilanSchema,
});

function duplicates(ids: readonly string[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  ids.forEach((id, i) => {
    if (seen.has(id)) out.push(i);
    seen.add(id);
  });
  return out;
}

/** Nom de fichier par défaut d'un monde, pour les messages. */
function worldFileOf(raw: unknown): string {
  const id = typeof raw === 'object' && raw !== null ? (raw as { id?: unknown }).id : undefined;
  return typeof id === 'string' && /^w\d{2}$/.test(id) ? `worlds/${id}.json` : 'worlds/?.json';
}

/**
 * Charge et valide un fichier de monde [GDD 03 §3.3, §3.4]. `file` nomme le fichier dans les erreurs
 * (clé d'importeur sans `./`) ; le chargeur le passe, {@link parseWorld} le déduit de `id`.
 */
export function parseWorldAs(raw: unknown, catalogue: Catalogue, file: string): WorldData {
  const schema = worldSchemaBase.superRefine((w, ctx) => {
    if (catalogue.byId[w.id].kind !== 'arrival') addCrossIssue(ctx, ['id'], `${w.id} n'est pas un monde d'arrivée`, 'reference');
    w.calendar.forEach((d, i) => {
      if (d.day !== i + 1) addCrossIssue(ctx, ['calendar', i, 'day'], `jours 1 à 7 dans l'ordre attendus : ${d.day} en position ${i + 1}`);
    });
    if (w.status !== 'skeleton') {
      for (const key of unfilledStreetKeys(w.street)) addCrossIssue(ctx, ['street', key], `bloc vide : permis seulement au statut skeleton [plan 02b T1]`);
    }
    const e = w.engine;
    w.engine.gates.forEach((g, i) => {
      if (g.when.cmp !== '>' && g.when.cmp !== '<') addCrossIssue(ctx, ['engine', 'gates', i, 'when', 'cmp'], `porte : comparateur strict '>' ou '<' attendu, reçu '${g.when.cmp}' [GDD 03 §3.4]`);
    });
    e.slopes.forEach((s, i) => {
      if (catalogue.byId[s.to].kind !== 'arrival') addCrossIssue(ctx, ['engine', 'slopes', i, 'to'], `pente vers ${s.to} : pas un monde d'arrivée du catalogue`, 'reference');
    });
    for (const i of duplicates(e.gates.map((g) => g.id))) addCrossIssue(ctx, ['engine', 'gates', i, 'id'], 'porte en double');
    for (const i of duplicates(e.slopes.map((s) => s.id))) addCrossIssue(ctx, ['engine', 'slopes', i, 'id'], 'pente en double');
    for (const i of duplicates(e.milestones.map((m) => m.id))) addCrossIssue(ctx, ['engine', 'milestones', i, 'id'], 'jalon en double');
    for (const i of duplicates(e.events.map((m) => m.id))) addCrossIssue(ctx, ['engine', 'events', i, 'id'], 'événement en double');
    for (const i of duplicates(w.kit.map((k) => k.id))) addCrossIssue(ctx, ['kit', i, 'id'], 'objet du kit en double');
    e.milestones.forEach((m, i) => {
      if (m.wsDelta === null) return;
      if (e.milestoneCapPerVar === null) {
        addCrossIssue(ctx, ['engine', 'milestones', i, 'wsDelta'], 'milestoneCapPerVar est null : aucun jalon ne peut porter de wsDelta [GDD 03 Q7]');
        return;
      }
      for (const [v, n] of Object.entries(m.wsDelta)) {
        if (Math.abs(n) > e.milestoneCapPerVar) addCrossIssue(ctx, ['engine', 'milestones', i, 'wsDelta', v], `|${n}| dépasse le plafond de jalon ${e.milestoneCapPerVar}`);
      }
    });
    if (new Set(e.projectionExtinctions).size !== e.projectionExtinctions.length) addCrossIssue(ctx, ['engine', 'projectionExtinctions'], 'extinction en double');
    e.projectionExtinctions.forEach((x, i) => {
      if (catalogue.byId[x].kind !== 'extinction') addCrossIssue(ctx, ['engine', 'projectionExtinctions', i], `${x} n'est pas une extinction du catalogue`, 'reference');
    });
  });
  const w = runParse(schema, raw, file);
  const { couplingScale, ...engineRest } = w.engine;
  return {
    status: w.status,
    id: w.id as ArrivalWorldId,
    engine: { ...engineRest, couplingScale100: couplingScale / 10 } as unknown as WorldEngine,
    forbiddenWords: w.forbiddenWords,
    calendar: w.calendar,
    kit: w.kit,
    survival: w.survival,
    street: w.street,
    bilan: w.bilan,
  };
}

/** Charge et valide un fichier de monde contre le catalogue [GDD 03 §3.3, §3.4]. */
export function parseWorld(raw: unknown, catalogue: Catalogue): WorldData {
  return parseWorldAs(raw, catalogue, worldFileOf(raw));
}

/** La jauge d'un monde, ou une erreur de chargement si le monde n'en a pas [plan 01 Task 14]. */
export function integrityOf(w: WorldData): IntegrityConfig {
  if (!('start' in w.survival)) throw new DataLoadError('schema', `worlds/${w.id}.json`, 'survival', "le monde n'a pas de jauge de survie");
  return w.survival as IntegrityConfig;
}

/** Vrai si le monde porte une jauge de survie. */
export function hasIntegrity(w: WorldData): boolean {
  return 'start' in w.survival;
}
