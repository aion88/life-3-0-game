import { expect, it } from 'vitest';
import { answersSeedString, runSeed } from '../../../src/shared/seed';
import { answersOf } from '../../../src/shared/types';
import { expectSameTwice } from '../../support/determinism';

// GDD 02 §4.7, F2
it('test_seed_order_independent_numeric_key_order', () => {
  const a = answersOf({ Q21: 'A', Q04: 'B', Q100: 'C' });
  const b = answersOf({ Q100: 'C', Q04: 'B', Q21: 'A' });
  expect(answersSeedString(a)).toBe('Q04=B;Q21=A;Q100=C');
  expect(runSeed(a)).toBe(runSeed(b));
  expect(expectSameTwice(() => runSeed(a))).toBe(runSeed(a));
});

it('test_seed_differs_when_one_answer_differs', () => {
  expect(runSeed(answersOf({ Q01: 'A' }))).not.toBe(runSeed(answersOf({ Q01: 'B' })));
});
