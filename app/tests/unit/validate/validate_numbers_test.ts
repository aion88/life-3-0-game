import { describe, expect, it } from 'vitest';
import { checkPlayerString } from '../../../src/validate/numbers';
import type { StringRule } from '../../../src/i18n/i18n';

const voice: StringRule = { policy: 'voice' }; const inventory: StringRule = { policy: 'inventory' }; const dated: StringRule = { policy: 'voice', allowCalendar: true };
const w10Forbidden = ['intégrité', 'integrity'];

describe('validate numbers', () => {
  it('test_dossier_bar_strings_pass_voice_and_the_gauge_name_stays_forbidden', () => {
    // barre « Dossier », décision Cynthia, playtest 2026-11-03 : ses textes passent sous `voice`, le nom de la jauge reste refusé
    for (const t of ['Dossier', 'audition']) expect(checkPlayerString(t, 'fr', voice, w10Forbidden)).toEqual([]);
    for (const t of ['File', 'hearing']) expect(checkPlayerString(t, 'en', voice, w10Forbidden)).toEqual([]);
    expect(checkPlayerString('Intégrité', 'fr', voice, w10Forbidden).map(v => v.code)).toEqual(['gaugeWord']);
  });
  it('test_bible_cards_pass_inventory_policy', () => {
    expect(checkPlayerString("Elle s'appelle Nadia. Elle avait un cabinet de traduction. Depuis 2028 elle vend des bons de parole. Il lui en reste 40 aujourd'hui.", 'fr', inventory, w10Forbidden)).toEqual([]);
    expect(checkPlayerString('Il s\'appelle Dario. Il livrait des repas à vélo. Depuis 2028 il livre des convocations, 212 cette année. Il n\'en ouvre aucune.', 'fr', inventory, [])).toEqual([]);
    expect(checkPlayerString("Il s'appelle Théodore. Il a quatre-vingt-un ans. Sa machine à écrire est enregistrée au nom de sa femme, morte en 2028.", 'fr', inventory, [])).toEqual([]); // âge
    expect(checkPlayerString("Il a vingt-deux élèves. Il lui en reste 40.", 'fr', inventory, []).map(v => v.code)).toEqual(['inventoryCountExceeded']);
    expect(checkPlayerString('Elle vend 40 bons et en a perdu 12.', 'fr', inventory, []).map(v => v.code)).toEqual(['inventoryCountExceeded']); // un nombre au plus, politique fusionnée [D141]
  });
  it('test_voice_refuses_counts_and_words', () => {
    expect(checkPlayerString("Il lui en reste 40 aujourd'hui.", 'fr', voice, []).map(v => v.code)).toEqual(['digit']);
    expect(checkPlayerString('vingt mots restants', 'fr', voice, []).map(v => v.token)).toEqual(['vingt']);   // D141 : un seuil en lettres échoue sous voice
    expect(checkPlayerString('un sur quatre', 'fr', voice, []).map(v => v.token)).toEqual(['un', 'quatre']);   // « un » compte dans un motif de proportion [D141]
    expect(checkPlayerString('one in four', 'en', voice, []).map(v => v.token)).toEqual(['one', 'four']);
    expect(checkPlayerString('Gatekeeper (31,6 %)', 'fr', voice, []).map(v => v.code)).toContain('percent');
    expect(checkPlayerString('Ton Intégrité baisse.', 'fr', voice, w10Forbidden).map(v => v.code)).toEqual(['gaugeWord']);
    expect(checkPlayerString('Ton Intégrité baisse.', 'fr', voice, w10Forbidden).map(v => v.code)).toEqual(['gaugeWord']); // NFC
    expect(checkPlayerString('un quart des lignes, la moitié du quartier', 'fr', voice, []).map(v => v.token)).toEqual(['quart', 'moitié']);
    expect(checkPlayerString('twice a dozen', 'en', voice, []).map(v => v.token)).toEqual(['twice', 'dozen']);
  });
  it('test_voice_admits_years_and_clock_hours_only', () => {                                              // D141
    for (const s of ['Le créneau de 8 h 30 est perdu.', "L'agent passe à 10 h.", 'À 17 h 30, le réseau est tombé.', "En 2026, c'est écrit :"]) expect(checkPlayerString(s, 'fr', voice, [])).toEqual([]);
    for (const s of ['at 2:30 p.m.', 'The agent comes at 10:00.', 'In 2026, it is written:']) expect(checkPlayerString(s, 'en', voice, [])).toEqual([]);
    for (const s of ['lundi 4 mars', 'Le 4 mars', 'Taux 12 %', 'Il a 31 ans.']) expect(checkPlayerString(s, 'fr', voice, [])).not.toEqual([]);
    for (const s of ['Monday, March 4', 'On March 4th', '12 percent']) expect(checkPlayerString(s, 'en', voice, [])).not.toEqual([]);
  });
  it('test_voice_refuses_day_month_dates_unless_declared', () => {
    expect(checkPlayerString('lundi 4 mars', 'fr', dated, [])).toEqual([]); expect(checkPlayerString('Monday, March 4', 'en', dated, [])).toEqual([]);
  });
  it('test_articles_are_not_quantities', () => {                                                           // D141
    for (const s of ['un chat, une porte', "J'ai vu un homme et une femme."]) expect(checkPlayerString(s, 'fr', voice, [])).toEqual([]);
    for (const s of ['a door, an hour', 'one door stays shut', 'She keeps a notebook.']) expect(checkPlayerString(s, 'en', voice, [])).toEqual([]);
    expect(checkPlayerString('une sur trois', 'fr', voice, []).map(v => v.token)).toEqual(['une', 'trois']);
    expect(checkPlayerString('a dozen doors', 'en', voice, []).map(v => v.token)).toEqual(['dozen']);
  });
  it('test_named_exception_allows_bible_witness_count', () => {
    expect(checkPlayerString('Tu as donné deux noms. Ils n\'ont plus besoin de toi.', 'fr', { policy: 'voice', allowTokens: ['deux'] }, [])).toEqual([]);
  });
  it('test_regime_document_and_sources', () => {
    expect(checkPlayerString('Secteur 9, escalier 9-D, 7 h 10, âge 47.', 'fr', { policy: 'regimeDocument' }, w10Forbidden)).toEqual([]);
    expect(checkPlayerString('Taux 12 %', 'fr', { policy: 'regimeDocument' }, []).map(v => v.code)).toEqual(['percent']);
    expect(checkPlayerString('31,6 %, une partie sur 917', 'fr', { policy: 'sources' }, [])).toEqual([]);
  });
});
