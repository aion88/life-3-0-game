/**
 * Relevé du soir de la semaine [plan rue guidée J3-J7, T5] : `eveningRecap` pur. Les noms donnés (`names`), le droit du jour des données,
 * le dernier jour de la semaine. Fixture `recap-week.json` : trois noms possibles (J1, J3, J4), droit `privacy` au J5, fin de semaine.
 */
import { describe, expect, it } from 'vitest';
import { eveningRecap } from '../../../src/engine/moments/recap';
import { ctxRecapWeek, stateWith, ACTS_THREE_NAMES, ACTS_DECLARE_ONLY, ACTS_NONE, ACTS_AUDITION } from '../../support/recap_week';

const recap = (day: 1 | 2 | 3 | 4 | 5 | 6 | 7, acts: Parameters<typeof stateWith>[1], rights: Parameters<typeof stateWith>[2] = {}) => eveningRecap(stateWith(day, acts, rights), ctxRecapWeek, {});

describe('moments : relevé de la semaine [J3-J7 T5]', () => {
  it('test_names_collected_in_day_order', () => {
    expect(recap(4, ACTS_THREE_NAMES).names).toEqual(['w10.dw.name.theodore', 'w10.dw.name.fille', 'w10.dw.name.marlene']);
  });
  it('test_names_stop_at_the_day_read', () => {
    expect(recap(3, ACTS_THREE_NAMES).names).toEqual(['w10.dw.name.theodore', 'w10.dw.name.fille']);
  });
  it('test_declare_counts_as_blank_line', () => {
    expect(recap(4, ACTS_DECLARE_ONLY).names).toEqual(['w10.dw.name.blank']);
  });
  it('test_no_names_is_empty', () => {
    expect(recap(4, ACTS_NONE).names).toEqual([]);
  });
  it('test_day_right_used_when_engine_has_none', () => {
    expect(recap(5, []).right).toBe('privacy');
    expect(recap(5, [], { '5.afternoon': 'move' }).right).toBe('move');
    expect(recap(4, []).right).toBeNull();   // le J4 ne dit aucun droit : lu par jour, jamais par indice
  });
  it('test_last_day_only_on_day_seven_with_an_ending', () => {
    expect(recap(7, ACTS_AUDITION)).toMatchObject({ lastDay: true, weekButtonKey: 'w10.dw.end.week' });
    expect(recap(6, [])).toMatchObject({ lastDay: false, weekButtonKey: null });
  });
});
