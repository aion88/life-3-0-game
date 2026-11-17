/**
 * Ciel de la rue : dégradé vertical à trois arrêts (zénith, milieu à +15°, horizon à 0° tenu sous l'horizon) et halo solaire [ciel-jour-spec §2].
 * Ce fichier porte la règle pure ; le dôme (`scene/sky.ts`) la reprend en nœuds TSL avec les mêmes constantes, le test les compare.
 */
import type { Rgb } from './lighting';

/** Élévation de l'arrêt du milieu, en degrés [ciel-jour-spec §2]. */
export const MID_ELEVATION_DEG = 15;
/** Sinus de l'élévation du milieu : le dôme travaille sur `direction.y`, le sinus de l'élévation. */
export const MID_SIN = Math.sin((MID_ELEVATION_DEG * Math.PI) / 180);

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
/** `smoothstep` de GLSL (arêtes `a` < `b`). */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Poids du mélange horizon -> milieu puis (horizon-milieu) -> zénith pour une élévation en degrés. */
export function skyBlend(elevationDeg: number): { readonly toMid: number; readonly toZenith: number } {
  const s = Math.sin((elevationDeg * Math.PI) / 180);
  return { toMid: smoothstep(0, MID_SIN, s), toZenith: smoothstep(MID_SIN, 1, s) };
}

export interface SkyStops { readonly zenith: Rgb; readonly mid: Rgb; readonly horizon: Rgb }

/** Couleur du dégradé (hors halo) à une élévation en degrés. */
export function skyColorAt(elevationDeg: number, s: SkyStops): Rgb {
  const { toMid, toZenith } = skyBlend(elevationDeg);
  const ch = (i: 0 | 1 | 2): number => {
    const low = s.horizon[i] + (s.mid[i] - s.horizon[i]) * toMid;
    return low + (s.zenith[i] - low) * toZenith;
  };
  return [ch(0), ch(1), ch(2)];
}
