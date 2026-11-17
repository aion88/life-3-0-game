import { describe, expect, it } from 'vitest';
import { lampHeadPositions, nearestLamps, poolProfile, spotAim, wallLitHeightM } from '../../../src/street/render/lampLight';
import { lightRig } from '../../../src/street/render/lighting';
import { parseScene } from '../../../src/engine/view/sceneSchema';
import w10SceneRaw from '../../../src/street/data/w10.scene.json';
import { ctxW10 } from '../../support/street';

const scene = () => parseScene(w10SceneRaw, ctxW10().street);

describe('lampadaires : sources de lumière [TV-02a-render]', () => {
  it('test_twelve_heads_at_the_mast_head_height', () => {
    const s = scene(); const heads = lampHeadPositions(s);
    expect(heads).toHaveLength(12);
    for (const h of heads) expect(h.y).toBeCloseTo(s.lamps.mastM.v - 0.1 - 0.15, 9);   // sous la tête émissive
    expect(heads.filter((h) => h.x > 0)).toHaveLength(6);
  });
  it('test_nearest_lamps_are_those_around_the_viewer', () => {
    const heads = lampHeadPositions(scene());
    const idx = nearestLamps(heads, { x: 0, z: 8 }, 4);
    expect(idx).toHaveLength(4);
    for (const i of idx) expect(Math.abs(heads[i]!.z - 8)).toBeLessThanOrEqual(18);   // la paire à z = 8 et celle d'à côté
    expect(new Set(idx).size).toBe(4);
  });
  it('test_nearest_lamps_is_stable_and_never_asks_for_more_than_exist', () => {
    const heads = lampHeadPositions(scene());
    expect(nearestLamps(heads, { x: 0, z: 8 }, 4)).toEqual(nearestLamps(heads, { x: 0, z: 8 }, 4));
    expect(nearestLamps(heads, { x: 0, z: 8 }, 99)).toHaveLength(12);
  });
  it('test_pool_is_brightest_under_the_lamp_and_gone_at_the_edge', () => {
    expect(poolProfile(0)).toBe(1);
    expect(poolProfile(0.5)).toBeLessThan(poolProfile(0.2));
    expect(poolProfile(1)).toBe(0);
    expect(poolProfile(1.5)).toBe(0);
  });
  it('test_lamps_are_off_by_day_and_on_at_night', () => {
    const rigs = scene().lightRigs;
    const at = (s: 'jour' | 'heureBleue' | 'nuit') => lightRig({ from: s, to: s, t: 1 }, rigs).lampLevel;
    expect(at('jour')).toBe(0);
    expect(at('nuit')).toBe(1);
    expect(at('heureBleue')).toBeGreaterThan(0);
    expect(at('heureBleue')).toBeLessThanOrEqual(1);
  });
  it('test_lamp_light_data_is_sodium_cut_off_and_within_the_light_budget', () => {
    const l = scene().lamps.light;
    expect(l.realCount.v).toBeLessThanOrEqual(4);                       // sources réelles près du joueur : le reste sont des flaques simulées
    expect(l.distanceM.v).toBeLessThanOrEqual(scene().lamps.spacingM.v);   // portée finie : une source qui entre dans le lot n'apparaît pas d'un coup
    expect(l.poolRadiusM.v).toBeGreaterThan(scene().lamps.mastM.v / 2);
  });
  it('test_spot_is_a_downward_cone_tilted_toward_the_road_axis', () => {
    const l = scene().lamps.light;
    expect(l.angleDeg.v).toBeGreaterThan(0); expect(l.angleDeg.v).toBeLessThan(60);   // un cône, pas une demi-sphère
    const east = spotAim('east', l.tiltDeg.v), west = spotAim('west', l.tiltDeg.v);
    expect(east[1]).toBeLessThan(0);                  // vers le bas
    expect(east[0]).toBeLessThan(0); expect(west[0]).toBeGreaterThan(0);   // incliné vers l'axe de la chaussée (x = 0)
    expect(east[0] + west[0]).toBeCloseTo(0, 12);
    expect(Math.hypot(...east)).toBeCloseTo(1, 12);
  });
  it('test_cone_lights_the_ground_floor_wall_and_not_the_upper_storeys', () => {
    const s = scene();
    const h = wallLitHeightM(s);
    expect(h).toBeGreaterThanOrEqual(s.build.storeyHeightM.v);   // le rez-de-chaussée reçoit la lumière
    expect(h).toBeLessThanOrEqual(3.5);                          // ciel-jour-spec lampadaires : le mur n'est éclairé que sous 3,5 m au plus
  });
  it('test_head_is_flat_and_horizontal_so_it_is_not_read_as_a_window', () => {
    const b = scene().build;
    expect(b.lampHeadLengthM.v).toBeGreaterThan(b.lampHeadHeightM.v * 2);   // plate : au moins deux fois plus longue que haute
    expect(b.lampHeadHeightM.v).toBeLessThan(b.lampHeadLengthM.v);
    expect(b.lampLensGain.v).toBeGreaterThan(b.litWindowGain.v);            // la lentille est plus claire que les fenêtres allumées
  });
});
