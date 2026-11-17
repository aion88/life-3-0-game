import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { crowdAt, easeToward, facingYaw, npcsPresent, queueSlots } from '../../../src/engine/view/crowd';
import { inQueueLane } from '../../../src/engine/view/walk';
import { presentAt } from '../../../src/engine/moments/npcs';
import { createCrowdView } from '../../../src/street/render/characters/crowdView';
import { createMannequinProvider } from '../../../src/street/render/characters/mannequin';
import { S, SCENE } from '../../support/street_crowd';

const scene = () => SCENE;

describe('foule et file', () => {
  it('test_crowd_is_a_pure_function_of_time', () => { expect(crowdAt(scene(), 5000, 9)).toEqual(crowdAt(scene(), 5000, 9)); expect(crowdAt(scene(), 5000, 9)).not.toEqual(crowdAt(scene(), 9000, 9)); });
  it('test_crowd_depends_on_the_seed', () => { expect(crowdAt(scene(), 5000, 9)).not.toEqual(crowdAt(scene(), 5000, 10)); });
  it('test_crowd_size_is_inside_the_art_bible_range', () => { for (const t of [0, 7_000, 90_000]) { const n = crowdAt(scene(), t, 9).length; expect(n).toBeGreaterThanOrEqual(12); expect(n).toBeLessThanOrEqual(16); } });
  it('test_passersby_stay_inside_the_street_and_out_of_the_queue_lane', () => {
    for (const t of [0, 12_345, 60_000, 400_000]) for (const p of crowdAt(scene(), t, 9)) {
      expect(Math.abs(p.pos.x)).toBeLessThanOrEqual(scene().layout.halfWidthM.v);
      expect(p.pos.z).toBeGreaterThanOrEqual(scene().layout.zMin.v); expect(p.pos.z).toBeLessThanOrEqual(scene().layout.zMax.v);
      expect(inQueueLane(p.pos, scene())).toBe(false);
    }
  });
  it('test_passersby_never_cross_the_checkpoint_wall', () => {
    const wallZ = scene().interactions['wall']!.at.v.z;
    for (let t = 0; t < 600_000; t += 7_000) for (const p of crowdAt(scene(), t, 3)) expect(p.pos.z).toBeGreaterThan(wallZ);
  });
  it('test_passersby_keep_clear_of_the_npc_waiting_places', () => {
    for (const t of [0, 30_000, 150_000]) for (const p of crowdAt(scene(), t, 9)) for (const n of Object.values(scene().npcPlaces)) expect(Math.abs(p.pos.x - n.at.v.x)).toBeGreaterThanOrEqual(1);
  });
  it('test_passersby_move_continuously_without_jumps', () => {
    const a = crowdAt(scene(), 0, 9), b = crowdAt(scene(), 50, 9);   // 50 ms : au plus la vitesse de marche x 0,05 s
    a.forEach((p, i) => expect(Math.abs(p.pos.z - b[i]!.pos.z)).toBeLessThanOrEqual(scene().walk.speedMps.v * 0.05 + 1e-9));
  });
  it('test_passersby_turn_around_at_the_ends_not_teleport', () => {
    const ts = Array.from({ length: 400 }, (_, i) => i * 1000);
    for (let i = 0; i < 14; i++) { const zs = ts.map((t) => crowdAt(scene(), t, 9)[i]!.pos.z); for (let k = 1; k < zs.length; k++) expect(Math.abs(zs[k]! - zs[k - 1]!)).toBeLessThanOrEqual(scene().walk.speedMps.v + 1e-9); }
  });
  it('test_crowd_uses_only_the_declared_body_variants', () => { const ids = new Set(crowdAt(scene(), 4000, 9).map(p => p.bodyId)); expect(ids.size).toBeGreaterThan(0); for (const id of ids) expect(scene().characters.crowdBodies.v).toContain(id); });
  it('test_crowd_ids_are_stable_over_time', () => { expect(crowdAt(scene(), 0, 9).map(p => p.id)).toEqual(crowdAt(scene(), 50_000, 9).map(p => p.id)); });
  it('test_queue_slots_are_08_m_apart', () => { const s = queueSlots(scene(), 500); expect(s.length).toBe(scene().crowd.queue.v); for (let i = 1; i < s.length; i++) expect(Math.abs(s[i]!.z - s[i - 1]!.z)).toBeCloseTo(0.8, 9); });
  it('test_queue_offset_follows_permille', () => { const a = queueSlots(scene(), 0), b = queueSlots(scene(), 1000); expect(Math.abs(b[0]!.z - a[0]!.z)).toBeCloseTo((a.length - 1) * 0.8, 9); });   // 1000 permille = toute la longueur de la file
  it('test_queue_head_is_in_front_of_the_tv_wall_when_fully_advanced', () => { expect(queueSlots(scene(), 1000)[0]!.z).toBeCloseTo(scene().crowd.queueHeadZ.v, 9); });
  it('test_no_queue_slot_is_inside_the_tv_wall_or_the_booth', () => { const c = scene().checkpoint, frontZ = scene().interactions['wall']!.at.v.z + c.booth.depthM.v / 2; for (const p of [0, 500, 1000]) for (const s of queueSlots(scene(), p)) expect(s.z).toBeGreaterThan(frontZ); });
  it('test_queue_slots_clamp_permille', () => { expect(queueSlots(scene(), 5000)).toEqual(queueSlots(scene(), 1000)); expect(queueSlots(scene(), -5)).toEqual(queueSlots(scene(), 0)); });
  it('test_queue_is_inside_the_lane_once_fully_advanced', () => { for (const p of queueSlots(scene(), 1000)) expect(inQueueLane(p, scene())).toBe(true); });
  it('test_present_npcs_follow_present_at', () => { expect(npcsPresent(S, scene(), 1, 430, 'courtesy').map(n => n.id).sort()).toEqual(S.npcs.filter(n => scene().npcPlaces[n.id]!.kind === 'person' && presentAt(n.id, 1, 430, 'courtesy', S)).map(n => n.id).sort()); });
  it('test_present_npcs_at_day_1_430_courtesy_is_pinned', () => { expect(npcsPresent(S, scene(), 1, 430, 'courtesy')).toEqual([{ id: 'nadia', bodyId: 'npc.nadia', pos: { x: -6, z: -2 } }]); });
  it('test_present_npcs_never_include_the_vehicle', () => {
    let seen = 0;
    for (const day of [1, 2, 3, 4, 5, 6, 7] as const) for (let m = 0; m < 1440; m += 10) for (const palier of ['courtesy', 'thanks', 'patience', 'appointment'] as const) {
      if (presentAt('greyCar', day, m, palier, S)) seen++;
      expect(npcsPresent(S, scene(), day, m, palier).map(n => n.id)).not.toContain('greyCar');
    }
    expect(seen).toBeGreaterThan(0);   // le test n'est pas vide : la voiture est bien présente à certains instants
  });
  it('test_displayed_queue_converges_to_engine_position', () => { let shown = 6.0; for (let i = 0; i < 80; i++) shown = easeToward(shown, 3, 50, 4); expect(shown).toBeCloseTo(3, 2); });   // 1 - exp(-4 x 0,05) = 0,181 par pas : (0,819)^80 x 3 = 3e-7
  it.each([[0, 0.05], [50, 4], [16, 4], [1000, 4], [5000, 4], [50, 0.3]])('test_ease_matches_the_exponential_dt_%s_rate_%s', (dt, rate) => { expect(easeToward(0, 1, dt, rate)).toBeCloseTo(1 - Math.exp((-rate * dt) / 1000), 12); });
  it('test_ease_never_overshoots_and_is_frame_rate_independent', () => {
    const one = easeToward(0, 1, 100, 4), two = easeToward(easeToward(0, 1, 50, 4), 1, 50, 4);
    expect(one).toBeCloseTo(two, 12); expect(one).toBeLessThan(1); expect(easeToward(5, 3, 10_000_000, 4)).toBeGreaterThanOrEqual(3);
  });
  it('test_facing_yaw_points_the_gltf_front_along_the_heading', () => {
    const o = new Object3D();
    for (const h of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {   // cap 0 = face à -z, croît vers l'est (+x)
      o.rotation.y = facingYaw(h); o.updateMatrixWorld(true);
      const f = { x: o.matrixWorld.elements[8]!, z: o.matrixWorld.elements[10]! };   // image de +Z local
      expect(f.x).toBeCloseTo(Math.round(Math.sin(h)), 9); expect(f.z).toBeCloseTo(Math.round(-Math.cos(h)), 9);
    }
  });
});

describe('vue de la foule', () => {
  it('test_engine_position_is_never_written_by_the_view', () => {
    const view = createCrowdView(createMannequinProvider(), new Object3D());
    expect(Object.keys(view)).not.toContain('setPositionInQueue'); expect(Object.keys(view).sort()).toEqual(['dispose', 'objectOf', 'update']);
  });
  it('test_view_places_people_acquires_arrivals_and_releases_departures', () => {
    const provider = createMannequinProvider(), root = new Object3D(), view = createCrowdView(provider, root);
    const people = crowdAt(scene(), 1000, 9);
    view.update(people, 16);
    expect(root.children.length).toBe(people.length); expect(provider.handles.length).toBe(people.length);
    people.forEach((p, i) => { const o = provider.handles[i]!.object; expect([o.position.x, o.position.y, o.position.z]).toEqual([p.pos.x, 0, p.pos.z]); expect(o.rotation.y).toBeCloseTo(facingYaw(p.heading), 12); });
    view.update(people.slice(0, 3), 16);
    expect(root.children.length).toBe(3); expect(provider.handles.filter(h => h.released).length).toBe(people.length - 3);
    view.update(people.slice(0, 3), 16);
    expect(provider.handles.length).toBe(people.length);   // aucune ré-acquisition pour qui est déjà là
    view.dispose(); expect(root.children.length).toBe(0);
  });
  it('test_object_of_returns_the_displayed_person_object_or_null', () => {
    const provider = createMannequinProvider(), view = createCrowdView(provider, new Object3D());
    const people = crowdAt(scene(), 1000, 9);
    view.update(people, 16);
    expect(view.objectOf(people[0]!.id)).toBe(provider.handles[0]!.object);   // UI-C T8 : la rue en projette le rectangle écran
    expect(view.objectOf('absent')).toBeNull();
    view.update([], 16);
    expect(view.objectOf(people[0]!.id)).toBeNull();
  });
  it('test_view_plays_walk_by_default_and_the_requested_clip_for_the_queue_and_ticks_time', () => {
    const provider = createMannequinProvider(), view = createCrowdView(provider, new Object3D());
    const [a] = crowdAt(scene(), 0, 9); const q = queueSlots(scene(), 500)[0]!;
    view.update([a!, { id: 'queue.0', bodyId: 'crowd_a', pos: q, heading: 0, clip: 'queue', kind: 'queue' }], 20);
    view.update([a!, { id: 'queue.0', bodyId: 'crowd_a', pos: q, heading: 0, clip: 'queue', kind: 'queue' }], 30);
    expect(provider.handles.map(h => [h.clip, h.spec.kind, h.ticked])).toEqual([['walk', 'passerby', 50], ['queue', 'queue', 50]]);
  });
});
