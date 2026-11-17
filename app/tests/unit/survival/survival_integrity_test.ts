import { describe, expect, it } from 'vitest';
import { integrityOf, parseWorld } from '../../../src/data/schema/world';
import { closeNight, palierOf, startSurvival, survivalEntry } from '../../../src/survival';
import { validateContent } from '../../../src/validate/content';
import type { Milli } from '../../../src/shared/milli';
import type { DayIndex, GameClock } from '../../../src/shared/types/street';
import { cat, w10Raw } from '../../fixtures/data/factories';
import {
  contentWith, ledgerOf, lastReading, oracle, permutations, playCase, sixNightsCouloir, withClamp, withSurvival,
} from '../../support/survival';

const CFG = integrityOf(parseWorld(w10Raw, cat));
const clock = (day: number, minute: number): GameClock => ({ day: day as DayIndex, minute });

const PROFILES: [string, number[], string][] = [
  ['Zéro nom', [63, 64, 63, 55, 48, 39], 'released'],
  ['Zéro nom + permis au J6', [63, 64, 63, 55, 48, 30], 'released'],
  ['Bavard, quatre noms', [47, 44, 39, 32, 23, 0], 'arrested:6'],
  ['Un nom, J2', [63, 76, 75, 67, 60, 51], 'released'],
  ['Un nom, J3', [63, 64, 75, 67, 60, 51], 'released'],
  ['Un nom, J4', [63, 64, 63, 72, 65, 56], 'released'],
  ['Un nom, J5', [63, 64, 63, 55, 62, 55], 'released'],
  ['Deux noms, J2 + J3', [63, 76, 87, 79, 72, 63], 'recruited'],
  ['Deux noms, J4 + J5', [63, 64, 63, 72, 79, 72], 'recruited'],
  ['Quatre noms', [63, 76, 87, 96, 100, 93], 'recruited'],
  ['Deux noms puis arrêté', [47, 32, 15, 24, 31, 24], 'arrested:audition'],
  ['Bavard', [47, 32, 15, 0], 'arrested:4'],
  ['Muet', [51, 40, 29, 9, 0], 'arrested:5'],
];

describe('survie de w10, jauge Intégrité [plan 01 T14]', () => {
  it.each(PROFILES)('test_profile_%s_exact', (name, nights, end) => {
    expect(playCase(oracle('survival').profiles[name]!, CFG)).toEqual({ nights, end });
  });

  it('test_first_night_couloir_63_muet_51_bavard_47', () => {
    expect(['Zéro nom', 'Muet', 'Bavard'].map((n) => playCase(oracle('survival').profiles[n]!, CFG).nights[0])).toEqual([63, 51, 47]);
  });

  it('test_d134_profiles_exact', () => {
    const d = oracle('survival').d134;
    expect(playCase(d['permis J1, #7 trouvé J2']!, CFG)).toEqual({ nights: [54, 45, 44, 36, 29, 20], end: 'arrested:audition' });
    expect(playCase(d['permis J1, #7 trouvé J5']!, CFG)).toEqual({ nights: [54, 55, 54, 46, 29, 20], end: 'arrested:audition' });
    expect(playCase(d['permis J1, sans #7']!, CFG)).toEqual({ nights: [54, 55, 54, 46, 39, 30], end: 'released' });
    expect(playCase(d['reste chez lui, couloir']!, CFG)).toEqual({ nights: [59, 56, 55, 43, 32, 19], end: 'arrested:audition' });
    expect(playCase(d['reste chez lui, muet']!, CFG)).toEqual({ nights: [47, 32, 21, 0], end: 'arrested:4' });
  });

  it('test_order_of_entries_does_not_change_night', () => {
    const entries = [survivalEntry('flaggedWord', clock(4, 430), CFG), survivalEntry('offer.refused.j4', clock(4, 1110), CFG), survivalEntry('question', clock(4, 600), CFG)];
    const near = { ...startSurvival(CFG), value: 27_000 as Milli };
    const base = closeNight(near, ledgerOf(4, entries), CFG);
    for (const perm of permutations(entries)) expect(closeNight(near, ledgerOf(4, perm), CFG)).toEqual(base);
  });

  it('test_paliers_bounds', () => {
    expect([100, 60, 59, 40, 39, 25, 24, 1].map((x) => palierOf((x * 1000) as Milli, CFG)))
      .toEqual(['courtesy', 'courtesy', 'thanks', 'thanks', 'patience', 'patience', 'appointment', 'appointment']);
  });

  it('test_dossier_closed_after_night_6', () => {
    const s = sixNightsCouloir(CFG);
    const { reading } = closeNight(s, ledgerOf(7, [survivalEntry('permit', clock(7, 600), CFG)]), CFG);
    expect(reading.value).toBe(s.value);
    expect(reading.mentions).toEqual(['sortantDeclare']);
  });

  it('test_relecture_is_neutral', () => {
    const at1 = clock(1, 600);
    const withRel = ledgerOf(1, [survivalEntry('relecture.flag', at1, CFG), survivalEntry('relecture.pass', at1, CFG)]);
    expect(closeNight(startSurvival(CFG), withRel, CFG).reading.value).toBe(closeNight(startSurvival(CFG), ledgerOf(1, []), CFG).reading.value);
  });

  it('test_m_entries_exist_in_cfg', () => {
    const d = (s: string): Milli => survivalEntry(s, clock(1, 480), CFG).delta;
    expect([d('phoneLeft'), d('scanFlagged'), d('letterKept')]).toEqual([-3_000, -6_000, -3_000]);
  });

  it('test_ledger_words_mismatch_throws', () => {
    expect(() => closeNight(startSurvival(CFG), { ...ledgerOf(6, []), wordsBase: 60 }, CFG)).toThrow();
  });

  it('test_ledger_credit_mismatch_throws', () => {
    expect(() => closeNight(startSurvival(CFG), { ...ledgerOf(2, []), wordsCredited: 15 }, CFG)).toThrow();
  });

  it('test_gauge_clamp_comes_from_data', () => {
    const C = withClamp(CFG, { floor: 10, cap: 70 });
    const up = closeNight({ ...startSurvival(C), value: 68_000 as Milli }, ledgerOf(2, [survivalEntry('offer.named', clock(2, 1000), C)], C), C);
    const down = closeNight({ ...startSurvival(C), value: 12_000 as Milli }, ledgerOf(4, [survivalEntry('found7', clock(4, 900), C)], C), C);
    expect([up.reading.value, down.reading.value]).toEqual([70_000, 10_000]);
  });

  it('test_gdd04_flag_threshold_on_grid_warns_not_errors', () => {
    const r = validateContent(contentWith(withSurvival(w10Raw, { arrest: { nightBelow: 0.5, auditionBelow: 24 } })));
    expect(r.warnings.map((i) => i.code)).toContain('GDD04-threshold-on-grid');
    expect(r.errors.map((i) => i.code)).not.toContain('GDD04-threshold-on-grid');
  });

  it('test_gdd04_flags_silent_on_shipped_w10', () => {
    expect(validateContent(contentWith(w10Raw)).warnings.filter((i) => i.code.startsWith('GDD04-'))).toEqual([]);
  });

  it('test_d86_one_name_release_carries_no_concours_mention_at_close', () => {
    const mentions = (name: string): readonly string[] => lastReading(oracle('survival').profiles[name]!, CFG).mentions;
    expect(playCase(oracle('survival').profiles['Un nom, J2']!, CFG).end).toBe('released');
    for (const n of ['Un nom, J2', 'Zéro nom', 'Deux noms, J2 + J3', 'Bavard, quatre noms']) expect(mentions(n)).not.toContain('concoursApporte');
  });

  it('test_schema_refuses_off_grid_unknown_report_id_and_bad_last_night', () => {
    const bad = (patch: Record<string, unknown>) => () => parseWorld(withSurvival(w10Raw, patch), cat);
    expect(bad({ arrest: { nightBelow: 0.3, auditionBelow: 24.5 } })).toThrow(/survival\.arrest\.nightBelow/);
    expect(bad({ report: { prices: { nope: 'full' }, comforts: [] } })).toThrow(/survival\.report\.prices\.nope/);
    expect(bad({ lastNight: 5 })).toThrow(/survival\.lastNight/);
    expect(bad({ bogus: 1 })).toThrow(/Unrecognized key/);
  });

  it('test_permit_mention_on_any_day', () => {
    const run = (day: number) => closeNight(startSurvival(CFG), ledgerOf(day, [survivalEntry('permit', clock(day, 600), CFG)]), CFG);
    const j2 = run(2);
    expect(j2.reading.mentions).toContain('sortantDeclare');
    const without = closeNight(startSurvival(CFG), ledgerOf(2, []), CFG);
    expect(without.reading.value - j2.reading.value).toBe(9_000);
    const s6 = sixNightsCouloir(CFG);
    const j7 = closeNight(s6, ledgerOf(7, [survivalEntry('permit', clock(7, 600), CFG)]), CFG);
    expect(j7.reading.mentions).toEqual(['sortantDeclare']);
    expect(j7.reading.value).toBe(s6.value);
  });

  it('test_all_entry_deltas_pinned', () => {
    const TABLE: Record<string, number> = {
      'offer.named': 12, 'offer.refused.j2': 0, 'offer.refused.j3': 0, 'offer.refused.j4': -5, 'offer.refused.j5': -2,
      permit: -9, found7: -10, absentRegistre: -4, receiptNotShown: -6, flaggedWord: -2, consignedFlag: -6,
      phoneLeft: -3, scanFlagged: -6, letterKept: -3, question: -1, wordsBoughtOver10: -2, bribe: -4,
      informant: -6, secondBribe: -15, bypassNacelle: -3, patrol: -8, 'relecture.flag': 0, 'relecture.pass': 0,
    };
    expect(Object.keys(CFG.entries).sort()).toEqual(Object.keys(TABLE).sort());
    for (const [src, pts] of Object.entries(TABLE)) expect([src, survivalEntry(src, clock(1, 480), CFG).delta]).toEqual([src, pts * 1000]);
  });
  it('test_schema_rejects_a_max_remaining_array_of_the_wrong_length_or_out_of_bounds', () => {   // ruling N6 v3 : un tableau a `lastNight` (6) valeurs, chacune un nombre de mots
    const withMax = (maxRemaining: unknown) => {
      const surv = (w10Raw['survival'] as { words: { sleep: Record<string, unknown> } & Record<string, unknown> });
      return withSurvival(w10Raw, { words: { ...surv.words, sleep: { ...surv.words.sleep, maxRemaining } } });
    };
    expect(() => parseWorld(withMax([20, 20, 20, 20, 20, 26]), cat)).not.toThrow();   // témoin : la forme de w10
    expect(() => parseWorld(withMax(20), cat)).not.toThrow();                          // un nombre reste accepté
    expect(() => parseWorld(withMax([20, 20, 20, 20, 20]), cat)).toThrow(/6 valeurs attendues/);          // longueur
    expect(() => parseWorld(withMax([20, 20, 20, 20, 20, 26, 26]), cat)).toThrow(/6 valeurs attendues/);
    expect(() => parseWorld(withMax([20, 20, 20, 20, 20, -1]), cat)).toThrow();                            // borne basse
    expect(() => parseWorld(withMax([20, 20, 20, 20, 20, 1.5]), cat)).toThrow();                           // non entier
  });
});
