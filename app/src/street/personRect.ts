/**
 * Rectangle écran de la personne parlée [plan UI-C T8 ; spec C §3.2 ; I-3] : la boîte monde de la personne, réduite à sa part haute
 * (« tête et buste », `bustShare`), projetée par la caméra. `null` si un coin de cette part est derrière la caméra.
 */
import { Vector3 } from 'three';
import type { Camera } from 'three';
import { loadUi } from '../data/ui/load';
import type { ScreenRect, Size } from './ui/placement';

/** Part haute de la boîte de la personne qui forme « tête et buste » [theme.street.bustShare]. */
export const bustShareOf = (): number => loadUi().theme.street.bustShare.v;

export interface WorldBox { readonly min: { readonly x: number; readonly y: number; readonly z: number }; readonly max: { readonly x: number; readonly y: number; readonly z: number } }

export function projectPersonRect(box: WorldBox, camera: Camera, view: Size, bustShare: number): ScreenRect | null {
  const yLow = box.max.y - (box.max.y - box.min.y) * bustShare;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const v = new Vector3();
  for (const x of [box.min.x, box.max.x]) for (const y of [yLow, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    v.set(x, y, z);
    if (v.clone().applyMatrix4(camera.matrixWorldInverse).z >= 0) return null;   // la caméra regarde vers -z : z >= 0 est derrière elle
    v.project(camera);
    const px = ((v.x + 1) / 2) * view.w, py = ((1 - v.y) / 2) * view.h;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
