/**
 * Rig de lumière par état [art bible §D.1 ; TV-02a-render]. Module pur : ni DOM, ni Three.js (hors du moteur : sin et cos y sont permis, la lumière ne touche pas à l'état de jeu).
 * Avant ce module la lumière de la scène était UNE hémisphère fixe, quel que soit l'état : `setLight('jour')` ne changeait que
 * l'étalonnage, donc une plaque « de jour » était rendue avec l'éclairage de la nuit. Le rig mélange maintenant les deux états du fondu.
 */
import type { LightBlend } from '../../engine/view/grade';
import type { SceneData } from '../../engine/view/sceneSchema';

/** Composantes sRGB 0 à 1. */
export type Rgb = readonly [number, number, number];

/** Lumière de la scène à un instant : hémisphère (ciel, sol), fond et soleil. */
export interface LightRig {
  readonly sky: Rgb;
  /** Fond de scène derrière la rue (le vide n'est plus noir). */
  readonly horizon: Rgb;
  readonly ground: Rgb;
  readonly hemiIntensity: number;
  readonly sunColor: Rgb;
  readonly sunIntensity: number;
  /** Vecteur unitaire vers le soleil. */
  readonly sunDir: readonly [number, number, number];
  /** Allumage des lampadaires, de 0 (éteints) à 1 (pleine nuit). */
  readonly lampLevel: number;
  /** Dôme de ciel : arrêts (sRGB) et halo solaire. */
  readonly skyZenith: Rgb;
  readonly skyMid: Rgb;
  readonly skyHorizon: Rgb;
  readonly sunHalo: Rgb;
  readonly sunHaloRadiusDeg: number;
}

const lerp = (a: number, b: number, t: number): number => (a === b ? a : a + (b - a) * t);
const lerp3 = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** `#RRGGBB` vers composantes sRGB 0 à 1. */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Direction VERS le soleil : hauteur au-dessus de l'horizon, azimut compté depuis +z vers +x (degrés). */
export function sunDirection(elevationDeg: number, azimuthDeg: number): readonly [number, number, number] {
  const e = (elevationDeg * Math.PI) / 180;
  const a = (azimuthDeg * Math.PI) / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

/** Rig d'un état seul. */
function rigOf(r: SceneData['lightRigs'][keyof SceneData['lightRigs']]): LightRig {
  return {
    sky: hexToRgb(r.sky.v), horizon: hexToRgb(r.horizon.v), ground: hexToRgb(r.ground.v), hemiIntensity: r.hemiIntensity.v,
    sunColor: hexToRgb(r.sunColor.v), sunIntensity: r.sunIntensity.v, sunDir: sunDirection(r.sunElevationDeg.v, r.sunAzimuthDeg.v), lampLevel: r.lampLevel.v,
    skyZenith: hexToRgb(r.skyZenith.v), skyMid: hexToRgb(r.skyMid.v), skyHorizon: hexToRgb(r.skyHorizon.v), sunHalo: hexToRgb(r.sunHalo.v), sunHaloRadiusDeg: r.sunHaloRadiusDeg.v,
  };
}

/** Rig du fondu courant : mélange linéaire des deux états par `t` (couleurs en sRGB, direction renormalisée). */
export function lightRig(b: LightBlend, rigs: SceneData['lightRigs']): LightRig {
  const a = rigOf(rigs[b.from]);
  if (b.from === b.to || b.t <= 0) return a;
  const z = rigOf(rigs[b.to]);
  if (b.t >= 1) return z;
  const d: [number, number, number] = [lerp(a.sunDir[0], z.sunDir[0], b.t), lerp(a.sunDir[1], z.sunDir[1], b.t), lerp(a.sunDir[2], z.sunDir[2], b.t)];
  const len = Math.hypot(...d) || 1;
  return {
    sky: lerp3(a.sky, z.sky, b.t), horizon: lerp3(a.horizon, z.horizon, b.t), ground: lerp3(a.ground, z.ground, b.t), hemiIntensity: lerp(a.hemiIntensity, z.hemiIntensity, b.t),
    sunColor: lerp3(a.sunColor, z.sunColor, b.t), sunIntensity: lerp(a.sunIntensity, z.sunIntensity, b.t), sunDir: [d[0] / len, d[1] / len, d[2] / len], lampLevel: lerp(a.lampLevel, z.lampLevel, b.t),
    skyZenith: lerp3(a.skyZenith, z.skyZenith, b.t), skyMid: lerp3(a.skyMid, z.skyMid, b.t), skyHorizon: lerp3(a.skyHorizon, z.skyHorizon, b.t),
    sunHalo: lerp3(a.sunHalo, z.sunHalo, b.t), sunHaloRadiusDeg: lerp(a.sunHaloRadiusDeg, z.sunHaloRadiusDeg, b.t),
  };
}
