/**
 * Intégration : les treize profils de l'oracle du plan 01 rejoués par les actes, la nuit 1 selon les mots, le J1 en quatorze écrans,
 * la reprise après rechargement [plan 02b T15 ; GDD 05 §3.4, §3.7 ; bible w10 §7.1, §7.3 ; R-02b.35 à R-02b.37].
 * La pureté du dossier est portée par la config eslint (R-02b.4), pas ici.
 */
import { describe, expect, it } from 'vitest';
import { buildLedger } from '../../../src/engine/moments/words';
import { replay } from '../../../src/engine/moments/replay';
import { knownActKinds } from '../../../src/engine/moments/verbs';
import { createSaveStore } from '../../../src/save/save';
import { isValidAct } from '../../../src/shared/acts';
import { canonicalJson } from '../../../src/shared/canonical';
import fr from '../../../src/data/strings/fr.json';
import { memStorage } from '../../fixtures/save/factories';
import { actsOfProfile, night1, walkJ1 } from '../../support/profile_acts';
import { act, ctxW10, endIdOf, SCRIPT_J1_J2 } from '../../support/street';
import { oracle } from '../../support/survival';

const ctx = ctxW10();
const FR = fr as unknown as Record<string, string>;
const PROFILES = Object.keys(oracle('survival').profiles);
const D134 = Object.entries(oracle('survival').d134).filter(([, o]) => o.found === null || o.found === 2).map(([n]) => n);   // le #7 trouvé plus tard n'est pas rejoué

describe('moments : intégration [plan 02b T15]', () => {
  it('test_the_thirteen_profiles_are_the_oracle_ones', () => { expect(PROFILES).toHaveLength(13); });

  it.each(PROFILES)('test_profile_through_acts_%s', (name) => {                    // les 13 profils de l'oracle du plan 01, rejoués par les actes
    const o = oracle('survival').profiles[name]!;
    const r = replay(actsOfProfile(name, { audition: 'silence' }), ctx);
    expect(r.rejected).toEqual([]);
    expect(r.state.readings.slice(0, o.nights.length).map((x) => x.value / 1000)).toEqual(o.nights);
    expect(endIdOf(r.state)).toBe(o.end);
    if (!o.end.startsWith('arrested:') || o.end === 'arrested:audition') {          // pas d'arrestation de nuit : sept relevés, le 7e sans effet [R-02b.36]
      expect(r.state.readings).toHaveLength(7);
      expect(r.state.readings[6]!.value).toBe(r.state.readings[5]!.value);
    } else expect(r.state.readings).toHaveLength(o.nights.length);
  });

  it.each(D134)('test_d134_through_acts_%s', (name) => {                           // permis, #7 laissé visible au J2, absences au Registre [D134]
    const o = oracle('survival').d134[name]!;
    const r = replay(actsOfProfile(name, { audition: 'silence' }), ctx);
    expect(r.rejected).toEqual([]);
    expect(r.state.readings.slice(0, o.nights.length).map((x) => x.value / 1000)).toEqual(o.nights);
    expect(endIdOf(r.state)).toBe(o.end);
  });

  it.each([[60, 63, 'courtesy'], [61, 56, 'thanks'], [70, 47, 'thanks'], [77, 40, 'thanks'], [78, 39, 'patience'], [92, 25, 'patience'], [93, 24, 'appointment'], [40, 63, 'courtesy'], [39, 56, 'thanks'], [15, 52, 'thanks'], [14, 51, 'thanks']] as const)(
    'test_night1_spent_%i_gives_%i', (spent, value, palier) => {                    // N1 = 57 - d au-delà de 60 ; silence -⌈(r-20)/5⌉ [GDD 05 §3.7 écran 14, calculé à la main]
      const r = replay(night1(spent), ctx);
      expect(r.rejected).toEqual([]);
      expect([r.state.readings[0]!.value / 1000, r.state.readings[0]!.palier]).toEqual([value, palier]);
    });
  it('test_night1_nothing_spent_reads_49', () => {                                  // 60 restent, silence -8 [bible w10 §7.3]
    const r = replay(night1(0, { bypass: true }), ctx);
    expect(r.rejected).toEqual([]);
    expect(r.state.readings[0]!.value).toBe(49_000);
  });
  it('test_a_paid_refusal_costs_its_words', () => {                                // « banalités » : 8 mots, 0 de jauge [GDD 05 §3.4 ; bible w10 §7.5 « Muet »]
    const banal = buildLedger(3, [act(3, 790, 'choice', 'j3.marlene', 'banal')], ctx);
    expect([banal.wordsSpent, banal.wordsCredited]).toEqual([8, 0]);
    expect(buildLedger(3, [act(3, 790, 'choice', 'j3.marlene', 'name')], ctx).wordsSpent).toBe(8);
    expect(buildLedger(4, [act(4, 790, 'choice', 'j4.neighbour', 'silent')], ctx).wordsSpent).toBe(0);
  });
  it('test_bracelet_messages_by_palier', () => {                              // [bible w10 §7.1]
    expect(['courtesy', 'thanks', 'patience', 'appointment'].map((p) => FR[`w10.msg.${p}`]))
      .toEqual(['Merci de votre courtoisie.', 'Merci.', 'Merci de votre patience.', 'Un rendez-vous vous attend.']);
  });

  it('test_j1_fourteen_screens', () => {                                            // GDD 05 §3.7, écrans 1 à 14, un pas chacun
    const t = walkJ1(ctx);
    expect(t.map((x) => x.moment)).toEqual(['lever', 'lever', 'lever', 'lever', 'rueAller', 'rueAller', 'rueAller', 'rueAller', 'rueAller', 'travail', 'rueMidi', 'soir', 'nuit', 'lever']);
    expect(t[0]!.bracelet).toBe(60); expect(t[1]!.rightLine).toBe('move'); expect(t[7]!.rightLine).toBe('speak'); expect(t[9]!.rightLine).toBe('work');
    expect(t[8]!.lanes).toEqual(['comply', 'buy', 'bypass', 'courtesy']); expect(t[3]!.clockMinute).toBe(430);
    expect(t[4]!.clockMinute).toBe(430);                                           // la marche ne fait pas avancer l'horloge
    expect(t[12]!.bracelet).toBe(46); expect(t[13]!.palier).toBe('thanks');         // 46 restent, 51 au matin
  });

  it('test_resume_after_reload_gives_the_same_state', () => {                      // reprise [plan 00, Sauvegarde ; GDD 05 §3.4]
    const st = memStorage();
    const a = createSaveStore(st, 'h', () => true, { isValidAct, known: knownActKinds() });
    for (const x of SCRIPT_J1_J2) a.appendAct(x);
    const b = createSaveStore(st, 'h', () => true, { isValidAct, known: knownActKinds() }).load().data.acts;
    expect(b).toHaveLength(SCRIPT_J1_J2.length);
    expect(canonicalJson(replay(b, ctx).state)).toBe(canonicalJson(replay(SCRIPT_J1_J2, ctx).state));
  });
});
