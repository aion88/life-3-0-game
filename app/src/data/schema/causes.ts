/** Fichier des beats de l'écran des causes : conditions en données, lignes témoins dans `strings/` [bible w07 §3, bible w12 §3 ; D74, D81, D82]. */
import { z } from 'zod';
import { addCrossIssue, dataStatusSchema, runParse, worldVarSchema, EXTINCTION_IDS, type DataStatus } from './common';
import type { AnswerKey, ExtinctionId, QuestionKey, WorldVar } from '../../shared/types';

/** Une réponse du joueur : question et lettre. */
export interface CauseAnswer { readonly question: QuestionKey; readonly answer: AnswerKey }

/** Un beat : lot, titre lié, variable et sens de la lecture, réponse principale et réponses « aussi » dans l'ordre d'écriture de la bible. */
export interface Beat {
  readonly id: string;
  readonly edition: 1 | 2 | 3;
  readonly linkedHeadline: string | 'rupture';
  readonly var: WorldVar;
  readonly sense: 1 | -1;
  readonly main: CauseAnswer | 'sumOfOthers';
  readonly also: readonly CauseAnswer[];
  /** Vrai quand variable et sens sont dérivés, pas écrits dans la bible [à confirmer: world-builder]. */
  readonly hypothesis?: boolean;
}

/** Les beats de chaque monde d'extinction. */
export interface CauseSet {
  readonly status: DataStatus;
  readonly byExtinction: Readonly<Record<ExtinctionId, readonly Beat[]>>;
}

/** Nombre d'éditions (lots) de l'écran des causes [bible w07 §3, bible w12 §3 ; D82]. */
export const EDITION_COUNT = 3;
/** Bornes des lots, numéros de beat inclus : 1 à 3 « les signaux », 4 à 6 « la cécité », 7 et 8 « la rupture » [bible w07 §3, bible w12 §3 ; D82]. */
export const EDITION_LOTS: readonly (readonly [number, number])[] = [[1, 3], [4, 6], [7, 8]];
/** Nombre de beats par monde d'extinction [bible w07 §3, bible w12 §3]. */
export const BEATS_PER_WORLD = 8;

const questionKey = z.string().regex(/^Q\d{2,3}$/).transform((s) => s as QuestionKey);
const answerSchema = z.strictObject({ question: questionKey, answer: z.enum(['A', 'B', 'C', 'D']) });

const beatSchema = z.strictObject({
  id: z.string().min(1),
  edition: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  linkedHeadline: z.string().min(1),
  var: worldVarSchema,
  sense: z.union([z.literal(1), z.literal(-1)]),
  main: z.union([answerSchema, z.literal('sumOfOthers')]),
  also: z.array(answerSchema),
  hypothesis: z.boolean().optional(),
});

const setSchema = z
  .strictObject({
    status: dataStatusSchema,
    byExtinction: z.strictObject({ w07: z.array(beatSchema), w12: z.array(beatSchema) }),
  })
  .superRefine((s, ctx) => {
    for (const world of EXTINCTION_IDS) {
      const beats = s.byExtinction[world];
      if (beats.length !== BEATS_PER_WORLD) addCrossIssue(ctx, ['byExtinction', world], `${world} : ${BEATS_PER_WORLD} beats attendus, ${beats.length} reçus`);
      beats.forEach((b, i) => {
        const at = ['byExtinction', world, i];
        const n = i + 1;
        if (b.id !== String(n)) addCrossIssue(ctx, [...at, 'id'], `${world} : beat ${n} attendu, id « ${b.id} »`);
        const lot = EDITION_LOTS.findIndex(([from, to]) => n >= from && n <= to) + 1;
        if (b.edition !== lot) addCrossIssue(ctx, [...at, 'edition'], `${world} beat ${n} : édition ${lot} attendue, ${b.edition} reçue`);
        const sum = b.main === 'sumOfOthers';
        if (sum !== (n === BEATS_PER_WORLD)) addCrossIssue(ctx, [...at, 'main'], `${world} beat ${n} : « sumOfOthers » réservé au dernier beat`);
        if (sum && b.also.length > 0) addCrossIssue(ctx, [...at, 'also'], `${world} beat ${n} : « aussi » interdit sur la somme des autres`);
        if ((b.linkedHeadline === 'rupture') !== (n === BEATS_PER_WORLD)) addCrossIssue(ctx, [...at, 'linkedHeadline'], `${world} beat ${n} : « rupture » réservé au dernier beat`);
      });
    }
  });

/** Charge et valide `causes.json` : 8 beats par monde, lots 1-3 / 4-6 / 7-8, somme des autres en dernier [plan 01 T10]. */
export function parseCauses(raw: unknown): CauseSet {
  return runParse(setSchema as unknown as z.ZodType<CauseSet, unknown>, raw, 'causes.json');
}
