import { describe, expect, it } from 'vitest';
import { CONTESTS, LABELS, NAMES, RULES } from '../../../../src/worlds/week/weekContent';
import {
  closeDay,
  contest,
  createWeek,
  endingOf,
  giveName,
  openDay,
  say,
  signNotebook,
  wordsForTomorrow,
  write,
} from '../../../../src/worlds/week/weekState';

const labels = (s: ReturnType<typeof createWeek>) => s.ledger.map((e) => e.label);

describe('week state', () => {
  it('test_week_state_new_game_starts_with_rule_values', () => {
    const s = createWeek();
    expect(s.budget).toBe(RULES.startBudget);
    expect(s.dossier).toBe(RULES.startDossier);
    expect(s.said).toBe(0);
    expect(s.day).toBe(1);
    expect(s.names).toEqual([]);
  });

  it('test_week_state_say_and_write_move_words_and_dossier', () => {
    const s = createWeek();
    say(s, 7);
    write(s, 'x', -4);
    expect(s.said).toBe(7);
    expect(s.dossier).toBe(RULES.startDossier - 4);
    expect(s.ledger).toEqual([{ label: 'x', delta: -4 }]);
  });

  it('test_week_state_giving_a_name_adds_words_and_dossier_once', () => {
    const s = createWeek();
    expect(giveName(s, 'Nadia')).toBe(true);
    expect(giveName(s, 'Nadia')).toBe(false);
    expect(s.names).toEqual(['Nadia']);
    expect(s.budget).toBe(RULES.startBudget + RULES.nameWords);
    expect(s.dossier).toBe(RULES.startDossier + RULES.nameDossier);
    expect(labels(s)).toEqual([LABELS.givenName]);
  });

  it('test_week_state_signing_notebook_gives_three_names_without_duplicate', () => {
    const s = createWeek();
    giveName(s, 'Marlène');
    const budget = s.budget;
    signNotebook(s);
    expect([...s.names].sort()).toEqual([...NAMES].sort());
    expect(s.names).toHaveLength(NAMES.length);
    expect(s.budget).toBe(budget);
    expect(s.dossier).toBe(RULES.startDossier + RULES.nameDossier + RULES.notebookDossier);
  });

  it('test_week_state_contesting_false_line_upholds_without_penalty', () => {
    const s = createWeek();
    const r = contest(s, 'refus', CONTESTS.refus.falseIndex);
    expect(r.outcome).toBe('upheld');
    expect(r.words).toBe(CONTESTS.refus.words);
    expect(s.said).toBe(CONTESTS.refus.words);
    expect(s.dossier).toBe(RULES.startDossier);
    expect(s.contested).toBe(true);
    expect(s.traces).toHaveLength(1);
  });

  it('test_week_state_touching_bracelet_line_costs_six_words_and_writes_unfounded', () => {
    const s = createWeek();
    const bracelet = 4;
    const r = contest(s, 'refus', bracelet);
    expect(r.outcome).toBe('rejected');
    expect(s.said).toBe(CONTESTS.refus.words);
    expect(s.ledger).toEqual([{ label: 'Contestation infondée', delta: -3 }]);
    expect(s.contested).toBe(false);
  });

  it('test_week_state_letting_the_registry_notice_pass_writes_yesterday_words', () => {
    const s = createWeek();
    const r = contest(s, 'avis', -1);
    expect(r.outcome).toBe('passed');
    expect(s.said).toBe(0);
    expect(s.ledger).toEqual([{ label: "Mots d'hier, selon le Registre", delta: -3 }]);
  });

  it('test_week_state_wrong_registry_line_writes_unfounded_then_yesterday_words', () => {
    const s = createWeek();
    contest(s, 'avis', 0);
    expect(labels(s)).toEqual(['Contestation infondée', "Mots d'hier, selon le Registre"]);
    expect(s.said).toBe(CONTESTS.avis.words);
  });

  it('test_week_state_tomorrow_words_follow_dossier_steps', () => {
    const [high, mid] = RULES.tomorrowSteps;
    expect(wordsForTomorrow(high.min)).toBe(high.words);
    expect(wordsForTomorrow(high.min - 1)).toBe(mid.words);
    expect(wordsForTomorrow(mid.min)).toBe(mid.words);
    expect(wordsForTomorrow(mid.min - 1)).toBe(RULES.tomorrowFloor);
  });

  it('test_week_state_evening_writes_silence_letter_night_in_order', () => {
    const s = createWeek();
    say(s, RULES.silenceBelow - 1);
    s.letter = true;
    const statement = closeDay(s);
    expect(labels(s)).toEqual([LABELS.silence, LABELS.undeclaredText, LABELS.night]);
    expect(s.dossier).toBe(RULES.startDossier - 3 - 3 - 2);
    expect(statement.tomorrow).toBe(wordsForTomorrow(s.dossier));
  });

  it('test_week_state_evening_overrun_comes_first_and_equals_excess', () => {
    const s = createWeek();
    say(s, RULES.startBudget + 5);
    closeDay(s);
    expect(s.ledger[0]).toEqual({ label: LABELS.overrun, delta: -5 });
    expect(labels(s)).not.toContain(LABELS.silence);
  });

  it('test_week_state_evening_ticket_ends_with_total_and_tomorrow_rows', () => {
    const s = createWeek();
    say(s, 10);
    const statement = closeDay(s);
    const total = statement.rows.find((r) => typeof r !== 'string' && r.total);
    expect(total).toEqual({ label: 'Dossier, ce soir', value: String(s.dossier), total: true });
    expect(statement.rows[statement.rows.length - 1]).toEqual({
      label: 'Mots accordés demain',
      value: String(statement.tomorrow),
    });
    expect(statement.rows[0]).toEqual({ label: 'Mots dits', value: `10 / ${RULES.startBudget}` });
  });

  it('test_week_state_open_day_rolls_budget_and_clears_the_day', () => {
    const s = createWeek();
    say(s, 6);
    const statement = closeDay(s);
    openDay(s);
    expect(s.day).toBe(2);
    expect(s.budget).toBe(statement.tomorrow);
    expect(s.yesterday).toBe(6);
    expect(s.said).toBe(0);
    expect(s.morning).toBe(s.dossier);
    expect(s.ledger).toEqual([]);
  });

  it('test_week_state_open_day_without_close_day_throws', () => {
    expect(() => openDay(createWeek())).toThrow();
  });

  it('test_week_state_ending_follows_threshold_then_names', () => {
    const s = createWeek();
    s.dossier = RULES.threshold - 1;
    s.names = ['Nadia', 'Théodore', 'Marlène'];
    expect(endingOf(s)).toBe('arrete');
    s.dossier = RULES.threshold;
    expect(endingOf(s)).toBe('recrute');
    s.names = ['Nadia'];
    expect(endingOf(s)).toBe('relache');
    s.names = ['Nadia', 'Théodore'];
    expect(endingOf(s)).toBe('recrute');
  });
});
