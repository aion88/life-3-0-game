// @vitest-environment happy-dom
/** Écran Atlas : la fin allume le bon monde, la fiche s'ouvre et se ferme au toucher, aucune requête réseau au montage. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import raw from '../../../src/atlas/data.json';
import { HIDDEN_WORLDS } from '../../../src/atlas/config';
import { seuilLabel } from '../../../src/atlas/model';
import { LABELS } from '../../../src/atlas/labels';
import { counts, displayed, lawReach, plate } from '../../../src/atlas/model';
import { parseAtlas, type AtlasData } from '../../../src/atlas/schema';
import { createAtlasScreen } from '../../../src/screens/atlas';
import { parAnnee, pourcentageDe } from '../../../src/screens/atlas/figures';

const data = parseAtlas(raw);
let current: ReturnType<typeof createAtlasScreen> | null = null;

function mount(arrival?: string, extra: { lang?: 'fr' | 'en'; data?: AtlasData } = {}): HTMLElement {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  current = createAtlasScreen(extra.data ?? data, { ...(arrival === undefined ? {} : { arrival }), ...(extra.lang ? { lang: extra.lang } : {}) });
  void current.mount(root);
  return root;
}
afterEach(() => { current?.unmount(); current = null; vi.unstubAllGlobals(); });

describe('atlas screen : la fin allume le bon monde', () => {
  it.each(data.mondes.map((m) => m.id).filter((id) => !HIDDEN_WORLDS.includes(id)))('test_arrival_%s_lights_that_world_only', (w) => {
    const root = mount(w);
    expect(root.querySelector<HTMLElement>('.atlas')?.dataset['lit']).toBe(w);
    const lit = (sel: string): string[] => [...root.querySelectorAll<HTMLElement>(sel)].map((e) => e.dataset['world'] ?? '');
    expect(lit('.at-wcard.lit')).toEqual([w]);
    expect(lit('.at-wh.lit')).toEqual([w]);
    expect(root.querySelector(`.at-wbtn[data-world="${w}"]`)?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector(`.at-mob-list[data-list="${w}"]`)?.hasAttribute('hidden')).toBe(false);
  });
  it('test_no_arrival_or_unknown_world_lights_nothing', () => {
    for (const a of [undefined, 'w99', '']) {
      const root = mount(a);
      expect(root.querySelector('.lit')).toBeNull();
      expect(root.querySelector<HTMLElement>('.atlas')?.dataset['lit']).toBeUndefined();
      current?.unmount();
    }
  });
});

describe('atlas screen : contenu', () => {
  it('test_twelve_futures_each_with_the_fli_sentence_and_the_label', () => {
    const root = mount();
    const cards = [...root.querySelectorAll('.at-wcard:not(.free)')];
    expect(cards).toHaveLength(12);
    for (const [i, c] of cards.entries()) {
      expect(c.querySelector('.at-fr')?.textContent, `fr ${i}`).toBe(data.mondes[i]?.futur.traduction_fr);
      expect(c.querySelector('.at-orig .at-en')?.textContent, `en ${i}`).toBe(data.mondes[i]?.futur.citation_en);
    }
    expect(root.querySelector('.at-attrib')?.textContent).toMatch(/Ariel Conn, 28 août 2017/);
    expect(root.querySelector('.at-attrib')?.textContent).toMatch(/Sourcé/);
    expect(root.textContent).not.toMatch(/selon Tegmark/i);
    expect(root.querySelectorAll('.at-wcard.ext')).toHaveLength(2);
  });
  it('test_matrix_shows_50_laws_and_filters_by_link', () => {
    const root = mount();
    expect(root.querySelectorAll('.at-data')).toHaveLength(50);
    expect(root.querySelectorAll('.at-data:not([hidden])')).toHaveLength(31);
    expect(root.querySelector('.at-count')?.textContent).toBe('31 textes affichés');
    const chk = root.querySelector<HTMLInputElement>('#at-f-link');
    if (!chk) throw new Error('filtre absent');
    chk.checked = false;
    chk.dispatchEvent(new Event('change'));
    expect(root.querySelectorAll('.at-data:not([hidden])')).toHaveLength(50);
  });
  it('test_phone_world_button_shows_its_laws', () => {
    const root = mount();
    root.querySelector<HTMLButtonElement>('.at-wbtn[data-world="w10"]')?.click();
    expect(root.querySelectorAll('.at-mob-list[data-list="w10"] > li:not([hidden])')).toHaveLength(29);
  });
  it('test_levers_and_chart_labels_and_fourteen_figures', () => {
    const root = mount();
    expect(root.querySelectorAll('.at-wcard:not(.free)')).toHaveLength(12);
    expect(root.querySelectorAll('.at-wcard .at-none')).toHaveLength(3);
    for (const bar of root.querySelectorAll('.at-tokens')) expect(bar.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    expect(root.querySelectorAll('#at-chiffres .at-ctile')).toHaveLength(14);
    for (const t of root.querySelectorAll('#at-chiffres .at-ctile')) {
      expect(t.querySelector('.at-tbig')?.textContent?.length).toBeGreaterThan(0);
      expect(t.querySelector('.at-trest')?.textContent?.length).toBeGreaterThan(0);
      expect(t.querySelector('.at-tby')?.textContent?.length).toBeLessThanOrEqual(60);
      for (const h of ['Question posée', 'Auteur et date', 'Ce que ça ne dit pas']) expect(t.textContent).not.toContain(h);
    }
    expect(root.querySelectorAll('.at-mk')).toHaveLength(47);
  });
});

describe('atlas screen : douze mondes affichés, leviers avant la matrice', () => {
  it('test_w12_stays_displayed_and_the_hidden_list_is_empty', () => {
    expect(HIDDEN_WORLDS).toEqual([]);
    const root = mount();
    expect(root.querySelector('[data-world="w12"]')).not.toBeNull();
    expect(root.querySelectorAll('.at-wh')).toHaveLength(12);
    expect(root.querySelectorAll('.at-data:first-child .at-c, .at-data .at-c').length / 50).toBe(12);
    expect(root.querySelector<HTMLElement>('.at-mx')?.style.getPropertyValue('--n')).toBe('12');
  });
  it('test_the_hiding_mechanism_still_works_when_a_world_is_listed', () => {
    const d = displayed(data, ['w12']);
    expect(d.mondes).toHaveLength(11);
    expect(d.mondes.some((m) => m.id === 'w12')).toBe(false);
    expect(data.mondes.some((m) => m.id === 'w12')).toBe(true);
  });
  it('test_counts_follow_the_displayed_worlds', () => {
    const root = mount();
    expect(root.querySelector('.at-cons-num')?.textContent).toBe('27');
    expect(root.querySelector('.at-cons-line')?.textContent).toMatch(/3 mondes sur 11 sans levier du droit actuel/);
    expect(root.querySelector('.at-cons-line')?.textContent).toMatch(/1 futur hors droit de l'IA \(Autodestruction\)/);
    expect(lawReach(data)).toMatchObject({ sansLevier: ['w05', 'w08', 'w09'], horsDroit: ['w12'], atteignables: 11 });
    expect(displayed(data).mondes).toHaveLength(12);
  });
  it('test_titles_say_twelve_and_two_extinctions', () => {
    const root = mount();
    expect(root.textContent).toMatch(/Dix mondes habités et deux extinctions/);
    expect(root.querySelector('.at-mx')?.getAttribute('aria-label')).toMatch(/douze mondes/);
    expect(root.textContent).not.toMatch(/onze/i);
  });
  it('test_a_w12_arrival_lights_its_world', () => {
    const root = mount('w12');
    expect(root.querySelectorAll('.lit').length).toBeGreaterThan(0);
  });
  it('test_levers_section_comes_before_the_matrix', () => {
    const root = mount();
    const ids = [...root.querySelectorAll('section.at-section')].map((s) => s.id);
    expect(ids).toEqual(['at-constat', 'at-leviers', 'at-matrice', 'at-frise', 'at-chiffres']);
  });
});

describe('atlas screen : chiffres compacts et futur hors droit', () => {
  it('test_the_year_is_not_repeated_when_the_author_already_carries_it', () => {
    expect(parAnnee('Planetary Health Check 2026', '2026')).toBe('Planetary Health Check 2026');
    expect(parAnnee('IPCC', '2023')).toBe('IPCC · 2023');
    const root = mount();
    for (const t of root.querySelectorAll('#at-chiffres .at-tby')) {
      const m = /(\d{4}) · \1$/.exec(t.textContent ?? '');
      expect(m, t.textContent ?? '').toBeNull();
    }
  });
  it('test_a_figure_tile_opens_the_same_paper_with_the_detail_and_a_source_link', () => {
    const root = mount();
    for (const c of data.chiffres) {
      root.querySelector<HTMLElement>(`#at-chiffres .at-ctile[data-open="${c.id}"]`)?.click();
      const sheet = root.querySelector('.at-sheet');
      const back = root.querySelector<HTMLElement>('.at-sheet-back');
      expect(back?.hidden, c.id).toBe(false);
      expect(sheet?.textContent, c.id).toContain(c.limite);
      expect(sheet?.textContent, c.id).toContain(c.question);
      expect(sheet?.querySelector('.at-links a[href^="https://"]'), c.id).not.toBeNull();
      expect(sheet?.querySelector('.at-tag.fact')?.textContent).toBe('Sourcé');
      back?.click();
      expect(back?.hidden).toBe(true);
    }
  });
  it('test_w12_card_is_out_of_law_not_no_lever', () => {
    const root = mount();
    const card = root.querySelector('.at-wcard[data-world="w12"]');
    expect(card?.classList.contains('out')).toBe(true);
    expect(card?.querySelector('.at-oltag')?.textContent).toBe("HORS DROIT DE L'IA");
    expect(card?.textContent).toContain("Ce futur ne passe pas par une loi sur l'IA. Dans le résumé du Future of Life Institute, l'humanité disparaît par d'autres voies (nucléaire, biotechnologie, crise climatique).");
    expect(card?.textContent).not.toContain('Aucun levier du droit actuel');
    expect(card?.querySelector('.at-none')).toBeNull();
    expect(root.querySelectorAll('.at-wcard .at-none')).toHaveLength(3);
  });
  it('test_w12_tiles_come_from_the_checked_register_and_open_the_paper', () => {
    expect(data.horsdroit.length).toBeGreaterThan(0);
    const root = mount();
    const tiles = [...root.querySelectorAll<HTMLElement>('#at-horsdroit .at-ctile')];
    expect(tiles.map((t) => t.dataset['open']).sort()).toEqual(data.horsdroit.map((c) => c.id).sort());
    expect(root.querySelectorAll('.at-wcard[data-world="w12"] .at-ctile')).toHaveLength(0);
    for (const c of data.horsdroit) expect(['vérifié', 'corrigé']).toContain(c.verdict);
    tiles[0]?.click();
    expect(root.querySelector<HTMLElement>('.at-sheet-back')?.hidden).toBe(false);
    expect(root.querySelector('.at-sheet')?.textContent).toContain(data.horsdroit[0]?.limite ?? '?');
  });
  it('test_w12_without_a_checked_register_says_data_under_check', () => {
    const empty = parseAtlas({ ...raw, horsdroit: [] });
    const root = mount(undefined, { data: empty });
    const card = root.querySelector('.at-wcard[data-world="w12"]');
    expect(card?.textContent).toContain('données en cours de contrôle');
    expect(card?.querySelectorAll('.at-ctile')).toHaveLength(0);
    expect(root.querySelector('#at-horsdroit')).toBeNull();
  });
  it('test_w12_matrix_column_head_says_out_of_law', () => {
    const root = mount();
    expect(root.querySelector('.at-wh[data-world="w12"] .at-ol')?.textContent).toBe("hors droit de l'IA");
    expect(root.querySelectorAll('.at-wh .at-ol')).toHaveLength(1);
  });
});

describe('atlas screen : bloc des mesures hors droit et jauges', () => {
  const synthetic = (over: Record<string, unknown>): AtlasData => {
    const base = raw.chiffres[0];
    if (!base) throw new Error('données vides');
    return parseAtlas({ ...raw, horsdroit: [{ ...base, sha256: 'a'.repeat(64), id: 'w12-t1', titre: 'Mesure de test', ...over }], reperes: [] });
  };
  it('test_block_is_full_width_after_the_world_cards_with_four_groups', () => {
    const root = mount();
    const lev = root.querySelector('.at-levers');
    expect(lev?.lastElementChild?.id).toBe('at-horsdroit');
    expect(lev?.querySelector('.at-wgrid')?.nextElementSibling?.id).toBe('at-horsdroit');
    expect([...root.querySelectorAll<HTMLElement>('#at-horsdroit .at-og')].map((g) => g.dataset['group'])).toEqual(['climate', 'biodiversity', 'nuclear', 'planetary']);
    expect(root.querySelector('.at-wcard[data-world="w12"] a[href="#at-horsdroit"]')).not.toBeNull();
    expect(root.querySelector('#at-horsdroit .at-fixedline')?.textContent).toBe("Ces chiffres décrivent un état mesuré, pas une chance d'extinction.");
  });
  it('test_a_bar_exists_only_with_a_gauge_and_its_fill_is_value_over_max', () => {
    const root = mount();
    let withGauge = 0;
    for (const c of data.horsdroit) {
      const tile = root.querySelector(`#at-horsdroit .at-ctile[data-open="${c.id}"]`);
      expect(tile, c.id).not.toBeNull();
      const g = tile?.querySelector<HTMLElement>('.at-gauge');
      if (!c.jauge) { expect(g, c.id).toBeNull(); expect(tile?.querySelector('.at-gbar'), c.id).toBeNull(); continue; }
      withGauge += 1;
      expect(Number(g?.dataset['fill']), c.id).toBeCloseTo((c.jauge.valeur / c.jauge.max) * 100, 1);
      expect(tile?.querySelector('.at-gfill')?.getAttribute('width')).toBe(((c.jauge.valeur / c.jauge.max) * 100).toFixed(2));
      expect(tile?.querySelectorAll('.at-gtick')).toHaveLength(c.jauge.seuils.length);
      expect([...(tile?.querySelectorAll('.at-gt') ?? [])].map((t) => t.textContent)).toEqual(c.jauge.seuils.map((s) => seuilLabel(s.valeur, c.jauge?.unite ?? '')));
    }
    expect(withGauge).toBeGreaterThan(0);
    expect(root.querySelectorAll('#at-chiffres .at-gauge')).toHaveLength(0);
  });
  it('test_synthetic_gauge_fill_ticks_and_no_invented_scale', () => {
    const j = { valeur: 1, max: 4, seuils: [{ valeur: 2, libelle: 'Seuil' }], unite: '°C au-dessus de la référence' };
    const root = mount(undefined, { data: synthetic({ jauge: j }) });
    expect(root.querySelector<HTMLElement>('#at-horsdroit .at-gauge')?.dataset['fill']).toBe('25.00');
    expect(root.querySelector('#at-horsdroit .at-gt')?.textContent).toBe('2 °C');
    expect(root.querySelector('#at-horsdroit .at-tbig')?.textContent).toBe('1 °C');
    const none = mount(undefined, { data: synthetic({ jauge: null }) });
    expect(none.querySelector('#at-horsdroit .at-gauge')).toBeNull();
    const absent = mount(undefined, { data: synthetic({}) });
    expect(absent.querySelector('#at-horsdroit .at-gauge')).toBeNull();
    expect(() => synthetic({ jauge: { ...j, max: 0 } })).toThrow();
    expect(() => synthetic({ jauge: { ...j, valeur: 9 } })).toThrow();
  });
  it('test_blocked_and_marker_entries_are_absent_and_thresholds_are_sourced', () => {
    const root = mount();
    const ids = [...root.querySelectorAll<HTMLElement>('#at-horsdroit .at-ctile')].map((t) => t.dataset['open']);
    expect(ids).not.toContain('w12-04');
    expect(ids).not.toContain('w12-12');
    const lines = [...root.querySelectorAll('#at-horsdroit .at-thresholds')];
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.querySelector('a')?.getAttribute('href')).toMatch(/^https:\/\//);
    expect(lines[0]?.textContent).toContain('Accord de Paris');
  });
  it('test_calculated_by_us_tag_only_where_the_figure_is_derived', () => {
    const root = mount();
    for (const c of [...data.chiffres, ...data.horsdroit]) {
      root.querySelector<HTMLElement>(`.at-ctile[data-open="${c.id}"]`)?.click();
      const calc = root.querySelector('.at-sheet .at-tag.calc');
      expect(calc !== null, c.id).toBe(c.calcule_par_nous || c.jauge?.calcule_par_nous === true);
      root.querySelector<HTMLElement>('.at-sheet-back')?.click();
    }
  });
});

describe('atlas screen : fiche', () => {
  it('test_sheet_opens_with_fact_link_and_extrapolated_reading_and_closes_on_touch', () => {
    const root = mount();
    root.querySelector<HTMLElement>('.at-data[data-id="fr-01"] .at-btn')?.click();
    const back = root.querySelector<HTMLElement>('.at-sheet-back');
    expect(back?.hidden).toBe(false);
    const sheet = root.querySelector('.at-sheet');
    expect(sheet?.textContent).toMatch(/Sourcé/);
    expect(sheet?.textContent).toMatch(/Stade au 14 novembre 2026/);
    expect(sheet?.textContent).toMatch(/Extrapolé/);
    expect(sheet?.textContent).toMatch(/Ce que ça ne dit pas/);
    const a = sheet?.querySelector<HTMLAnchorElement>('.at-links a');
    expect(a?.href).toMatch(/^https:\/\//);
    expect(a?.rel).toContain('noopener');
    sheet?.querySelector<HTMLElement>('h3')?.click();
    expect(back?.hidden).toBe(true);
  });
  it('test_sheet_without_any_link_says_so', () => {
    const root = mount();
    root.querySelector<HTMLElement>('.at-data[data-id="fr-23"] .at-btn')?.click();
    expect(root.querySelector('.at-sheet')?.textContent).toMatch(/Aucun lien|aucun lien|ne la rattache à aucun monde/);
  });
  it('test_escape_closes_the_sheet', () => {
    const root = mount();
    root.querySelector<HTMLElement>('.at-data .at-btn')?.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.querySelector<HTMLElement>('.at-sheet-back')?.hidden).toBe(true);
  });
});

describe('atlas screen : aucun réseau, aucun mot interdit', () => {
  it('test_mount_makes_no_network_request', () => {
    const fetchSpy = vi.fn();
    const xhr = vi.fn();
    const img = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhr);
    vi.stubGlobal('Image', img);
    vi.stubGlobal('WebSocket', xhr);
    mount('w10');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(img).not.toHaveBeenCalled();
  });
  const FILES = readdirSync('src/screens/atlas').filter((f) => f.endsWith('.ts')).map((f) => join('src/screens/atlas', f));
  it('test_sources_have_no_network_primitive_nor_three', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(5);
    const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+Image\b|\bimport\s*\((?!\s*'\.)|\bWebSocket\b|\bEventSource\b|from\s+'three|street\//;
    expect(FILES.filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
  it('test_our_texts_use_no_forbidden_word_or_dash', () => {
    const BAN = /interactif|immersif|—|\bpreuves?\b|inévitable|va conduire|mène à/i;
    for (const f of [...FILES, 'src/screens/atlas/atlas.css']) expect(BAN.test(readFileSync(f, 'utf8')), f).toBe(false);
  });
});

describe('atlas screen : prêt pour la langue anglaise', () => {
  it('test_english_without_any_translation_data_still_mounts_with_english_labels', () => {
    expect(LABELS.en).toBeDefined();
    const en = mount(undefined, { lang: 'en' });
    expect(en.textContent).toMatch(/The levers, world by world/);
    expect(en.textContent).not.toMatch(/Les leviers, monde par monde/);
    expect(en.querySelector('.atlas')?.getAttribute('lang')).toBe('en');
  });
  it('test_optional_translated_fields_are_used_and_citations_never_replaced', () => {
    const l0 = data.lois[0];
    const m0 = data.mondes[0];
    if (!l0 || !m0) throw new Error('données vides');
    const translated = parseAtlas({
      ...raw,
      mondes: raw.mondes.map((m, i) => (i === 0 ? { ...m, en: { nom: 'Libertarian utopia' } } : m)),
      lois: raw.lois.map((l, i) => (i === 0 ? { ...l, en: { titre: 'Act EN title', limite: 'English limit' } } : l)),
    });
    const en = mount(undefined, { lang: 'en', data: translated });
    expect(en.textContent).toContain('Libertarian utopia');
    expect(en.textContent).not.toContain(m0.nom);
    en.querySelector<HTMLElement>(`.at-data[data-id="${l0.id}"] .at-btn`)?.click();
    const sheet = en.querySelector('.at-sheet')?.textContent ?? '';
    expect(sheet).toContain('Act EN title');
    expect(sheet).toContain('English limit');
    expect(sheet).toContain(l0.citation.replace(/^« | »$/g, ''));
    const fr = mount(undefined, { data: translated });
    expect(fr.textContent).toContain(m0.nom);
    expect(fr.textContent).not.toContain('Libertarian utopia');
  });
  it('test_no_french_interface_text_is_hardcoded_in_the_screen_sources', () => {
    const dir = join(__dirname, '../../../src/screens/atlas');
    const allowed = new Set(['adoptée', 'déposée', 'expirée']);
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const m of src.matchAll(/(['"`])((?:(?!\1)[^\\\n])*)\1/g)) {
        const t = m[2] ?? '';
        if (/[éèêàçùôâîû]/i.test(t) && !allowed.has(t)) throw new Error(`${f} : texte français en dur « ${t} »`);
      }
    }
  });
});

describe('atlas screen : le bureau du registre', () => {
  it('test_the_plate_has_one_case_per_text_and_is_computed_from_the_data', () => {
    const root = mount();
    const pl = plate(data);
    const c = counts(data);
    expect(root.querySelectorAll('.at-plate .at-pc')).toHaveLength(data.lois.length);
    expect(pl.nombre.direct + pl.nombre.indirect + pl.nombre.frein + pl.nombre.both).toBe(c.touchent10);
    expect(pl.nombre.frein + pl.nombre.both).toBe(c.freins10);
    expect(pl.vides).toBe(data.lois.length - c.touchent10);
    // la légende « indirect et frein » ne décrit que ce qu'elle dit : aucun texte à la fois direct et frein
    expect(pl.directEtFrein).toBe(0);
    expect([...root.querySelectorAll('.at-plate .at-pc')].filter((x) => x.querySelector('svg')).length).toBe(c.touchent10);
    expect(root.querySelector('.at-plate')?.getAttribute('aria-label')).toContain(`${c.touchent10} textes sur ${c.textes}`);
    expect(root.querySelector('.at-cons-t2')?.textContent).toBe(`dont ${c.freins10} freins`);
  });
  it('test_tokens_count_the_texts_of_each_lever_one_by_one', () => {
    const root = mount();
    const c = counts(data);
    for (const card of root.querySelectorAll('.at-wcard:not(.free)')) {
      const w = data.mondes.find((m) => m.id === (card as HTMLElement).dataset['world']);
      const blocks = [...card.querySelectorAll('.at-lv:not(.at-none):not(.at-outlaw)')];
      for (const [i, lv] of (w?.leviers ?? []).entries()) {
        const total = Object.values(c.parLevier[lv.id] ?? {}).reduce((a, b) => a + b, 0);
        expect(blocks[i]?.querySelectorAll('.at-tokens .at-tk').length, `${w?.id} ${lv.id}`).toBe(total);
      }
    }
    expect(root.querySelector('.at-wcard .at-orig')?.tagName).toBe('DETAILS');
    for (const c2 of root.querySelectorAll('.at-wcard.nolever')) expect(c2.querySelector('.at-stamp')?.textContent).toBe('Aucun levier du droit actuel');
  });
  it('test_figure_tickets_show_the_source_line_the_verdict_and_a_gauge_only_for_one_percent', () => {
    const root = mount();
    const tickets = [...root.querySelectorAll('#at-chiffres .at-ticket')];
    expect(tickets).toHaveLength(data.chiffres.length);
    for (const [i, t] of tickets.entries()) {
      const c = data.chiffres[i];
      expect(t.querySelector('.at-tfoot a[href^="https://"]'), c?.id).not.toBeNull();
      expect(t.querySelector('.at-tfoot .at-v')?.textContent, c?.id).toContain(c?.verdict ?? '?');
      const big = t.querySelector('.at-tbig')?.textContent ?? '';
      expect(t.querySelector('.at-pg') !== null, `${c?.id} ${big}`).toBe(pourcentageDe(big) !== null);
    }
    expect(pourcentageDe('73 %')).toBe(73);
    expect(pourcentageDe('68,3 %')).toBe(68.3);
    expect(pourcentageDe('37,8 à 51,4 %')).toBeNull();
    expect(pourcentageDe('48 favorables / 51 opposés %')).toBeNull();
  });
  it('test_the_timeline_has_a_vertical_phone_list_with_every_dated_text', () => {
    const root = mount();
    expect(root.querySelectorAll('.at-tl-v .at-tkb')).toHaveLength(root.querySelectorAll('.at-mk').length);
    for (const b of root.querySelectorAll<HTMLElement>('.at-tl-v .at-tkb')) expect(b.dataset['open']).toBeTruthy();
    root.querySelector<HTMLElement>('.at-tl-v .at-tkb')?.click();
    expect(root.querySelector<HTMLElement>('.at-sheet-back')?.hidden).toBe(false);
  });
  it('test_the_matrix_marks_extinction_columns_and_the_densest_world_without_a_jurisdiction_color', () => {
    const root = mount();
    expect([...root.querySelectorAll<HTMLElement>('.at-wh.ext')].map((e) => e.dataset['world'])).toEqual(['w07', 'w12']);
    expect([...root.querySelectorAll<HTMLElement>('.at-wh.dense')].map((e) => e.dataset['world'])).toEqual(['w10']);
    expect(root.querySelector('.at-title-block .at-full')).toBeNull();
    const css = readFileSync(join(__dirname, '../../../src/screens/atlas/atlas.css'), 'utf8');
    expect(css).not.toMatch(/--j-(fr|ue|int)/);
  });
});

describe('atlas screen : lectures daffichage facultatives des chiffres', () => {
  it('test_libelle_court_and_valeur_affichee_drive_the_tile_and_the_sheet', () => {
    const first = data.chiffres[0];
    if (!first) throw new Error('aucun chiffre');
    const custom = parseAtlas({ ...JSON.parse(JSON.stringify(raw)), chiffres: [{ ...first, libelle_court: 'Libellé de test', valeur_affichee: '48 % / 51 %', titre: undefined }, ...data.chiffres.slice(1)] });
    const root = mount(undefined, { data: custom });
    const tile = root.querySelector('#at-chiffres .at-ticket');
    expect(tile?.querySelector('.at-tbig')?.textContent).toBe('48 % / 51 %');
    expect(tile?.querySelector('.at-trest')?.textContent).toBe('Libellé de test');
    tile?.querySelector<HTMLElement>('.at-ctile')?.click();
    expect(root.querySelector('.at-sheet .at-fbig')?.textContent).toBe('48 % / 51 %');
    expect(root.querySelector('.at-sheet')?.textContent).toContain(first.limite);
    // sans ces champs, la tuile garde la valeur et la ligne du registre
    const plain = mount();
    expect(plain.querySelector('#at-chiffres .at-ticket .at-tbig')?.textContent).not.toBe('48 % / 51 %');
  });
});
