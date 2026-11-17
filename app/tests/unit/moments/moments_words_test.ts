/**
 * Mots, bracelet et relevé du jour [plan 02b T5 ; bible w10 §4.4, §7.2, §7.3, §7.4 ; GDD 05 §3.5].
 * Les répliques `q.test5` et `flag.test2` sont des fixtures injectées, jamais des données de w10 [R-02b.20].
 */
import { describe, expect, it } from 'vitest';
import { braceletCount, buildLedger, countWords } from '../../../src/engine/moments/words';
import { ledgerAllocation } from '../../../src/shared/ledger';
import { ledgerOf } from '../../../src/engine/moments/state';
import { closeNight, startSurvival } from '../../../src/survival/integrity';
import type { IntegrityConfig } from '../../../src/data/schema/world';
import { act, canon, ctxLang, ctxW10, homeAt, reduceOk, withStreet } from '../../support/street';

const ctx = ctxW10();
const fixtures = ctxW10(withStreet((s) => {
  s.lines.say['q.test5'] = { key: 'w10.line.filler.1', words: 5, question: true, flaggedWords: 0 };
  s.lines.say['flag.test2'] = { key: 'w10.line.filler.1', words: 2, question: false, flaggedWords: 2 };
  // Option `name` du choix de J3 : son coût en mots est une donnée du choix (T4/T11 la posent) [R-02b.18].
  (s as { choices: unknown }).choices = [{ id: 'j3.marlene', options: [{ id: 'name', isRefusal: false, priceRef: 'w10.price.j3.marlene.name', words: 8 }] }];
}));

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));
}

describe('mots, bracelet, relevé du jour', () => {
  it('test_j2_component_declare_costs_8_credits_15_and_names_once', () => {            // pas de double compte : l'entrée vient de dayExtra, le crédit de la donnée
    const s = reduceOk(homeAt(2, 420), act(2, 420, 'choice', 'j2.component', 'declare'));
    const l = ledgerOf(s, 2, ctx);
    expect(l.wordsSpent).toBe(8);
    expect(l.wordsCredited).toBe(15);
    expect(l.entries.filter((e) => e.source === 'offer.named')).toHaveLength(1);
  });

  it('test_count_words_rules', () => {
    expect(countWords("Vous n'auriez rien à partager ?")).toBe(5);
    expect(countWords('quatre-vingts')).toBe(1);
    expect(countWords('14 h 02')).toBe(3);
    expect(countWords("Beau temps pour la saison. Vous n'auriez rien à partager ?")).toBe(10);   // réplique de Marlène [bible w10 §4.4]
    expect(countWords('  ? :  ')).toBe(0);
  });

  it('test_words_cost_is_data_not_string', () => {
    const fr = buildLedger(1, [act(1, 700, 'say', 'filler.1')], ctxLang('fr'));
    const en = buildLedger(1, [act(1, 700, 'say', 'filler.1')], ctxLang('en'));
    expect(fr.wordsSpent).toBe(1);
    expect(en).toEqual(fr);
  });

  it('test_checkpoint_words_are_lane_data', () => {
    expect(buildLedger(1, [act(1, 600, 'lane', 'checkpoint', 'comply')], ctx).wordsSpent).toBe(14);       // [bible w10 §7.4]
    expect(buildLedger(1, [act(1, 600, 'lane', 'checkpoint', 'buy:bons')], ctx).wordsSpent).toBe(3);
  });

  // N8 [T14, calibrage gd-t14 §3.1 ; bible w10 §5.0 l. 363 : « Consignes (source du +2 d'obéissance) : voix à la file du checkpoint »].
  it('test_checkpoint_queue_lane_counts_one_order', () => {
    const lane = (o: string) => buildLedger(1, [act(1, 600, 'lane', 'checkpoint', o)], ctx).orders;
    expect([lane('comply'), lane('courtesy')]).toEqual([1, 1]);   // on fait la file : la voix y donne une consigne
    expect(['buy:bons', 'buy:permission', 'buy:component', 'bypass', 'refuse'].map(lane)).toEqual([0, 0, 0, 0, 0]);   // pas de file, pas de consigne
  });
  it('test_explicit_obey_same_day_pays_nothing_more', () => {   // ordersTerm borné par perDayCap (2) : +2 au plus par jour
    const cfg = ctx.world.survival as unknown as IntegrityConfig;
    const ordersOf = (acts: Parameters<typeof buildLedger>[1]) => closeNight(startSurvival(cfg), buildLedger(1, acts, ctx), cfg).reading.terms['orders'];
    const queue = act(1, 600, 'lane', 'checkpoint', 'comply');
    expect(ordersOf([queue])).toBe(2000);
    expect(ordersOf([queue, act(1, 700, 'obey', 'checkpoint')])).toBe(2000);
  });

  it('test_j1_comply_leaves_46_on_the_bracelet', () => {
    expect(braceletCount(buildLedger(1, [act(1, 600, 'lane', 'checkpoint', 'comply')], ctx))).toBe(46);   // 60 - 14 [GDD 05 §3.7 écran 13]
  });

  it('test_naming_costs_8_credits_15_and_pays_12', () => {
    const l = buildLedger(3, [act(3, 900, 'choice', 'j3.marlene', 'name')], fixtures);
    expect([l.wordsSpent, l.wordsCredited, ledgerAllocation(l)]).toEqual([8, 15, 75]);                    // A = 75 les jours de nom [bible w10 §7.5]
    expect(l.entries.map((e) => e.source)).toEqual(['offer.named']);
    expect(l.entries[0]!.delta).toBe(12_000);                                                              // +12 en millièmes
  });

  it('test_question_doubles_and_flagged_word_costs_3', () => {
    const q = buildLedger(2, [act(2, 700, 'say', 'q.test5')], fixtures);
    expect(q.wordsSpent).toBe(10);
    expect(q.entries.map((e) => e.source)).toEqual(['question']);
    const f = buildLedger(2, [act(2, 700, 'say', 'flag.test2')], fixtures);
    expect(f.wordsSpent).toBe(6);                                                                          // 2 × 3 au lieu de 2 × 1
    expect(f.entries.map((e) => e.source)).toEqual(['flaggedWord', 'flaggedWord']);
  });

  it('test_over_10_bought_words_cost_once', () => {
    const buy = (n: number) => act(2, 500, 'buyWords', 'nadia', String(n));
    expect(buildLedger(2, [buy(6), buy(4)], ctx).entries).toEqual([]);
    expect(buildLedger(2, [buy(6), buy(5)], ctx).entries.map((e) => e.source)).toEqual(['wordsBoughtOver10']);
    const three = buildLedger(2, [buy(6), buy(5), buy(5)], ctx);
    expect(three.wordsBought).toBe(16);
    expect(three.entries.map((e) => e.source)).toEqual(['wordsBoughtOver10']);
  });

  it('test_base_by_day_and_j7_takes_the_last', () => {
    expect(buildLedger(1, [], ctx).wordsBase).toBe(60);
    expect(buildLedger(6, [], ctx).wordsBase).toBe(40);
    expect(buildLedger(7, [], ctx).wordsBase).toBe(40);
  });

  it('test_ledger_counts_glances_orders_and_ignores_other_days', () => {
    const l = buildLedger(4, [act(4, 450, 'glance', 'n1'), act(4, 460, 'glance', 'n2'), act(4, 560, 'obey', 'voice'), act(3, 600, 'obey', 'x')], ctx);
    expect([l.glances, l.orders, l.day]).toEqual([2, 1, 4]);
  });

  it('test_bracelet_never_negative', () => {
    expect(braceletCount(buildLedger(6, [act(6, 500, 'lane', 'checkpoint', 'comply'), act(6, 510, 'lane', 'checkpoint', 'comply'), act(6, 520, 'lane', 'checkpoint', 'comply')], ctx))).toBe(0);
  });

  it('test_ledger_independent_of_act_order_within_day', () => {                // Review Focus 5 [D89]
    // Trois actes à entrées de sources DISTINCTES à la MÊME minute : seul le tri du moteur fixe l'ordre des entrées.
    const day = [
      act(4, 450, 'glance', 'n1'), act(4, 560, 'obey', 'voice'), act(4, 600, 'lane', 'checkpoint', 'comply'),
      act(4, 1100, 'choice', 'j3.marlene', 'name'), act(4, 1100, 'say', 'q.test5'), act(4, 1100, 'say', 'flag.test2'),
    ];
    const ledger = buildLedger(4, day, fixtures);
    expect(ledger.entries.map((e) => e.source)).toEqual(['flaggedWord', 'flaggedWord', 'offer.named', 'question']);
    const keys = ledger.entries.map((e) => [e.at.minute, e.source] as const);
    expect(keys).toEqual([...keys].sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0)));   // trié (minute, source)
    const base = canon(ledger);
    for (const p of permutations(day)) expect(canon(buildLedger(4, p, fixtures))).toEqual(base);
  });
});
