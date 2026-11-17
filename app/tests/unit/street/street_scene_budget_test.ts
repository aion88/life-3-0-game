// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { buildDistrict } from '../../../src/street/render/scene';
import { wallCounterOf } from '../../../src/engine/moments/bilan';
import { createI18n, type StringMeta } from '../../../src/i18n/i18n';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import meta from '../../../src/data/strings/meta.json';
import { scene } from '../../support/street_render';
import { ctxW10 } from '../../support/street';
import { describeScene, liveResources, noAssets, reachableResources } from '../../support/street_scene';

const i18n = createI18n({ fr, en }, meta as StringMeta, 'fr', { mode: 'dev', report: () => undefined });
const build = (interiors: 'core' | 'deferred' = 'core') => buildDistrict(scene(), noAssets, { interiors, i18n });
const PERSONS = ['npc', 'passerby'];   // personnes rendues par la foule, pas des objets [R-02a.14 a]

describe('scène de la rue : structure construite', () => {
  it('test_every_place_with_an_activity_has_a_volume_and_a_hit_mesh', () => {
    const d = build();
    for (const c of ctxW10().street.clickables.filter(x => !PERSONS.includes(x.id))) expect(d.hitMeshes.has(c.id)).toBe(true);
    for (const id of PERSONS) expect(d.hitMeshes.has(id)).toBe(false);
    expect(d.hitMeshes.size).toBe(11);
    for (const key of Object.keys(scene().layout.places)) expect(d.places.has(key)).toBe(true);
  });
  it('test_hit_meshes_sit_at_their_scene_positions', () => {
    const d = build(); const s = scene();
    for (const [id, o] of d.hitMeshes) {
      const at = s.interactions[id]!.at.v;
      const p = o.getWorldPosition(o.position.clone());
      expect(p.x).toBeCloseTo(at.x, 5); expect(p.z).toBeCloseTo(at.z, 5);
    }
  });
  it('test_wall_counter_shows_the_engine_value_and_never_goes_down', () => {
    const d = build();
    const start = wallCounterOf({ acts: [] }, ctxW10());   // la valeur vient de wallCounterOf, jamais d'un 3871 écrit ici
    d.setWallCounter(start + 9); d.setWallCounter(start);
    expect(describeScene(d).wallCounterText).toBe(i18n.t('w10.doc.wallCounter', { n: start + 9 }));
    d.setWallCounter(start + 12);
    expect(describeScene(d).wallCounterText).toBe(i18n.t('w10.doc.wallCounter', { n: start + 12 }));
  });
  it('test_nacelles_exist_at_engine_z', () => {
    const d = build();
    expect([...d.nacelles.keys()]).toEqual(ctxW10().street.gaze.nacelleZ.map(z => `n${z}`));
    for (const [id, o] of d.nacelles) expect(o.position.z).toBe(Number(id.slice(1)));
  });
  it('test_wall_is_sixteen_screens_with_one_orange_at_row3_col2', () => {
    const d = build(); const w = scene().checkpoint.wall;
    expect(d.wallScreens).toHaveLength(w.cols.v * w.rows.v);
    const orange = d.wallScreens.filter(o => o.userData['tint'] === 'orange');
    expect(orange).toHaveLength(1);
    expect([orange[0]!.userData['row'], orange[0]!.userData['col']]).toEqual([w.orange.row, w.orange.col]);
  });
  it('test_only_wall_screens_write_the_bloom_channel', () => {
    const d = build(); const screens = new Set(d.wallScreens);
    d.root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const m = o.material as MeshBasicNodeMaterial;
      expect(m.mrtNode != null).toBe(screens.has(o));
    });
  });
  it('test_screen_scanlines_are_a_node_not_a_texture', () => {
    const d = build();
    for (const o of d.wallScreens) {
      const m = (o as Mesh).material as MeshBasicNodeMaterial;
      expect(m.map).toBeNull(); expect(m.colorNode).toBeTruthy();
    }
  });
  it('test_other_emissives_are_the_vault_and_the_lamps', () => {
    const d = build();
    expect(d.otherEmissives.length).toBeGreaterThan(0);
    for (const o of d.otherEmissives) expect(d.wallScreens).not.toContain(o);
  });
  it('test_scene_stays_inside_the_structural_budget', () => {
    const s = scene();
    for (const interiors of ['core', 'deferred'] as const) {
      const r = describeScene(build(interiors));
      expect(r.drawCalls).toBeLessThanOrEqual(s.budget.drawCalls.v); expect(r.triangles).toBeLessThanOrEqual(s.budget.triangles.v);
      expect(r.drawCalls).toBeGreaterThan(20);
    }
  });
  it('test_facades_are_instanced_by_type', () => {
    const d = build(); let instanced = 0;
    d.root.traverse((o) => { if ((o as { isInstancedMesh?: boolean }).isInstancedMesh === true) instanced++; });
    expect(instanced).toBeGreaterThanOrEqual(3);
  });
  it('test_deferred_interiors_add_the_flat_and_the_register', () => {
    const core = build('core'); const full = build('deferred');
    expect(core.root.getObjectByName('interior.logement')).toBeUndefined();
    expect(full.root.getObjectByName('interior.logement')).toBeDefined();
    expect(full.root.getObjectByName('interior.registre')).toBeDefined();
  });
  it('test_grey_car_can_be_hidden', () => {
    const d = build(); const car = d.hitMeshes.get('greyCar')!;
    d.setVisible('greyCar', false);
    expect(car.parent!.visible).toBe(false);
    d.setVisible('greyCar', true);
    expect(car.parent!.visible).toBe(true);
  });
  it('test_wall_counter_text_surface_is_injectable', () => {
    const shown: string[] = [];
    const d = buildDistrict(scene(), noAssets, { interiors: 'core', i18n, textSurface: ({ widthM, heightM }) => ({ object: new Mesh(new PlaneGeometry(widthM, heightM), new MeshBasicNodeMaterial()), setText: (t) => { shown.push(t); } }) });
    d.setWallCounter(5); d.setWallCounter(4); d.setWallCounter(6);
    expect(shown).toEqual([i18n.t('w10.doc.wallCounter', { n: 5 }), i18n.t('w10.doc.wallCounter', { n: 6 })]);
  });
  it('test_dispose_frees_everything', () => {
    const before = liveResources();
    const d = build('deferred');
    expect(liveResources()).not.toEqual(before);
    const reach = reachableResources(d.root);
    const disposed = new Set<unknown>();
    for (const r of [...reach.geometries, ...reach.materials, ...reach.textures]) r.addEventListener('dispose', () => disposed.add(r));
    d.dispose();
    expect(liveResources()).toEqual(before);
    expect(disposed.size).toBe(reach.geometries.size + reach.materials.size + reach.textures.size);
  });
});
