import { describe, expect, it } from 'vitest';
import { fovFromFocal } from '../../../src/engine/view/camera';
import { shotFor, shotPose, stepShot, type Shot } from '../../../src/engine/view/rig';
import w10 from '../../../src/data/worlds/w10.json';
import { SCENE } from '../../support/street_walk';

const A: Shot = { focus: { x: 0, z: 0 }, y: 1, distM: 36, elevDeg: 38, azimDeg: 0, focalMm: 60 };
const B: Shot = { focus: { x: 4, z: -10 }, y: 1, distM: 20, elevDeg: 30, azimDeg: 12, focalMm: 70 };
const scene = SCENE;

describe('caméra haute de trois quarts', () => {
  it('test_pose_is_above_and_behind_focus', () => {
    const p = shotPose(A, 24);
    expect(p.pos[1]).toBeCloseTo(1 + 36 * Math.sin(38 * Math.PI / 180), 6);
    expect(p.pos[2]).toBeGreaterThan(0);
    expect(p.fovDeg).toBeCloseTo(fovFromFocal(60, 24), 9);
    expect(p.letterbox).toBe(false);
  });
  it('test_step_converges_without_overshoot', () => {
    const flat = (t: Shot): number[] => [t.focus.x, t.focus.z, t.y, t.distM, t.elevDeg, t.azimDeg, t.focalMm];
    let s = A;
    for (let i = 0; i < 500; i++) {
      const n = stepShot(s, B, 16, 700, false);
      const [fs, fn, fb] = [flat(s), flat(n), flat(B)];
      fb.forEach((b, j) => expect(Math.abs(b - fn[j]!)).toBeLessThanOrEqual(Math.abs(b - fs[j]!)));
      s = n;
    }
    flat(B).forEach((b, j) => expect(flat(s)[j]!).toBeCloseTo(b, 3));
  });
  it('test_azimuth_sign_90_puts_camera_east_of_focus', () => {
    const p = shotPose({ ...A, azimDeg: 90 }, 24);
    expect(p.pos[0]).toBeCloseTo(A.focus.x + A.distM * Math.cos(38 * Math.PI / 180), 6);
    expect(p.pos[2]).toBeCloseTo(A.focus.z, 6);
  });
  it('test_nonpositive_tau_snaps_without_nan', () => { expect(stepShot(A, B, 16, 0, false)).toEqual(B); expect(stepShot(A, B, 16, -5, false)).toEqual(B); });
  it('test_snap_is_exact', () => { expect(stepShot(A, B, 16, 700, true)).toEqual(B); });
  it('test_high_camera_focal_within_spec_range', () => {
    for (const k of ['home', 'desk', 'street', 'talk', 'queue'] as const) {
      expect(scene.camera.high[k].focalMm.v).toBeGreaterThanOrEqual(60);
      expect(scene.camera.high[k].focalMm.v).toBeLessThanOrEqual(70);
    }
  });
  it('test_shot_for_reads_the_data', () => {
    const s = shotFor('talk', { x: 1, z: 2 }, scene.camera.high);
    expect([s.distM, s.elevDeg, s.azimDeg, s.focalMm, s.y]).toEqual([20, 36, 10, 70, scene.camera.high.focusHeightM.v]);
  });
  it('test_every_scene_place_is_declared', () => {
    for (const s of w10.street.guided!.scenes) expect(scene.guided.places).toHaveProperty([s.place]);
  });
});
