/**
 * Briques communes des schémas de données : erreur typée, conversion points vers millièmes,
 * conditions [GDD 03 §3.4, §4]. Les JSON s'écrivent en points ; tout schéma convertit au chargement
 * et refuse une valeur hors grille avec son chemin, jamais d'arrondi [GDD 03 §4].
 */
import { z } from 'zod';
import { GridError, toMilli, type Milli } from '../../shared/milli';
import type { ExtinctionId, WorldId, WorldVar } from '../../shared/types';

/** Statut d'un fichier de données : `skeleton` ne peut pas être joué [plan 00 « Données »]. */
export type DataStatus = 'skeleton' | 'content';

/** Nature d'un refus de chargement. */
export type DataLoadErrorKind = 'schema' | 'grid' | 'reference' | 'fetch';

/**
 * Refus de chargement d'un fichier de données, avec le chemin fautif [plan 00 « Données »].
 * `file` est la clé d'importeur sans le `./` initial (`worlds/w10.json`).
 */
export class DataLoadError extends Error {
  readonly kind: DataLoadErrorKind;
  readonly file: string;
  readonly path: string;

  constructor(kind: DataLoadErrorKind, file: string, path: string, message: string) {
    super(`${file} : ${path === '' ? '(racine)' : path} : ${message}`);
    this.name = 'DataLoadError';
    this.kind = kind;
    this.file = file;
    this.path = path;
  }
}

/** Les douze identifiants de monde, dans l'ordre du catalogue [GDD 03 §3.2]. */
export const WORLD_IDS = [
  'w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w09', 'w10', 'w11', 'w12',
] as const satisfies readonly WorldId[];

/** Les deux mondes d'extinction [GDD 02 §3.5]. */
export const EXTINCTION_IDS = ['w07', 'w12'] as const satisfies readonly ExtinctionId[];

/** Les six variables du monde, en tuple pour `z.enum` [GDD 03 §3.1]. */
export const WORLD_VAR_NAMES = [
  'aiPower', 'order', 'abundance', 'freedom', 'surveillance', 'unrest',
] as const satisfies readonly WorldVar[];

/** Bornes de santé des valeurs de données, en points : rien d'impropre n'atteint le moteur [revue Task 2]. */
export const BOUNDS = {
  /** Axe du monde, seuil, vecteur [GDD 03 §3.1]. */
  axis: { min: 0, max: 100 },
  /** Variation signée par pas (dérive, écho, jalon). */
  delta: { min: -100, max: 100 },
  /** Poussée d'une réponse, entier signé [GDD 01 §3.1 règle 4]. */
  push: { min: -100, max: 100 },
  /** Distance maximale dans l'espace des six axes : 100 × √6, arrondi au-dessus. */
  distance: { min: 0, max: 250 },
  /** Échelle de couplage d'un monde [GDD 03 §3.3]. */
  scale: { min: 0, max: 10 },
  /** Magnitude d'un couplage [GDD 03 §3.3]. */
  magnitude: { min: 0, max: 10 },
} as const;

interface MilliSpec {
  /** Grille en millièmes : 1 par défaut, 10 pour couplingScale, 100 pour une magnitude. */
  readonly grid?: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Nombre en points converti en millièmes par {@link toMilli} : hors grille ou hors bornes, refus `grid`
 * avec le chemin, jamais d'arrondi [GDD 03 §4].
 */
export function milliPoints(spec: MilliSpec): z.ZodType<Milli, number> {
  return z.number().transform((v, ctx) => {
    const fail = (message: string): typeof z.NEVER => {
      ctx.issues.push({ code: 'custom', message, input: v, params: { kind: 'grid' } });
      return z.NEVER;
    };
    if (v < spec.min || v > spec.max) return fail(`hors bornes ${spec.min}..${spec.max} : ${v}`);
    try {
      return toMilli(v, spec.grid ?? 1);
    } catch (e) {
      if (e instanceof GridError) return fail(e.message);
      throw e;
    }
  });
}

/** Axe du monde : points 0..100 vers millièmes [GDD 03 §3.1]. */
export const axisPoints = milliPoints(BOUNDS.axis);
/** Variation signée : points vers millièmes. */
export const deltaPoints = milliPoints(BOUNDS.delta);

/** Statut d'un fichier [plan 00 « Données »]. */
export const dataStatusSchema = z.enum(['skeleton', 'content']);

/** Identifiant d'un des douze mondes. */
export const worldIdSchema = z.enum(WORLD_IDS);

/** Variable du monde. */
export const worldVarSchema = z.enum(WORLD_VAR_NAMES);

/** Comparateur d'une condition [GDD 03 §3.3 : tests stricts pour couplages et portes, larges pour lectures et extinctions]. */
export const comparatorSchema = z.enum(['>', '<', '>=', '<=']);

/** Condition sur une variable : variable, comparateur, seuil en millièmes [GDD 03 §3.3, §3.4]. */
export interface Condition {
  readonly var: WorldVar;
  readonly cmp: '>' | '<' | '>=' | '<=';
  readonly threshold: Milli;
}

/** Schéma d'une {@link Condition}, seuil dans l'axe 0..100. */
export const conditionSchema: z.ZodType<Condition, unknown> = z.strictObject({
  var: worldVarSchema,
  cmp: comparatorSchema,
  threshold: axisPoints,
});

/** Variation partielle sur les variables du monde, en millièmes, bornée à ±100 points. */
export const deltaSchema = z
  .strictObject({
    aiPower: deltaPoints.optional(),
    order: deltaPoints.optional(),
    abundance: deltaPoints.optional(),
    freedom: deltaPoints.optional(),
    surveillance: deltaPoints.optional(),
    unrest: deltaPoints.optional(),
  })
  // Une clé absente n'existe pas dans le résultat : le `| undefined` d'inférence ne se produit jamais.
  .transform((d) => d as Readonly<Partial<Record<WorldVar, Milli>>>);

/** Vecteur complet des six variables, chaque axe 0..100 vers millièmes [GDD 03 §3.1]. */
export const vectorSchema = z.strictObject({
  aiPower: axisPoints,
  order: axisPoints,
  abundance: axisPoints,
  freedom: axisPoints,
  surveillance: axisPoints,
  unrest: axisPoints,
});

/** Ajoute une règle croisée bloquante à un contexte de raffinement. */
export function addCrossIssue(
  ctx: z.RefinementCtx,
  path: readonly (string | number)[],
  message: string,
  kind: 'schema' | 'reference' = 'schema',
): void {
  ctx.addIssue({ code: 'custom', path: [...path], message, params: { kind } });
}

/** Chemin lisible : `engine.drift.unrest`, `questions[2].answers[0]`. */
export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out === '' ? String(seg) : `.${String(seg)}`;
  }
  return out;
}

/** Valide `raw` contre `schema` ; toute faute devient une {@link DataLoadError} qui nomme le fichier et le chemin. */
export function runParse<T>(schema: z.ZodType<T, unknown>, raw: unknown, file: string): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issues = result.error.issues;
  const first = issues[0];
  const params = first && 'params' in first ? (first.params as { kind?: DataLoadErrorKind } | undefined) : undefined;
  const kind = params?.kind ?? 'schema';
  const others = issues.slice(1).map((i) => formatPath(i.path) || '(racine)');
  const message = first ? first.message + (others.length > 0 ? ` (+${others.length} autre(s) : ${others.join(', ')})` : '') : 'refus sans détail';
  throw new DataLoadError(kind, file, first ? formatPath(first.path) : '', message);
}

/** Lève sur un fichier encore en squelette ; nomme le fichier [plan 00 « Données »]. */
export function assertContent(file: { readonly status: DataStatus }, name: string): void {
  if (file.status === 'skeleton') {
    throw new DataLoadError('schema', name, 'status', 'statut skeleton : le contenu n\'est pas écrit, l\'écran ne peut pas le jouer');
  }
}
