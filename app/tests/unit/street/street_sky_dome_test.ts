import { describe, expect, it } from 'vitest';
import { skyBlend, skyColorAt, MID_ELEVATION_DEG } from '../../../src/street/render/sky';
import { lightRig } from '../../../src/street/render/lighting';
import { parseScene } from '../../../src/engine/view/sceneSchema';
import w10SceneRaw from '../../../src/street/data/w10.scene.json';
import { ctxW10 } from '../../support/street';

const scene = () => parseScene(w10SceneRaw, ctxW10().street);
const STOPS = { zenith: [0, 0, 1], mid: [0, 1, 0], horizon: [1, 0, 0] } as const;

describe('ciel de jour : dégradé à trois arrêts [TV-02a-render, ciel-jour-spec §2]', () => {
  it('test_horizon_and_below_are_the_horizon_stop', () => {
    expect(skyColorAt(0, STOPS)).toEqual([1, 0, 0]);
    expect(skyColorAt(-40, STOPS)).toEqual([1, 0, 0]);   // sous l'horizon : tenu
  });
  it('test_mid_stop_is_reached_at_fifteen_degrees_and_zenith_at_ninety', () => {
    expect(MID_ELEVATION_DEG).toBe(15);
    const m = skyColorAt(15, STOPS); const z = skyColorAt(90, STOPS);
    expect(m[1]).toBeCloseTo(1, 9); expect(m[0]).toBeCloseTo(0, 9);
    expect(z[2]).toBeCloseTo(1, 9); expect(z[1]).toBeCloseTo(0, 9);
  });
  it('test_blend_weights_are_monotonic_and_bounded', () => {
    let last = -1;
    for (let e = -10; e <= 90; e += 5) { const b = skyBlend(e); expect(b.toMid).toBeGreaterThanOrEqual(0); expect(b.toMid).toBeLessThanOrEqual(1); expect(b.toZenith).toBeGreaterThanOrEqual(last); last = b.toZenith; }
  });
  it('test_every_state_has_three_distinct_stops_in_day_and_dusk_and_horizon_is_the_fog_colour', () => {
    const rigs = scene().lightRigs;
    for (const k of ['jour', 'heureBleue'] as const) {
      const r = rigs[k];
      expect(new Set([r.skyZenith.v, r.skyMid.v, r.skyHorizon.v]).size).toBe(3);
      expect(r.horizon.v).toBe(r.skyHorizon.v);   // brouillard accordé à l'horizon [§4.4]
    }
    expect(rigs.nuit.horizon.v).toBe(rigs.nuit.skyHorizon.v);
  });
  it('test_rig_blends_the_dome_stops_between_states', () => {
    const rigs = scene().lightRigs;
    const mid = lightRig({ from: 'jour', to: 'nuit', t: 0.5 }, rigs);
    const a = lightRig({ from: 'jour', to: 'jour', t: 1 }, rigs), z = lightRig({ from: 'nuit', to: 'nuit', t: 1 }, rigs);
    expect(mid.skyZenith[0]).toBeCloseTo((a.skyZenith[0] + z.skyZenith[0]) / 2, 9);
    expect(mid.sunHaloRadiusDeg).toBeCloseTo((a.sunHaloRadiusDeg + z.sunHaloRadiusDeg) / 2, 9);
  });
  it('test_night_has_no_halo_and_fog_starts_beyond_the_walk_view', () => {
    const s = scene();
    expect(s.lightRigs.nuit.sunHaloRadiusDeg.v).toBe(0);
    expect(s.sky.fogFarM.v).toBeGreaterThan(s.sky.fogNearM.v);
  });
});
