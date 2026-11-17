import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture } from 'three';
import { applyLightFloor } from '../../../src/street/render/characters/floor';
import { parseScene } from '../../../src/engine/view/sceneSchema';
import w10SceneRaw from '../../../src/street/data/w10.scene.json';
import { ctxW10 } from '../../support/street';

describe('plancher de lumière des personnages [art bible §E.1, TV-02a-render]', () => {
  it('test_floor_emits_a_fraction_of_the_albedo', () => {
    const m = new MeshStandardMaterial({ color: new Color(0.8, 0.4, 0.2) });
    const g = new Group(); g.add(new Mesh(new BoxGeometry(), m));
    applyLightFloor(g, 0.3);
    expect(m.emissive.r).toBeCloseTo(0.24, 9);
    expect(m.emissive.g).toBeCloseTo(0.12, 9);
    expect(m.emissive.b).toBeCloseTo(0.06, 9);
  });
  it('test_floor_follows_the_albedo_map_when_there_is_one', () => {
    const map = new Texture();
    const m = new MeshStandardMaterial({ color: new Color(1, 1, 1), map });
    const g = new Group(); g.add(new Mesh(new BoxGeometry(), m));
    applyLightFloor(g, 0.3);
    expect(m.emissiveMap).toBe(map);
    expect(m.emissive.r).toBeCloseTo(0.3, 9);
  });
  it('test_floor_is_idempotent_on_shared_materials', () => {
    const m = new MeshStandardMaterial({ color: new Color(0.5, 0.5, 0.5) });
    const g = new Group(); g.add(new Mesh(new BoxGeometry(), m), new Mesh(new BoxGeometry(), m));
    applyLightFloor(g, 0.3); applyLightFloor(g, 0.3);
    expect(m.emissive.r).toBeCloseTo(0.15, 9);
  });
  it('test_floor_leaves_unlit_materials_alone', () => {
    const m = new MeshBasicMaterial({ color: 0x808080 });
    const g = new Group(); g.add(new Mesh(new BoxGeometry(), m));
    expect(() => { applyLightFloor(g, 0.3); }).not.toThrow();
  });
  it('test_floor_gain_is_the_art_bible_thirty_percent', () => {
    expect(parseScene(w10SceneRaw, ctxW10().street).characters.floorGain.v).toBeCloseTo(0.3, 9);
  });
});
