/**
 * Mannequin neutre : DOUBLURE DE TEST de `CharacterProvider` [plan 02a T7]. Gris uni (un bouche-trou est neutre [art bible §C.7bis]),
 * étiqueté `neutral: true`. Jamais à l'écran, jamais dans une plaque, jamais importé par `runtime.ts` (testé à la tâche 12).
 */
import { CapsuleGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { ClipName } from '../../../engine/view/glb';
import type { CharacterHandle, CharacterProvider, CharacterSpec } from './provider';

/** Poignée du mannequin : garde ce qu'on lui a demandé, pour que les tests le lisent. */
export interface MannequinHandle extends CharacterHandle { readonly spec: CharacterSpec; clip: ClipName | null; speed: number; ticked: number; released: boolean }
export interface MannequinProvider extends CharacterProvider { readonly neutral: true; readonly handles: readonly MannequinHandle[] }

const GREY = 0x808080;
const HEIGHT_M = 1.75;
const RADIUS_M = 0.25;

export function createMannequinProvider(): MannequinProvider {
  const geometry = new CapsuleGeometry(RADIUS_M, HEIGHT_M - 2 * RADIUS_M);
  const material = new MeshBasicMaterial({ color: GREY });
  const handles: MannequinHandle[] = [];
  return {
    neutral: true,
    handles,
    acquire(spec) {
      const object = new Group();
      const body = new Mesh(geometry, material);
      body.position.y = HEIGHT_M / 2;       // origine aux pieds, comme un corps livré
      object.add(body);
      const h: MannequinHandle = {
        object, spec, clip: null, speed: 0, ticked: 0, released: false,
        play(clip, speed) { h.clip = clip; h.speed = speed; },
        tick(dtMs) { h.ticked += dtMs; },
        release() { h.released = true; object.removeFromParent(); },
      };
      handles.push(h);
      return h;
    },
  };
}
