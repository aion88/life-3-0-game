/** Configuration du moteur : V0, couplages, hystérésis, calendrier du fast-forward, extinctions [GDD 03 §3.1, §3.3, §3.4 ; GDD 02 §3.2, §3.5]. */
import { z } from 'zod';
import {
  BOUNDS, addCrossIssue, conditionSchema, milliPoints, runParse, vectorSchema, worldVarSchema, EXTINCTION_IDS,
  type Condition,
} from './common';
import type { ExtinctionId, WorldVar, WorldVector } from '../../shared/types';
import type { Milli } from '../../shared/milli';

export type { Condition } from './common';

/**
 * Un couplage : conditions, variable écrite, signe, magnitude en millièmes (multiple de 100).
 * Effet = signe × (magnitude / 100) × couplingScale100, entier exact [GDD 03 §3.3, §4].
 */
export interface Coupling {
  readonly id: string;
  readonly when: readonly Condition[];
  readonly target: WorldVar;
  readonly sign: 1 | -1;
  readonly magnitude: Milli;
}

/** Règle d'extinction : conjonction de conditions tenue `hold` pas consécutifs dès `fromStep` [GDD 02 §3.5]. */
export interface ExtinctionRule {
  readonly id: ExtinctionId;
  readonly all: readonly Condition[];
  readonly hold: number;
  readonly fromStep: number;
}

/** Configuration du moteur [GDD 03 §3.1 à §3.4, GDD 02 §3.2 à §3.6]. */
export interface EngineConfig {
  readonly v0: WorldVector;
  readonly couplings: readonly Coupling[];
  readonly hysteresis: Milli;
  /** Entiers, 1 par défaut [GDD 02 §3.6]. */
  readonly axisWeights: Readonly<Record<WorldVar, number>>;
  readonly projectionHorizon: number;
  /** Comparer distanceSq > farArrivalDistance², soit 3,6 × 10^9 en millièmes² [GDD 03 §4]. */
  readonly farArrivalDistance: Milli;
  readonly steps: {
    readonly pushSteps: readonly number[];
    readonly arrivalStep: number;
    readonly choiceStep: number;
    readonly maxRuptureStep: number;
  };
  readonly extinctions: readonly ExtinctionRule[];
}

const step = z.number().int().min(1).max(1000);

/** Condition de couplage : comparateur strict seulement [GDD 03 §3.3]. */
const strictConditionSchema = conditionSchema.refine((c) => c.cmp === '>' || c.cmp === '<', {
  message: "couplage : comparateur strict '>' ou '<' attendu [GDD 03 §3.3]",
  path: ['cmp'],
});

const couplingSchema = z.strictObject({
  id: z.string().min(1),
  when: z.array(strictConditionSchema).min(1),
  target: worldVarSchema,
  sign: z.union([z.literal(1), z.literal(-1)]),
  magnitude: milliPoints({ grid: 100, min: BOUNDS.magnitude.min, max: BOUNDS.magnitude.max }),
});

const extinctionSchema = z.strictObject({
  id: z.enum(EXTINCTION_IDS),
  all: z.array(conditionSchema).min(1),
  hold: step,
  fromStep: step,
});

const weight = z.number().int().min(0).max(100);

const engineSchema = z
  .strictObject({
    v0: vectorSchema,
    axisWeights: z.strictObject({
      aiPower: weight, order: weight, abundance: weight, freedom: weight, surveillance: weight, unrest: weight,
    }),
    couplings: z.array(couplingSchema).min(1),
    hysteresis: milliPoints({ min: 0, max: BOUNDS.axis.max }),
    projectionHorizon: z.number().int().min(1).max(10_000),
    farArrivalDistance: milliPoints(BOUNDS.distance),
    steps: z.strictObject({
      pushSteps: z.array(step).min(1),
      arrivalStep: step,
      choiceStep: step,
      maxRuptureStep: step,
    }),
    extinctions: z.array(extinctionSchema),
  })
  .superRefine((e, ctx) => {
    const ids = new Set<string>();
    e.couplings.forEach((c, i) => {
      if (ids.has(c.id)) addCrossIssue(ctx, ['couplings', i, 'id'], `couplage en double : ${c.id}`);
      ids.add(c.id);
    });
    e.steps.pushSteps.forEach((s, i) => {
      const prev = e.steps.pushSteps[i - 1];
      if (prev !== undefined && s <= prev) addCrossIssue(ctx, ['steps', 'pushSteps', i], 'pas de poussée non croissants');
    });
    const ext = new Set<string>();
    e.extinctions.forEach((r, i) => {
      if (ext.has(r.id)) addCrossIssue(ctx, ['extinctions', i, 'id'], `règle d'extinction en double : ${r.id}`);
      ext.add(r.id);
    });
  });

/** Charge et valide `engine.json` ; points vers millièmes, grille 100 pour les magnitudes [GDD 03 §3.3]. */
export function parseEngine(raw: unknown): EngineConfig {
  return runParse(engineSchema, raw, 'engine.json');
}
