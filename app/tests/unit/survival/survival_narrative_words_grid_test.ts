/**
 * B-1 : mots des choix narratifs et jauge Intégrité de w10 [spec rue guidée §11.1, amendement B-1 du 2026-11-04 ;
 * bible w10 §7.2 à §7.5]. Joue la grille de 93 312 profils de la bible sur le vrai moteur (`closeNight`).
 * Verdict et lecture : docs/superpowers/plans/reviews/2026-11-04-rue-guidee-b1-mesure.md.
 * Contre-épreuve indépendante (modèle Python de `tools/plancher/w10.py`) : mêmes nombres sur toutes les lignes.
 */
import { describe, expect, it } from 'vitest';
import { buildProfiles, metricsOf, play, playGrid, type GridMetrics, type Reading } from '../../support/narrative_words_grid';

const profiles = buildProfiles();
const base = playGrid(profiles, null);
const measure = (k: number, days: readonly number[], reading: Reading): GridMetrics =>
  metricsOf(profiles, base, k === 0 ? base : playGrid(profiles, { k, days, reading }));

describe('grille de 93 312 profils, k = 0 [bible w10 §7.5, passe 5 bis]', () => {
  it('test_narrative_words_grid_size_is_93312', () => {
    expect(profiles.length).toBe(93312);
  });

  it('test_narrative_words_grid_zero_reproduces_bible_counts', () => {
    const m = measure(0, [], 'additive');
    expect(m).toEqual({
      kindChanged: 0, endChanged: 0, palierN1: 0, palierN2: 0,
      domainReleased: 40, domainMin: 30, outArrested: 28024, at24: 1002, at25: 1346, at25released: 122, saved: 326, couples: 956,
      muet: 'arrested:5', bavard: 'arrested:4', bavardThenTwoNames: 24,
    });
  });

  it('test_narrative_words_grid_muet_named_on_day3_says_the_name_not_the_banalities', () => {
    // Muet qui nomme au J3 : 14 forcés + 8 de la phrase du nom = 22 mots, pas 30 [bible §7.3, §7.5].
    // Nuit 3 : 40 - 6 (dossier) - 3 (regards) + 2 (consigne) - ceil((60 - 22 - 20) / 5) (silence, -4) + 12 (nom) = 41.
    // Avec 30 mots (w10.py) le silence vaudrait -2 et la nuit 43 : c'est l'écart de 6 couples et 26 profils à 24.
    const r = play({ modes: ['muet', 'muet', 'muet', 'muet', 'muet', 'muet'], names: [3], permit: null }, null);
    expect(r.values.slice(0, 3)).toEqual([51, 40, 41]);
  });
});

/** [jours, lecture, k, sorte d'issue changée, issue changée (nuit comprise), palier N1, palier N2, domaine libérés,
 *  domaine min, hors domaine arrêtés, à 24, à 25, sauvés, couples, muet, bavard, bavard puis deux noms]. */
type Row = [string, Reading, number, number, number, number, number, number, number, number, number, number, number, number, string, string, number | null];
const ROWS: Row[] = [
  ['12', 'forced', 4, 692, 2627, 0, 1296, 40, 30, 27990, 1298, 1154, 348, 990, 'arrested:5', 'arrested:4', 24],
  ['12', 'forced', 8, 1652, 5603, 0, 1296, 40, 30, 27892, 1054, 1380, 388, 1088, 'arrested:5', 'arrested:4', 24],
  ['12', 'forced', 12, 2110, 7597, 0, 1296, 40, 30, 27820, 1490, 1226, 414, 1160, 'arrested:5', 'arrested:4', 24],
  ['12', 'forced', 16, 3224, 10066, 0, 14256, 40, 30, 27746, 1258, 1508, 418, 1234, 'arrested:5', 'arrested:4', 24],
  ['12', 'forced', 24, 5908, 15266, 0, 22032, 40, 30, 27568, 1422, 1216, 478, 1402, 'arrested:5', 'arrested:4', 24],
  ['12', 'forced', 25, 5908, 15266, 0, 22032, 40, 30, 27568, 1422, 1216, 478, 1402, 'arrested:5', 'arrested:4', 24],
  ['12', 'forced', 26, 11716, 26553, 27216, 37584, 40, 30, 26352, 1316, 1330, 744, 2248, 'arrested:audition', 'arrested:4', 24],
  ['12', 'additive', 1, 5766, 16262, 27216, 18144, 34, 16, 28782, 1082, 1454, 134, 362, 'arrested:5', 'arrested:4', 22],
  ['12', 'additive', 4, 9190, 31305, 27216, 41472, 26, 10, 28946, 906, 1108, 98, 200, 'arrested:5', 'arrested:4', 16],
  ['12', 'additive', 8, 14310, 50403, 54432, 54432, 6, 2, 29034, 798, 954, 40, 92, 'arrested:5', 'arrested:3', null],
  ['12', 'additive', 12, 17524, 63451, 58320, 66096, 0, 0, 29032, 546, 718, 36, 88, 'arrested:5', 'arrested:3', null],
  ['12', 'additive', 16, 19714, 70685, 62208, 82944, 0, -1, 29022, 578, 458, 34, 98, 'arrested:5', 'arrested:2', null],
  ['12', 'additive', 24, 22372, 80619, 62208, 88128, 0, -1, 28974, 350, 460, 46, 136, 'arrested:5', 'arrested:2', null],
  ['123456', 'forced', 4, 2664, 7962, 0, 1296, 40, 30, 27772, 982, 1320, 420, 1208, 'arrested:5', 'arrested:4', 24],
  ['123456', 'forced', 8, 5602, 15064, 0, 1296, 40, 30, 27524, 1106, 1576, 438, 1456, 'arrested:5', 'arrested:4', 24],
  ['123456', 'forced', 10, 5602, 15064, 0, 1296, 40, 30, 27524, 1106, 1576, 438, 1456, 'arrested:5', 'arrested:4', 24],
  ['123456', 'forced', 11, 6886, 19511, 0, 1296, 40, 30, 27356, 732, 1152, 438, 1624, 'arrested:6', 'arrested:4', 24],
  ['123456', 'forced', 12, 6886, 19511, 0, 1296, 40, 30, 27356, 732, 1152, 438, 1624, 'arrested:6', 'arrested:4', 24],
  ['123456', 'forced', 16, 8734, 23223, 0, 14256, 40, 30, 27048, 1912, 1112, 592, 1932, 'arrested:6', 'arrested:4', 24],
  ['123456', 'forced', 24, 19308, 39222, 0, 22032, 40, 30, 25280, 2344, 508, 1184, 3320, 'arrested:audition', 'arrested:4', 24],
  ['123456', 'additive', 1, 11944, 38318, 27216, 18144, 0, 0, 29116, 808, 910, 2, 4, 'arrested:5', 'arrested:4', 14],
  ['123456', 'additive', 4, 16028, 61921, 27216, 41472, 0, -1, 29120, 500, 716, 0, 0, 'arrested:5', 'arrested:4', 2],
  ['123456', 'additive', 8, 22406, 81496, 54432, 54432, 0, -1, 29120, 254, 214, 0, 0, 'arrested:5', 'arrested:3', null],
  ['123456', 'additive', 12, 23926, 87238, 58320, 66096, 0, -1, 29120, 76, 90, 0, 0, 'arrested:6', 'arrested:3', null],
  ['123456', 'additive', 16, 24232, 89144, 62208, 82944, 0, -1, 29120, 24, 46, 0, 0, 'arrested:6', 'arrested:2', null],
  ['123456', 'additive', 24, 24426, 89875, 62208, 88128, 0, -1, 29102, 86, 18, 8, 18, 'arrested:audition', 'arrested:2', null],
];

describe('B-1 : k mots narratifs par jour ajoutés à la grille', () => {
  it.each(ROWS)('test_narrative_words_grid_days_%s_%s_k%i', (days, reading, k, kind, end, n1, n2, domRel, domMin, outArr, at24, at25, saved, couples, muet, bavard, bpd) => {
    const m = measure(k, [...days].map(Number), reading);
    expect([m.kindChanged, m.endChanged, m.palierN1, m.palierN2, m.domainReleased, m.domainMin, m.outArrested, m.at24, m.at25, m.saved, m.couples, m.muet, m.bavard, m.bavardThenTwoNames])
      .toEqual([kind, end, n1, n2, domRel, domMin, outArr, at24, at25, saved, couples, muet, bavard, bpd]);
  });
});
