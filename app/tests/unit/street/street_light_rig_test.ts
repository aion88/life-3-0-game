import { describe, expect, it } from 'vitest';
import { lightRig, sunDirection } from '../../../src/street/render/lighting';
import type { SceneData } from '../../../src/engine/view/sceneSchema';
import { parseScene } from '../../../src/engine/view/sceneSchema';
import w10SceneRaw from '../../../src/street/data/w10.scene.json';
import { ctxW10 } from '../../support/street';

const h = (v: string) => ({ v, src: 'test', status: 'sourced' as const });
const n = (v: number) => ({ v, src: 'test', status: 'sourced' as const });
const rig = (hemi: number, sun: number, sky = '#000000', sunColor = '#000000') => ({
  sky: h(sky), horizon: h(sky), ground: h('#000000'), hemiIntensity: n(hemi), sunColor: h(sunColor), sunIntensity: n(sun), sunElevationDeg: n(30), sunAzimuthDeg: n(90), lampLevel: n(0),
  skyZenith: h(sky), skyMid: h(sky), skyHorizon: h(sky), sunHalo: h(sky), sunHaloRadiusDeg: n(0),
});
const RIGS: SceneData['lightRigs'] = { jour: rig(2, 3, '#ffffff', '#ffffff'), heureBleue: rig(1, 0), nuit: rig(0.5, 0) };

describe('rig de lumière par état [TV-02a-render]', () => {
  it('test_light_rig_of_a_settled_state_is_that_state_not_the_night', () => {
    const r = lightRig({ from: 'jour', to: 'jour', t: 1 }, RIGS);
    expect(r.hemiIntensity).toBe(2);
    expect(r.sunIntensity).toBe(3);
    expect(r.sky).toEqual([1, 1, 1]);
    expect(r.horizon).toEqual([1, 1, 1]);   // le fond suit l'état, il n'est jamais le noir du vide
  });
  it('test_light_rig_blends_numbers_and_colours_by_t', () => {
    const r = lightRig({ from: 'jour', to: 'nuit', t: 0.5 }, RIGS);
    expect(r.hemiIntensity).toBeCloseTo(1.25, 9);   // (2 + 0,5) / 2
    expect(r.sunIntensity).toBeCloseTo(1.5, 9);     // (3 + 0) / 2
    expect(r.sky[0]).toBeCloseTo(0.5, 9);
  });
  it('test_sun_direction_points_to_the_sun', () => {
    const up = sunDirection(90, 0);
    expect(up[1]).toBeCloseTo(1, 9);
    const east = sunDirection(0, 90);          // azimut 90 degrés : vers +x
    expect(east[0]).toBeCloseTo(1, 9);
    expect(east[2]).toBeCloseTo(0, 9);
    const back = sunDirection(0, 0);           // azimut 0 : vers +z
    expect(back[2]).toBeCloseTo(1, 9);
    const d = sunDirection(30, 200);
    expect(Math.hypot(...d)).toBeCloseTo(1, 9);
  });
  it('test_the_day_is_actually_brighter_than_the_night_in_the_data', () => {
    const rigs = parseScene(w10SceneRaw, ctxW10().street).lightRigs;
    const lum = (s: 'jour' | 'heureBleue' | 'nuit') => { const r = lightRig({ from: s, to: s, t: 1 }, rigs); return r.hemiIntensity * (r.sky[0] + r.sky[1] + r.sky[2]) / 3 + r.sunIntensity; };
    expect(lum('jour')).toBeGreaterThan(lum('heureBleue'));
    expect(lum('heureBleue')).toBeGreaterThan(lum('nuit'));
    expect(lum('nuit')).toBeGreaterThan(0);   // jamais un noir total : les fenêtres seules ne lisent pas une rue
  });
});
