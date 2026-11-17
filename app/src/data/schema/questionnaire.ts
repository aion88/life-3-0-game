/** Questionnaire : clés opaques, ordre d'écran, réponses et poussées entières [GDD 01 §3.1]. */
import { z } from 'zod';
import { BOUNDS, addCrossIssue, dataStatusSchema, runParse, type DataStatus } from './common';
import { toMilli } from '../../shared/milli';
import { isQuestionKey, type AnswerKey, type PushVector, type QuestionKey } from '../../shared/types';

/** Une question : clé stable, rang d'écran, réponses A, B, ... [GDD 01 §3.1 règles 3 et 4]. */
export interface Question {
  readonly key: QuestionKey;
  readonly order: number;
  /** Vague d'ajout, métadonnée seule [GDD 01 §3.1 règle 4]. */
  readonly wave?: number;
  readonly answers: readonly { readonly key: AnswerKey; readonly push: PushVector; readonly hypothesis: boolean }[];
}

/** Le questionnaire, questions triées par `order` [GDD 01 §3.1]. */
export interface Questionnaire {
  readonly status: DataStatus;
  readonly retired: readonly QuestionKey[];
  readonly questions: readonly Question[];
}

const ANSWER_KEYS = ['A', 'B', 'C', 'D'] as const;

const pushValue = z
  .number()
  .int()
  .min(BOUNDS.push.min)
  .max(BOUNDS.push.max)
  .transform((n) => toMilli(n));

const pushSchema = z.strictObject({
  aiPower: pushValue, order: pushValue, abundance: pushValue, freedom: pushValue, surveillance: pushValue, unrest: pushValue,
});

const answerSchema = z.strictObject({
  key: z.enum(ANSWER_KEYS),
  push: pushSchema,
  hypothesis: z.boolean(),
});

const questionSchema = z.strictObject({
  key: z.string(),
  order: z.number().int().min(1),
  wave: z.number().int().min(1).optional(),
  answers: z.array(answerSchema).min(2).max(4),
});

const questionnaireSchema = z
  .strictObject({
    status: dataStatusSchema,
    retired: z.array(z.string()),
    questions: z.array(questionSchema).min(1),
  })
  .superRefine((q, ctx) => {
    q.retired.forEach((k, i) => {
      if (!isQuestionKey(k)) addCrossIssue(ctx, ['retired', i], `clé retirée mal formée : ${k}`);
    });
    if (new Set(q.retired).size !== q.retired.length) addCrossIssue(ctx, ['retired'], 'clé retirée en double');
    const keys = new Set<string>();
    const orders = new Set<number>();
    q.questions.forEach((x, i) => {
      if (!isQuestionKey(x.key)) addCrossIssue(ctx, ['questions', i, 'key'], `clé de question hors format Q + 2 ou 3 chiffres : ${x.key}`);
      if (keys.has(x.key)) addCrossIssue(ctx, ['questions', i, 'key'], `clé en double : ${x.key}`);
      keys.add(x.key);
      if (q.retired.includes(x.key)) addCrossIssue(ctx, ['questions', i, 'key'], `clé retirée réutilisée : ${x.key}`, 'reference');
      if (orders.has(x.order)) addCrossIssue(ctx, ['questions', i, 'order'], `order en double : ${x.order}`);
      orders.add(x.order);
      x.answers.forEach((a, j) => {
        if (a.key !== ANSWER_KEYS[j]) addCrossIssue(ctx, ['questions', i, 'answers', j, 'key'], `réponses A, B, ... contiguës attendues : ${a.key} en position ${j + 1}`);
      });
    });
  });

/** Charge et valide `questionnaire.json` ; poussées entières converties ×1000 [GDD 01 §3.1]. */
export function parseQuestionnaire(raw: unknown): Questionnaire {
  const parsed = runParse(questionnaireSchema, raw, 'questionnaire.json');
  const questions = [...parsed.questions].sort((a, b) => a.order - b.order) as unknown as readonly Question[];
  return { status: parsed.status, retired: parsed.retired as QuestionKey[], questions };
}
