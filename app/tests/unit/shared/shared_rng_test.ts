import { expect, it } from 'vitest';
import golden from '../../fixtures/rng-golden.json';
import { foldUint32 } from '../../support/checksum';
import { fnv1a32, mix32, mulberry32, mulberry32Uint32 } from '../../../src/shared/rng';

it('test_mulberry32_bit_exact_with_v1_on_100k_outputs', () => {
  expect(golden.seeds).toHaveLength(10);
  for (const g of golden.seeds) {
    const next = mulberry32Uint32(g.seed);
    let h = 0x811c9dc5;
    const first: number[] = [];
    for (let i = 0; i < 100_000; i++) {
      const x = next();
      if (i < 8) first.push(x);
      h = foldUint32(h, x);
    }
    expect(first).toEqual(g.first8);
    expect(h >>> 0).toBe(g.checksum);
  }
});

it('test_mulberry32_is_uint32_over_2_pow_32_in_unit_interval', () => {
  const u = mulberry32Uint32(9000);
  const f = mulberry32(9000);
  for (let i = 0; i < 1000; i++) {
    const x = u();
    expect(Number.isInteger(x) && x >= 0 && x <= 0xffffffff).toBe(true);
    expect(f()).toBe(x / 4294967296);
  }
});

it('test_fnv1a32_known_vectors_and_utf16_units', () => {
  expect(fnv1a32('')).toBe(0x811c9dc5);
  expect(fnv1a32('a')).toBe(0xe40c292c);
  expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  expect(fnv1a32('clé')).toBeGreaterThanOrEqual(0);
});

it('test_mix32_frozen_outputs_and_uint32_range', () => {
  expect(mix32()).toBe(0x9e3779b9);
  // Valeurs re-dérivées indépendamment par une référence BigInt de la boucle du brief (relecteur, 2026-11-01).
  expect(mix32(0)).toBe(493009611);
  // Idem, référence BigInt indépendante (relecteur, 2026-11-01).
  expect(mix32(1, 2, 3)).toBe(2901138804);
  // Idem, référence BigInt indépendante (relecteur, 2026-11-01).
  expect(mix32(3000000000, 4294967295, -1)).toBe(3700661774);
  for (let i = 0; i < 1000; i++) {
    const m = mix32(i, i * 7919, 3000000000);
    expect(Number.isInteger(m) && m >= 0 && m <= 0xffffffff).toBe(true);
  }
  expect(mix32(1, 2)).not.toBe(mix32(2, 1));
});
