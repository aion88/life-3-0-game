import { describe, expect, it } from 'vitest';
import { choicesToPresent } from '../../../src/engine/view/interactions';
import { ctx, INTERACT, streetAt } from '../../support/street_interactions';

describe('choix ouverts ensemble [A-1]', () => {
  it('test_max_concurrent_choices_over_days_and_a_position_grid', () => {
    let best = { n: 0, day: 0, x: 0, z: 0, ids: [] as readonly string[] };
    for (const day of [1, 2, 3, 4, 5, 6, 7] as const) for (const minute of [450, 700, 900]) {
      const st = streetAt(day, minute);
      for (let x = -12; x <= 12; x += 1) for (let z = -30; z <= 45; z += 1) {
        const ids = choicesToPresent(st, { x, z }, ctx, INTERACT);
        if (ids.length > best.n) best = { n: ids.length, day, x, z, ids };
      }
    }
    console.info(`A-1 : maximum ${best.n} choix ouverts ensemble, jour ${best.day} en (${best.x}, ${best.z}) : ${best.ids.join(', ')}`);
    // Mesuré le 2026-11-02 : 7 au jour 1 près du logement, quand la lettre, la liste, la relecture et le permis s'ouvraient partout.
    // Remesuré le 2026-11-03 après le retour de playtest (chaque choix ouvert à son lieu) : 3, au Registre le J1. La spec choix-simultanes-ux §1 est à relire.
    expect(best.n).toBe(3);
    expect([...best.ids].sort()).toEqual(['m4.list', 'permit.j1', 'relecture.j1']);
    expect(best.day).toBe(1);
  });
});
