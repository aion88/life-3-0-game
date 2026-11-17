import { expect, expectTypeOf, it } from 'vitest';
import {
  RIGHT_IDS, WORLD_VARS, answersOf, isQuestionKey, questionNumber, worldNumber, worldSeedOf,
} from '../../../src/shared/types';
import type { ArrivalWorldId, ExtinctionId, QuestionKey } from '../../../src/shared/types';

it('test_world_constants', () => {
  expect(WORLD_VARS).toEqual(['aiPower', 'order', 'abundance', 'freedom', 'surveillance', 'unrest']);
  expect(worldSeedOf('w10')).toBe(9000);
  expect(worldSeedOf('w01')).toBe(0);
  expect(worldNumber('w07')).toBe(7);
  expect(RIGHT_IDS).toEqual(['move', 'leave', 'stay', 'speak', 'read', 'assemble', 'privacy', 'work']);
  expect(questionNumber('Q21' as QuestionKey)).toBe(21);
  expect(isQuestionKey('Q04')).toBe(true);
  expect(isQuestionKey('Q123')).toBe(true);
  expect(isQuestionKey('Q1')).toBe(false);
  expect(isQuestionKey('Q1000')).toBe(false);
  expect(isQuestionKey('q04')).toBe(false);
  expect(answersOf({ Q11: 'B' })).toEqual({ Q11: 'B' });
  expect(() => answersOf({ Q1: 'A' })).toThrow();
  expectTypeOf<'w07'>().not.toMatchTypeOf<ArrivalWorldId>();
  expectTypeOf<'w12'>().toMatchTypeOf<ExtinctionId>();
});
