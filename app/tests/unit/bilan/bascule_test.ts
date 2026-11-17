import { describe, expect, it } from 'vitest';
import { bascule } from '../../../src/bilan/bascule';
import { basculeYear, shiftYears } from '../../../src/engine/projection';
import { expectSameTwice } from '../../support/determinism';
import { proj } from '../../support/bilan_curve';

// bascule(avec écho, sans écho, repli) ; les paires ci-dessous sont (sans, avec) comme `shiftYears` [plan 01 Task 8].
const b = (without: number | null, withE: number | null) => bascule(proj(withE), proj(without));

describe('bascule : les cinq cas de GDD 06 §3.4', () => {
  it('test_case_a_shift_one_year', () => {
    expect(shiftYears(52, 40)).toBe(1);
    expect(b(52, 40)).toEqual({ case: 'a', yearWith: basculeYear(40), yearWithout: basculeYear(52), shiftYears: 1, direction: 'forward' });
    expect(b(52, 40).yearWith).toBe(2033);
  });
  it('test_case_a_shift_back', () => {
    expect(b(54, 72)).toMatchObject({ case: 'a', shiftYears: -1, direction: 'back', yearWith: 2036 });
    expect(b(54, 78)).toMatchObject({ case: 'a', shiftYears: -2, direction: 'back' });
  });
  it('test_case_b_n_zero_shows_only_year_with_echo', () => {
    expect(shiftYears(51, 45)).toBe(0);
    const r = b(51, 45);
    expect(r).toEqual({ case: 'b', yearWith: 2033, yearWithout: 2034, shiftYears: 0, direction: null });
  });
  it('test_case_b_equal_switch_steps', () => {
    for (const [without, withE] of [[60, 54], [54, 60]] as const) {
      expect(shiftYears(without, withE)).toBe(0);
      expect(b(without, withE)).toMatchObject({ case: 'b', shiftYears: 0, direction: null });
    }
  });
  it('test_case_c_neither_tips', () => {
    expect(b(null, null)).toEqual({ case: 'c', yearWith: null, yearWithout: null, shiftYears: null, direction: null });
  });
  it('test_case_c_is_defined_by_the_projections_alone', () => {
    expect(b(null, null).case).toBe('c'); // jamais conditionné par un texte de repli
    expect(bascule.length).toBe(2);
  });
  it('test_case_d_only_without_echo_tips', () => {
    expect(b(52, null)).toEqual({ case: 'd', yearWith: null, yearWithout: 2034, shiftYears: null, direction: null });
  });
  it('test_case_e_only_with_echo_tips', () => {
    expect(b(null, 40)).toEqual({ case: 'e', yearWith: 2033, yearWithout: null, shiftYears: null, direction: null });
  });
  it('test_case_none_without_projection', () => {
    const none = { case: 'none', yearWith: null, yearWithout: null, shiftYears: null, direction: null };
    expect(bascule(null, null)).toEqual(none);
    expect(bascule(proj(40), null)).toEqual(none);
    expect(bascule(null, proj(40))).toEqual(none);
  });
  it('test_bascule_never_emits_zero_years', () => {
    const pairs = [[52, 40], [51, 45], [54, 72], [54, 78], [60, 54], [54, 60]] as const;
    for (const [without, withE] of pairs) {
      const r = b(without, withE);
      if (r.case === 'a') expect(r.shiftYears).not.toBe(0);
      else expect(r).toMatchObject({ case: 'b', shiftYears: 0, direction: null });
      expect(r.shiftYears).toBe(shiftYears(without, withE));
    }
  });
  it('test_b_v11_table_covers_five_cases_and_n_examples', () => {
    const cases = [b(52, 40), b(51, 45), b(null, null), b(52, null), b(null, 40)].map((r) => r.case);
    expect(cases).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect([b(52, 40), b(54, 72), b(54, 78)].map((r) => r.shiftYears)).toEqual([1, -1, -2]);
  });
  it('test_bascule_is_pure_same_input_same_output', () => {
    expectSameTwice(() => [b(52, 40), b(null, null), b(51, 45)]);
  });
  it('test_bascule_does_not_run_a_projection', () => {
    // des projections sans pas : seule la comparaison des deux `switchStep` décide
    expect(bascule({ steps: [], switchStep: 40, toWorld: 'w03', extinctionStep: null }, { steps: [], switchStep: 52, toWorld: 'w03', extinctionStep: null }).case).toBe('a');
  });
});
