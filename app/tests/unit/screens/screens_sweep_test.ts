// @vitest-environment happy-dom
/**
 * Balayages transverses des sept écrans [plan 03 T15] : tout texte vient d'une clé, aucun chiffre hors année, les deux langues
 * demandent les mêmes clés. Les écrans ont chacun leurs tests ; ici, ce que seul le registre complet peut dire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../../../src/app/shell';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import { SCREEN_IDS, YEAR_SELECTOR, sweepScreens, type SweepId } from '../../support/screens_sweep';
import { pseudoI18n, realI18n, visibleTexts } from '../../support/street_ui';
import { questionTexts, questionTextProblems } from '../../support/question_text';

// These contracts belong to the retained bilingual seven-day edition.
beforeEach(() => history.replaceState(null, '', '?episode=semaine'));
afterEach(() => { vi.restoreAllMocks(); });

const LANGS = ['fr', 'en'] as const;
/** Texte d'une clé enveloppée par `pseudoI18n` : `[!!` … `!!]`, imbriqué quand un paramètre est lui-même une clé. */
const INNERMOST = /\[!!(?:(?!\[!!|!!\]).)*!!\]/gs;
function stripKeys(text: string): string {
  let out = text;
  for (let prev = ''; prev !== out;) { prev = out; out = out.replace(INNERMOST, ''); }
  return out;
}
/** Seuls `bilan` et `sources` ont le droit de montrer un chiffre à côté d'une clé (politique de chiffres `bilan`, `sources`) : pourcentages et années. */
const NUMBER_SCREENS: readonly SweepId[] = ['bilan', 'sources'];
const YEAR = /\b(?:19|20)\d\d\b/g;
const DATES = (lang: 'fr' | 'en'): Set<string> => new Set(Object.entries(({ fr, en } as Record<string, Record<string, string>>)[lang]!).filter(([k]) => /^q\.Q\d+\.date$/.test(k)).map(([, v]) => v));

/** Inline source buttons split a translated sentence into nodes. Restore that sentence for
 * the legacy key/number policy; optional reference metadata and the bilingual onboarding
 * are covered separately by question_help_test and warning_screen_test. */
function legacyTexts(root:HTMLElement):string[]{
 const copy=root.cloneNode(true) as HTMLElement;
 copy.querySelectorAll('.q-source-sticker,.play-flow').forEach(el=>el.remove());
 copy.querySelectorAll('[data-testid="q-scene"]').forEach(el=>el.replaceChildren(document.createTextNode(el.textContent??'')));
 return visibleTexts(copy,YEAR_SELECTOR);
}

describe('balayage des textes', () => {
  it.each(LANGS)('test_every_screen_text_node_is_an_i18n_key (%s)', async (lang) => {
    const seen = new Map<SweepId, number>();
    const bad: string[] = [];
    await sweepScreens(pseudoI18n(lang), lang, SCREEN_IDS, (id) => (state, root) => {
      for (const text of legacyTexts(root)) {
        seen.set(id, (seen.get(id) ?? 0) + 1);
        // une fois les clés retirées, il ne reste que des séparateurs : rien n'est écrit en dur
        let rest = stripKeys(text);
        // Trou nommé : sur `bilan` et `sources` toute suite de chiffres est retirée, et le balayage « aucun chiffre » ci-dessous exclut ces deux
        // écrans. Un nombre écrit en dur dans l'un d'eux n'est donc vu par aucun balayage ; toléré par la politique de chiffres `bilan`/`sources`
        // (pourcentages, années), suivi dans open-items.md (lead-programmer).
        if (NUMBER_SCREENS.includes(id)) rest = rest.replace(/\d+(?:[.,]\d+)?\s*%?/g, '');
        rest = rest.replace(/[\s·.,;:!?()«»'’"–—/-]+/g, '');
        if (rest !== '') bad.push(`${id} / ${state} : « ${text.slice(0, 80)} »`);
      }
    });
    expect([...seen.keys()].sort()).toEqual([...SCREEN_IDS].sort());
    expect([...new Set(bad)]).toEqual([]);
  });

  it.each(LANGS)('test_visible_text_sweep_fr_en : aucun chiffre hors année (%s)', async (lang) => {
    const i18n = realI18n(lang);
    // Le titre canon de Q18 est un lieu et une date, chaîne fermée de T2 ; point ouvert writer (rapport T4).
    const canonDate = i18n.t('q.Q18.title');
    const bad: string[] = [];
    const ids: readonly SweepId[] = ['lang', 'warning', 'questionnaire', 'fastforward', 'causes'];
    await sweepScreens(i18n, lang, ids, (id) => (state, root) => {
      const qTexts = questionTexts(lang);
      for (const text of legacyTexts(root)) {
        // Scène, libellé, coût : leurs chiffres sont des jetons nommés par clé dans meta.json, contrôlés par leur politique (support/question_text).
        const qKey = qTexts.get(text);
        if (qKey !== undefined) { for (const p of questionTextProblems(text, lang, qKey)) bad.push(`${id} / ${state} : ${p}`); continue; }
        // La date de la question (`q.<Q>.date`, spec C §3.1) porte un jour et une année : seul ce texte exact est exempté du contrôle de chiffre.
        const bare = [...DATES(lang)].reduce((t, d) => t.replace(d, ''), text.replace(canonDate, '')).replace(YEAR, '');
        if (/\d/.test(bare)) bad.push(`${id} / ${state} : « ${text.slice(0, 80)} »`);
      }
    });
    expect([...new Set(bad)]).toEqual([]);
  });
});

describe('parité des deux langues', () => {
  it('test_fr_en_parity_of_screen_ids : chaque écran demande les mêmes clés en français et en anglais', async () => {
    const keysOf = async (lang: 'fr' | 'en'): Promise<Map<SweepId, string[]>> => {
      const base = pseudoI18n(lang);
      const asked = new Map<SweepId, Set<string>>();
      let current: SweepId | null = null;
      const recording: AppContext['i18n'] = { ...base, t: (k, p) => { if (current) (asked.get(current) ?? asked.set(current, new Set()).get(current)!).add(k); return base.t(k, p); } };
      for (const id of SCREEN_IDS) {
        current = id;
        await sweepScreens(recording, lang, [id], () => () => undefined);
      }
      return new Map([...asked].map(([id, set]) => [id, [...set].sort()]));
    };
    const fr = await keysOf('fr');
    const en = await keysOf('en');
    expect([...fr.keys()].sort()).toEqual([...SCREEN_IDS].sort());
    for (const id of SCREEN_IDS) expect(en.get(id), id).toEqual(fr.get(id));
  });
});
