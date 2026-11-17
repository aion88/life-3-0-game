/**
 * Fiche d'arrivée d'un monde, montrée avant la première situation : dix mondes, cinq champs, deux langues, textes courts.
 */
import { describe, expect, it } from 'vitest';
import { worldIds, worldIntro } from '../../../src/worlds/situations/situationState';

const FIELDS = ['monde', 'decide', 'gagne', 'cout', 'question'] as const;
/** Longest text allowed: the world's description, then the four short lines (the card must fit under the picture on a phone). */
const CEILING = { monde: 190, decide: 90, gagne: 90, cout: 100, question: 100 } as const;

describe('fiche d’arrivée des mondes', () => {
  it('test_worldIntro_everyPlayableWorld_inBothLanguages_hasTheFiveFieldsUnderTheirCeiling', () => {
    for (const lang of ['fr', 'en']) for (const id of worldIds()) {
      const intro = worldIntro(id, lang);
      expect(intro, `${id} ${lang}`).not.toBeNull();
      for (const field of FIELDS) {
        const text = intro![field];
        expect(text.trim().length, `${id} ${lang} ${field} filled`).toBeGreaterThan(0);
        expect(text.length, `${id} ${lang} ${field} under ${CEILING[field]}`).toBeLessThanOrEqual(CEILING[field]);
        expect(text, `${id} ${lang} ${field} without long dash`).not.toMatch(/[—–]/);
      }
      expect(intro!.question.trim().endsWith('?'), `${id} ${lang} question`).toBe(true);
    }
  });
  it('test_worldIntro_languages_differ_andUnknownLanguageFallsBackToFrench', () => {
    expect(worldIntro('w10', 'en')!.monde).not.toBe(worldIntro('w10', 'fr')!.monde);
    expect(worldIntro('w10', 'de')).toEqual(worldIntro('w10', 'fr'));
  });
  it('test_worldIntro_unknownWorld_returnsNull', () => {
    expect(worldIntro('w07', 'fr')).toBeNull();
    expect(worldIntro('nope', 'fr')).toBeNull();
  });
});
