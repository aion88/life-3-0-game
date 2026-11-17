import { describe, expect, it } from 'vitest';
import { activityOf, advance } from '../../../src/engine/moments/clock';
import { activityInput, barrierBlockers, checkpointSolids, stepWalk, streetBounds } from '../../../src/engine/view/walk';
import { day, day1State, EAST_WALL, IN_QUEUE_LANE, OUTSIDE, READING, S, SCENE, WALK } from '../../support/street_walk';

describe('marche à pied', () => {
  it('test_walk_speed_and_dt_clamp', () => {
    const a = stepWalk({ x: 0, z: 0 }, { keys: new Set(['KeyW']), dtMs: 1000 }, WALK, []); expect(a.pos.z).toBeCloseTo(-0.08, 9);   // dt borné à 50 ms : 1,6 x 0,05
  });
  it('test_diagonal_is_not_faster', () => {
    const a = stepWalk({ x: 0, z: 0 }, { keys: new Set(['KeyW', 'KeyD']), dtMs: 50 }, WALK, []); expect(Math.hypot(a.pos.x, a.pos.z)).toBeCloseTo(0.08, 9);
  });
  it.each([['KeyW'], ['ArrowUp']])('test_key_%s_uses_event_code', k => { expect(stepWalk({ x: 0, z: 0 }, { keys: new Set([k]), dtMs: 50 }, WALK, []).moving).toBe(true); });
  it('test_azerty_physical_position', () => { expect(stepWalk({ x: 0, z: 0 }, { keys: new Set(['KeyZ']), dtMs: 50 }, WALK, []).moving).toBe(false); });   // Z n'est pas la touche physique de WASD : le code décide
  it('test_walls_block_and_slide', () => { const r = stepWalk({ x: 6.95, z: 0 }, { keys: new Set(['KeyD', 'KeyW']), dtMs: 50 }, WALK, [EAST_WALL]); expect(r.pos.x).toBeLessThanOrEqual(7); expect(r.pos.z).toBeLessThan(0); });
  it('test_barrier_blocks_until_a_lane_act_is_in_the_days_acts', () => {
    const closed = stepWalk({ x: 0, z: -11.95 }, { keys: new Set(['KeyW']), dtMs: 50 }, WALK, barrierBlockers(null, SCENE)); expect(closed.pos.z).toBeGreaterThanOrEqual(-12);
    const open = stepWalk({ x: 0, z: -11.95 }, { keys: new Set(['KeyW']), dtMs: 50 }, WALK, barrierBlockers(READING, SCENE)); expect(open.pos.z).toBeLessThan(-12);
  });
  it('test_walking_against_either_end_of_the_street_never_passes_zmax_or_zmin', () => {
    const { zMin, zMax } = SCENE.layout;
    const bounds = [...streetBounds(SCENE), ...barrierBlockers(READING, SCENE)];
    for (const [key, edge, from] of [['KeyS', zMax.v, zMax.v - 1], ['KeyW', zMin.v, zMin.v + 1]] as const) {
      let pos = { x: 0, z: from };
      for (let i = 0; i < 400; i++) pos = stepWalk(pos, { keys: new Set([key, 'KeyD']), dtMs: 50 }, WALK, bounds).pos;   // 20 s contre le bout, en diagonale
      expect(pos.z).toBeLessThanOrEqual(zMax.v); expect(pos.z).toBeGreaterThanOrEqual(zMin.v);
      expect(Math.abs(pos.z - edge)).toBeLessThan(0.1);                      // il est bien arrivé au bout, pas arrêté en route
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(SCENE.layout.halfWidthM.v);
    }
  });
  it('test_the_player_cannot_walk_through_the_tv_wall_or_the_booth_and_stops_in_front_of_them', () => {
    const c = SCENE.checkpoint, z = SCENE.interactions['wall']!.at.v.z, frontZ = z + c.booth.depthM.v / 2;
    const left = c.boothX.v - c.booth.widthM.v / 2 - c.wall.widthM, right = c.boothX.v + c.booth.widthM.v / 2;
    const blockers = [...streetBounds(SCENE), ...barrierBlockers(READING, SCENE), ...checkpointSolids(SCENE)];   // barrière ouverte : seul le décor plein arrête
    for (const x of [left + 0.1, 0, c.boothX.v, right - 0.1]) {
      let p = { x, z: -4 };
      for (let i = 0; i < 600; i++) p = stepWalk(p, { keys: new Set(['KeyW']), dtMs: 50 }, WALK, blockers).pos;
      expect(p.z, `x = ${x} : il reste devant la face avant (z = ${frontZ})`).toBeGreaterThanOrEqual(frontZ + WALK.bodyRadiusM.v - 1e-9);
    }
  });
  it('test_the_open_street_west_of_the_wall_is_still_a_way_through_to_the_registre', () => {
    const c = SCENE.checkpoint, left = c.boothX.v - c.booth.widthM.v / 2 - c.wall.widthM;
    const blockers = [...streetBounds(SCENE), ...barrierBlockers(READING, SCENE), ...checkpointSolids(SCENE)];
    let p = { x: left - WALK.bodyRadiusM.v - 0.2, z: -4 };
    for (let i = 0; i < 600; i++) p = stepWalk(p, { keys: new Set(['KeyW']), dtMs: 50 }, WALK, blockers).pos;
    expect(p.z).toBeLessThan(-20);
  });
  it.each([[true, false, false], [false, true, false], [false, false, true]])('test_activity_input_moving_%s_queue_%s_dialogue_%s', (m, q, dlg) => { const pos = q ? IN_QUEUE_LANE : OUTSIDE; const i = activityInput(m, pos, SCENE, dlg); expect(i).toEqual({ moving: m, inQueue: q, inDialogue: dlg }); });
  it('test_engine_activity_order_is_queue_walk_scene_wait', () => { const st = day1State(); expect(activityOf(st, { moving: true, inQueue: true, inDialogue: true })).toBe('queue'); expect(activityOf(st, { moving: true, inQueue: false, inDialogue: true })).toBe('walk'); expect(activityOf(st, { moving: false, inQueue: false, inDialogue: true })).toBe('scene'); expect(activityOf(st, { moving: false, inQueue: false, inDialogue: false })).toBe('wait'); });   // acquis du moteur [plan 02b rév. 4]
  it('test_walking_does_not_advance_the_clock_but_waiting_does', () => { const st = day1State(); const walk = activityOf(st, activityInput(true, OUTSIDE, SCENE, false)), wait = activityOf(st, activityInput(false, OUTSIDE, SCENE, false)); expect(advance(day(), 10_000, walk, S).clock.minute).toBe(day().clock.minute); expect(advance(day(), 10_000, wait, S).clock.minute).toBeGreaterThan(day().clock.minute); });   // 02b T2
});
