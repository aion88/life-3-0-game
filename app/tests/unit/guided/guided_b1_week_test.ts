/**
 * B-1 remesuré sur la semaine guidée de w10 [plan rue guidée J3-J7, T14 ; conception 2026-11-05 §6 ; bible w10 §7.5].
 * Mesure : (1) les sommes de §6 chemin par chemin, sur le vrai moteur ; (2) les trois modes atteints chaque jour (preuve) ;
 * (3) la matrice mode x nom des jours à offre ; (4) l'Intégrité nuit par nuit des semaines types, contre la grille.
 * Document : docs/superpowers/plans/reviews/2026-11-05-rue-guidee-j3-j7-b1-mesure.md.
 * Chemins joués par le metteur en scène (aide de T11, ruling T14) et non par `pathOf`, qui refuse le préfixe couloir complet.
 */
import { describe, expect, it } from 'vitest';
import { parseWorld } from '../../../src/data/schema/world';
import { proveGuided, refOf } from '../../../src/validate/guided';
import { buildLedger } from '../../../src/engine/moments/words';
import { replay } from '../../../src/engine/moments/replay';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import { cat, realInput, w10Raw } from '../../fixtures/data/factories';
import { ctxW10 } from '../../support/street';
import { play } from '../../support/narrative_words_grid';
import { DAY_PICKS, EXPECTED, playOf, stateAfter, weekOf, withNames, type Picks } from '../../support/guided';
import type { SpeechModeId } from '../../../src/data/schema/guided';

const MODES: readonly SpeechModeId[] = ['muet', 'couloir', 'bavard'];
const loadW10 = () => parseWorld(w10Raw, cat);

/** Mots dits le jour `day` (`buildLedger(...).wordsSpent`), aide locale de T11. */
const wordsOfDayFor = (day: number, picks: Picks): number => buildLedger(day as DayIndex, playOf(picks).acts, ctxW10()).wordsSpent;

/** Joue la semaine : Intégrité nuit par nuit, issue (temps `outcome` ou fin anticipée). */
function playWeek(picks: Picks) {
  const { acts, seen } = playOf(picks);
  const st = stateAfter(acts, ctxW10());
  const nights = st.readings.map((x) => x.value / 1000);
  const o = seen.find((b) => b.kind === 'outcome');
  const e = seen.find((b) => b.kind === 'end');
  const ended = o !== undefined && o.kind === 'outcome' ? { endId: o.endId, names: o.names }
    : e !== undefined && e.kind === 'end' ? { endId: e.early ? 'arrestedNight' : 'end', endedDay: e.endedDay } : null;
  const spent = [1, 2, 3, 4, 5, 6, 7].map((d) => buildLedger(d as DayIndex, acts, ctxW10()).wordsSpent);
  return { nights, ended, spent };
}

/** Semaines types : guidée contre grille (même mode toutes les nuits, mêmes jours de nom, aucun permis). */
function nightsOf(modes: readonly SpeechModeId[]) {
  const out: Record<string, unknown> = {};
  for (const m of modes) {
    for (const names of [[], [3], [4, 5]] as const) {
      const w = playWeek(weekOf(m, { names }));
      const g = play({ modes: [m, m, m, m, m, m], names: [...names], permit: null }, null);
      out[`${m} noms=[${names.join(',')}]`] = { guided: w.nights, guidedEnd: w.ended, spent: w.spent, grid: g.values, gridEnd: g.end };
    }
  }
  return out;
}

describe('B-1 sur la semaine guidée (T14)', { timeout: 300_000 }, () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('test_day_%i_hand_sums', (d) => {
    expect(MODES.map((m) => wordsOfDayFor(d, DAY_PICKS[d]![m]))).toEqual(EXPECTED[d]);
  });

  it('test_each_day_reaches_three_modes', () => {
    const r = proveGuided(loadW10().street, { throughDay: 7, mustOpen: [] }, refOf(realInput()));
    expect(r.proof.modes).toEqual(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, ['muet', 'couloir', 'bavard']])));
  });

  /** Matrice mode x nom, re-dérivée à la main (document §2) : [couloir nomme, couloir ne nomme pas, bavard nomme, bavard ne nomme pas]. */
  const MATRIX: Readonly<Record<3 | 4 | 5, readonly [number, number, number, number]>> = {
    3: [43, 43, 71, 71],   // l'offre du J3 coûte 8 mots, nom ou banalités
    4: [52, 44, 80, 72],   // nom 8 ; refus 0
    5: [52, 44, 78, 70],   // nom 8 ; refus 0
  };
  it.each([3, 4, 5] as const)('test_offer_day_%i_reaches_couloir_and_bavard_with_and_without_name', (d) => {
    const modes = loadW10().street.guided!.speechModes[d]!;
    const at = (m: 'couloir' | 'bavard', named: boolean) => wordsOfDayFor(d, withNames(DAY_PICKS[d]![m], named ? [d] : []));
    const got = [at('couloir', true), at('couloir', false), at('bavard', true), at('bavard', false)];
    expect(got).toEqual(MATRIX[d]);
    for (const w of got.slice(0, 2)) { expect(w).toBeGreaterThanOrEqual(modes.couloir[0]); expect(w).toBeLessThanOrEqual(modes.couloir[1]); }
    for (const w of got.slice(2)) expect(w).toBeGreaterThanOrEqual(modes.bavard);
  });

  /**
   * Semaines types BLOQUANTES (ruling T14 sur la portée de la preuve). Valeurs : bible §7.5 ou calcul à la main terme par terme
   * (document §3) : dossier -2n, regards -3 (plancher, aucun regard), consigne +2 (N8, voie à la file), mots (dépassement -1 par mot ;
   * reste contre la base : silence au-delà de 20, sommeil +6 si reste <= 20 sans dépassement), entrées des offres (refus J4 -5, J5 -2 et -2
   * reportés à la nuit 6 ; nom +12).
   */
  const nights6 = (picks: Picks) => { const w = playWeek(picks); return { nights: w.nights.slice(0, 6), ended: w.ended }; };
  it('test_couloir_week_is_released', () => {   // bible §7.5 : 63, 64, 63, 55, 48, 39, libéré
    expect(nights6(weekOf('couloir', { names: [] }))).toEqual({ nights: [63, 64, 63, 55, 48, 39], ended: { endId: 'released', names: 0 } });
  });
  it('test_couloir_one_name_week_is_released', () => {   // nom J3 : +12, 43 mots (reste 17 contre la base 60, sommeil payé)
    expect(nights6(weekOf('couloir', { names: [3] }))).toEqual({ nights: [63, 64, 75, 67, 60, 51], ended: { endId: 'released', names: 1 } });
  });
  it('test_couloir_one_name_j5_marlene_is_54_and_berenice_55_on_night_6', () => {   // gd-m6, décision A : le -1 de Marlène à la nuit 6 est voulu, aucune donnée touchée ; libérés tous les deux
    const who = (name: string) => nights6({ ...weekOf('couloir', { names: [5] }), 'j5.who': name });
    const marlene = who('marlene'); const berenice = who('berenice');
    expect(marlene.nights[5]).toBe(54); expect(berenice.nights[5]).toBe(55);
    expect(marlene.ended).toEqual({ endId: 'released', names: 1 }); expect(berenice.ended).toEqual({ endId: 'released', names: 1 });
  });
  it('test_couloir_two_names_week_is_recruited', () => {   // noms J4 et J5 : +12 chacun, ni refus J4 (-5) ni J5 (-2, -2 reportés)
    expect(nights6(weekOf('couloir', { names: [4, 5] }))).toEqual({ nights: [63, 64, 63, 72, 79, 72], ended: { endId: 'recruited', names: 2 } });
  });
  it('test_muet_week_is_arrested_night_5', () => {   // bible §7.5 : 51, 40, 29, 9, 0 ; silence -6, -6, -4 (J3, 22 mots), -6, -6
    expect(nights6(weekOf('muet', { names: [] }))).toEqual({ nights: [51, 40, 29, 9, 0], ended: { endId: 'arrestedNight', endedDay: 5 } });
  });
  it('test_bavard_week_is_arrested_night_4', () => {   // bible §7.5 : 47, 32, 15, 0 ; guidé 14 à la nuit 3 : 71 mots au J3, 1 de plus que 70
    expect(nights6(weekOf('bavard', { names: [] }))).toEqual({ nights: [47, 32, 14, 0], ended: { endId: 'arrestedNight', endedDay: 4 } });
  });

  /**
   * B1b remesuré (ruling : `buy:bons` = 3 mots dits forcés + `price` mots donnés en bons). Couloir du domaine, J1 : 8 mots achetés chez
   * Nadia juste avant le contrôle, voie `buy:bons` (porte ouverte, prix 8) au lieu de `comply`. À la main : relevé du J1 = 8 + 26 + 3 + 8 = 45
   * mots (`buildLedger` n'en voit que 37 : le prix passe par `dayExtra`), achetés 8, reste contre la base 15, sommeil +6 ; pas de file, donc
   * pas de consigne ; la voie `buy` pose `bribe` (-4) et, si le tirage de `checkpoint.informant` (1 sur 4) tombe, `informant` (-6) : tombé ici.
   * Nuit 1 = 60 - 2 - 3 + 0 + 6 - 4 - 6 = 51, soit 12 de moins que `comply` (63) ; les jours suivants sont identiques, l'écart reste 12 :
   * 51, 52, 51, 43, 36, 27, libéré (27 >= 24,5). Sans l'indicateur : 57 à la nuit 1, 33 à la nuit 6.
   */
  it('test_buy_bons_on_the_week', () => {
    const { acts } = playOf(weekOf('couloir', { names: [] }));
    const i = acts.findIndex((a) => a.day === 1 && a.kind === 'lane' && a.id === 'checkpoint');
    const lane = acts[i]!;
    const injected: ActRecord[] = [...acts.slice(0, i), { ...lane, kind: 'buyWords', id: 'nadia', option: '8' }, { ...lane, option: 'buy:bons' }, ...acts.slice(i + 1)];
    const r = replay(injected, ctxW10());
    expect(r.rejected.filter((x) => x.reason !== 'ended')).toEqual([]);
    const j1 = r.state.ledgers.find((l) => l.day === 1)!;
    expect([buildLedger(1, injected, ctxW10()).wordsSpent, j1.wordsSpent, j1.wordsBought, r.state.bons]).toEqual([37, 45, 8, 0]);
    expect(j1.entries.map((e) => e.source)).toEqual(['bribe', 'informant', 'relecture.flag']);   // tirage de l'indicateur (1 sur 4) : tombé sur ce chemin
    expect(r.state.readings.slice(0, 6).map((x) => x.value / 1000)).toEqual([51, 52, 51, 43, 36, 27]);
    expect(r.state.ended?.endId).toBe('released');
  });

  it('test_archetype_nights_are_recorded', () => {   // NON bloquant : toutes les semaines types, guidé contre grille (document §3)
    expect(nightsOf(['muet', 'couloir', 'bavard'])).toMatchSnapshot();
  });
});
