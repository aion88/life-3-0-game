/**
 * Jour, nuit et étalonnage par monde de la rue [plan 02a T3]. Module pur : ni DOM, ni Three.js, ni horloge, ni hasard.
 * L'état de lumière vient des marches de données (aucune heure en code, art bible §D.1) ; les uniformes d'étalonnage
 * mélangent deux états puis ajoutent les gains ÉCRITS en données (un gain `null` n'a aucun effet) [design §4.4 ; GDD 03 §3.4].
 */
import { milliToPoints, type Milli } from '../../shared/milli';
import type { ArrivalOffset } from '../../shared/types/run';
import { WORLD_VARS, type WorldVar, type WorldVector } from '../../shared/types/world';
import type { GradeData, LightData, LightState } from './sceneSchema';

export type { GradeData, LightData, LightState };

/** Fondu entre deux états : `t` vaut 0 sur `from`, 1 sur `to`. */
export interface LightBlend { readonly from: LightState; readonly to: LightState; readonly t: number }

/** Uniformes d'étalonnage de la rue. `veil`, `accent` et `curvature` valent 0 tant qu'aucun gain n'est écrit. */
export interface GradeUniforms {
  readonly grain: number;
  readonly vignetteIL: number;
  readonly blackPoint: number;
  readonly exposure: number;
  readonly toneMap: 'neutral' | 'aces';
  readonly veil: number;
  readonly accent: number;
  readonly curvature: number;
}

/** Entrées d'étalonnage : fondu courant, monde courant, monde au départ de la semaine (`ws0`, reçu, jamais calculé ici), écart d'arrivée. */
export interface GradeInput {
  readonly light: LightBlend;
  readonly ws: WorldVector;
  readonly ws0: WorldVector;
  readonly offset: ArrivalOffset;
}

/** Dernière marche dont `fromMinute <= minute` ; `slept` donne la nuit. Avant la première marche : la première [H.4]. */
export function lightStateAt(minute: number, slept: boolean, light: LightData): LightState {
  if (slept) return 'nuit';
  let state = light.steps[0]!.state;
  let best = -Infinity;
  for (const s of light.steps) {
    if (s.fromMinute <= minute && s.fromMinute >= best) { best = s.fromMinute; state = s.state; }
  }
  return state;
}

/** État affiché maintenant : le mélange est à `to` seulement quand il est fini. */
function current(b: LightBlend): LightState {
  return b.t >= 1 ? b.to : b.t <= 0 ? b.from : b.t >= 0.5 ? b.to : b.from;
}

/**
 * Avance le fondu de `dtMs / blendMs`, borné à 1. Un retour vers l'origine inverse le fondu en cours (`from` et `to`
 * échangés, `t` devient `1 - t`) : la valeur mélangée ne saute pas. À `t` = 0,5 c'est le cas du brief (`from: 'nuit'`, `t: 0,5`).
 * Une cible tierce repart de l'état affiché, avec un saut possible : un fondu à deux états ne porte pas un mélange à trois.
 */
export function stepBlend(b: LightBlend, target: LightState, dtMs: number, blendMs: number): LightBlend {
  const dt = blendMs > 0 ? dtMs / blendMs : 1;
  if (target === b.to) return { from: b.from, to: b.to, t: Math.min(1, b.t + dt) };
  if (target === b.from && b.t < 1) {
    // retour vers l'origine : on inverse le fondu (from et to échangés, t -> 1 - t), la valeur mélangée est continue
    return { from: b.to, to: target, t: Math.min(1, 1 - b.t + dt) };
  }
  // troisième état : un fondu à deux états ne peut pas porter un mélange à trois, on repart de l'état affiché (le plus proche)
  const from = b.t >= 1 ? b.to : current(b);
  return { from, to: target, t: Math.min(1, dt) };
}

function mix(a: number, b: number, t: number): number {
  return a === b ? a : a + (b - a) * t;
}

/** Somme des gains écrits pour un uniforme : gain x (ws - ws0) / 100 par variable, gain x signed / 100 par axe d'arrivée. */
function gainSum(gains: GradeData['gains'][keyof GradeData['gains']], input: GradeInput): number {
  if (gains === null) return 0;
  let sum = 0;
  for (const [key, g] of Object.entries(gains)) {
    if (!(WORLD_VARS as readonly string[]).includes(key)) throw new Error(`gain sur une variable inconnue : ${key}`);
    const k = key as WorldVar;
    const drift = milliToPoints((input.ws[k] - input.ws0[k]) as Milli);
    sum += (g.v * drift) / 100;
    for (const ax of input.offset.axes) if (ax.var === k) sum += (g.v * milliToPoints(ax.signed)) / 100;
  }
  return sum;
}

/** Uniformes d'étalonnage : mélange linéaire des deux états par `t`, plus les gains écrits. */
export function gradeUniforms(input: GradeInput, grade: GradeData): GradeUniforms {
  const a = grade.states[input.light.from];
  const b = grade.states[input.light.to];
  const t = input.light.t;
  const g = grade.gains;
  return {
    grain: mix(a.grain.v, b.grain.v, t) + gainSum(g.grain, input),
    vignetteIL: mix(a.vignetteIL.v, b.vignetteIL.v, t),
    blackPoint: mix(a.blackPoint.v, b.blackPoint.v, t),
    exposure: mix(a.exposure.v, b.exposure.v, t),
    toneMap: t < 0.5 ? a.toneMap.v : b.toneMap.v,
    veil: gainSum(g.veil, input),
    accent: gainSum(g.accent, input),
    curvature: gainSum(g.curvature, input),
  };
}

/**
 * Adaptation de l'exposition vers `target` : rattrape une part `rate x dt` de l'écart, sans dépasser la cible.
 * Taux montant pour une cible plus claire, taux descendant sinon [art bible §E.5 ; GTA V, recherche gta §1.1].
 */
export function adaptExposure(currentExposure: number, target: number, dtMs: number, adapt: GradeData['exposure']['adapt']): number {
  const rate = target > currentExposure ? adapt.upRatePerS.v : adapt.downRatePerS.v;
  const share = Math.min(1, Math.max(0, (rate * dtMs) / 1000));
  return currentExposure + (target - currentExposure) * share;
}
