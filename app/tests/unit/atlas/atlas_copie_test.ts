// @vitest-environment happy-dom
/** Atlas, relecture de copie du 14 novembre 2026 : aucun identifiant interne visible, mots de lien sans causalité, note de vérification dans un repli. */
import { afterEach, describe, expect, it } from 'vitest';
import raw from '../../../src/atlas/data.json';
import en from '../../../src/atlas/data.en.json';
import { buildAtlas, type EnglishData } from '../../../src/atlas/model';
import { LABELS } from '../../../src/atlas/labels';
import { parseAtlas } from '../../../src/atlas/schema';
import { createAtlasScreen } from '../../../src/screens/atlas';

const fr = parseAtlas(raw);
const E = buildAtlas(fr, en as unknown as EnglishData);
let current: ReturnType<typeof createAtlasScreen> | null = null;
afterEach(() => { current?.unmount(); current = null; });

const ID = /\bw\d\d\b|\bL[1-5]\b|\bT[1-7]\b|\b(?:fr|ue|int|chf)-\d\d\b/;
const FORBIDDEN = /preuve|mène à|mène vers|conduit à|inévitable|va conduire|probabilité|interactif|immersif|—|\bproof\b|leads? to|inevitable|probability|interactive|immersive/i;

function textOf(lang: 'fr' | 'en', arrival?: string): string {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  current = createAtlasScreen(lang === 'en' ? E : fr, { ...(arrival ? { arrival } : {}), lang });
  void current.mount(root);
  let all = root.textContent ?? '';
  for (const b of root.querySelectorAll<HTMLElement>('[data-open]')) {
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    all += `\n${root.querySelector('.at-sheet')?.textContent ?? ''}`;
    root.querySelector<HTMLElement>('.at-sheet-back')?.click();
  }
  return all;
}

describe('atlas copie : aucun identifiant interne affiché', () => {
  for (const lang of ['fr', 'en'] as const) {
    it(`test_displayed_text_${lang}_has_no_world_lever_theme_or_law_identifier`, () => {
      for (const arrival of [undefined, 'w03', 'w12']) expect(textOf(lang, arrival)).not.toMatch(ID);
    });
    it(`test_labels_${lang}_have_no_identifier_and_no_forbidden_wording`, () => {
      const L = LABELS[lang]!;
      const out: string[] = [];
      const walk = (o: unknown): void => {
        if (typeof o === 'string') out.push(o);
        else if (typeof o === 'function') out.push(String((o as (...a: unknown[]) => unknown)(1, 'Nom', 'Nom', 'Nom')));
        else if (o && typeof o === 'object') Object.values(o).forEach(walk);
      };
      walk(L);
      const bad = out.filter((s) => ID.test(s) || FORBIDDEN.test(s));
      expect(bad).toEqual([]);
    });
  }
  it('test_data_texts_fr_and_en_have_no_identifier_or_forbidden_wording', () => {
    const bad: string[] = [];
    const SKIP = /^themes\.\d+\.lois|(^|\.)(id|monde|theme|citation|citation_id|question_fr|question_tr|citation_ajoutee|citation_en|url|url_suivi|urls_secondes|sha256|_src|question|titre|titre_en|levier|leviers)(\.|$|\.\d+)/;
    const walk = (o: unknown, p: string): void => {
      if (typeof o === 'string') { if (!SKIP.test(p) && (ID.test(o) || FORBIDDEN.test(o))) bad.push(`${p}: ${o.slice(0, 80)}`); }
      else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${p}.${i}`));
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
    };
    walk(raw, '');
    walk(en, '');
    expect(bad).toEqual([]);
  });
});

describe('atlas copie : note de vérification', () => {
  it('test_verification_sits_in_a_closed_fold_and_not_in_the_limit', () => {
    const l = fr.lois.find((x) => x.id === 'fr-01')!;
    expect(l.verification).toContain('petite loi');
    expect(l.limite).not.toContain('petite loi');
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    current = createAtlasScreen(fr, { lang: 'fr' });
    void current.mount(root);
    root.querySelector<HTMLElement>('[data-open="fr-01"]')?.click();
    const fold = root.querySelector<HTMLDetailsElement>('.at-sheet details.at-verif');
    expect(fold?.open).toBe(false);
    expect(fold?.querySelector('summary')?.textContent).toBe('Comment on l’a vérifié');
    expect(fold?.textContent).toContain('petite loi');
    fold?.querySelector('summary')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelector<HTMLElement>('.at-sheet-back')?.hidden).toBe(false);
  });
  it('test_no_limit_is_empty_and_every_verification_has_an_english_text', () => {
    for (const l of fr.lois) {
      expect(l.limite.trim().length, l.id).toBeGreaterThan(0);
      if (l.verification) expect((E.lois.find((x) => x.id === l.id)?.en as { verification?: string } | undefined)?.verification, l.id).toBeTruthy();
    }
  });
});
