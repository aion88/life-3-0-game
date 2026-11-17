import { describe, expect, it } from 'vitest';
import { gazeRange, stepGaze, type GazeTracker } from '../../../src/engine/moments/gaze';
import type { Vec2 } from '../../../src/engine/moments/types';
import type { Palier } from '../../../src/survival';
import { ctxW10 } from '../../support/street';

const S = ctxW10().street;
const EMPTY: GazeTracker = { inside: {}, counted: {} };
const N = { id: 'n16', pos: { x: 7, z: 16 }, aim: { x: -1, z: 0 } };   // nacelle fixture, visée vers l'axe de la rue
const run = (ms: number[], player: Vec2, range = 12, aim: Vec2 = N.aim) => ms.reduce(
  (a, dt) => { const r = stepGaze(a.t, { dtMs: dt, player, nacelles: [{ ...N, aim }], rangeM: range }, S); return { t: r.tracker, g: [...a.g, r.glanced] }; },
  { t: EMPTY, g: [] as (string | null)[] });

describe('moments : nacelles, cône entier, regards [plan 02b T6]', () => {
  it('test_glance_needs_more_than_4s', () => {
    expect(run([2000, 2000], { x: 0, z: 16 }).g.filter(Boolean)).toEqual([]);
    expect(run([2000, 2001], { x: 0, z: 16 }).g.filter(Boolean)).toEqual(['n16']);   // « plus de quatre secondes » [GDD 05 3.7]
  });
  it('test_one_glance_per_entry', () => { expect(run([3000, 3000, 3000], { x: 0, z: 16 }).g.filter(Boolean)).toHaveLength(1); });
  it('test_leaving_and_returning_counts_again', () => {
    const a = run([5000], { x: 0, z: 16 }); expect(a.g.at(-1)).toBe('n16');
    const out = stepGaze(a.t, { dtMs: 100, player: { x: 0, z: 40 }, nacelles: [N], rangeM: 12 }, S).tracker;   // la sortie remet le compteur à zéro
    expect(out.inside.n16).toBe(0);
    expect(stepGaze(out, { dtMs: 5000, player: { x: 0, z: 16 }, nacelles: [N], rangeM: 12 }, S).glanced).toBe('n16');   // le retour recompte
  });
  it('test_cone_angle_and_range', () => {
    expect(run([4001], { x: -4, z: 17 }).g.at(-1)).toBe('n16');   // 11 m, environ 5 degrés : dedans
    expect(run([4001], { x: -5, z: 18 }).g.at(-1)).toBeNull();    // 12,2 m : hors portée de 12
    expect(run([4001], { x: -5, z: 18 }, 18).g.at(-1)).toBe('n16');   // dedans à 18 m
    expect(run([4001], { x: 0, z: 26 }).g.at(-1)).toBeNull();     // 12,2 m et 55 degrés : hors cône
  });
  it('test_player_behind_the_nacelle_is_not_counted', () => {
    expect(run([4001], { x: 12, z: 16 }).g.at(-1)).toBeNull();    // derrière : le produit scalaire est négatif, son carré ne doit pas compter [R-02b.21]
  });
  it('test_range_by_palier', () => { expect(['courtesy', 'thanks', 'patience', 'appointment'].map(p => gazeRange(p as Palier, S))).toEqual([12, 12, 18, 18]); });
});
