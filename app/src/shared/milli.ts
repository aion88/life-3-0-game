/**
 * Millièmes : la représentation entière de tout état du jeu [GDD 03 §4].
 * 100 points = 100 000 millièmes. Aucune valeur d'état n'est jamais arrondie en silence.
 */

/** Entier en millièmes ; 100 points = 100 000 ; signé pour un écart. */
export type Milli = number & { readonly __milli: unique symbol };

/** Valeur hors grille, artefact flottant ou non finie : refusée, jamais arrondie. */
export class GridError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GridError';
  }
}

/** Borne haute d'un axe, en millièmes. */
const AXIS_MAX = 100_000;

/**
 * Convertit des points en millièmes, exactement ou en lançant {@link GridError}.
 * Critère sans tolérance : accepté si et seulement si `round(p × 1000) / 1000 === p`,
 * `p` fini et le résultat multiple de `gridMilli` (10 pour couplingScale, 100 pour une magnitude de couplage).
 */
export function toMilli(points: number, gridMilli: number = 1): Milli {
  if (!Number.isFinite(points)) throw new GridError(`valeur non finie : ${points}`);
  if (!Number.isInteger(gridMilli) || gridMilli < 1) throw new GridError(`grille invalide : ${gridMilli}`);
  const m = Math.round(points * 1000);
  if (m / 1000 !== points) throw new GridError(`hors grille 0,001 : ${points}`);
  if (m % gridMilli !== 0) throw new GridError(`hors grille de ${gridMilli} millièmes : ${points}`);
  return (m + 0) as Milli; // + 0 efface le zéro négatif
}

/** Comme {@link toMilli}, borné à 0..100 000 (un axe du monde) ; hors borne = {@link GridError}. */
export function toAxisMilli(points: number): Milli {
  const m = toMilli(points);
  if (m < 0 || m > AXIS_MAX) throw new GridError(`hors axe 0..100 : ${points}`);
  return m;
}

/**
 * Borne une valeur entière de millièmes à 0..100 000, pour le moteur.
 * Un non-entier est une faute de l'appelant : refusé, pas arrondi.
 */
export function clampAxis(v: number): Milli {
  if (!Number.isInteger(v)) throw new GridError(`millième non entier : ${v}`);
  return Math.min(AXIS_MAX, Math.max(0, v)) as Milli;
}

/** Millièmes vers points : frontière d'affichage et de shader seulement [GDD 03 §4]. */
export function milliToPoints(m: Milli): number {
  return m / 1000;
}
