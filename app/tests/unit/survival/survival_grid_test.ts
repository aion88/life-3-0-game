import { describe, expect, it } from 'vitest';
import { integrityOf, parseWorld } from '../../../src/data/schema/world';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { gridCounts, gridMinFinal, oracle, playCase } from '../../support/survival';

const CFG = integrityOf(parseWorld(w10Raw, cat));

describe('grille du logement de w10 [bible w10 §7.5, w10_logement.py]', () => {
  it('test_logement_grid_counts_couloir', () => {
    expect(gridCounts('couloir', null, CFG)).toEqual({ '0:released': 8, '1:released': 32, '2:recruited': 48, '3:recruited': 32, '4:recruited': 8 });
    expect(gridMinFinal('couloir', null, CFG)).toEqual({ 0: 30, 1: 42, 2: 54, 3: 70, 4: 84 });
    expect(gridCounts('couloir', 2, CFG)).toEqual({ '0:arrested:audition': 6, '0:released': 2, '1:released': 24, '2:recruited': 24, '3:recruited': 8 });
    expect(gridMinFinal('couloir', 2, CFG)).toEqual({ 0: 20, 1: 32, 2: 48, 3: 65 });
  });

  it('test_logement_grid_every_case_matches_oracle', () => {
    const grid = oracle('survival').grid;
    expect(grid.length).toBe(768);
    for (const c of grid) expect(playCase(c, CFG)).toEqual({ nights: c.nights, end: c.end });
  });
});
