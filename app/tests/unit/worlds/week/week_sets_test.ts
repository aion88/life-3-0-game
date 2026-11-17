// @vitest-environment happy-dom
import { Box3, Ray, Vector3, type Mesh, type Object3D, type PointLight } from 'three';
import { describe, expect, it } from 'vitest';
import type { WeekPlace, WeekSet } from '../../../../src/worlds/week/weekContracts';
import { buildWeekSet } from '../../../../src/worlds/week/weekSets';

const PLACES: readonly WeekPlace[] = ['chez-toi', 'palier', 'rue', 'controle', 'escalier', 'audition', 'parents'];
/** Personnes a placer par lieu (plan §8 : Roux, Theodore + Nadia, Marlene, Bruno, l'agente, Maman + Papa). */
const MIN_NPC_MARKS: Record<WeekPlace, number> = {
  'chez-toi': 1, palier: 1, rue: 2, controle: 0, escalier: 1, audition: 1, parents: 2,
};
/** Reperes d'objets exiges par lieu (regles d'emission §7). */
const REQUIRED_PROPS: Partial<Record<WeekPlace, readonly string[]>> = {
  rue: ['lettre'], escalier: ['dossier', 'stylo'], audition: ['dossier', 'carnet'],
};
const READER_AT = new Vector3(-1.52, 0, 0.4);
const BARRIER_AT = new Vector3(1.8, 0, 0);
/** Hauteur de poitrine (m) de la ligne de vue testee entre le joueur et chaque PNJ. */
const CHEST_Y = 1.3;
/** Un meuble plus bas que ceci ne coupe pas la ligne de vue a hauteur de poitrine. */
const CHAIR_BACK_MAX = 1.0;

const countMeshes = (root: Object3D): number => {
  let n = 0;
  root.traverse((o) => {
    if ((o as Mesh).isMesh) n++;
  });
  return n;
};
const build = (place: WeekPlace): WeekSet => buildWeekSet(place, document);

describe('week sets', () => {
  it.each(PLACES)('test_week_sets_build_%s_has_complete_marks', (place) => {
    const set = build(place);
    try {
      expect(set.marks.npcs.length).toBeGreaterThanOrEqual(MIN_NPC_MARKS[place]);
      expect(Number.isFinite(set.marks.playerYaw)).toBe(true);
      for (const v of [set.marks.entry, set.marks.player, set.marks.camera.offset, set.marks.camera.look]) {
        expect([v.x, v.y, v.z].every(Number.isFinite)).toBe(true);
      }
      for (const npc of set.marks.npcs) expect(Number.isFinite(npc.yaw)).toBe(true);
      for (const id of REQUIRED_PROPS[place] ?? []) expect(set.marks.props).toHaveProperty(id);
      expect(countMeshes(set.root)).toBeGreaterThan(0);
    } finally {
      set.dispose();
    }
  });

  it.each(PLACES)('test_week_sets_dispose_%s_empties_root', (place) => {
    const set = build(place);
    set.dispose();
    expect(set.root.children).toHaveLength(0);
    expect(() => set.dispose()).not.toThrow();
  });

  it('test_week_sets_build_twice_returns_independent_marks', () => {
    const a = build('rue'), b = build('rue');
    a.marks.player.x += 5;
    expect(b.marks.player.x).not.toBe(a.marks.player.x);
    a.dispose();
    b.dispose();
  });

  it('test_week_sets_meshes_per_set_stay_within_control_benchmark', () => {
    const control = build('controle');
    const benchmark = countMeshes(control.root);
    control.dispose();
    expect(benchmark).toBeGreaterThan(100);
    for (const place of PLACES) {
      const set = build(place);
      expect(countMeshes(set.root), place).toBeLessThanOrEqual(benchmark);
      set.dispose();
    }
  });

  it('test_week_sets_control_reader_and_barrier_sit_at_original_coordinates', () => {
    const set = build('controle');
    const reader = set.root.getObjectByName('station.reader');
    const gate = set.root.getObjectByName('station.barrier');
    expect(reader?.position.distanceTo(READER_AT)).toBeLessThan(1e-9);
    expect(gate?.position.distanceTo(BARRIER_AT)).toBeLessThan(1e-9);
    set.dispose();
  });

  it('test_week_sets_control_barrier_opens_with_t_and_reader_tolerates_no_canvas', () => {
    const set = build('controle');
    const arm = set.root.getObjectByName('station.barrier.arm');
    expect(arm?.rotation.z).toBeCloseTo(0, 9);
    set.setBarrier?.(1);
    expect(arm?.rotation.z).toBeCloseTo(-Math.PI * 0.48, 9);
    set.setBarrier?.(5);
    expect(arm?.rotation.z).toBeCloseTo(-Math.PI * 0.48, 9);
    expect(() => set.setReader?.('−14 MOTS', true)).not.toThrow();
    set.dispose();
  });

  it('test_week_sets_only_control_has_reader_and_barrier', () => {
    for (const place of PLACES.filter((p) => p !== 'controle')) {
      const set = build(place);
      expect(set.setReader, place).toBeUndefined();
      expect(set.setBarrier, place).toBeUndefined();
      set.dispose();
    }
  });

  it('test_week_sets_no_global_light_only_point_lamps', () => {
    for (const place of PLACES) {
      const set = build(place);
      set.root.traverse((o) => {
        if ((o as { isLight?: boolean }).isLight) expect((o as PointLight).isPointLight, place).toBe(true);
      });
      set.dispose();
    }
  });

  it('test_week_sets_dispose_removes_point_lamps', () => {
    const set = build('parents');
    let lamps = 0;
    set.root.traverse((o) => {
      if ((o as PointLight).isPointLight) lamps++;
    });
    expect(lamps).toBeGreaterThan(0);
    set.dispose();
    let after = 0;
    set.root.traverse((o) => {
      if ((o as PointLight).isPointLight) after++;
    });
    expect(after).toBe(0);
  });

  it('test_week_sets_parents_has_door_at_entry_and_parents_facing_it', () => {
    const set = build('parents');
    const { entry, npcs } = set.marks;
    expect(npcs).toHaveLength(2);
    for (const npc of npcs) {
      const toEntry = Math.atan2(entry.x - npc.at.x, entry.z - npc.at.z);
      expect(npc.yaw).toBeCloseTo(toEntry, 9);
    }
    set.dispose();
  });

  it('test_week_sets_stairs_npc_stands_two_steps_above_player', () => {
    const set = build('escalier');
    expect(set.marks.npcs[0]?.at.y).toBeCloseTo(0.34, 9);
    expect(set.marks.player.y).toBe(0);
    set.dispose();
  });

  it.each(PLACES.filter((p) => MIN_NPC_MARKS[p] > 0))('test_week_sets_%s_no_wall_between_player_and_npcs', (place) => {
    const set = build(place);
    set.root.updateMatrixWorld(true);
    const blockers: Box3[] = [];
    set.root.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      const box = new Box3().setFromObject(o);
      if (box.max.y > CHAIR_BACK_MAX + 0.01 && box.max.y - box.min.y > 0.05) blockers.push(box);
    });
    for (const npc of set.marks.npcs) {
      const from = set.marks.player.clone().setY(set.marks.player.y + CHEST_Y);
      const to = npc.at.clone().setY(npc.at.y + CHEST_Y);
      const length = from.distanceTo(to);
      const ray = new Ray(from, to.clone().sub(from).normalize());
      const hit = new Vector3();
      for (const box of blockers) {
        const point = ray.intersectBox(box, hit);
        const at = point ? point.distanceTo(from) : Infinity;
        expect(at > length || at < 0, `${place}: un volume coupe la vue`).toBe(true);
      }
    }
    set.dispose();
  });
});
