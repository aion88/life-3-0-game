/**
 * Droits : une ligne par moment, butoir, carnet, longueur des huit lignes [plan 02b T9 ; GDD 05 §3.3 ; bible w10 §4.5 ; R-02b.25, R-02b.51].
 * Les textes sont ceux de la bible, recopiés dans `fr.json` : les longueurs attendues ont été calculées sur eux.
 */
import { describe, expect, it } from 'vitest';
import { parseWorld } from '../../../src/data/schema/world';
import { carnet, lineHalves, lineLength, rightLineFor } from '../../../src/engine/moments/rights';
import { checkPlayerString } from '../../../src/validate/numbers';
import { RIGHT_IDS, type MomentId } from '../../../src/shared/types/street';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { allBut, ctxW10, metBefore, stateAt, withMet, withStreetRaw } from '../../support/street';

const ctx = ctxW10();
const S = ctx.street;
const FR = frJson as Record<string, string>;
const EN = enJson as Record<string, string>;

describe('droits : ligne par moment, butoir, carnet [plan 02b T9]', () => {
  it('test_contact_calendar_counts_per_day', () => { expect([1, 2, 3, 4, 5, 6, 7].map(d => S.rights.contacts.filter(c => c.day === d).length)).toEqual([3, 1, 2, 1, 0, 1, 0]); });   // V11, F6
  it('test_each_right_has_exactly_one_contact', () => { expect(S.rights.contacts.map(c => c.right).sort()).toEqual([...RIGHT_IDS].sort()); });
  it('test_one_line_per_moment_in_the_calendar', () => { const k = S.rights.contacts.map(c => `${c.day}.${c.moment}`); expect(new Set(k).size).toBe(k.length); });
  it('test_line_is_said_once_per_right', () => { expect(rightLineFor(stateAt('lever', 1), ctx)).toBe('move'); expect(rightLineFor(stateAt('lever', 1, { met: ['move'] }), ctx)).toBeNull(); });   // AC-F2
  it('test_permit_line_defers_to_next_free_moment', () => {                  // Review Focus 4
    const j1 = { lever: 'move', rueAller: 'speak', travail: 'work' } as const;
    for (const [m, r] of Object.entries(j1)) expect(rightLineFor(stateAt(m as MomentId, 1, { met: metBefore(m) }), ctx)).toBe(r);
    expect(rightLineFor(stateAt('travail', 1, { met: ['move', 'speak', 'work'], lines: { '1.travail': 'work' }, pending: ['leave'] }), ctx)).toBeNull();   // le moment du droit 8 est occupé
    expect(rightLineFor(stateAt('rueMidi', 1, { met: ['move', 'speak', 'work'], pending: ['leave'] }), ctx)).toBe('leave');
  });
  it('test_list_line_defers_after_permit', () => {
    const met = ['move', 'speak', 'work', 'leave'] as const;
    expect(rightLineFor(stateAt('rueMidi', 1, { met, lines: { '1.rueMidi': 'leave' }, pending: ['read'] }), ctx)).toBeNull();   // une ligne par moment : rueMidi est occupé
    expect(rightLineFor(stateAt('soir', 1, { met, lines: { '1.rueMidi': 'leave' }, pending: ['read'] }), ctx)).toBe('read');
  });
  it('test_butoir_forces_leave_at_j6_1400', () => {
    expect(rightLineFor(stateAt('rueAller', 6, { minute: 839, met: allBut('leave') }), ctx)).toBeNull(); expect(rightLineFor(stateAt('rueAller', 6, { minute: 840, met: allBut('leave') }), ctx)).toBe('leave');   // 14 h au plus tard [bible w10 §4.5]
  });
  it('test_carnet_lists_met_rights_in_order_and_nothing_else', () => { expect(carnet(withMet(['move', 'speak']))).toEqual(['move', 'speak']); expect(carnet(withMet([]))).toEqual([]); });
  it('test_rl2_lengths_of_the_eight_lines', () => {                           // [calculé à la main, vérifié par script : 8 lignes sur 8 passent, égalité pour les droits 2, 7 et 8]
    const got = RIGHT_IDS.map(r => lineLength(FR[`w10.right.${r}`]!));
    expect(got.map(g => [g.first, g.second])).toEqual([[10, 8], [12, 12], [11, 9], [17, 14], [13, 11], [16, 14], [15, 15], [14, 14]]);   // ordre de RIGHT_IDS : move, leave, stay, speak, read, assemble, privacy, work
    for (const g of got) expect(g.second).toBeLessThanOrEqual(g.first);
  });
  it('test_rl2_forbidden_words_absent_from_second_half', () => { for (const r of RIGHT_IDS) expect(lineHalves(FR[`w10.right.${r}`]!).second).not.toMatch(/(?<![\p{L}])(mais|déjà|encore|perdu|avant)(?![\p{L}])/iu); });
  it('test_right_lines_pass_voice_policy', () => { for (const r of RIGHT_IDS) expect(checkPlayerString(FR[`w10.right.${r}`]!, 'fr', { policy: 'voice' }, ctx.world.forbiddenWords)).toEqual([]); });   // D141 : « En 2026 » admis

  // Ajouts du lot, hors brief : ce que le brief laisse sans test.
  it('test_conditional_right_is_silent_until_armed', () => {
    expect(rightLineFor(stateAt('rueMidi', 1, { met: ['move', 'speak', 'work'] }), ctx)).toBeNull();                 // ni permis demandé ni liste lue : rien
    expect(rightLineFor(stateAt('rueMidi', 1, { met: ['move', 'speak', 'work', 'leave'], pending: ['leave'] }), ctx)).toBeNull();   // armé mais déjà rencontré
  });
  it('test_missed_right_is_said_at_first_free_moment_after_its_date', () => {
    expect(rightLineFor(stateAt('lever', 2, { met: ['move', 'speak'] }), ctx)).toBe('privacy');       // le contact daté du moment passe avant le rattrapage
    expect(rightLineFor(stateAt('rueAller', 2, { met: ['move', 'speak', 'privacy'] }), ctx)).toBe('work');   // J1 travail manqué : dit au premier moment libre du J2
    expect(rightLineFor(stateAt('travail', 1, { met: ['move'] }), ctx)).toBe('work');                  // moment daté d'abord
    expect(rightLineFor(stateAt('rueMidi', 1, { met: ['move'] }), ctx)).toBe('speak');                 // J1 rueAller passé, non rencontré : rattrapé
    expect(rightLineFor(stateAt('lever', 2, { lines: { '2.lever': 'work' }, met: ['move', 'speak'] }), ctx)).toBeNull();   // moment occupé
  });
  it('test_rights_block_is_strict_and_texts_exist_in_both_languages', () => {
    const base = { contacts: S.rights.contacts };
    expect(() => parseWorld(withStreetRaw(w10Raw, { rights: { ...base, extra: 1 } }), cat)).toThrow(/street\.rights\.extra/);
    expect(() => parseWorld(withStreetRaw(w10Raw, { rights: { contacts: [{ ...base.contacts[0], x: 1 }] } }), cat)).toThrow(/street\.rights\.contacts\[0\]\.x/);
    expect(() => parseWorld(withStreetRaw(w10Raw, { rights: { contacts: [base.contacts[0], base.contacts[0]] } }), cat)).toThrow(/droit en double/);
    for (const r of RIGHT_IDS) { expect(FR[`w10.right.${r}`], r).toMatch(/^Ici, .* En 2026, c'est écrit : /); expect(EN[`w10.right.${r}`], r).toMatch(/^Here, .* In 2026, it is written: /); }
  });
});
