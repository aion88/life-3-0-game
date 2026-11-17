/** Mise en forme des parts d'arrivée de SOURCES & HONESTY [GDD 06 §3.8 point 8]. Pur : entiers seulement, un seul arrondi. */
import type { Lang } from '../shared/types/common';

/**
 * Part d'un compte dans un total, à un chiffre après la virgule : « 31,6 % » en français, « 31.6% » en anglais.
 * Arrondi au dixième le plus proche (le demi monte), calculé sur des entiers.
 */
export function sharePercent(count: number, total: number, lang: Lang): string {
  const tenths = Math.round((count * 1000) / total);
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return lang === 'fr' ? `${whole},${frac} %` : `${whole}.${frac}%`;
}

/** Un bloc de la fiche partageable : rectangle plein, en pixels entiers. */
export interface ShareBlock { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface ShareLayout { readonly margin: number; readonly blocks: readonly ShareBlock[] }

/** Poids relatifs des blocs : le titre, le monde, puis une ligne par « autre vie ». */
const WEIGHT = { title: 2, world: 3, other: 2 } as const;

/**
 * Mise en page de l'image partageable [GDD 06 §3.3, B-V9] : pure, entiers seulement. Les blocs se touchent (`y` + `h` du bloc
 * suivant = `y` du suivant), le dernier absorbe le reste : aucun trou pour 0 à 4 lignes de « Les autres ». Zéro ligne donne un bloc `locked`.
 */
export function layoutShare(others: number, width: number, height: number): ShareLayout {
  const n = Math.max(0, Math.min(4, Math.trunc(others)));
  const margin = Math.floor(Math.min(width, height) / 16);
  const ids: { readonly id: string; readonly weight: number }[] = [{ id: 'title', weight: WEIGHT.title }, { id: 'world', weight: WEIGHT.world }];
  if (n === 0) ids.push({ id: 'locked', weight: WEIGHT.other });
  for (let i = 0; i < n; i++) ids.push({ id: `other-${i}`, weight: WEIGHT.other });
  const usable = height - 2 * margin;
  const total = ids.reduce((a, b) => a + b.weight, 0);
  const blocks: ShareBlock[] = [];
  let y = margin;
  ids.forEach((b, i) => {
    const h = i === ids.length - 1 ? margin + usable - y : Math.floor((usable * b.weight) / total);
    blocks.push({ id: b.id, x: margin, y, w: width - 2 * margin, h });
    y += h;
  });
  return { margin, blocks };
}
