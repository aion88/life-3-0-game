// @vitest-environment happy-dom
/** Atlas, version anglaise : chaque entrée affichée a son texte anglais (fichier à part), parité des clés, mêmes interdits, rien de français hors citations. */
import { afterEach, describe, expect, it } from 'vitest';
import raw from '../../../src/atlas/data.json';
import en from '../../../src/atlas/data.en.json';
import { fingerprint, frenchFor, leafPaths } from '../../../src/atlas/enSource';
import { anneeDe, buildAtlas, formatDate, jaugeLisible, bigValue, type EnglishData } from '../../../src/atlas/model';
import { FR, LABELS, labelsFor } from '../../../src/atlas/labels';
import { parseAtlas } from '../../../src/atlas/schema';
import { createAtlasScreen } from '../../../src/screens/atlas';

const fr = parseAtlas(raw);
const tr = en as unknown as EnglishData;
const E = buildAtlas(fr, tr);
const present = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
let current: ReturnType<typeof createAtlasScreen> | null = null;
afterEach(() => { current?.unmount(); current = null; });

describe('atlas en : parité du fichier anglais avec les registres', () => {
  it('test_every_law_has_its_english_text_for_each_displayed_field', () => {
    const FIELDS = ['titre_court', 'stade_label', 'stade_note', 'phrase', 'limite', 'nature', 'procedure', 'experimentation', 'entree_en_vigueur', 'application', 'raison_sans_levier', 'sans_lien'] as const;
    const miss: string[] = [];
    for (const l of fr.lois) {
      const t = tr.lois[l.id] as Record<string, unknown> | undefined;
      if (!t) { miss.push(l.id); continue; }
      for (const f of FIELDS) if (l[f] && !present(t[f])) miss.push(`${l.id}.${f}`);
      if (l.levier && !present(t['levier_mots'])) miss.push(`${l.id}.levier_mots`);
      const liens = (t['liens'] ?? {}) as Record<string, Record<string, unknown>>;
      const keyOf = (k: { monde: string; sens: string }): string => (l.liens.filter((x) => x.monde === k.monde).length > 1 ? `${k.monde}:${k.sens}` : k.monde);
      for (const k of l.liens) for (const f of ['mecanisme', 'limite']) if (!present(liens[keyOf(k)]?.[f])) miss.push(`${l.id}.liens.${keyOf(k)}.${f}`);
      expect(Object.keys(liens).sort(), l.id).toEqual(l.liens.map(keyOf).sort());
    }
    expect(miss).toEqual([]);
    expect(Object.keys(tr.lois).sort()).toEqual(fr.lois.map((l) => l.id).sort());
  });
  it('test_every_figure_world_lever_and_theme_has_its_english_text', () => {
    const miss: string[] = [];
    for (const [rows, bag] of [[fr.chiffres, tr.chiffres], [fr.horsdroit, tr.horsdroit]] as const) {
      expect(Object.keys(bag).sort()).toEqual(rows.map((c) => c.id).sort());
      for (const c of rows) {
        const t = bag[c.id] as Record<string, unknown>;
        for (const f of ['titre', 'titre_court', 'libelle_court', 'phrase', 'limite', 'population', 'effectif', 'date_publication'] as const) if (c[f] && !present(t[f])) miss.push(`${c.id}.${f}`);
        if (typeof c.valeur_affichee === 'string' && !present(t['valeur_affichee'])) miss.push(`${c.id}.valeur_affichee`);
        if (Array.isArray(c.valeur_affichee) && (t['libelles_affichees'] as string[] | undefined)?.length !== c.valeur_affichee.length) miss.push(`${c.id}.libelles_affichees`);
        if (typeof c.valeur === 'string' && !present(t['valeur'])) miss.push(`${c.id}.valeur`);
        if (!c.question_fr && !present(t['question_tr'])) miss.push(`${c.id}.question_tr`);
        const j = t['jauge'] as { unite?: string; seuils?: string[]; note?: string } | undefined;
        if (c.jauge) {
          if (!present(j?.unite)) miss.push(`${c.id}.jauge.unite`);
          if ((j?.seuils ?? []).length !== c.jauge.seuils.length || (j?.seuils ?? []).some((x) => !present(x))) miss.push(`${c.id}.jauge.seuils`);
          if (c.jauge.note && !present(j?.note)) miss.push(`${c.id}.jauge.note`);
        }
      }
    }
    for (const m of fr.mondes) { const t = tr.mondes[m.id] as Record<string, unknown> | undefined; if (!present(t?.['nom']) || !present(t?.['futur_limite']) || (m.note_aucun && !present(t?.['note_aucun']))) miss.push(m.id); }
    for (const l of fr.leviers) { const t = tr.leviers[l.id] as Record<string, unknown> | undefined; if (!present(t?.['nom']) || !present(t?.['question'])) miss.push(l.id); }
    for (const x of fr.themes) if (!present((tr.themes[x.id] as Record<string, unknown> | undefined)?.['titre'])) miss.push(x.id);
    expect(miss).toEqual([]);
  });
  it('test_no_english_field_is_empty_and_the_file_passes_the_schema', () => {
    const empties: string[] = [];
    const walk = (o: unknown, path: string): void => {
      if (typeof o === 'string') { if (!o.trim()) empties.push(path); } else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
    };
    walk(en, 'en');
    expect(empties).toEqual([]);
    expect(() => parseAtlas(E)).not.toThrow();
  });
  it('test_english_texts_keep_the_same_numbers_as_the_french', () => {
    const nums = (t: string): string[] => (t.replace(/[\u00a0\u202f ](?=\d{3}\b)/g, '').replace(/,(?=\d{3}\b)/g, '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'));
    const bad: string[] = [];
    for (const c of E.chiffres) {
      const f = fr.chiffres.find((x) => x.id === c.id);
      if (!f || typeof f.valeur !== 'string' || typeof c.valeur !== 'string') continue;
      if (nums(f.valeur).join('|') !== nums(c.valeur).join('|')) bad.push(c.id);
    }
    expect(bad).toEqual([]);
  });
  it('test_english_values_use_no_forbidden_word_no_dash_no_nbsp', () => {
    const BAN = /\bproofs?\b|\bprov(?:e|es|ed|ing)\b|leads? to\b|will lead to|inevitabl|\bprobabilit|\u2014|\u00a0|\u202f/i;
    const bad: string[] = [];
    const walk = (o: unknown, path: string): void => {
      if (typeof o === 'string') {
        // Les extraits cités entre guillemets français restent dans leur langue : on ne les contrôle pas.
        const sans = o.replace(/«[^»]*»/g, '');
        if (BAN.test(sans)) bad.push(path);
      } else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
    };
    walk(en, 'en');
    expect(bad).toEqual([]);
  });
  it('test_labels_en_carry_the_same_keys_as_fr_and_no_forbidden_word', () => {
    const L = LABELS.en!;
    expect(Object.keys(L).sort()).toEqual(Object.keys(FR).sort());
    const flat = JSON.stringify(Object.values(L).map((v) => (typeof v === 'function' ? (v as (...a: number[]) => unknown)(3, 2, 1, 0) : v)));
    expect(flat).not.toMatch(/proof|leads to|inevitable|probability|\u2014/i);
    expect(labelsFor('en')).toBe(L);
  });
});

describe('atlas en : empreintes du français source', () => {
  it('test_every_translated_field_still_matches_the_french_it_was_translated_from', () => {
    const src = (en as unknown as { _src?: Record<string, string> })._src ?? {};
    const stale: string[] = [];
    for (const p of leafPaths(en as unknown as Record<string, unknown>)) {
      const f = frenchFor(fr, p);
      if (f === undefined) stale.push(`${p} : le champ français n'existe plus`);
      else if (src[p] !== fingerprint(f)) stale.push(`${p} : le français a changé, retraduire puis \`node tools/atlas-en-sync.mjs --stamp\``);
    }
    expect(stale).toEqual([]);
    expect(Object.keys(src).sort()).toEqual(leafPaths(en as unknown as Record<string, unknown>).sort());
  });
  it('test_fingerprint_changes_when_one_character_changes', () => {
    expect(fingerprint('a')).not.toBe(fingerprint('b'));
    expect(fingerprint('Le Conseil')).toBe(fingerprint('Le Conseil'));
  });
});

describe('atlas : tuile chf-09, deux nombres chacun avec son pourcentage', () => {
  const tile = (lang: 'fr' | 'en'): string => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    current = createAtlasScreen(lang === 'en' ? E : fr, { lang });
    void current.mount(root);
    return root.querySelector('#chf-09')?.textContent ?? '';
  };
  it('test_french_tile_shows_48_percent_and_51_percent_with_their_words', () => {
    const t = tile('fr');
    expect(t).toMatch(/48 %\s*\/\s*51 %/);
    expect(t).toContain('favorables / opposés');
    expect(t).not.toMatch(/opposés\s*%/);
  });
  it('test_english_tile_shows_48_percent_and_51_percent_with_their_words', () => {
    const t = tile('en');
    expect(t).toMatch(/48%\s*\/\s*51%/);
    expect(t).toContain('in favor / opposed');
    expect(t).not.toMatch(/opposed\s*%/);
  });
});

describe('atlas : aucun identifiant technique dans un texte affiché', () => {
  const ID = /\b(?:fr|ue|int|chf|teg|w12)-\d+/;
  const scan = (root: unknown, allow: readonly string[] = []): string[] => {
    const hits: string[] = [];
    const walk = (o: unknown, path: string): void => {
      if (typeof o === 'string') { if (ID.test(o) && !/\.id$|citation_id|\.sha256|\.lois\[\d+\]$|\.lois\.[\w-]+$/.test(path) && !allow.includes(path)) hits.push(`${path}: ${ID.exec(o)?.[0]}`); }
      else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
    };
    walk(root, '$');
    return hits;
  };
  it('test_english_texts_cite_no_internal_id', () => { expect(scan(en)).toEqual([]); });
  it('test_french_registry_texts_cite_no_internal_id', () => { expect(scan(raw)).toEqual([]); });
});

describe('atlas en : formats anglais', () => {
  it('test_dates_and_numbers_follow_english_format', () => {
    const L = labelsFor('en');
    expect(formatDate('2026-11-14', L)).toBe('November 14, 2026');
    expect(formatDate('2025-05', L)).toBe('May 2025');
    expect(formatDate('avant le 2025-05-23', L)).toBe('before May 23, 2025');
    expect(L.num(12187)).toBe('12,187');
    expect(L.num(1.09)).toBe('1.09');
    const c = E.chiffres.find((x) => x.id === 'chf-01')!;
    expect(bigValue({ ...c, valeur: 68.3, unite: '%' }, L).big).toBe('68.3%');
    const w = E.horsdroit.find((x) => x.id === 'w12-06')!;
    expect(jaugeLisible(w, L)).toBe('49,505 of 175,909');
    expect(jaugeLisible(fr.horsdroit.find((x) => x.id === 'w12-06')!)).toBe('49 505 sur 175 909');
  });
});

describe('atlas en : écran', () => {
  const mount = (arrival?: string): HTMLElement => {
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    current = createAtlasScreen(E, { ...(arrival ? { arrival } : {}), lang: 'en' });
    void current.mount(root);
    return root;
  };
  it('test_screen_shows_english_chrome_and_the_original_fli_sentence_not_a_retranslation', () => {
    const root = mount('w10');
    const t = root.textContent ?? '';
    expect(t).toContain('The atlas of futures');
    expect(t).toContain('Sourced');
    expect(t).toContain(fr.mondes[0]!.futur.citation_en);
    expect(t).not.toContain(fr.mondes[0]!.futur.traduction_fr);
    expect(root.querySelector('.at-orig')).toBeNull();
  });
  it('test_publication_dates_hold_iso_and_text_forms_in_both_languages', () => {
    expect(anneeDe('5 janvier 2024 (version 3 : 8 octobre 2025)')).toBe('2024');
    expect(anneeDe('octobre 2022')).toBe('2022');
    expect(anneeDe('2025-04-03')).toBe('2025');
    expect(anneeDe('January 5, 2024 (version 3: October 8, 2025)')).toBe('2024');
    const text = (lang: 'fr' | 'en', id: string): string => {
      const root = document.createElement('div');
      document.body.replaceChildren(root);
      current = createAtlasScreen(lang === 'en' ? E : fr, { lang });
      void current.mount(root);
      root.querySelector<HTMLElement>(`#at-chiffres .at-ctile[data-open="${id}"]`)?.click();
      return root.querySelector('.at-sheet')?.textContent ?? '';
    };
    expect(text('fr', 'chf-16')).toContain('3 avril 2025');
    expect(text('en', 'chf-16')).toContain('April 3, 2025');
    expect(text('fr', 'chf-01')).toContain('5 janvier 2024 (version 3 : 8 octobre 2025)');
    expect(text('en', 'chf-01')).toContain('January 5, 2024 (version 3: October 8, 2025)');
    // aucune date française restée dans l'anglais
    for (const c of [...E.chiffres, ...E.horsdroit]) expect(c.en?.date_publication ?? '', c.id).not.toMatch(/janvier|février|mars|avril|\bmai\b|juin|juillet|août|septembre|octobre|novembre|décembre/i);
  });
  it('test_english_units_and_applications_carry_no_french_words', () => {
    const FRW = /\b(des|jugeant|adultes|interrogés|d.accord|plaintes|reçues|ogives|espèces|au-dessus|moyenne|dans les|suivant|entrée en vigueur)\b/i;
    for (const c of [...E.chiffres, ...E.horsdroit]) expect(c.en?.unite ?? '', `${c.id} unite`).not.toBe('');
    for (const c of [...E.chiffres, ...E.horsdroit]) expect(c.en?.unite ?? '', c.id).not.toMatch(FRW);
    for (const l of E.lois) expect(l.en?.application ?? '', l.id).not.toMatch(FRW);
    const root = document.createElement('div');
    document.body.replaceChildren(root);
    current = createAtlasScreen(E, { lang: 'en' });
    void current.mount(root);
    root.querySelector<HTMLElement>('#at-chiffres .at-ctile[data-open="chf-02"]')?.click();
    expect(root.querySelector('.at-sheet')?.textContent).toContain('of respondents giving at least a 10% chance');
  });
  it('test_survey_questions_are_quoted_in_both_languages', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const id of ['chf-01', 'chf-02', 'chf-04']) {
        const root = document.createElement('div');
        document.body.replaceChildren(root);
        current = createAtlasScreen(lang === 'en' ? E : fr, { lang });
        void current.mount(root);
        root.querySelector<HTMLElement>(`#at-chiffres .at-ctile[data-open="${id}"]`)?.click();
        const q = [...root.querySelectorAll('.at-sheet h4')].find((h) => /question/i.test(h.textContent ?? ''))?.nextElementSibling?.textContent ?? '';
        expect(q, `${lang}/${id}`).toMatch(lang === 'en' ? /^\u201cWhat probability|^\u201cAssume|^\u201cQ1/ : /^\u00ab\s(What probability|Assume|Q1)/);
        expect(q.trim().endsWith(lang === 'en' ? '\u201d' : '\u00bb'), `${lang}/${id} closing quote`).toBe(true);
      }
    }
  });
  it('test_law_sheet_says_french_title_and_marks_french_quotation_language', () => {
    const root = mount();
    root.querySelector<HTMLElement>('.at-data[data-id="fr-01"] .at-btn')?.click();
    const sheet = root.querySelector('.at-sheet');
    expect(sheet?.textContent).toContain('French title');
    expect(sheet?.querySelector('h3')?.getAttribute('lang')).toBe('fr');
    expect(sheet?.querySelector('blockquote')?.getAttribute('lang')).toBe('fr');
    expect(sheet?.textContent).toContain('French original, not translated.');
    expect(sheet?.textContent).toContain(fr.lois[0]!.citation.replace(/^« | »$/g, ''));
    expect(sheet?.textContent).toContain('corrected');
  });
  it('test_no_french_interface_word_is_left_outside_citations_titles_and_data_names', () => {
    const root = mount('w10');
    const clone = root.cloneNode(true) as HTMLElement;
    // Hors français voulu : citations, titres officiels, noms propres des registres (marqués lang="fr" ou hors du texte d'interface).
    clone.querySelectorAll('[lang=fr], blockquote').forEach((n) => n.remove());
    const text = clone.textContent ?? '';
    const FR_UI = /\b(Sourcé|Extrapolé|Retour|Fermer|Le constat|La matrice|La frise|Les chiffres|Les leviers|Ce que ça|Aucun levier|ton monde|Contrôlé le|Mécanisme|Limite :|Procédure)\b/;
    expect(text.match(FR_UI)).toBeNull();
  });
});
