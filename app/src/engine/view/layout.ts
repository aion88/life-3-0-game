/**
 * Mise en espace de la rue : façades, lampadaires, teintes du mur [plan 02a T6]. Module pur : ni DOM, ni Three.js, ni horloge.
 * Le seul hasard est `mulberry32(seed)`, la graine vient de l'appelant (`worldSeedOf('w10') + 17`, bible w10 §5.1 n°2).
 */
import { mulberry32 } from '../../shared/rng';
import type { SceneData } from './sceneSchema';

/** Une façade : un côté de la rue, de `z0` à `z1`, `storeys` étages, `litMask` une case par fenêtre (étage après étage). */
export interface Facade { readonly side: 'east' | 'west'; readonly z0: number; readonly z1: number; readonly storeys: number; readonly litMask: readonly boolean[] }

const SIDES = ['east', 'west'] as const;

/** Entier de `lo` à `hi` inclus. */
function intIn(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Largeurs entières d'un côté : chaque façade de `min` à `max`, somme exactement `total`. Invariant : le reste, tant qu'il n'est pas
 * nul, vaut au moins `min`, donc il se découpe toujours (`max >= 2 min - 1` : 7 à 19 le garantit).
 */
function widths(rng: () => number, total: number, min: number, max: number): number[] {
  const out: number[] = [];
  let rest = total;
  while (rest > 0) {
    const w = rest <= max ? rest : intIn(rng, min, Math.min(max, rest - min));
    out.push(w);
    rest -= w;
  }
  return out;
}

/** Mélange de Fisher-Yates, en place, avec le générateur donné. */
function shuffle<T>(rng: () => number, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!; a[i] = a[j]!; a[j] = t;
  }
  return a;
}

/**
 * Découpe chaque côté en façades de `widthMinM` à `widthMaxM` qui couvrent exactement `zMin` à `zMax`, sans trou ni chevauchement.
 * Une fenêtre sur `litOneIn` est allumée : le compte par façade est exact (arrondi), seule la place est tirée.
 */
export function layoutFacades(d: SceneData, seed: number): readonly Facade[] {
  const { zMin, zMax } = d.layout;
  const f = d.facades;
  const rng = mulberry32(seed);
  const out: Facade[] = [];
  for (const side of SIDES) {
    let z = zMin.v;
    for (const w of widths(rng, zMax.v - zMin.v, f.widthMinM.v, f.widthMaxM.v)) {
      const storeys = intIn(rng, f.floorsMin.v, f.floorsMax.v);
      const cols = Math.floor(w / d.build.windowPitchM.v);
      const n = cols * storeys;
      const lit = Math.round(n / f.litOneIn.v);
      const mask = shuffle(rng, Array.from({ length: n }, (_, i) => i < lit));
      out.push({ side, z0: z, z1: z + w, storeys, litMask: mask });
      z += w;
    }
  }
  return out;
}

/** Lampadaires : `perSide` par côté, du bout de la rue vers le fond, tous les `spacingM` [bible w10 §5.1 n°1]. */
export function lampPositions(d: SceneData): readonly { side: 'east' | 'west'; z: number }[] {
  const { zMax } = d.layout;
  const { spacingM, perSide } = d.lamps;
  return SIDES.flatMap((side) => Array.from({ length: perSide.v }, (_, i) => ({ side, z: zMax.v - i * spacingM.v })));
}

/** Les trois teintes de CRT de la grille, par lettre ; l'orange est le quatrième nom, jamais dans la grille. */
export type WallTint = 'cyan' | 'paleBlue' | 'magenta' | 'orange';
const LETTER: Readonly<Record<string, WallTint>> = { c: 'cyan', p: 'paleBlue', m: 'magenta' };

/** Les seize écrans du mur : rangée et colonne de 1, teinte. L'écran `orange` de la donnée prend la place que la grille lui laisse. */
export function wallCells(d: SceneData): readonly { row: number; col: number; tint: WallTint }[] {
  const w = d.checkpoint.wall;
  const out: { row: number; col: number; tint: WallTint }[] = [];
  for (let row = 1; row <= w.rows.v; row++) {
    for (let col = 1; col <= w.cols.v; col++) {
      const isOrange = row === w.orange.row && col === w.orange.col;
      out.push({ row, col, tint: isOrange ? 'orange' : LETTER[w.grid.v[row - 1]![col - 1]!]! });
    }
  }
  return out;
}

/** Teintes (degrés) réellement présentes sur le mur, sans doublon. */
export function wallScreenHues(d: SceneData): number[] {
  const t = d.checkpoint.wall.tints;
  return [...new Set(wallCells(d).map((c) => t[c.tint].v.h))];
}
