import { expect, it } from 'vitest';
import { createDice } from '../../../src/shared/dice';
import { worldSeedOf } from '../../../src/shared/types';

// T-1d [GDD 03 §8]
it('test_roll_independent_of_call_order', () => {
  const d = createDice(worldSeedOf('w10'));
  const a = d.roll('event', 3, 7, 'nb-neighbor-taken');
  for (let i = 0; i < 50; i++) d.roll('line', 3, 7, `npc-${i}`);
  expect(d.roll('event', 3, 7, 'nb-neighbor-taken')).toBe(a);
  expect(createDice(worldSeedOf('w10')).roll('event', 3, 7, 'nb-neighbor-taken')).toBe(a);
});

it('test_roll_in_unit_interval_and_frequency_close_to_chance', () => {
  const d = createDice(9000);
  let hits = 0;
  for (let i = 0; i < 10_000; i++) {
    const r = d.roll('street', 1, 9, `checkpoint.k${i}`);
    expect(r >= 0 && r < 1).toBe(true);
    if (r < 0.25) hits++;
  }
  expect(hits / 10_000).toBeGreaterThan(0.23);
  expect(hits / 10_000).toBeLessThan(0.27);
});

it('test_domains_separate', () => {
  const d = createDice(9000);
  let same = 0;
  for (let i = 0; i < 1000; i++) if (d.roll('event', 2, 10, `k${i}`) === d.roll('line', 2, 10, `k${i}`)) same++;
  expect(same).toBeLessThan(5);
});

// Valeurs produites en exécutant ce code, comparables à rien de la v1 [GDD 03 T-1d].
it('test_golden_values_recorded', () => {
  const d = createDice(9000);
  expect([
    d.roll('event', 1, 7, 'a'),
    d.roll('line', 7, 22, 'marlene'),
    d.roll('street', 4, 9, 'checkpoint.bypass'),
  ]).toMatchSnapshot();
});

it('test_non_ascii_key_refused', () => {
  expect(() => createDice(0).roll('event', 1, 7, 'clé')).toThrow();
  expect(() => createDice(0).roll('event', 1, 7, 'a b')).toThrow();
  expect(() => createDice(0).roll('event', 1, 7, '')).toThrow();
});
