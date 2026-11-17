import { describe, expect, it } from 'vitest';
import { crowdAt, queueSlots } from '../../../src/engine/view/crowd';
import { lampPositions } from '../../../src/engine/view/layout';
import { solidBlockers, stepWalk, streetBounds, type Blocker } from '../../../src/engine/view/walk';
import { SCENE, WALK } from '../../support/street_walk';

/**
 * Décors pleins de la rue [plan 02a T13-fix] : le joueur ne traverse ni le mur de télés et la guérite, ni les décors de `solids`, ni les mâts de
 * lampadaire ; les trajets (registre, portail, file, passants) restent libres. Le joueur est un point : les boîtes sont élargies de `walk.bodyRadiusM`.
 */
const R = WALK.bodyRadiusM.v, HW = SCENE.layout.halfWidthM.v;
interface Item { readonly name: string; readonly x: number; readonly z: number; readonly hw: number; readonly hd: number }
const wallZ = SCENE.interactions['wall']!.at.v.z, ck = SCENE.checkpoint;
const ITEMS: readonly Item[] = [
  { name: 'murDeTeles', x: ck.boothX.v - ck.booth.widthM.v / 2 - ck.wall.widthM / 2, z: wallZ, hw: ck.wall.widthM / 2, hd: ck.booth.depthM.v / 2 },
  { name: 'guerite', x: ck.boothX.v, z: wallZ, hw: ck.booth.widthM.v / 2, hd: ck.booth.depthM.v / 2 },
  ...Object.entries(SCENE.solids).map(([name, { v }]) => {
    const c = v.at !== undefined ? SCENE.interactions[v.at]!.at.v : { x: v.x!, z: v.z! };
    return { name, x: c.x, z: c.z, hw: v.w / 2, hd: v.d / 2 };
  }),
  ...lampPositions(SCENE).map((l, i) => ({ name: `mat.${l.side}.${i}`, x: (l.side === 'east' ? 1 : -1) * (HW - 0.4), z: l.z, hw: SCENE.build.mastRadiusM.v, hd: SCENE.build.mastRadiusM.v })),
];
const BLOCKERS: readonly Blocker[] = [...streetBounds(SCENE), ...solidBlockers(SCENE)];
const insideRaw = (p: { x: number; z: number }, it: Item): boolean => Math.abs(p.x - it.x) < it.hw && Math.abs(p.z - it.z) < it.hd;
const insideAnyBlocker = (p: { x: number; z: number }): boolean => solidBlockers(SCENE).some((b) => b.kind === 'box' && p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z);
const distToRaw = (p: { x: number; z: number }, it: Item): number => Math.hypot(Math.max(Math.abs(p.x - it.x) - it.hw, 0), Math.max(Math.abs(p.z - it.z) - it.hd, 0));

describe('décors pleins', () => {
  it('test_the_table_covers_every_solid_of_the_data_the_wall_the_booth_and_every_lamp_mast', () => {
    expect(ITEMS.length).toBe(2 + Object.keys(SCENE.solids).length + lampPositions(SCENE).length);
    expect(Object.keys(SCENE.solids)).toEqual(expect.arrayContaining(['banc', 'etal', 'voitureGrise', 'cabineScan', 'pylone', 'registreEtagere', 'registreFacade', 'poteauBarriere', 'portailCoffre']));
  });
  it.each(ITEMS.map((i) => [i.name, i] as const))('test_the_player_cannot_walk_into_%s_from_any_side', (_name, it) => {
    let tried = 0;
    for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      let p = { x: it.x + sx * (it.hw + 1.5), z: it.z + sz * (it.hd + 1.5) };
      if (Math.abs(p.x) >= HW || p.z > SCENE.layout.zMax.v || p.z < SCENE.layout.zMin.v || insideAnyBlocker(p)) continue;   // départ hors de la rue ou déjà dans un autre décor
      tried++;
      const keys = new Set([sx > 0 ? 'KeyA' : sx < 0 ? 'KeyD' : '', sz > 0 ? 'KeyW' : sz < 0 ? 'KeyS' : ''].filter((k) => k !== ''));   // vers le centre
      for (let i = 0; i < 400; i++) p = stepWalk(p, { keys, dtMs: 50 }, WALK, BLOCKERS).pos;
      expect(insideRaw(p, it), `${it.name} : le joueur est dans le décor en (${p.x.toFixed(2)} ; ${p.z.toFixed(2)})`).toBe(false);
      expect(distToRaw(p, it), `${it.name} : il garde le rayon de son corps`).toBeGreaterThanOrEqual(R - 1e-6);
    }
    expect(tried, 'au moins un côté d\'approche est dans la rue').toBeGreaterThan(0);
  });
  it('test_every_interaction_point_has_a_free_spot_within_interact_range', () => {
    const range = SCENE.interact.interactRangeM.v;
    for (const [id, { at }] of Object.entries(SCENE.interactions)) {
      let found = false;
      for (let dx = -range; dx <= range && !found; dx += 0.1) for (let dz = -range; dz <= range && !found; dz += 0.1) {
        const p = { x: at.v.x + dx, z: at.v.z + dz };
        if (Math.hypot(dx, dz) > range || Math.abs(p.x) >= HW || p.z > SCENE.layout.zMax.v || p.z < SCENE.layout.zMin.v) continue;
        if (!insideAnyBlocker(p)) found = true;
      }
      expect(found, `${id} : aucun point libre à portée (${range} m)`).toBe(true);
    }
  });
  it('test_the_street_stays_connected_home_to_registre_to_the_vault_gate_front_and_the_gate_closes_the_end', () => {
    const STEP = 0.1, x0 = -HW, z0 = SCENE.layout.zMin.v;
    const nx = Math.round((2 * HW) / STEP), nz = Math.round((SCENE.layout.zMax.v - z0) / STEP);
    const free = (i: number, j: number): boolean => { const p = { x: x0 + i * STEP, z: z0 + j * STEP }; return Math.abs(p.x) < HW && !insideAnyBlocker(p); };
    const cell = (x: number, z: number): [number, number] => [Math.round((x - x0) / STEP), Math.round((z - z0) / STEP)];
    const seen = new Uint8Array((nx + 1) * (nz + 1));
    const stack: [number, number][] = [cell(0, SCENE.layout.places.logement.z.v - 2)];
    while (stack.length > 0) {
      const [i, j] = stack.pop()!;
      if (i < 0 || j < 0 || i > nx || j > nz || seen[i * (nz + 1) + j] === 1 || !free(i, j)) continue;
      seen[i * (nz + 1) + j] = 1;
      stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
    }
    const reached = (x: number, z: number): boolean => { const [i, j] = cell(x, z); return seen[i * (nz + 1) + j] === 1; };
    const reg = SCENE.layout.places.registre;
    expect(reached(0, 30), 'le logement').toBe(true);
    expect(reached(-3, (reg.z.v + reg.zEnd!.v) / 2), 'le Registre').toBe(true);
    expect(reached(0, -43), 'devant le portail').toBe(true);
    expect(reached(0, -46), 'derrière le portail fermé').toBe(false);
  });
  it('test_neither_the_queue_nor_the_passers_cross_a_solid', () => {
    const crossing: string[] = [];
    for (const permille of [0, 500, 1000]) for (const s of queueSlots(SCENE, permille)) for (const it of ITEMS) if (insideRaw(s, it)) crossing.push(`file ${permille} ${it.name}`);
    for (const seed of [1, 2, 3, 7, 42]) for (let t = 0; t < 600_000; t += 1000) for (const p of crowdAt(SCENE, t, seed)) for (const it of ITEMS) if (insideRaw(p.pos, it)) crossing.push(`passant ${seed} ${it.name}`);
    expect(crossing).toEqual([]);
  });
});
