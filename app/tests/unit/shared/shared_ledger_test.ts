import { expect, it } from 'vitest';
import { ledgerAllocation, ledgerOverrun, ledgerRemaining } from '../../../src/shared/ledger';
import type { NightLedger } from '../../../src/shared/types/street';

// relevé de la nuit de w10 [bible w10 §7.2, §7.5]
const l = (o: Partial<NightLedger>): NightLedger => ({
  day: 1, wordsBase: 60, wordsCredited: 0, wordsBought: 0, wordsSpent: 0, glances: 0, orders: 0, entries: [], ...o,
});

it('test_overrun_against_allocation_remaining_against_base_only', () => {
  expect(ledgerOverrun(l({ wordsSpent: 70 }))).toBe(10); // le bavard dépasse A de 10
  expect(ledgerOverrun(l({ wordsSpent: 85, wordsCredited: 15 }))).toBe(10); // jour de nom, A = 75
  expect(ledgerRemaining(l({ wordsSpent: 30, wordsCredited: 15 }))).toBe(30); // contre B seule, jamais 45
  expect(ledgerRemaining(l({ day: 6, wordsBase: 40, wordsSpent: 15 }))).toBe(25);
  expect(ledgerAllocation(l({ wordsCredited: 15, wordsBought: 5 }))).toBe(80);
});

it('test_overrun_and_remaining_never_negative', () => {
  expect(ledgerOverrun(l({ wordsSpent: 10 }))).toBe(0);
  expect(ledgerRemaining(l({ wordsSpent: 90 }))).toBe(0);
});
