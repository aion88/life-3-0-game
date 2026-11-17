import { describe, expect, it } from 'vitest';
import { layoutFacades, lampPositions, wallScreenHues } from '../../../src/engine/view/layout';
import { scene } from '../../support/street_render';

/** Les quatre teintes de la table du spike [bible w10 §10.1, recalculées des RGB : cyan, magenta, bleu pâle, orange]. */
const SPIKE_HUES = [202.8, 328.4, 223.6, 27.7];

describe('mise en espace de la rue : partie pure', () => {
  it('test_facades_tile_the_street_without_gap', () => {
    for (const side of ['east', 'west'] as const) {
      const f = layoutFacades(scene(), 1).filter(x => x.side === side).sort((a, b) => a.z0 - b.z0);
      expect(f[0]!.z0).toBe(-48); expect(f.at(-1)!.z1).toBe(44);
      for (let i = 1; i < f.length; i++) expect(f[i]!.z0).toBe(f[i - 1]!.z1);
      for (const x of f) { expect(x.z1 - x.z0).toBeGreaterThanOrEqual(7); expect(x.z1 - x.z0).toBeLessThanOrEqual(19); expect(x.storeys).toBeGreaterThanOrEqual(4); expect(x.storeys).toBeLessThanOrEqual(6); }
      expect(f.reduce((s, x) => s + (x.z1 - x.z0), 0)).toBe(92);
    }
  });
  it('test_facades_tile_for_many_seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const side of ['east', 'west'] as const) {
        const f = layoutFacades(scene(), seed).filter(x => x.side === side);
        expect(f[0]!.z0).toBe(-48); expect(f.at(-1)!.z1).toBe(44);
        for (let i = 1; i < f.length; i++) expect(f[i]!.z0).toBe(f[i - 1]!.z1);
        for (const x of f) { expect(x.z1 - x.z0).toBeGreaterThanOrEqual(7); expect(x.z1 - x.z0).toBeLessThanOrEqual(19); }
      }
    }
  });
  it('test_layout_is_deterministic_and_seed_dependent', () => { expect(layoutFacades(scene(), 1)).toEqual(layoutFacades(scene(), 1)); expect(layoutFacades(scene(), 1)).not.toEqual(layoutFacades(scene(), 2)); });
  it('test_about_one_window_in_three_is_lit', () => { const f = layoutFacades(scene(), 1); const all = f.flatMap(x => x.litMask); const share = all.filter(Boolean).length / all.length; expect(share).toBeGreaterThan(0.28); expect(share).toBeLessThan(0.38); });
  it('test_lit_mask_matches_the_window_grid', () => {
    const b = scene().build;
    for (const f of layoutFacades(scene(), 1)) {
      const cols = Math.floor((f.z1 - f.z0) / b.windowPitchM.v);
      expect(f.litMask.length).toBe(cols * f.storeys);
    }
  });
  it('test_lamp_positions_are_six_per_side', () => { expect(lampPositions(scene()).filter(l => l.side === 'east').map(l => l.z)).toEqual([44, 26, 8, -10, -28, -46]); expect(lampPositions(scene()).filter(l => l.side === 'west')).toHaveLength(6); });
  it('test_wall_hues_come_from_the_spike_table', () => { expect(wallScreenHues(scene()).sort()).toEqual([...new Set(SPIKE_HUES)].sort()); });
});
