import { describe, expect, it } from 'vitest';
import { avoidSolids, cameraPose, fovFromFocal } from '../../../src/engine/view/camera';
import type { Blocker } from '../../../src/engine/view/walk';
import { CAM, P0 } from '../../support/street_walk';

describe('caméra de la rue : optique de l\'art bible', () => {
  it.each([[35, 37.85], [40, 33.40], [85, 16.07], [135, 10.16]])('test_art_bible_optics_%imm', (f, deg) => { expect(fovFromFocal(f, 24)).toBeCloseTo(deg, 2); });   // 2 atan(12 / f), recalculé
  it('test_letterbox_only_in_observation', () => { expect(cameraPose('walk', P0, false, CAM).letterbox).toBe(false); expect(cameraPose('observation', P0, false, CAM).letterbox).toBe(true); });
  it('test_observation_is_longer_than_walk', () => { expect(cameraPose('observation', P0, false, CAM).fovDeg).toBeLessThan(cameraPose('walk', P0, false, CAM).fovDeg); });
  it('test_walk_camera_opens_when_moving_and_tightens_at_rest', () => { expect(cameraPose('walk', P0, true, CAM).fovDeg).toBeGreaterThan(cameraPose('walk', P0, false, CAM).fovDeg); });   // art bible §D.2, compromis gta §2
  // flèche de côté : la vue reste dans l'axe de la rue (cible devant la caméra en -z, même x), jamais tournée vers un mur [bug 2026-11-03]
  // perche qui se raccourcit : un bloc plein entre le joueur et la caméra ramène la caméra devant lui, à la marge près [bug 2026-11-03]
  it('test_camera_boom_stops_in_front_of_a_solid_box', () => {
    const wall: Blocker = { kind: 'box', min: { x: -2, z: 1 }, max: { x: 2, z: 2 } };   // 1 m derrière le joueur
    const pose = avoidSolids(cameraPose('walk', { x: 0, z: 0 }, false, CAM), { x: 0, z: 0 }, [wall], 0.25);
    expect(pose.pos[2]).toBeCloseTo(0.75, 9); expect(pose.pos[0]).toBe(0);                // 1 - 0,25
  });
  it('test_camera_boom_unchanged_without_obstacle_or_from_inside', () => {
    const free = cameraPose('walk', { x: 0, z: 0 }, false, CAM);
    expect(avoidSolids(free, { x: 0, z: 0 }, [{ kind: 'box', min: { x: 3, z: 1 }, max: { x: 4, z: 2 } }], 0.25)).toEqual(free);
    expect(avoidSolids(free, { x: 0, z: 0 }, [{ kind: 'box', min: { x: -1, z: -1 }, max: { x: 1, z: 1 } }], 0.25)).toEqual(free);
  });
  it('test_walk_camera_looks_down_the_street_axis', () => { const p = cameraPose('walk', { x: 2.5, z: 4 }, true, CAM); expect(p.pos[0]).toBe(p.target[0]); expect(p.target[2]).toBeLessThan(p.pos[2]); });
});
