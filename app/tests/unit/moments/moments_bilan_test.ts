/**
 * Audition du J7 et entrée du bilan [plan 02b T13 ; bible w10 §7.6, §5.2 c ; GDD 05 AC-F5, D136, D137 ; GDD 06 §5 ; R-02b.27, R-02b.28, R-02b.33, R-02b.35, R-02b.62].
 * `bilan.ts` ne fait que lire : l'audition est écrite par `reduceAct` (T10).
 */
import { describe, expect, it } from 'vitest';
import { flaggedLines, relectureLineOf, toBilanInput, wallCounterOf } from '../../../src/engine/moments/bilan';
import { replay } from '../../../src/engine/moments/replay';
import { createStreet } from '../../../src/engine/moments/state';
import type { Milli } from '../../../src/shared/milli';
import type { DayIndex, NightLedger } from '../../../src/shared/types/street';
import { actsOfProfile } from '../../support/profile_acts';
import { act, ctxW10, endIdOf } from '../../support/street';

const ctx = ctxW10();
const S = ctx.street;
const RELECTURE_DAYS: readonly DayIndex[] = [1, 2, 4, 5, 6];

/** Relevé vide du jour `day` (sans entrée). */
const L0 = (day: number): NightLedger => ({ day: day as DayIndex, wordsBase: 60, wordsCredited: 0, wordsBought: 0, wordsSpent: 0, glances: 0, orders: 0, entries: [] });
/** Relevé du jour `day` portant les entrées `sources`. */
const L = (day: number, sources: readonly string[]): NightLedger => ({
  ...L0(day), entries: sources.map((source) => ({ source, delta: 0 as Milli, at: { day: day as DayIndex, minute: 480 } })),
});

describe('audition du J7', () => {
  it.each([['arrestedAudition', 'Deux noms puis arrêté', 'arrested:audition'], ['recruited', 'Deux noms, J2 + J3', 'recruited'], ['released', 'Zéro nom', 'released']])(
    'test_audition_end_%s', (endId, profile, oracleEnd) => {
      const r = replay(actsOfProfile(profile, { audition: 'silence' }), ctx);
      expect(r.state.ended).toMatchObject({ endId });
      expect(endIdOf(r.state)).toBe(oracleEnd);
      expect(r.rejected).toEqual([]);
    });

  it('test_audition_answer_does_not_change_the_end', () => {
    const ends = ['all', 'none', 'silence'].map((o) => replay(actsOfProfile('Zéro nom', { audition: o }), ctx).state.ended!.endId);
    expect(new Set(ends).size).toBe(1);
  });
});

describe('entrée du bilan', () => {
  it('test_week_end_input_is_complete', () => {
    const r = replay(actsOfProfile('Zéro nom', { audition: 'none' }), ctx);
    const b = toBilanInput(r.state, r.week, ctx);
    expect(b).toMatchObject({ entry: 'weekEnd' });
    expect(b.week!.curve).toHaveLength(r.week.stepsDone + 1);
    expect(b.week!.curve).toHaveLength(8);
    expect(b.survival).not.toBeNull();
    expect(b.run).toBe(ctx.run);
    expect(b.acts).toEqual(r.state.acts);
  });

  it('test_early_arrest_gives_early_end_and_a_partial_week', () => {
    const r = replay(actsOfProfile('Muet', {}), ctx);
    const b = toBilanInput(r.state, r.week, ctx);
    expect(b.entry).toBe('earlyEnd');
    expect(b.week).not.toBeNull();
    expect(b.week!.curve).toHaveLength(r.week.stepsDone + 1);
    expect(b.week!.curve).toHaveLength(5);                                         // Muet : cinq relevés, quatre matins, courbe de 5 [R-02b.28, R-02b.33]
    expect(b.week!.curve).toHaveLength(r.state.readings.length);                    // earlyEnd : curve.length === readings.length
    expect(r.state.ended).toMatchObject({ endId: 'arrested' });                     // arrêté à la nuit 5
    expect(b.survival).toMatchObject({ endId: 'arrested', endDay: 5 });
  });

  it('test_input_needs_an_ended_week', () => {
    const r = replay([], ctx);
    expect(() => toBilanInput(r.state, r.week, ctx)).toThrow();
  });
});

describe('ligne de relecture du jour', () => {
  it('test_relecture_line_of_follows_the_entry_else_the_unconditional', () => {
    for (const d of RELECTURE_DAYS) {
      const [first, second] = S.lines.relecture[String(d) as '1']!;
      const keyed = second.whenEntry !== null ? second : first.whenEntry !== null ? first : null;
      expect(relectureLineOf(d, L0(d), S)).toBe((first.whenEntry === null ? first : second).key);   // sans entrée : la ligne sans condition
      if (keyed !== null) expect(relectureLineOf(d, L(d, [keyed.whenEntry!]), S)).toBe(keyed.key);
    }
  });

  it('test_relecture_line_of_reads_the_data_entry_of_the_second_line', () => {
    const [first, second] = S.lines.relecture['6']!;
    expect(second.whenEntry).not.toBeNull();                                        // J6 : la seconde ligne va avec l'entrée `permit` [w10.json]
    expect(relectureLineOf(6, L(6, [second.whenEntry!]), S)).toBe(second.key);
    expect(relectureLineOf(6, L(6, ['unrelated']), S)).toBe(first.key);
  });

  it('test_relecture_line_of_falls_back_to_the_unconditional_line_wherever_it_is', () => {
    const [cond, plain] = S.lines.relecture['1']!;
    expect([cond.whenEntry !== null, plain.whenEntry]).toEqual([true, null]);       // J1 [w10.json] : conditionnelle d'abord, sans condition ensuite
    expect(relectureLineOf(1, L(1, [cond.whenEntry!]), S)).toBe(cond.key);          // avec l'entrée : la première
    expect(relectureLineOf(1, L0(1), S)).toBe(plain.key);                           // sans l'entrée : la seconde
    expect(relectureLineOf(1, L(1, ['unrelated']), S)).toBe(plain.key);
  });

  // Reprend le test du brief : il épingle la pureté (même entrée, même sortie), il ne prouve pas le choix.
  it('test_relecture_line_of_is_deterministic', () => {
    for (const d of RELECTURE_DAYS) expect(relectureLineOf(d, L(d, ['permit']), S)).toBe(relectureLineOf(d, L(d, ['permit']), S));
  });

  it('test_relecture_line_of_is_null_on_reserve_days_and_one_of_two_otherwise', () => {
    expect([3, 7].map((d) => relectureLineOf(d as DayIndex, L0(d), S))).toEqual([null, null]);   // J3 et J7 : réserve
    for (const d of RELECTURE_DAYS) expect(S.lines.relecture[String(d) as '1']!.map((x) => x.key)).toContain(relectureLineOf(d, L0(d), S));
  });
});

describe('lignes signalées et compteur du mur', () => {
  it('test_flagged_lines_counted_apart', () => {
    expect(flaggedLines([act(1, 700, 'choice', 'relecture.j1', 'flag'), act(2, 700, 'choice', 'relecture.j2', 'pass'), act(4, 700, 'choice', 'relecture.j4', 'flag')])).toBe(2);
  });

  it('test_flagged_lines_ignores_other_choices_and_kinds', () => {
    expect(flaggedLines([act(1, 700, 'choice', 'm1.scan', 'flag'), act(1, 701, 'say', 'relecture.j1', 'flag'), act(1, 702, 'choice', 'relecture.j1', null)])).toBe(0);
  });

  it('test_wall_counter_starts_at_the_data_start', () => {
    expect(wallCounterOf(createStreet(ctx), ctx)).toBe(S.wallCounter.start);
    expect(wallCounterOf(createStreet(ctx), ctx)).toBe(3871);                       // [bible w10 §5.2 c, spike]
  });

  it('test_wall_counter_rises_with_flagged_lines', () => {
    const s = (n: number) => ({ ...createStreet(ctx), acts: Array.from({ length: n }, (_, i) => act((1 + i) as DayIndex, 700, 'choice', `relecture.j${1 + i}`, 'flag')) });
    expect([0, 1, 2].map((n) => wallCounterOf(s(n), ctx))).toEqual([3871, 3872, 3873]);   // 1 par signalement [supposé: game-designer]
  });

  it('test_wall_counter_never_goes_down_over_any_prefix', () => {
    // Zéro nom, avec une relecture au J1 (flag), J2 (pass) et J4 (flag) insérée avant le remplissage du soir.
    const base = actsOfProfile('Zéro nom', { audition: 'silence' });
    const at = (d: number) => base.findIndex((a) => a.day === d && a.minute >= 800);
    const picks: readonly [DayIndex, string][] = [[1, 'flag'], [2, 'pass'], [4, 'flag']];
    const acts = [...base];
    for (const [d, option] of [...picks].reverse()) acts.splice(at(d), 0, act(d, 790, 'choice', `relecture.j${d}`, option));
    expect(replay(acts, ctx).rejected).toEqual([]);
    const v = acts.map((_, i) => wallCounterOf(replay(acts.slice(0, i + 1), ctx).state, ctx));
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeGreaterThanOrEqual(v[i - 1]!);
    expect(new Set(v).size).toBe(3);                                                // 3871, 3872, 3873 : le compteur a bougé
    expect(v.at(-1)).toBe(S.wallCounter.start + S.wallCounter.perFlag * picks.filter(([, o]) => o === 'flag').length);
  });
});
