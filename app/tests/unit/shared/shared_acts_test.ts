import { expect, it } from 'vitest';
import { baseActKeys, isValidAct } from '../../../src/shared/acts';
import type { ActValidation } from '../../../src/save/save';
import type { ActRecord, DayIndex } from '../../../src/shared/types';

const act = (o: Partial<ActRecord> = {}): ActRecord => ({ day: 3, minute: 600, kind: 'routine', id: 'usePhone', option: null, ...o });

it('test_base_act_keys_are_the_three_kinds', () => {
  expect([...baseActKeys].sort()).toEqual(['milestone', 'routine', 'survival']);
});

it('test_is_valid_act_accepts_every_base_kind', () => {
  for (const kind of baseActKeys) expect(isValidAct(act({ kind }), baseActKeys)).toBe(true);
});

it('test_is_valid_act_refuses_kind_outside_known', () => {
  expect(isValidAct(act({ kind: 'ghost' }), baseActKeys)).toBe(false);
  expect(isValidAct(act({ kind: 'choice' }), baseActKeys)).toBe(false); // kind du plan 02b : absent de la base
  expect(isValidAct(act({ kind: 'routine.usePhone' }), baseActKeys)).toBe(false); // une clé composée n'est pas un kind
});

it('test_known_extended_by_plan_02b_keeps_base_and_adds_its_own', () => {
  const known = new Set([...baseActKeys, 'choice']);
  expect([isValidAct(act({ kind: 'choice', option: 'comply' }), known), isValidAct(act(), known)]).toEqual([true, true]);
});

it('test_is_valid_act_refuses_day_out_of_range', () => {
  for (const day of [0, 8, 1.5, Number.NaN]) expect(isValidAct(act({ day: day as DayIndex }), baseActKeys)).toBe(false);
  for (const day of [1, 7] as const) expect(isValidAct(act({ day }), baseActKeys)).toBe(true);
});

it('test_is_valid_act_refuses_minute_out_of_range', () => {
  for (const minute of [419, 1321, 600.5, Number.NaN]) expect(isValidAct(act({ minute }), baseActKeys)).toBe(false);
  for (const minute of [420, 1320]) expect(isValidAct(act({ minute }), baseActKeys)).toBe(true);
});

it('test_is_valid_act_refuses_empty_id_and_empty_option', () => {
  expect(isValidAct(act({ id: '' }), baseActKeys)).toBe(false);
  expect(isValidAct(act({ option: '' }), baseActKeys)).toBe(false);
  expect(isValidAct(act({ option: 'comply' }), baseActKeys)).toBe(true);
});

it('test_exports_fit_act_validation_of_plan_00', () => {
  // typage seulement : ce plan ne câble pas createSaveStore
  const v: ActValidation = { isValidAct, known: baseActKeys };
  expect(v.known.size).toBe(3);
});

it('test_is_valid_act_never_throws_on_malformed_input', () => {
  const bad = { day: undefined, minute: null, kind: 3, id: undefined, option: 7 } as unknown as ActRecord;
  expect(isValidAct(bad, baseActKeys)).toBe(false);
});
