/** Fichier des titres du journal : conditions en données, textes témoins ailleurs (`strings/`) [GDD 02 §3.7 ; TRAJ §5 ; bibles w07 et w12 §2.4]. */
import { z } from 'zod';
import {
  addCrossIssue, comparatorSchema, conditionSchema, dataStatusSchema, deltaPoints, runParse, worldVarSchema, EXTINCTION_IDS,
  type Condition, type DataStatus,
} from './common';
import type { Milli } from '../../shared/milli';
import type { AnswerKey, ExtinctionId, QuestionKey, WorldVar } from '../../shared/types';

/** Condition d'un titre, évaluée sur la trajectoire d'une partie [plan 01 T5]. */
export type HeadlineCond =
  | { readonly kind: 'state'; readonly all: readonly Condition[] } // vraie au pas t
  | { readonly kind: 'yearDelta'; readonly var: WorldVar; readonly cmp: '>=' | '<='; readonly delta: Milli } // V(t) − V(t−12), t ≥ 12
  | { readonly kind: 'twoYears'; readonly all: readonly Condition[] } // vraie à t et à t − 12
  | { readonly kind: 'answer'; readonly question: QuestionKey; readonly answer: AnswerKey } // vraie à tout pas
  | { readonly kind: 'atStep'; readonly step: number } // date portée par la donnée : vraie dès ce pas
  | { readonly kind: 'rupture' }; // pas de rupture d'une extinction

/** Nature de la marque tirée dans une table de variantes [GDD 02 §3.7]. */
export type HeadlineVariant = 'region' | 'n' | 'capital';

/** Un titre : identifiant, priorité (le plus petit passe d'abord), portée, conditions toutes requises. */
export interface Headline {
  readonly id: string;
  readonly priority: number;
  readonly scope: 'all' | ExtinctionId;
  readonly when: readonly HeadlineCond[];
  readonly alwaysShown: boolean;
  readonly variant: HeadlineVariant | null;
}

/** Les titres et la longueur de chaque table de variantes (la même en FR et en EN) [GDD 02 §3.7]. */
export interface HeadlineSet {
  readonly status: DataStatus;
  readonly variantSizes: Readonly<Record<HeadlineVariant, number>>;
  readonly headlines: readonly Headline[];
}

const nonEmpty = z.string().min(1);
const questionKey = z.string().regex(/^Q\d{2,3}$/).transform((s) => s as QuestionKey);
const answerKey = z.enum(['A', 'B', 'C', 'D']);
const size = z.number().int().min(1).max(1000);

const condSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('state'), all: z.array(conditionSchema).min(1) }),
  z.strictObject({
    kind: z.literal('yearDelta'),
    var: worldVarSchema,
    cmp: comparatorSchema.refine((c) => c === '>=' || c === '<=', { message: "yearDelta : comparateur '>=' ou '<=' attendu" }),
    delta: deltaPoints,
  }),
  z.strictObject({ kind: z.literal('twoYears'), all: z.array(conditionSchema).min(1) }),
  z.strictObject({ kind: z.literal('answer'), question: questionKey, answer: answerKey }),
  z.strictObject({ kind: z.literal('atStep'), step: size }),
  z.strictObject({ kind: z.literal('rupture') }),
]);

const headlineSchema = z.strictObject({
  id: nonEmpty,
  priority: z.number().int().min(0).max(1000),
  scope: z.enum(['all', ...EXTINCTION_IDS]),
  when: z.array(condSchema).min(1),
  alwaysShown: z.boolean(),
  variant: z.enum(['region', 'n', 'capital']).nullable(),
});

const setSchema = z
  .strictObject({
    status: dataStatusSchema,
    variantSizes: z.strictObject({ region: size, n: size, capital: size }),
    headlines: z.array(headlineSchema),
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    s.headlines.forEach((h, i) => {
      if (ids.has(h.id)) addCrossIssue(ctx, ['headlines', i, 'id'], `titre en double : ${h.id}`);
      ids.add(h.id);
    });
  });

/** Charge et valide `headlines.json` ; refuse genre de condition inconnu, variable inconnue, seuil hors grille [plan 01 T5]. */
export function parseHeadlines(raw: unknown): HeadlineSet {
  return runParse(setSchema as unknown as z.ZodType<HeadlineSet, unknown>, raw, 'headlines.json');
}
