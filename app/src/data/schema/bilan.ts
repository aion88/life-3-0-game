/** Données du bilan : réglages communs (`bilan.json`) et bloc `bilan` d'un monde [GDD 06 §3.12 et §7 ; plan 03 T2]. Aucune valeur en code. */
import { z } from 'zod';
import { addCrossIssue, dataStatusSchema } from './common';
import { RIGHT_IDS, type RightId } from '../../shared/types/street';
import { WORLD_VARS } from '../../shared/types/world';
import type { WorldId } from '../../shared/types';

const key = z.string().min(1);
const range = (lo: number, hi: number) => z.strictObject({ min: z.number().int().min(lo).max(hi), max: z.number().int().min(lo).max(hi) })
  .refine((r) => r.min <= r.max, 'min au-dessus de max');

/** Réglages communs aux mondes [GDD 06 §7] : lus par `loadBilanCommon`, jamais écrits en code. */
const bilanCommonSchema = z.strictObject({
  status: dataStatusSchema,
  /** Pas de sigma de la projection [GDD 03 §4, proposé] : le plan 01 le prend en paramètre d'appel de `project`. */
  sigma100: z.number().int().min(1),
  sheetMaxLines: z.number().int().min(1).max(7),
  others: range(0, 4),
  traceback: range(2, 3),
  rightsCount: z.literal(8),
  /** Les huit points de contenu de SOURCES & HONESTY [GDD 06 §3.8], dans l'ordre. */
  contentPoints: z.array(key).length(8),
  /** Notes de SOURCES & HONESTY [GDD 06 §3.8 points 2, 3 et 6]. */
  noteKeys: z.array(key),
  /** Les douze comptes d'arrivée figés [GDD 06 §3.8 point 8, calculé à la main], total 746 496. */
  counts: z.strictObject(Object.fromEntries(
    ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w09', 'w10', 'w11', 'w12'].map((id) => [id, z.number().int().min(1)]),
  ) as Record<WorldId, z.ZodNumber>),
  total: z.number().int().min(1),
}).superRefine((c, ctx) => {
  const sum = Object.values(c.counts).reduce((s, n) => s + n, 0);
  if (sum !== c.total) addCrossIssue(ctx, ['total'], `somme des comptes ${sum} différente de ${c.total}`);
});
export { bilanCommonSchema };
export type BilanCommonRaw = z.infer<typeof bilanCommonSchema>;

const carrierSchema = z.strictObject({
  var: z.enum(WORLD_VARS as [string, ...string[]]),
  /** Sens de la perte : +1 si une poussée positive sur la variable est la perte, -1 si c'est une poussée négative. */
  sign: z.union([z.literal(1), z.literal(-1)]),
});

const SOURCE_LABELS = ['sourced', 'unreopened', 'extrapolated', 'gameHypothesis'] as const;

const dossierSchema = z.strictObject({
  names: z.array(z.strictObject({ choiceId: key, nameOption: key, refuseOption: key, personKey: key })),
  audition: z.strictObject({ choiceId: key, keys: z.strictObject({ all: key, none: key, silence: key }) }),
  noneFlaggedKey: key,
  mentionKeys: z.strictObject({ savedByName: key, twoNamesThenArrested: key, declaredLeaver: key, radioFromInside: key }),
});

/** Bloc `bilan` d'un monde à rue, strict, tout champ obligatoire. Les lignes de relecture vivent au 02b, jamais ici. */
const bilanWorldShape = z.strictObject({
  worldBlockId: key,
  dossier: dossierSchema,
  rights: z.strictObject({
    carriers: z.strictObject(Object.fromEntries(RIGHT_IDS.map((id) => [id, carrierSchema])) as Record<RightId, typeof carrierSchema>),
  }),
  /** Les variables que la pente nomme dans la bible §9, épaissies sur la courbe [GDD 06 §3.4]. */
  emphasis: z.array(z.enum(WORLD_VARS as [string, ...string[]])).min(1),
  fate: z.strictObject({ ends: z.record(key, key), prices: z.record(key, key), comforts: z.record(key, key) }),
  sources: z.array(z.strictObject({ label: z.enum(SOURCE_LABELS), textKey: key })).min(1),
  share: z.strictObject({ width: z.number().int().min(1).nullable(), height: z.number().int().min(1).nullable() }),
}).superRefine((b, ctx) => {
  if (!b.sources.some((r) => r.label === 'sourced')) addCrossIssue(ctx, ['sources'], 'au moins une ligne sourced attendue [GDD 06 §3.8]');
  if (new Set(b.emphasis).size !== b.emphasis.length) addCrossIssue(ctx, ['emphasis'], 'variable en double');
  if ((b.share.width === null) !== (b.share.height === null)) addCrossIssue(ctx, ['share'], 'largeur et hauteur nulles ensemble ou définies ensemble [décision 9]');
});

export type BilanWorldData = z.infer<typeof bilanWorldShape>;
export const bilanWorldSchema: z.ZodType<BilanWorldData> = bilanWorldShape as unknown as z.ZodType<BilanWorldData>;
