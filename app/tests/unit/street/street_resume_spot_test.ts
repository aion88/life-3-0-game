import { describe, expect, it } from 'vitest';
import { parseScene } from '../../../src/engine/view/sceneSchema';
import { barrierBlockers, resumeSpot, solidBlockers, streetBounds, type Blocker } from '../../../src/engine/view/walk';
import w10SceneRaw from '../../../src/street/data/w10.scene.json';
import { ctxW10 } from '../../support/street';

/**
 * Reprise de la rue [demande Cynthia 2026-11-03] : une position de reprise collée à un solide, ou qu'aucun chemin ne relie à l'entrée
 * de la rue, est remplacée par l'entrée. Sinon la joueuse reprend là où l'état la pose.
 */
const OPTS = { clearanceM: 0.3, cellM: 0.5, bounds: { min: { x: -7, z: -20 }, max: { x: 7, z: 20 } } };
const ENTRY = { x: 0, z: 10 };
const box = (x0: number, z0: number, x1: number, z1: number): Blocker => ({ kind: 'box', min: { x: x0, z: z0 }, max: { x: x1, z: z1 } });
const seg = (ax: number, az: number, bx: number, bz: number): Blocker => ({ kind: 'segment', a: { x: ax, z: az }, b: { x: bx, z: bz } });

describe('reprise : position de la joueuse', () => {
  it('test_resume_spot_free_and_reachable_is_kept', () => {
    expect(resumeSpot({ x: 1, z: -5 }, ENTRY, [box(3, 0, 5, 2)], OPTS)).toEqual({ x: 1, z: -5 });
  });
  it('test_resume_spot_inside_or_touching_a_solid_goes_to_entry', () => {
    expect(resumeSpot({ x: 4, z: 1 }, ENTRY, [box(3, 0, 5, 2)], OPTS)).toEqual(ENTRY);
    expect(resumeSpot({ x: 5, z: 1 }, ENTRY, [box(3, 0, 5, 2)], OPTS)).toEqual(ENTRY);       // sur le bord
    expect(resumeSpot({ x: 5.2, z: 1 }, ENTRY, [box(3, 0, 5, 2)], OPTS)).toEqual(ENTRY);     // à moins de la marge
  });
  it('test_resume_spot_against_a_wall_goes_to_entry', () => {
    expect(resumeSpot({ x: 6.9, z: 0 }, ENTRY, [seg(7, -20, 7, 20)], OPTS)).toEqual(ENTRY);
    expect(resumeSpot({ x: 6.5, z: 0 }, ENTRY, [seg(7, -20, 7, 20)], OPTS)).toEqual({ x: 6.5, z: 0 });
  });
  it('test_resume_spot_enclosed_by_walls_goes_to_entry', () => {
    const room = [seg(-2, -12, 2, -12), seg(2, -12, 2, -8), seg(2, -8, -2, -8), seg(-2, -8, -2, -12)];
    expect(resumeSpot({ x: 0, z: -10 }, ENTRY, room, OPTS)).toEqual(ENTRY);
    expect(resumeSpot({ x: 0, z: -10 }, ENTRY, room.slice(1), OPTS)).toEqual({ x: 0, z: -10 });   // une porte : atteignable
  });
  it('test_resume_spot_outside_the_street_goes_to_entry', () => {
    expect(resumeSpot({ x: 0, z: 30 }, ENTRY, [], OPTS)).toEqual(ENTRY);
  });

  it('test_resume_spot_on_w10_registre_behind_closed_barrier_goes_to_entry', () => {
    const s = parseScene(w10SceneRaw, ctxW10().street);
    const p = s.layout.places, hw = s.layout.halfWidthM.v;
    const o = { clearanceM: s.walk.bodyRadiusM.v, cellM: 0.5, bounds: { min: { x: -hw, z: s.layout.zMin.v }, max: { x: hw, z: s.layout.zMax.v } } };
    const entry = { x: 0, z: p.logement.zEnd!.v };
    const reg = { x: 0, z: (p.registre.z.v + p.registre.zEnd!.v) / 2 };
    const open = [...streetBounds(s), ...solidBlockers(s)];
    expect(resumeSpot(reg, entry, open, o)).toEqual(reg);
    expect(resumeSpot(reg, entry, [...barrierBlockers(null, s), ...open], o)).toEqual(entry);
    expect(resumeSpot({ x: 0, z: p.logement.z.v }, entry, open, o)).toEqual({ x: 0, z: p.logement.z.v });
  });
});
