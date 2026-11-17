/* eslint-disable no-restricted-properties --
   sin, cos et exp sont interdits au moteur pour garder la simulation reproductible d'une plateforme à l'autre [GDD 03 §4] ;
   ici la sortie ne va qu'à l'objectif (pose, amorti), jamais à l'état du jeu ni à une sauvegarde. */
/**
 * Caméra haute de trois quarts de la rue guidée [spec rue guidée §4.4]. Pur : ni DOM ni Three.js, aucun nombre en dur,
 * tout vient de `SceneData['camera']['high']`. Un plan (`Shot`) est un foyer, une distance, une plongée, un azimut et une focale ;
 * `stepShot` l'amortit dans le temps, `shotPose` le convertit en pose pour Three.js.
 */
import type { Vec2 } from '../moments/types';
import { fovFromFocal, type CameraPose } from './camera';
import type { SceneData } from './sceneSchema';

/** Plan de caméra : foyer au sol (x, z), hauteur du point visé, distance, plongée, azimut (depuis +z vers +x) et focale. */
export interface Shot { readonly focus: Vec2; readonly y: number; readonly distM: number; readonly elevDeg: number; readonly azimDeg: number; readonly focalMm: number }
/** Genre de scène : le plan en dépend. */
export type ShotKind = 'home' | 'desk' | 'street' | 'talk' | 'queue';

const RAD = Math.PI / 180;

/** Plan d'un genre de scène autour de `focus`, tiré des données. */
export function shotFor(kind: ShotKind, focus: Vec2, d: SceneData['camera']['high']): Shot {
  const k = d[kind];
  return { focus, y: d.focusHeightM.v, distM: k.distM.v, elevDeg: k.elevDeg.v, azimDeg: k.azimDeg.v, focalMm: k.focalMm.v };
}

/** Pose : position = focus + dist (sin az cos el, sin el, cos az cos el) ; cible = focus à y ; champ = fovFromFocal(focal, capteur). Jamais de bandes. */
export function shotPose(s: Shot, sensorHeightMm: number): CameraPose {
  const el = s.elevDeg * RAD, az = s.azimDeg * RAD;
  return {
    pos: [s.focus.x + s.distM * Math.sin(az) * Math.cos(el), s.y + s.distM * Math.sin(el), s.focus.z + s.distM * Math.cos(az) * Math.cos(el)],
    target: [s.focus.x, s.y, s.focus.z],
    fovDeg: fovFromFocal(s.focalMm, sensorHeightMm),
    letterbox: false,
  };
}

/**
 * Amorti exponentiel : k = 1 - exp(-dt / tauMs) sur chaque champ ; `snap` : k = 1 (le plan voulu, exactement).
 * `tauMs <= 0` vaut `snap` (pas de NaN). L'azimut s'interpole linéairement, sans arc le plus court : les données restent dans 0 à 180.
 */
export function stepShot(cur: Shot, want: Shot, dtMs: number, tauMs: number, snap: boolean): Shot {
  if (snap || tauMs <= 0) return want;
  const k = 1 - Math.exp(-dtMs / tauMs);
  const m = (a: number, b: number): number => a + (b - a) * k;
  return {
    focus: { x: m(cur.focus.x, want.focus.x), z: m(cur.focus.z, want.focus.z) },
    y: m(cur.y, want.y), distM: m(cur.distM, want.distM), elevDeg: m(cur.elevDeg, want.elevDeg),
    azimDeg: m(cur.azimDeg, want.azimDeg), focalMm: m(cur.focalMm, want.focalMm),
  };
}
