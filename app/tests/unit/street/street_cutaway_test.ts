// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { InstancedMesh, Mesh, PointLight, Vector3, type Object3D } from 'three/webgpu';
import { buildDistrict, type DistrictHandle } from '../../../src/street/render/scene';
import { clipSpan, cutawayInstances } from '../../../src/street/render/scene/cutaway';
import { createI18n, type StringMeta } from '../../../src/i18n/i18n';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import meta from '../../../src/data/strings/meta.json';
import { scene } from '../../support/street_render';
import { shotFor, shotPose } from '../../../src/engine/view/rig';
import { layoutFacades } from '../../../src/engine/view/layout';
import { worldSeedOf } from '../../../src/shared/types/world';
import { FACADE_SEED_OFFSET } from '../../../src/street/render/scene/facades';
import { describeScene, noAssets } from '../../support/street_scene';

const i18n = createI18n({ fr, en }, meta as StringMeta, 'fr', { mode: 'dev', report: () => undefined });
const district = (interiors: 'core' | 'deferred' = 'deferred'): DistrictHandle => buildDistrict(scene(), noAssets, { interiors, i18n });

/** Les matrices de toutes les instances de la scène, par maillage instancié nommé. */
function matrices(d: DistrictHandle): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  d.root.traverse((o) => { if (o instanceof InstancedMesh) out[o.name] = [...(o.instanceMatrix.array as Float32Array)]; });
  return out;
}
const unitNames = (d: DistrictHandle): string[] => {
  const out: string[] = [];
  d.root.getObjectByName('interior.logement')!.children.forEach((c) => { if (/^unit\.9-[A-D]$/.test(c.name)) out.push(c.name); });
  return out;
};
const worldPos = (o: Object3D): Vector3 => o.getWorldPosition(new Vector3());
const lights = (d: DistrictHandle): PointLight[] => { const out: PointLight[] = []; d.root.traverse((o) => { if (o instanceof PointLight) out.push(o); }); return out; };
/** Un maillage est éclairé quand une source réelle visible et allumée est à moins de `r` mètres. */
function lightNear(d: DistrictHandle, m: Object3D, r: number): PointLight | null {
  return lights(d).find((l) => l.visible && l.intensity > 0 && worldPos(l).distanceTo(worldPos(m)) <= r) ?? null;
}
/** Instances d'un maillage dont les trois axes de la matrice sont nuls (échelle 0). */
const hidden = (d: DistrictHandle, name: string): number => {
  const m = d.root.getObjectByName(name) as InstancedMesh; const a = m.instanceMatrix.array as Float32Array;
  let n = 0;
  for (let i = 0; i < m.count; i++) if (a[i * 16] === 0 && a[i * 16 + 5] === 0 && a[i * 16 + 10] === 0) n++;
  return n;
};

describe('coupe de l\'immeuble 9', () => {
  it('test_cutaway_selects_only_west_instances_in_range', () => {
    expect(cutawayInstances([{ x: -9, z: 30 }, { x: 9, z: 30 }, { x: -9, z: 10 }], 28, 38)).toEqual([0]);
  });
  it('test_cutaway_range_is_inclusive_and_order_free', () => {
    expect(cutawayInstances([{ x: -9, z: 28 }, { x: -9, z: 38 }, { x: -9, z: 38.01 }, { x: 0, z: 30 }], 38, 28)).toEqual([0, 1]);
  });
  it('test_set_cutaway_restores_exact_matrices', () => {
    const d = district(); const before = matrices(d);
    d.setCutaway(true);
    expect(matrices(d)).not.toEqual(before);
    d.setCutaway(false);
    expect(matrices(d)).toEqual(before);
  });
  it('test_clip_span_keeps_the_outside_part', () => {
    expect(clipSpan(29, 44, 28, 38)).toBeNull();          // tout au nord ou dedans : rien ne reste
    expect(clipSpan(20, 29, 28, 38)).toEqual([20, 28]);   // le moignon au sud reste
    expect(clipSpan(30, 36, 28, 38)).toBeNull();
    expect(clipSpan(0, 10, 28, 38)).toEqual([0, 10]);
    expect(clipSpan(40, 50, 28, 38)).toBeNull();
    expect(clipSpan(20, 50, 28, 38)).toEqual([20, 28]);
  });
  it('test_no_west_facade_spans_both_sides_of_the_range_for_this_seed', () => {
    const s = scene(); const lo = s.layout.places.logement.zEnd!.v, hi = s.layout.places.logement.z.v;
    for (const f of layoutFacades(s, worldSeedOf('w10') + FACADE_SEED_OFFSET)) if (f.side === 'west') expect(f.z0 < lo && f.z1 > hi, `${f.z0}..${f.z1}`).toBe(false);
  });
  it('test_set_cutaway_keeps_only_the_south_stub_of_the_facades_that_touch_the_flat', () => {
    const d = district(); const m = d.root.getObjectByName('facade.body') as InstancedMesh; const a = m.instanceMatrix.array as Float32Array;
    d.setCutaway(true);
    const live = (side: number): number[][] => [...Array(m.count).keys()]
      .filter((i) => Math.sign(a[i * 16 + 12]!) === side && a[i * 16]! !== 0 && a[i * 16 + 14]! + a[i * 16 + 10]! / 2 > 27 && a[i * 16 + 14]! - a[i * 16 + 10]! / 2 < 45)
      .map((i) => [a[i * 16 + 14]! - a[i * 16 + 10]! / 2, a[i * 16 + 14]! + a[i * 16 + 10]! / 2]);
    expect(live(-1)).toEqual([[20, 28]]);   // la façade ouest [29, 44] part, [20, 29] est rognée à 28
    expect(live(1)).toEqual([[26, 28]]);    // la façade est [26, 44] aussi : la caméra haute regarde par-dessus
    expect(hidden(d, 'facade.body')).toBe(1);   // la façade ouest [29, 44] seule disparaît tout entière
  });
  it('test_set_cutaway_hides_the_street_door_and_the_nacelles_in_range', () => {
    const d = district(); const door = d.root.getObjectByName('logement.door')!;
    d.setCutaway(true);
    expect(door.visible).toBe(false);
    for (const [id, n] of d.nacelles) expect(n.visible).toBe(!(Number(id.slice(1)) >= 28 && Number(id.slice(1)) <= 38));
    expect(d.nacelles.get('n36')!.visible).toBe(false);
    expect(d.nacelles.get('n16')!.visible).toBe(true);
    d.setCutaway(false);
    expect(door.visible).toBe(true);
    for (const n of d.nacelles.values()) expect(n.visible).toBe(true);
  });
  it('test_every_visible_interior_lamp_lights_something', () => {
    const d = district(); d.setCutaway(true);
    const bulbs = d.otherEmissives.filter((o) => o.name.startsWith('interior.lamp.'));
    expect(bulbs).toHaveLength(4);
    for (const m of bulbs) expect(lightNear(d, m, 1.0), m.name).not.toBeNull();
  });
  it('test_interior_lights_are_off_when_the_cutaway_is_closed', () => {
    const d = district();
    expect(lights(d).filter((l) => l.name.startsWith('unit.')).every((l) => !l.visible)).toBe(true);
    d.setCutaway(true);
    expect(lights(d).filter((l) => l.name.startsWith('unit.')).every((l) => l.visible && l.intensity === scene().cutaway.lamp.intensityCd.v)).toBe(true);
    d.setCutaway(false);
    expect(lights(d).filter((l) => l.name.startsWith('unit.')).every((l) => !l.visible)).toBe(true);
  });
  it('test_four_units_with_player_desk_in_9d', () => {
    const d = district();
    expect(unitNames(d)).toEqual(['unit.9-A', 'unit.9-B', 'unit.9-C', 'unit.9-D']);
    expect(d.root.getObjectByName('unit.9-D.desk')).toBeDefined();
    for (const u of ['A', 'B', 'C', 'D']) for (const f of ['bed', 'desk', 'table', 'shelf']) expect(d.root.getObjectByName(`unit.9-${u}.${f}`), `${u} ${f}`).toBeDefined();
  });
  it('test_units_tile_the_flat_and_cover_the_guided_anchor_of_9d', () => {
    const d = district(); const s = scene(); const edges = [s.layout.places.logement.z.v, ...s.cutaway.units.map((u) => u.zEnd.v)];
    expect(edges).toEqual([38, 35.5, 33, 30.5, 28]);
    const anchor = s.guided.places['unit.9-D']!.v;
    expect(anchor.z).toBeLessThan(edges[3]!);
    expect(anchor.z).toBeGreaterThan(edges[4]!);
    const desk = worldPos(d.root.getObjectByName('unit.9-D.desk')!);
    expect(desk.z).toBeGreaterThan(edges[4]! - 0.01);
    expect(desk.z).toBeLessThan(edges[3]! + 0.01);
  });
  it('test_every_piece_of_furniture_stays_inside_its_unit', () => {
    const d = district(); const s = scene();
    const edges = [s.layout.places.logement.z.v, ...s.cutaway.units.map((u) => u.zEnd.v)];
    s.cutaway.units.forEach((u, i) => {
      const g = d.root.getObjectByName(`unit.${u.id}`)!;
      g.traverse((o) => {
        if (!(o instanceof Mesh) || o.name.endsWith('.floor')) return;
        const z = worldPos(o).z;
        expect(z, o.name).toBeLessThanOrEqual(edges[i]!); expect(z, o.name).toBeGreaterThanOrEqual(edges[i + 1]!);
      });
    });
  });
  it('test_the_cutaway_stays_inside_the_structural_budget', () => {
    const d = district(); const s = scene();
    d.setCutaway(true);
    const r = describeScene(d);
    expect(r.drawCalls).toBeLessThanOrEqual(s.budget.drawCalls.v); expect(r.triangles).toBeLessThanOrEqual(s.budget.triangles.v);
  });
  it('test_core_tier_cuts_the_facade_like_the_furnished_tier_without_lamps', () => {
    // premier plan du J1 avant la charge différée : la façade est coupée comme au plan du logement [revue finale M-2]
    const core = district('core'); const full = district('deferred'); const before = matrices(core);
    expect(core.root.getObjectByName('interior.logement')).toBeUndefined();
    core.setCutaway(true); full.setCutaway(true);
    expect(hidden(core, 'facade.windows.dark')).toBe(hidden(full, 'facade.windows.dark'));
    expect(matrices(core)['facade.body']).toEqual(matrices(full)['facade.body']);
    expect(lights(core)).toHaveLength(lights(district('core')).length);   // aucune lampe de bureau au palier core
    core.setCutaway(false);
    expect(matrices(core)).toEqual(before);
  });

  it('test_no_visible_window_lies_outside_a_visible_body_span', () => {
    const d = district(); d.setCutaway(true);
    const live = (name: string): number[][] => {
      const m = d.root.getObjectByName(name) as InstancedMesh | undefined; const a = (m?.instanceMatrix.array ?? new Float32Array()) as Float32Array; const out: number[][] = [];
      for (let i = 0; m !== undefined && i < m.count; i++) if (a[i * 16]! !== 0 && a[i * 16 + 10]! !== 0) out.push([Math.sign(a[i * 16 + 12]!), a[i * 16 + 14]! - a[i * 16 + 10]! / 2, a[i * 16 + 14]! + a[i * 16 + 10]! / 2]);
      return out;
    };
    const bodies = live('facade.body'); let windows = 0;
    for (const name of ['facade.windows.dark', 'facade.windows.lit']) for (const [side, a, b] of live(name)) {
      windows++;
      expect(bodies.some(([bs, ba, bb]) => bs === side && a! >= ba! - 1e-6 && b! <= bb! + 1e-6), `${name} ${side} ${a}..${b}`).toBe(true);
    }
    expect(windows).toBeGreaterThan(50);
  });

  describe('vue de la caméra haute', () => {
    type Box = { min: [number, number, number]; max: [number, number, number] };
    const boxOf = (p: Vector3, sc: Vector3): Box => ({ min: [p.x - sc.x / 2, p.y - sc.y / 2, p.z - sc.z / 2], max: [p.x + sc.x / 2, p.y + sc.y / 2, p.z + sc.z / 2] });
    /** Segment contre boîte alignée (méthode des dalles), sur [0, 0,999] : la cible est posée sur une surface. */
    function hits(a: readonly number[], b: readonly number[], box: Box): boolean {
      let t0 = 0, t1 = 0.999;
      for (let i = 0; i < 3; i++) {
        const dlt = b[i]! - a[i]!;
        if (Math.abs(dlt) < 1e-12) { if (a[i]! < box.min[i]! || a[i]! > box.max[i]!) return false; continue; }
        let u = (box.min[i]! - a[i]!) / dlt, v = (box.max[i]! - a[i]!) / dlt;
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u); t1 = Math.min(t1, v);
        if (t0 > t1) return false;
      }
      return true;
    }
    function obstacles(d: DistrictHandle): Box[] {
      d.setCutaway(true);
      const out: Box[] = [];
      d.root.traverse((o) => {
        if (o instanceof InstancedMesh && (o.name === 'facade.body' || o.name.startsWith('facade.windows'))) {
          const a = o.instanceMatrix.array as Float32Array;
          for (let i = 0; i < o.count; i++) if (a[i * 16]! !== 0) out.push(boxOf(new Vector3(a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14]), new Vector3(a[i * 16], a[i * 16 + 5], a[i * 16 + 10])));
        } else if (o instanceof Mesh && /^interior\.logement\.(back|side\.)/.test(o.name)) out.push(boxOf(worldPos(o), o.scale));
      });
      return out;
    }
    const s = scene();
    const focuses = [['home', 'unit.9-D'], ['street', 'unit.9-D'], ['street', 'door.9-B'], ['home', 'door.9-B']] as const;
    it.each(focuses)('test_bulbs_and_desk_tops_are_unobstructed_from_the_%s_shot_at_%s', (kind, place) => {
      const d = district(); const boxes = obstacles(d);
      const f = s.guided.places[place]!.v;
      const cam = shotPose(shotFor(kind, f, s.camera.high), s.camera.sensorHeightMm.v).pos;
      const targets: [string, number[]][] = [];
      d.otherEmissives.filter((o) => o.name.startsWith('interior.lamp.')).forEach((o) => targets.push([o.name, worldPos(o).toArray()]));
      s.cutaway.units.forEach((u) => { const w = worldPos(d.root.getObjectByName(`unit.${u.id}.desk`)!); targets.push([`${u.id} desk top`, [w.x, 1.0, w.z]]); });
      expect(targets).toHaveLength(8);
      for (const [name, t] of targets) expect(boxes.filter((b) => hits(cam, t, b)).map((b) => JSON.stringify(b)), `${name} caché depuis ${kind}@${place} cam ${cam.map((v) => v.toFixed(1))}`).toEqual([]);
    });
    it('test_the_dividing_partitions_are_below_the_desk_top_and_the_back_wall_is_not', () => {
      const d = district(); const flat = d.root.getObjectByName('interior.logement')!;
      const h = (n: string): number => (flat.getObjectByName(n) as Mesh).scale.y;
      expect(h('interior.logement.side.35.5')).toBe(s.cutaway.partitionM.v);
      expect(s.cutaway.partitionM.v).toBeLessThan(1.0);
      expect(h('interior.logement.back')).toBe(2.8);
      expect(h('interior.logement.side.38')).toBe(s.cutaway.partitionM.v);   // les fins aussi : l'étendue entière est vue d'en haut
    });
    it('test_bulbs_are_hidden_while_the_cutaway_is_closed', () => {
      const d = district(); const bulbs = d.otherEmissives.filter((o) => o.name.startsWith('interior.lamp.'));
      expect(bulbs.every((b) => !b.visible)).toBe(true);
      d.setCutaway(true); expect(bulbs.every((b) => b.visible)).toBe(true);
      d.setCutaway(false); expect(bulbs.every((b) => !b.visible)).toBe(true);
    });
  });
});
