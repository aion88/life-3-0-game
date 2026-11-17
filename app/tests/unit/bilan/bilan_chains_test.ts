/**
 * « Les chaînes de ta semaine » [plan rue guidée J3-J7, T7] : une entrée par chaîne ouverte, jamais un maillon `absent`, et la semaine coupée
 * à la nuit d'une arrestation anticipée (Review Focus 4).
 */
import { describe, expect, it } from 'vitest';
import { weekChains } from '../../../src/bilan/chains';
import { marksOf } from '../../../src/engine/moments/marks';
import { ACTS_FULL_WEEK_FIXTURE, ACTS_ONE_CHAIN, ARREST_N2_ACTS, CLK, endInput, FIX_ENDING, G_WEEK, w10Guided } from '../../support/bilan_chains';

describe('chaînes de la semaine', () => {
  it('test_week_chains_one_entry_per_opened_chain', () => {
    const w = weekChains(endInput(ACTS_FULL_WEEK_FIXTURE), G_WEEK, CLK, {});
    expect(w.chains.map((c) => c.chainId)).toEqual(['A', 'B', 'C', 'E']);   // J4 : C2 (relecture du 9-C) ouvre la chaîne C même sans la cantine du J3
    expect(w.arrestedNight).toBeNull();
    expect(w.arrestedLineKey).toBeNull();
  });

  it('test_week_chains_skip_chains_never_opened', () => {
    // B, C et E jamais franchies (maillons `absent` seulement) : aucune entrée, pas même vide
    expect(weekChains(endInput(ACTS_ONE_CHAIN), G_WEEK, CLK, {}).chains.map((c) => c.chainId)).toEqual(['A']);
  });

  it('test_week_chains_never_list_absent', () => {
    const absent = marksOf(ACTS_ONE_CHAIN, { day: 3 }, G_WEEK, CLK).filter((m) => m.variant === 'absent');
    expect(absent.length).toBeGreaterThan(0);   // la fixture porte bien des maillons `absent`
    const items = weekChains(endInput(ACTS_ONE_CHAIN), G_WEEK, CLK, {}).chains.flatMap((c) => c.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items.filter((i) => i.recapKey.endsWith('.absent'))).toEqual([]);
  });

  it('test_week_chains_items_in_day_then_minute_order', () => {
    for (const c of weekChains(endInput(ACTS_FULL_WEEK_FIXTURE), G_WEEK, CLK, {}).chains) {
      const at = c.items.map((i) => i.day * 10000 + i.minute);
      expect(at).toEqual([...at].sort((a, b) => a - b));
    }
  });

  it('test_week_chains_answer_gives_link_key', () => {
    const w = weekChains(endInput(ACTS_FULL_WEEK_FIXTURE), G_WEEK, CLK, { Q11: 'B' } as never);
    const a = w.chains.find((c) => c.chainId === 'A')!;
    expect(a.answer).toBe('B');
    expect(a.linkKey).toBe('w10.chain.A.link.B');
    expect(w.chains.find((c) => c.chainId === 'B')!.linkKey).toBeNull();
  });

  it('test_week_chains_cut_at_arrest_night', () => {   // Review Focus 4 ; contexte ctxArrestNight(2) de T4, actes rejoués jusqu'à `ended`
    const w = weekChains({ entry: 'earlyEnd', acts: ARREST_N2_ACTS }, w10Guided, CLK, {});
    expect(w.arrestedNight).toBe(2);
    expect(Math.max(...w.chains.flatMap((c) => c.items.map((i) => i.day)))).toBeLessThanOrEqual(2);
  });

  it('test_week_chains_drop_links_after_the_arrest_night', () => {
    // arrêté dans la nuit 1 (dernier `sleep` au jour 1) : le maillon de nuit A2, daté du matin du jour 2, n'a pas eu lieu
    const night1 = ARREST_N2_ACTS.filter((a) => a.day === 1);
    expect(night1.some((a) => a.kind === 'sleep')).toBe(true);
    const w = weekChains({ entry: 'earlyEnd', acts: night1 }, w10Guided, CLK, {});
    expect(w.arrestedNight).toBe(1);
    expect(w.chains.flatMap((c) => c.items.map((i) => i.day)).every((d) => d <= 1)).toBe(true);
    expect(weekChains(endInput(night1), w10Guided, CLK, {}).chains.flatMap((c) => c.items).some((i) => i.day === 2)).toBe(true);
  });

  it('test_arrest_line_key_only_with_an_ending', () => {
    expect(weekChains({ entry: 'earlyEnd', acts: ARREST_N2_ACTS }, { ...w10Guided, ending: null }, CLK, {}).arrestedLineKey).toBeNull();   // un monde sans fin (w10 a la sienne depuis T13)
    expect(weekChains({ entry: 'earlyEnd', acts: ARREST_N2_ACTS }, w10Guided, CLK, {}).arrestedLineKey).toBe('w10.end.arrestedNight');
    expect(weekChains({ entry: 'earlyEnd', acts: ARREST_N2_ACTS }, { ...w10Guided, ending: FIX_ENDING }, CLK, {}).arrestedLineKey).toBe(FIX_ENDING.arrestedNightKey);
  });
});
