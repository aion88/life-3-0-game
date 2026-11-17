import { describe, expect, it } from 'vitest';
import { contestRecord, createLedger, say, wordsLeft, write, type ContestRule } from '../../../src/worlds/controlStationLedger';

const BUDGET = 20;
const DOSSIER = 60;
const RULE: ContestRule = { cost: 6, falseIndex: 2, lineCount: 4, penalty: -3, penaltyLabel: 'Contestation infondée' };

describe('control-station ledger', () => {
  it('test_new_ledger_starts_with_full_words_and_untouched_dossier', () => {
    const ledger = createLedger(BUDGET, DOSSIER);
    expect(wordsLeft(ledger)).toBe(BUDGET);
    expect(ledger.dossier).toBe(DOSSIER);
    expect(ledger.entries).toEqual([]);
    expect(ledger.contested).toBe('none');
  });
  it('test_saying_words_reduces_what_is_left_and_may_go_below_zero', () => {
    const ledger = createLedger(BUDGET, DOSSIER);
    say(ledger, RULE.cost);
    expect(wordsLeft(ledger)).toBe(BUDGET - RULE.cost);
    say(ledger, BUDGET);
    expect(wordsLeft(ledger)).toBe(-RULE.cost);
  });
  it('test_writing_an_entry_moves_the_dossier_and_keeps_the_trace', () => {
    const ledger = createLedger(BUDGET, DOSSIER);
    write(ledger, 'Garante enregistrée : maman', 2);
    expect(ledger.dossier).toBe(DOSSIER + 2);
    expect(ledger.entries).toEqual([{ label: 'Garante enregistrée : maman', delta: 2 }]);
  });
  it('test_contesting_the_false_line_costs_words_only', () => {
    const ledger = createLedger(BUDGET, DOSSIER);
    expect(contestRecord(ledger, RULE.falseIndex, RULE)).toBe('founded');
    expect(wordsLeft(ledger)).toBe(BUDGET - RULE.cost);
    expect(ledger.dossier).toBe(DOSSIER);
    expect(ledger.contested).toBe('founded');
  });
  it('test_contesting_a_true_line_costs_words_and_is_written_to_the_dossier', () => {
    const ledger = createLedger(BUDGET, DOSSIER);
    expect(contestRecord(ledger, 0, RULE)).toBe('unfounded');
    expect(wordsLeft(ledger)).toBe(BUDGET - RULE.cost);
    expect(ledger.dossier).toBe(DOSSIER + RULE.penalty);
    expect(ledger.entries).toEqual([{ label: RULE.penaltyLabel, delta: RULE.penalty }]);
  });
  it('test_second_contest_changes_nothing', () => {
    const ledger = createLedger(BUDGET, DOSSIER);
    contestRecord(ledger, RULE.falseIndex, RULE);
    expect(contestRecord(ledger, 0, RULE)).toBe('ignored');
    expect(wordsLeft(ledger)).toBe(BUDGET - RULE.cost);
    expect(ledger.dossier).toBe(DOSSIER);
    expect(ledger.contested).toBe('founded');
  });
  it('test_line_outside_the_record_is_ignored', () => {
    const ledger = createLedger(BUDGET, DOSSIER);
    expect(contestRecord(ledger, RULE.lineCount, RULE)).toBe('ignored');
    expect(contestRecord(ledger, -1, RULE)).toBe('ignored');
    expect(wordsLeft(ledger)).toBe(BUDGET);
    expect(ledger.contested).toBe('none');
  });
});
