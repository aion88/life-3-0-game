/**
 * Aides de test de l'interaction dans la rue [plan 02a T9, R-02a.2]. Aucune règle de jeu ici.
 */
import { parseScene, type SceneData } from '../../src/engine/view/sceneSchema';
import type { InteractData } from '../../src/engine/view/interactions';
import type { Vec2 } from '../../src/engine/moments/types';
import w10SceneRaw from '../../src/street/data/w10.scene.json';
import { ctxW10, homeAt, streetAt } from './street';

export const ctx = ctxW10();
export const S = ctx.street;

/** La scène de w10, validée contre le monde. */
export const scene = (): SceneData => parseScene(w10SceneRaw, S);
/** Ce que l'interaction lit de la scène. */
export const INTERACT: InteractData = (() => { const s = scene(); return { interact: s.interact, interactions: s.interactions, triggers: s.triggers }; })();

/** Joueuse au logement, jour 1 à 7 h : rien n'est en attente. */
export const st0 = homeAt(1, 420);
/** Position d'un cliquable de la scène. */
export const posOf = (id: string): Vec2 => scene().interactions[id]!.at.v;
/** Position de départ au logement. */
export const P: Vec2 = { x: 0, z: 33 };
/** Point de la rue loin de tout lieu d'un choix (plus de 14 m du checkpoint, du logement et des PNJ). */
export const FAR: Vec2 = { x: 0, z: -44 };
export { homeAt, streetAt };
