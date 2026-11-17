/** Projection du rectangle de la personne parlée [plan UI-C T8 ; I-3] : caméra et boîte connues, résultat recalculé à la main. */
import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { projectPersonRect } from '../../../src/street/personRect';

const camera = (): PerspectiveCamera => {
  const c = new PerspectiveCamera(90, 1, 0.1, 100);   // fov 90°, aspect 1 : ndc = (x, y) / -z
  c.position.set(0, 0, 0); c.lookAt(0, 0, -1); c.updateMatrixWorld(); c.updateProjectionMatrix();
  return c;
};

describe('projectPersonRect', () => {
  it('test_project_person_rect_takes_top_bust_share', () => {
    // boîte x ±1, y de -2 à 2, z de -4 à -2. Part haute 0,5 : y de 0 à 2.
    // z=-2 : ndc x ±0,5, y 0..1 ; z=-4 : ndc x ±0,25, y 0..0,5. Union : x [-0,5 ; 0,5], y [0 ; 1].
    // Fenêtre 1000 × 1000 : x [250 ; 750], y = (1 - ndc) / 2 × 1000 -> [0 ; 500].
    const r = projectPersonRect({ min: { x: -1, y: -2, z: -4 }, max: { x: 1, y: 2, z: -2 } }, camera(), { w: 1000, h: 1000 }, 0.5)!;
    expect(r.x).toBeCloseTo(250, 6); expect(r.y).toBeCloseTo(0, 6); expect(r.w).toBeCloseTo(500, 6); expect(r.h).toBeCloseTo(500, 6);
  });

  it('test_person_behind_camera_returns_null', () => {
    expect(projectPersonRect({ min: { x: -1, y: -2, z: 2 }, max: { x: 1, y: 2, z: 4 } }, camera(), { w: 1000, h: 1000 }, 0.5)).toBeNull();
  });
});
