/** Exécute `fn` deux fois et exige des résultats identiques (JSON canonique) ; rend le premier [GDD 03 §8]. */
import { expect } from 'vitest';

export function expectSameTwice<T>(fn: () => T): T {
  const a = fn();
  const b = fn();
  expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  return a;
}
