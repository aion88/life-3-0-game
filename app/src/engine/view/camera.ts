/**
 * Optique et poses de la caméra de la rue [plan 02a T8, art bible §D.2]. Pur : ni DOM ni Three.js, aucun nombre en dur,
 * tout vient de `SceneData['camera']` avec sa provenance. L'interpolation dans le temps (`transitionMs`) est l'affaire de l'écran.
 */
import type { Vec2 } from '../moments/types';
import type { SceneData } from './sceneSchema';
import type { Blocker } from './walk';

/** Données de caméra de la scène : focales, hauteurs, distances, durée de transition. */
export type CameraData = SceneData['camera'];
/** `walk` : troisième personne basse, jouée. `observation` : longue focale, bandes 2,39:1. */
export type CameraMode = 'walk' | 'observation';
/** Pose rendue à Three.js : position, cible, champ vertical en degrés, bandes. */
export interface CameraPose {
  readonly pos: [number, number, number];
  readonly target: [number, number, number];
  readonly fovDeg: number;
  readonly letterbox: boolean;
}

/** Champ vertical en degrés : 2 atan(h / 2f) [art bible §D.2]. */
export function fovFromFocal(focalMm: number, sensorHeightMm: number): number {
  return (2 * Math.atan(sensorHeightMm / (2 * focalMm)) * 180) / Math.PI;
}

/**
 * Pose de la caméra. Elle vise toujours le long de la rue, vers -z (le checkpoint), et ne suit JAMAIS le cap du corps : les touches de marche
 * sont des axes d'écran (`stepWalk` : haut = -z, gauche = ouest, droite = est), une caméra liée au cap les rendrait fausses. Lier la caméra
 * au cap faisait pivoter la vue de 90° sur une flèche de côté, face au mur de la rue [bug Cynthia 2026-11-03]. Convention tranchée (le GDD 05
 * et le plan 02a sont muets) : gauche et droite déplacent de côté (pas latéral), le corps se tourne vers sa marche, la vue reste dans l'axe.
 * La caméra se tient derrière le joueur à `distanceM` (en +z ; en observation, décalée de `lateralM` en x du monde, à l'opposé de la file),
 * à `heightM`, et vise le joueur à cette hauteur. En marche, `moving` ouvre la focale ; à l'arrêt elle se resserre.
 * L'observation ignore `moving`.
 */
export function cameraPose(mode: CameraMode, player: Vec2, moving: boolean, d: CameraData): CameraPose {
  const sensor = d.sensorHeightMm.v;
  const rig = mode === 'walk' ? d.walk : d.observation;
  const focal = mode === 'walk' ? (moving ? d.walk.movingFocalMm.v : d.walk.restFocalMm.v) : d.observation.focalMm.v;
  const h = rig.heightM.v;
  // Observation près du mur de télés : la visée glisse du joueur vers le point de cadrage du checkpoint et la caméra recule (w de 0 à 1 sur `rampM`),
  // sinon le mur solide remplit le cadre à 85 mm. Pose continue en z, pure.
  const f = d.observation.checkpointFrame.v;
  const w = mode === 'observation' ? Math.min(Math.max((f.fromZ - player.z) / f.rampM, 0), 1) : 0;
  const back = rig.distanceM.v + w * (f.distanceM - rig.distanceM.v);
  // L'observation se tient à côté de la file, du côté opposé à elle (`lateralM` est signé, en x du monde, négatif = ouest, la file étant à l'est) :
  // sur l'axe de la file la caméra serait dans la file et un voisin passerait devant l'objectif.
  const side = mode === 'observation' ? d.observation.lateralM.v : 0;
  return {
    pos: [player.x + side, h, player.z + back],
    target: [player.x + w * (f.x - player.x), h, player.z + w * (f.z - player.z)],
    fovDeg: fovFromFocal(focal, sensor),
    letterbox: mode === 'observation',
  };
}

/** Première fraction t de [0, 1] du trajet p -> c qui touche l'obstacle, `null` s'il n'est pas touché. Un départ dans une boîte ne compte pas. */
function firstHit(p: Vec2, c: Vec2, k: Blocker): number | null {
  const dx = c.x - p.x, dz = c.z - p.z;
  if (k.kind === 'segment') {
    const ex = k.b.x - k.a.x, ez = k.b.z - k.a.z, den = dx * ez - dz * ex;
    if (den === 0) return null;
    const t = ((k.a.x - p.x) * ez - (k.a.z - p.z) * ex) / den, u = ((k.a.x - p.x) * dz - (k.a.z - p.z) * dx) / den;
    return t > 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  }
  if (p.x > k.min.x && p.x < k.max.x && p.z > k.min.z && p.z < k.max.z) return null;
  let t0 = 0, t1 = 1;
  for (const [o, dv, lo, hi] of [[p.x, dx, k.min.x, k.max.x], [p.z, dz, k.min.z, k.max.z]] as const) {
    if (dv === 0) { if (o <= lo || o >= hi) return null; continue; }
    const ta = (lo - o) / dv, tb = (hi - o) / dv;
    t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
  }
  return t1 > t0 ? t0 : null;
}

/**
 * La caméra ne passe jamais derrière un décor plein [bug Cynthia 2026-11-03 : « je marche au milieu d'un mur »]. Sur le trajet au sol du joueur
 * vers la caméra, le premier obstacle touché ramène la caméra devant lui, à `marginM` en deçà (perche qui se raccourcit). La hauteur et la visée
 * ne bougent pas. Sans obstacle, la pose est rendue telle quelle. Les obstacles sont ceux de la marche (`streetBounds`, `solidBlockers`,
 * la barrière) : leurs boîtes sont déjà élargies du rayon du corps.
 */
export function avoidSolids(pose: CameraPose, player: Vec2, blockers: readonly Blocker[], marginM: number): CameraPose {
  const c: Vec2 = { x: pose.pos[0], z: pose.pos[2] };
  const len = Math.sqrt((c.x - player.x) * (c.x - player.x) + (c.z - player.z) * (c.z - player.z));
  if (len === 0) return pose;
  let t = 1;
  for (const k of blockers) { const h = firstHit(player, c, k); if (h !== null && h < t) t = h; }
  if (t === 1) return pose;
  const keep = Math.max(t * len - marginM, 0) / len;
  return { ...pose, pos: [player.x + (c.x - player.x) * keep, pose.pos[1], player.z + (c.z - player.z) * keep] };
}
