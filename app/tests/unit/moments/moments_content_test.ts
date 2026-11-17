/**
 * Données des sept jours de w10 : choix, jalons, micro-situations, grille des axes, PNJ, objets, relecture [plan 02b T11].
 * Les tests lisent les données RÉELLES de w10 : un chiffre ici est recalculé à la main depuis GDD 05 §3.6 et la bible w10.
 */
import { describe, expect, it } from 'vitest';
import { AXES } from '../../../src/engine/moments/types';
import { KIT_EVENTS } from '../../../src/engine/moments/kit';
import { presentAt } from '../../../src/engine/moments/npcs';
import { countWords } from '../../../src/engine/moments/words';
import { ruleFor } from '../../../src/i18n/i18n';
import { checkPlayerString } from '../../../src/validate/numbers';
import type { Palier } from '../../../src/survival/integrity';
import enJson from '../../../src/data/strings/en.json';
import frJson from '../../../src/data/strings/fr.json';
import { ctxW10, loadMeta } from '../../support/street';

const ctx = ctxW10();
const S = ctx.street;
const W = ctx.world;
const FR = frJson as Record<string, string>;
const EN = enJson as Record<string, string>;
const days = [1, 2, 3, 4, 5, 6, 7] as const;
const options = S.choices.flatMap((c) => c.options.map((o) => ({ c, o })));

describe('données de w10 : les sept jours [plan 02b T11]', () => {
  it('test_f2_sourced_choices_per_day', () => {                                  // [GDD 05 F2, calculé à la main : 1, 2, 1, 2, 2, 1, 1, soit 10 ; 11 avec l'audition]
    const SOURCED: Record<number, string[]> = { 1: ['checkpoint.j1'], 2: ['checkpoint.j2', 'j2.component'], 3: ['j3.marlene'], 4: ['checkpoint.j4', 'j4.neighbour'], 5: ['checkpoint.j5', 'j5.bruno'], 6: ['checkpoint.j6'], 7: ['permit.j7'] };
    for (const d of days) for (const id of SOURCED[d]!) expect(S.choices.find((c) => c.id === id)?.days).toContain(d);
    const counted = days.map((d) => Object.values(SOURCED).flat().filter((id) => S.choices.find((c) => c.id === id)?.days.includes(d)).length);   // compté dans les données, pas recopié
    expect(counted).toEqual([1, 2, 1, 2, 2, 1, 1]); expect(counted.reduce((n, k) => n + k, 0)).toBe(10);
    expect(S.choices.find((c) => c.id === 'audition.j7')?.days).toEqual([7]);
  });
  it('test_every_day_has_an_offered_choice', () => { for (const d of days) expect(S.choices.some((c) => c.days.includes(d))).toBe(true); });
  it('test_offers_cap_one_per_day_j2_to_j5_none_else', () => {                     // [GDD 04 §3.4 w10]
    expect(days.map((d) => S.choices.filter((c) => c.kind === 'offer' && c.days.includes(d)).length)).toEqual([0, 1, 1, 1, 1, 0, 0]);
  });
  it('test_axes_table_counts', () => {                                            // [GDD 05 3.6, recalculé : G(j) = 5, 3, 5, 3, 3, 3, 1 ; 23 G, 17 V, 2 D]
    const g = (d: number) => S.axes.filter((c) => c.day === d && c.type === 'G').length;
    expect(days.map(g)).toEqual([5, 3, 5, 3, 3, 3, 1]);
    const all = S.axes;
    expect([all.length, all.filter((c) => c.type === 'G').length, all.filter((c) => c.type === 'V').length, all.filter((c) => c.type === 'D').length]).toEqual([42, 23, 17, 2]);
    expect(AXES.map((a) => all.filter((c) => c.axis === a && c.type === 'G').length)).toEqual([3, 5, 1, 5, 7, 2]);   // vie, travail, rue, liens, pouvoir, ia
  });
  it('test_d_cells_have_an_owner', () => { for (const c of S.axes.filter((x) => x.type === 'D')) expect(c.owner).toBe('world-builder'); });   // T-1, T-2
  it('test_npc_lines_at_most_12_words', () => { for (const n of S.npcs) for (const k of n.lineKeys) expect(countWords(FR[k]!)).toBeLessThanOrEqual(12); });   // [bible w10 §8.4]
  it.each([
    ['greyCar', 1, 449, 'patience', false], ['greyCar', 1, 450, 'patience', true], ['greyCar', 1, 539, 'patience', true], ['greyCar', 1, 540, 'patience', false],
    ['greyCar', 1, 450, 'courtesy', false], ['greyCar', 1, 450, 'appointment', false], ['yusuf', 1, 779, 'courtesy', false], ['yusuf', 1, 780, 'courtesy', true],
    ['nadia', 5, 600, 'courtesy', true], ['nadia', 6, 600, 'courtesy', false],
  ])('test_presence_%s_j%i_%i_%s', (id, d, m, p, here) => { expect(presentAt(id, d, m, p as Palier, S)).toBe(here); });
  // voiture grise de 7 h 30 à 9 h, soit [450, 540[, seulement au palier patience [GDD 05 l. 262, 265], jamais à `appointment` ni à `thanks` (conflit avec la bible l. 9, au world-builder)
  it('test_relecture_lines_exist_for_the_five_days_and_use_the_regime_document_policy', () => {
    const meta = loadMeta();
    for (const d of [1, 2, 4, 5, 6]) {
      const lines = S.lines.relecture[String(d) as '1'];
      expect(lines).toHaveLength(2);
      for (const l of lines) {
        expect(ruleFor(meta, l.key).policy).toBe('regimeDocument');
        expect(FR[l.key], l.key).toBeTruthy(); expect(EN[l.key], l.key).toBeTruthy();
        for (const lang of ['fr', 'en'] as const) expect(checkPlayerString((lang === 'fr' ? FR : EN)[l.key]!, lang, ruleFor(meta, l.key), W.forbiddenWords), l.key).toEqual([]);
      }
    }
  });
  it('test_kit_events_only_name_known_items', () => { for (const { o } of options) if (o.kitEvent) expect(KIT_EVENTS).toContain(o.kitEvent); });
  it('test_wall_counter_string_is_a_regime_document_and_passes_its_policy', () => {   // point 8 du plan 02a [bible w10 §5.2 c ; plan 00 politiques]
    expect(ruleFor(loadMeta(), 'w10.doc.wallCounter').policy).toBe('regimeDocument');
    for (const lang of ['fr', 'en'] as const) expect(checkPlayerString((lang === 'fr' ? FR : EN)['w10.doc.wallCounter']!.replace('{n}', '3871'), lang, { policy: 'regimeDocument' }, W.forbiddenWords)).toEqual([]);
  });

  // Garde-fous propres à T11 : le contrat entre les données, les chaînes et les moteurs voisins (T10, T12, T14).
  it('test_every_price_line_key_exists_in_fr_and_en_and_passes_its_policy', () => {
    const meta = loadMeta();
    for (const { c, o } of options) {
      if (o.priceLineKey === null) continue;
      expect(FR[o.priceLineKey], `fr ${c.id}/${o.id}`).toBeTruthy(); expect(EN[o.priceLineKey], `en ${c.id}/${o.id}`).toBeTruthy();
      for (const lang of ['fr', 'en'] as const) expect(checkPlayerString((lang === 'fr' ? FR : EN)[o.priceLineKey]!, lang, ruleFor(meta, o.priceLineKey), W.forbiddenWords), o.priceLineKey).toEqual([]);
    }
  });
  it('test_every_trace_is_dated_the_day_after_the_choice', () => {                // R-02b.54 : une trace s'écrit au lendemain du premier jour du choix
    for (const { c, o } of options) if (o.trace !== null) {
      expect(o.trace.day, `${c.id}/${o.id}`).toBe(Math.min(...c.days) + 1);
      expect(FR[o.trace.key], o.trace.key).toBeTruthy(); expect(EN[o.trace.key], o.trace.key).toBeTruthy();
    }
  });
  it('test_neutral_options_are_exactly_the_neutre_ones', () => { for (const { c, o } of options) expect(o.neutral, `${c.id}/${o.id}`).toBe(o.priceRef === 'neutre'); });
  it('test_micro_days_match_their_choice_days', () => {
    for (const id of new Set(S.micro.map((m) => m.id))) {
      expect(S.micro.filter((m) => m.id === id).map((m) => m.day), id).toEqual(S.choices.find((c) => c.id === id)!.days);
    }
  });
  it('test_permit_and_list_contract_with_t10', () => {                             // R-02b.59 : permit.jN lève permit.request, m4.list a une option qui n'est pas un refus
    for (const d of [1, 2, 4, 5, 6, 7]) {
      const c = S.choices.find((x) => x.id === `permit.j${d}`)!;
      expect(c.options.map((o) => o.id)).toEqual(['request', 'dontAsk']);
      expect(c.options[0]!.kitEvent).toBe('permit.request'); expect(c.options[1]!.isRefusal).toBe(true);
    }
    expect(S.choices.find((c) => c.id === 'm4.list')!.options.some((o) => !o.isRefusal)).toBe(true);
  });
  it('test_exception_micro_clickables_and_relecture_triggers', () => {
    expect(S.exceptionJour?.day).toBe(7); expect(S.exceptionJourLibre?.day).toBe(3);
    expect([...new Set(S.micro.map((m) => m.id))].sort()).toEqual(['m1.scan', 'm2.nadia', 'm3.letter', 'm4.list', 'm5.yusuf']);
    expect(new Set(S.micro.filter((m) => m.traceKey !== null).map((m) => m.id)).size).toBe(3);   // m1, m2, m5
    expect(S.clickables).toHaveLength(13);
    const entries = Object.keys((W.survival as { entries: Record<string, unknown> }).entries);
    for (const ls of Object.values(S.lines.relecture)) for (const l of ls) if (l.whenEntry !== null) expect(entries, l.key).toContain(l.whenEntry);
  });
  it('test_ids_of_the_brief_for_relecture_and_list', () => {
    for (const d of [1, 2, 4, 5, 6]) expect(S.choices.find((c) => c.id === `relecture.j${d}`)!.options.map((o) => o.id)).toEqual(['flag', 'pass']);
    expect(S.choices.find((c) => c.id === 'm4.list')!.options.map((o) => o.id)).toEqual(['read', 'pass']);
    expect(S.choices.find((c) => c.id === 'checkpoint.j3')!.options.find((o) => o.id === 'refuse')!.trace).toBeNull();
  });
  it('test_every_choice_has_one_refusal_and_every_npc_line_exists_in_both_languages', () => {
    for (const c of S.choices) expect(c.options.filter((o) => o.isRefusal).length, c.id).toBe(1);
    for (const n of S.npcs) for (const k of n.lineKeys) { expect(FR[k], k).toBeTruthy(); expect(EN[k], k).toBeTruthy(); }
    for (const k of S.clickables) { expect(FR[k.responseKey], k.id).toBeTruthy(); expect(EN[k.responseKey], k.id).toBeTruthy(); }
  });
});
