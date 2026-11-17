import { describe, expect, it } from 'vitest';
import { queueBlockers, queueSlots, stepQueue, type QueueState } from '../../../src/engine/view/crowd';
import { easeToward } from '../../../src/engine/view/crowd';
import { barrierBlockers, stepWalk, streetBounds } from '../../../src/engine/view/walk';
import type { Vec2 } from '../../../src/engine/moments/types';
import { READING, SCENE, WALK } from '../../support/street_walk';

/**
 * Place réservée du joueur dans la file [plan 02a T13-fix]. Cause du défaut d'origine : la file était posée sans le joueur ; il entrait sur un
 * emplacement occupé et un voisin le traversait. Distance minimale : la donnée `crowd.queueMinGapM`. Les tests rejouent la boucle de `runtime.ts`
 * (pas de 50 ms, avance de la file lissée, obstacles de la rue, `stepQueue`, `queueBlockers`) et contrôlent CHAQUE image.
 */
const GAP = SCENE.crowd.queueMinGapM.v, STEP = SCENE.crowd.queueSpacingM.v, N = SCENE.crowd.queue.v;
const wallZ = SCENE.interactions['wall']!.at.v.z, QX = SCENE.crowd.queueXM.v, HEAD = SCENE.crowd.queueHeadZ.v;
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
const DT = 50;

/** Contrôle d'une image : file droite, ordre et pas conservés, tous les corps à `GAP` au moins du joueur et les uns des autres. */
function worstOf(zs: readonly number[], player: Vec2): number {
  let worst = Infinity;
  expect(zs.length).toBe(N);
  for (let i = 0; i < zs.length; i++) {
    worst = Math.min(worst, dist({ x: QX, z: zs[i]! }, player));
    if (i > 0) { worst = Math.min(worst, zs[i]! - zs[i - 1]!); expect(zs[i]! - zs[i - 1]!, `ordre : rang ${i} derrière rang ${i - 1}`).toBeGreaterThanOrEqual(STEP - 1e-9); }
  }
  return worst;
}

interface Run { worst: number; frames: number; jump: number; end: { zs: QueueState; player: Vec2 } }
function run(script: ReadonlyArray<readonly [readonly string[], number]>, start: Vec2, open: boolean): Run {
  let player = start, shown = 0, zs: QueueState | null = null, worst = Infinity, frames = 0, jump = 0, prev: QueueState | null = null, prevBase: readonly Vec2[] | null = null;
  for (const [keys, n] of script) {
    for (let f = 0; f < n; f++) {
      shown = easeToward(shown, open ? 1000 : 0, DT, SCENE.view.easeRatePerS.v);
      const blockers = [...barrierBlockers(open ? READING : null, SCENE), ...streetBounds(SCENE), ...(zs === null ? [] : queueBlockers(SCENE, zs.zs, player))];
      player = stepWalk(player, { keys: new Set(keys), dtMs: DT }, WALK, blockers).pos;
      zs = stepQueue(SCENE, zs, shown, player, DT);
      worst = Math.min(worst, worstOf(zs.zs, player)); frames++;
      const base = queueSlots(SCENE, shown);
      if (prev !== null && prevBase !== null) for (let i = 0; i < N; i++) jump = Math.max(jump, Math.abs(zs.zs[i]! - prev.zs[i]!) - Math.abs(base[i]!.z - prevBase[i]!.z));   // mouvement propre de la file (son avance) retranché
      prev = zs; prevBase = base;
    }
  }
  return { worst, frames, jump, end: { zs: zs!, player } };
}

describe('file : place réservée du joueur', () => {
  const SCRIPTS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [readonly string[], number]>, Vec2]> = [
    ['entre_par_le_milieu_avance_recule', [[['KeyW'], 120], [['KeyS'], 60], [['KeyW'], 200], [['KeyS'], 200]], { x: QX, z: 1 }],
    ['entre_de_cote_puis_au_milieu', [[['KeyW', 'KeyD'], 40], [['KeyW'], 80], [['KeyA'], 20], [['KeyW'], 160], [['KeyS'], 120], [['KeyD'], 30], [['KeyW'], 120]], { x: QX + 0.8, z: 4 }],
    ['zigzag_dans_la_file', [[['KeyW', 'KeyA'], 20], [['KeyW', 'KeyD'], 20], [['KeyS', 'KeyA'], 20], [['KeyS', 'KeyD'], 20], [['KeyW'], 100], [['KeyD'], 40], [['KeyW'], 100]], { x: QX + 0.3, z: 3 }],
    ['traine_la_file_vers_la_rue_puis_sort_de_cote', [[['KeyS'], 300], [['KeyD'], 30], [['KeyS'], 40], [['KeyA'], 30], [['KeyW'], 200]], { x: QX, z: 0 }],
    ['longe_la_file_sans_y_entrer', [[['KeyD'], 20], [['KeyW'], 250], [['KeyS'], 250]], { x: QX, z: 8 }],
    ['trajet_droit_sur_laxe_de_la_rue_jusquau_mur', [[['KeyW'], 700], [['KeyS'], 100]], { x: 0, z: 30 }],
  ];
  for (const [name, script, start] of SCRIPTS) {
    for (const open of [false, true]) {
      it(`test_every_frame_keeps_min_gap_and_order_and_never_jumps_${name}_barrier_${open ? 'open' : 'closed'}`, () => {
        const r = run(script, start, open);
        expect(r.frames).toBeGreaterThan(300);
        expect(r.worst).toBeGreaterThanOrEqual(GAP - 1e-9);
        expect(r.jump, "un voisin ne bouge pas de plus de 0,35 m par image au-delà de l'avance de la file (le cercle de 0,6 m croît de 0,31 m au plus par pas du joueur au bord de l'emprise)").toBeLessThan(0.35);
      });
    }
  }
  it('test_straight_walk_along_the_street_axis_to_the_wall_never_disturbs_the_queue', () => {
    const r = run([[['KeyW'], 700]], { x: 0, z: 30 }, true);
    expect(r.end.player.z, 'il atteint le mur').toBeLessThan(wallZ + 0.5);
    expect(Math.max(...r.end.zs.offs.map(Math.abs)), 'aucun voisin déplacé').toBe(0);
    expect(r.worst).toBeGreaterThanOrEqual(GAP);
  });
  it('test_far_player_leaves_the_queue_intact_after_the_neighbours_settle', () => {
    let zs: QueueState | null = null;
    for (let f = 0; f < 400; f++) zs = stepQueue(SCENE, zs, 500, { x: QX + 3, z: 0 }, DT);
    expect(zs!.zs.map((z) => ({ x: QX, z }))).toEqual(queueSlots(SCENE, 500));
  });
  it('test_player_inside_the_file_gets_a_reserved_place_neighbours_behind_step_back', () => {
    const base = queueSlots(SCENE, 0).map((s) => s.z);
    const player = { x: QX, z: base[4]! + 0.4 };
    let zs: QueueState | null = null;
    for (let f = 0; f < 100; f++) zs = stepQueue(SCENE, zs, 0, player, DT);
    expect(worstOf(zs!.zs, player)).toBeGreaterThanOrEqual(GAP - 1e-9);
    for (let i = 0; i < 5; i++) expect(zs!.zs[i]).toBeLessThanOrEqual(player.z - GAP + 1e-9);      // devant lui, côté mur
    for (let i = 5; i < N; i++) expect(zs!.zs[i]).toBeGreaterThanOrEqual(player.z + GAP - 1e-9);   // derrière lui : ceux qui le gênaient ont reculé
  });
  it('test_queue_blocker_stops_the_player_inside_the_file_from_passing_neighbours_but_not_from_walking_round', () => {
    const zs = Array.from({ length: N }, (_, i) => HEAD + STEP * i);   // file serrée contre le mur
    const player0 = { x: QX, z: HEAD + STEP * 2 + 1.5 };                      // trois voisins devant, hors de la boîte
    const blockers = [...streetBounds(SCENE), ...queueBlockers(SCENE, zs, player0)];
    let p = player0;
    for (let i = 0; i < 400; i++) p = stepWalk(p, { keys: new Set(['KeyW']), dtMs: DT }, WALK, blockers).pos;
    expect(p.z).toBeGreaterThanOrEqual(HEAD + STEP * 2 + GAP - 1e-9);
    p = { x: QX + 0.8, z: player0.z };
    for (let i = 0; i < 400; i++) p = stepWalk(p, { keys: new Set(['KeyW']), dtMs: DT }, WALK, blockers).pos;
    expect(p.z, 'à côté de la file il passe').toBeLessThan(HEAD + STEP * 2);
  });
});
