/**
 * Aides des tests de caméra et de marche [R-02a.2, plan 02a T8] : un fichier, un écrivain. Rien sous `src/` ne l'importe.
 */
import { parseScene, type SceneData } from '../../src/engine/view/sceneSchema';
import type { Blocker } from '../../src/engine/view/walk';
import type { QueuePosition } from '../../src/engine/moments/checkpoint';
import { startDay, type ClockState } from '../../src/engine/moments/clock';
import type { Vec2 } from '../../src/engine/moments/types';
import w10SceneRaw from '../../src/street/data/w10.scene.json';
import { ctxW10, day1State } from './street';

export { day1State };

/** Données de rue de w10 : l'argument `street` de `advance`. */
export const S = ctxW10().street;
/** Scène de w10, validée. */
export const SCENE: SceneData = parseScene(w10SceneRaw, S);
/** Données de caméra et de marche de la scène. */
export const CAM = SCENE.camera;
export const WALK = SCENE.walk;
/** L'origine. */
export const P0: Vec2 = { x: 0, z: 0 };
/** Mur est de la rue : x = 7 [bible w10 §5.0, demi-largeur], de bout en bout. */
export const EAST_WALL: Blocker = { kind: 'segment', a: { x: SCENE.layout.halfWidthM.v, z: SCENE.layout.zMin.v }, b: { x: SCENE.layout.halfWidthM.v, z: SCENE.layout.zMax.v } };
/** Une lecture de file quelconque : un acte `lane` du jour a été joué. */
export const READING: QueuePosition = { lane: 'courtesy', startMinute: 600, endMinute: 660, permille: 0 };
const wallZ = SCENE.interactions['wall']!.at.v.z;
/** Au milieu du couloir de file, devant le mur du checkpoint. */
export const IN_QUEUE_LANE: Vec2 = { x: 0, z: wallZ + SCENE.queue.lengthM.v / 2 };
/** Loin du checkpoint, côté logement. */
export const OUTSIDE: Vec2 = { x: 0, z: SCENE.layout.places.logement.z.v };

/** Horloge du jour 1 à l'ouverture de la rue. */
export function day(): ClockState {
  return startDay(1, S);
}
