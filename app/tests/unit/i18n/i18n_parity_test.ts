import { describe, expect, it } from 'vitest';
import { checkParity, ruleFor } from '../../../src/i18n/i18n';
import type { StringMeta } from '../../../src/i18n/i18n';
import frJson from '../../../src/data/strings/fr.json';
import enJson from '../../../src/data/strings/en.json';
import metaJson from '../../../src/data/strings/meta.json';

// Préfixes de chaînes de données, couverts par leurs propres tests (`ff.` titres du journal T5, `cause.` écran des causes T10) et jugés par
// `validateContent`, une politique par clé (D141). Plan 02b : jamais `w10.` seul, `w10.kit.*` est dans `need` [R-02b.13].
const DATA_PREFIXES = [
  'ff.', 'cause.', 'w10.street.', 'w10.price.', 'w10.right.', 'w10.evening.', 'w10.msg.', 'w10.npc.', 'w10.object.', 'w10.doc.', 'w10.line.',
  'w10.card.', 'w10.bracelet.', 'w10.choice.', 'w10.name.',   // UI-C T6 : libellés des options ; T8 : noms de la puce de nom ; jugés par validateContent
  // plan 03 T2 : familles de clés dérivées des données (intitulés `q.<clé>.`, mondes, jours, bilan, sources), jugées par `validateContent` avec leur
  // politique (`bilan` et `sources` admettent des paramètres numériques) ; leur couverture exacte est épinglée par `bilan_keys_test`.
  'q.Q', 'world.', 'w10.day.', 'w10.bilan.', 'bilan.', 'redirect.', 'sources.', 'w10.sources.',
  'rights.',   // lignes de droit à source nommée [rue guidée T12] : « 1948 », « 13 », « 2026 » de `rights.source.*`, jugés par validateContent (politique `sources`)
  'w10.welcome.', 'w10.goal.', 'w10.arrive.', 'w10.seq.',   // accueil du J1 et ligne d'objectif [playtest 2026-11-03 §1 A] : « Secteur 9 », heures d'horloge, jugés par validateContent avec `meta.json`
  'w10.scene.', 'w10.chain.', 'w10.recap.', 'w10.fact.', 'w10.demo.',   // journées guidées J1-J2 [rue guidée T5] : faits sourcés (« 1 300 », « 2024 »), heures en lettres sous `allowTokens`, jugés par validateContent
  'w10.end.',   // fin de la semaine [rue guidée J3-J7 T13] : issues de l'audition, ligne d'arrestation `{jour}` (politique `bilan`), bouton « Voir ta semaine »
];

describe('i18n parity', () => {
  it('test_fr_en_same_keys_and_placeholders', () => { expect(checkParity({ fr: frJson, en: enJson })).toEqual([]); });
  it('test_parity_detects_placeholder_mismatch', () => {
    expect(checkParity({ fr: { k: 'a {x}' }, en: { k: 'a {y}' } }).map(i => i.code)).toEqual(['placeholder-mismatch']);
  });
  it('test_parity_detects_missing_key_in_either_language', () => {
    const r = checkParity({ fr: { a: 'x', b: 'y' }, en: { a: 'x', c: 'z' } });
    expect(r.map(i => `${i.code}:${i.path}:${i.file}`)).toEqual(['missing-key:b:strings/en.json', 'missing-key:c:strings/fr.json']);
  });
  it('test_parity_plural_categories_may_differ_when_other_exists', () => {
    expect(checkParity({ fr: { 'y.one': '{n}', 'y.many': '{n}', 'y.other': '{n}' }, en: { 'y.one': '{n}', 'y.other': '{n}' } })).toEqual([]);
    expect(checkParity({ fr: { 'y.one': '{n}', 'y.other': '{n}' }, en: { 'y.one': '{n}' } }).map(i => i.code)).toEqual(['missing-key']);
  });
  it('test_parity_rejects_invalid_key_and_em_dash_and_digits_in_shell', () => {
    expect(checkParity({ fr: { 'bad key': 'x' }, en: { 'bad key': 'x' } }).map(i => i.code)).toEqual(['invalid-key', 'invalid-key']);
  });
  it('test_shell_strings_have_no_digit_no_em_dash_and_declared_meta', () => {
    const meta = metaJson as StringMeta;
    for (const table of [frJson, enJson] as Record<string, string>[]) {
      for (const [k, v] of Object.entries(table)) {
        expect(v.trim(), k).not.toBe('');
        if (DATA_PREFIXES.some(p => k.startsWith(p))) continue;   // clés de données : jugées par validateContent [R-02b.13 b]
        if (k === 'app.title') expect(v).toBe('Life 3.0'); else expect(v, k).not.toMatch(/\d/); expect(v, k).not.toContain('—');
      }
    }
    expect(ruleFor(meta, 'sources.title').policy).toBe('sources');
    expect(ruleFor(meta, 'q.q01.date').allowCalendar).toBe(true);
    expect(ruleFor(meta, 'w10.day.mon').allowCalendar).toBe(true);
    expect(ruleFor(meta, 'app.title')).toEqual({ policy: 'voice', allowTokens: ['3.0'] });
    expect(meta['resume']).toEqual({ policy: 'voice' });
  });
  it('test_shell_has_every_screen_stub_and_kit_label', () => {
    const need = ['app.title', 'app.loading', 'app.error.load', 'app.error.retry', 'app.error.reload', 'app.staleTab', 'app.reload', 'lang.choose', 'lang.fr', 'lang.en', 'stub.next', 'atlas.open', 'feedback.contact', 'feedback.subject',
      ...['lang', 'warning', 'questionnaire', 'fastforward', 'causes', 'street', 'bilan', 'sources', 'atlas', 'error'].map(s => `stub.${s}`),
      ...['bracelet', 'sectorCard', 'phone', 'permitBook', 'classSheet', 'machineReceipt', 'component'].map(s => `w10.kit.${s}`),
      // interface de la rue [plan 02a T11] : clés `voice`, soumises au contrôle des chiffres ci-dessus ; une raison de refus par `RejectReason`
      ...['confirm', 'continue', 'skip', 'skipQueue', 'goTo', 'noGpu', 'bodiesMissing', 'bodyFailed', 'controls', 'sleep', 'notSaved', 'refusal.generic', 'words.unit', 'words.price.one', 'words.price.other', 'words.none', 'dossier.name', 'dossier.audition', 'dossier.hint', 'choices.opened', 'choices.closed', 'choices.milestone', 'choices.more', 'choices.moreLabel', 'carnet.folded', 'carnet.more', 'outcome.continue', 'montage.label'].map(s => `street.ui.${s}`),   // carnet : repli « Droits (N) » et reste « + N » [zones UX §4] ; bouton de l'issue de l'audition [J3-J7 T6]
      ...['welcome.label', 'welcome.next', 'welcome.skip', 'objective.label'].map(s => `street.ui.${s}`),   // accueil et ligne d'objectif [playtest 2026-11-03 §1 A]
      ...['stamp', 'said', 'names.none', 'names.and'].map(s => `street.recap.${s}`),   // relevé du soir précis [rue guidée T11] : heure `{h} h {m}`, réplique entre guillemets, et `{noms}` (personne / et) [J3-J7 T5]
      ...['title', 'continue', 'new', 'confirm', 'cancel'].map(s => `resume.${s}`),   // reprise : Continuer ou Nouvelle partie [demande Cynthia 2026-11-03]
      // écrans du plan 03 en politique `voice` : avertissement de contenu, interface du questionnaire, éditions des causes [T2]
      ...['title', 'body', 'soft.label', 'soft.hint', 'continue'].map(s => `warning.${s}`),
      ...['progress', 'pick', 'confirm', 'continue'].map(s => `q.ui.${s}`),
      ...['title', 'edition', 'final', 'replay', 'countdownStops', 'previous', 'next', 'seeBilan', 'read'].map(s => `causes.ui.${s}`),
      'street.ui.sequence.skip', ...['invalidAct', 'unknownKind', 'unknownChoice', 'unknownOption', 'choiceClosed', 'outOfOrder', 'dayGap', 'exitBlocked', 'auditionPending', 'stallClosed', 'registreClosed', 'bonsInsufficient', 'stallEmpty', 'ended', 'unknownLine', 'unavailable'].map(s => `street.ui.refusal.${s}`)];
    const shell = (t: Record<string, string>) => Object.keys(t).filter(k => !DATA_PREFIXES.some(p => k.startsWith(p))).sort();
    expect(shell(frJson)).toEqual([...need].sort());
    expect(shell(enJson)).toEqual([...need].sort());
  });
});
