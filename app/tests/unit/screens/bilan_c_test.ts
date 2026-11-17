// @vitest-environment happy-dom
/** Bilan C : onglets, monde atteint, jours d'une teinte, kit, fin, message du dernier relevé [plan UI-C T10 ; spec C §3.4 ; rulings GD 1, 2, 3g, 3h, 3i]. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBilan } from '../../../src/bilan/build';
import { buildSheet } from '../../../src/bilan/sheet';
import { loadBilanCommon } from '../../../src/data/bilanLoad';
import { replay } from '../../../src/engine/moments/replay';
import { bilanScreen, createBilanScreen } from '../../../src/screens/bilan';
import { createUiEvents } from '../../../src/ui/events';
import { createInstantAnimator } from '../../../src/ui/motion';
import { loadUi } from '../../../src/data/ui/load';
import { createDaysRow, createKitCards, createSheetBlocks, dayTone, frenchSpaces, kitTone, worldNames } from '../../../src/screens/bilan/sheetC';
import { shareLines } from '../../../src/screens/bilan/shareImage';
import type { PalierId } from '../../../src/data/schema/world';
import type { BilanInput, BilanSheet, DayLine, KitRow } from '../../../src/shared/types/bilan';
import { actsOfProfile } from '../../support/profile_acts';
import { mountScreen } from '../../support/screens';
import { bilanCtx, REDIRECTED_RUN, W10, weekEndOf } from '../../support/screens_bilan';
import { ctxW10 } from '../../support/street';
import { realI18n, visibleTexts } from '../../support/street_ui';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';

const t = realI18n('fr');
const nb = frenchSpaces;   // le rendu pose une espace insécable avant « : ; ? ! »
const ctx = ctxW10();
const has = (k: string): boolean => t.has(k);
const toggle = (root: HTMLElement): HTMLButtonElement => root.querySelector<HTMLButtonElement>('[data-ui="soft-toggle"]')!;
const SRC = (rel: string): string => readFileSync(join(__dirname, '../../../src', rel), 'utf8');
const sheetOf = (input: BilanInput): BilanSheet => buildSheet(input, ctx, has);
const PALIERS: readonly PalierId[] = ['courtesy', 'thanks', 'patience', 'appointment'];
const withMsg = (s: BilanSheet, m: PalierId | null): BilanSheet => ({ ...s, lastMessage: m });
const render = (s: BilanSheet): HTMLElement => { const d = document.createElement('div'); d.append(...createSheetBlocks(s, t)); return d; };

const EARLY: BilanInput = { ...weekEndOf(), entry: 'earlyEnd', acts: [], survival: null, week: null };
// These contracts belong to the retained bilingual seven-day edition.
beforeEach(() => history.replaceState(null, '', '?episode=semaine'));
afterEach(() => { vi.restoreAllMocks(); });

describe('bilan C : donnée', () => {
  it('test_build_sheet_last_message_is_last_reading_palier', () => {
    for (const p of ['Zéro nom', 'Quatre noms', 'Deux noms puis arrêté']) {
      const input = weekEndOf(p);
      const last = replay(input.acts, ctx).state.readings.at(-1)!.palier;
      expect(sheetOf(input).lastMessage, p).toBe(last);
    }
    expect(PALIERS).toContain(sheetOf(weekEndOf()).lastMessage);
  });

  it('test_no_reading_no_message_no_empty_slot', async () => {
    const s = sheetOf(EARLY);
    expect(s.lastMessage).toBeNull();
    const dom = render(s);
    expect(dom.querySelector('[data-testid="bilan-w10-block"]')).toBeNull();
    expect(dom.querySelector('[data-testid="bilan-message"]')).toBeNull();
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: EARLY });
    expect(root.querySelector('[data-testid="bilan-w10-block"]')).toBeNull();
  });

  it('test_recruited_fixture_replays_ok', () => {
    const acts = JSON.parse(readFileSync(join(__dirname, '../../fixtures/e2e/recruited-acts.json'), 'utf8')) as ReturnType<typeof actsOfProfile>;
    const r = replay(acts, ctx);
    expect(r.rejected).toEqual([]);
    for (const id of ['j3.marlene', 'j4.neighbour', 'j5.bruno']) expect(acts.some((a) => a.id === id), id).toBe(true);
    expect(r.state.readings.length).toBeGreaterThan(0);
  });

  it('test_lived_world_shown_only_when_it_differs', async () => {
    const same = sheetOf(weekEndOf());
    expect(worldNames(same)).toEqual({ computed: same.computedWorld, lived: null });
    const redirected = sheetOf(weekEndOf('Zéro nom', REDIRECTED_RUN));
    expect(redirected.livedWorld).not.toBe(redirected.computedWorld);
    expect(worldNames(redirected)).toEqual({ computed: redirected.computedWorld, lived: redirected.livedWorld });
    const a = render(same);
    expect(a.querySelector('[data-testid="bilan-world-redirect"]')).toBeNull();
    const b = render(redirected);
    const line = b.querySelector('[data-testid="bilan-world-redirect"]')!;
    expect(line.textContent).toBe(nb(t.t('redirect.bilan', { lived: t.t(`world.${redirected.livedWorld}.name`), computed: t.t(`world.${redirected.computedWorld}.name`) })));
    expect(line.textContent).not.toMatch(/world\.w\d+/);
  });

  it('test_world_name_is_never_replaced', () => {
    for (const s of [sheetOf(weekEndOf()), sheetOf(weekEndOf('Zéro nom', REDIRECTED_RUN))]) {
      const dom = render(s);
      expect(dom.querySelector('[data-testid="bilan-world-name"]')!.textContent).toBe(t.t(`world.${s.computedWorld}.name`));
      expect(dom.querySelector('[data-testid="bilan-world-clear"]')!.textContent).toBe(nb(t.t(`world.${s.computedWorld}.clear`)));
      expect(dom.querySelector('[data-testid="bilan-world"]')!.textContent).toContain(t.t('bilan.sheet.world'));
    }
  });

  it('test_each_day_pill_shows_its_date', () => {
    const s = sheetOf(weekEndOf());
    const row = createDaysRow(s.days, t);
    const days = [...row.querySelectorAll('[data-day]')];
    expect(days).toHaveLength(s.days.length);
    days.forEach((d, i) => {
      expect(d.querySelector('[data-day-date]')!.textContent).toBe(nb(t.t(s.days[i]!.dateKey)));
      expect(d.querySelector('[data-day-line]')!.textContent).toBe(nb(t.t(s.days[i]!.textKey)));
      expect(d.firstElementChild!.hasAttribute('data-day-pill')).toBe(true);
    });
  });
});

describe('bilan C : jours', () => {
  const pills = (days: readonly DayLine[]): string[] => [...createDaysRow(days, t).querySelectorAll('[data-day-pill]')].map((p) => p.outerHTML);

  it('test_days_row_same_markup_for_zero_name_and_recruited', () => {
    const recruited = JSON.parse(readFileSync(join(__dirname, '../../fixtures/e2e/recruited-acts.json'), 'utf8')) as ReturnType<typeof actsOfProfile>;
    const zero = sheetOf(weekEndOf('Zéro nom')).days;
    const rec = buildSheet({ ...weekEndOf('Quatre noms'), acts: recruited }, ctx, has).days;
    expect(zero.map((d) => d.textKey)).not.toEqual(rec.map((d) => d.textKey));
    expect(pills(zero)).toEqual(pills(rec));
    // teinte de calendrier (ruling GD 1, option A de Cynthia 2026-11-08) : fixée par la place du jour, jamais par son contenu
    const tones = [...createDaysRow(zero, t).querySelectorAll<HTMLElement>('[data-day-pill]')].map((p) => p.dataset['tone']);
    expect(tones).toEqual(zero.map((d) => dayTone(d.day)));
    expect(createDaysRow(zero, t).innerHTML).not.toBe(createDaysRow(rec, t).innerHTML);
  });

  it('test_days_row_common_prefix_identical_when_lengths_differ', () => {
    const long = sheetOf(weekEndOf('Zéro nom')).days;
    const short = sheetOf(weekEndOf('Bavard')).days;
    expect(short.length).toBeLessThan(long.length);
    const a = pills(long), b = pills(short);
    const n = Math.min(a.length, b.length);
    expect(n).toBeGreaterThan(0);
    expect(a.slice(0, n)).toEqual(b.slice(0, n));
  });

  it('test_no_day_after_end', () => {
    const short = sheetOf(weekEndOf('Bavard')).days;
    expect(createDaysRow(short, t).querySelectorAll('[data-day-pill]')).toHaveLength(short.length);
    expect(createDaysRow([], t).querySelectorAll('[data-day-pill]')).toHaveLength(0);
  });
});

describe('bilan C : kit', () => {
  const STATES = ['kept', 'left', 'seized', 'handedOver', 'declared'] as const;
  const rowsAll: KitRow[] = STATES.map((st, i) => ({ itemId: `x${i}`, labelKey: sheetOf(weekEndOf()).kit[0]!.labelKey, state: st, stateKey: `bilan.kit.state.${st}` }));

  it('test_kit_cards_identical_for_every_state', () => {
    const cards = [...createKitCards(rowsAll, t).querySelectorAll('[data-kit-card]')];
    expect(cards).toHaveLength(5);
    const shape = (c: Element): string => c.outerHTML.replace(/>[^<]*</g, '><');
    // à place égale, la carte est la même quel que soit l'état ; la teinte de l'icône suit la place, jamais l'état
    const alone = STATES.map((_, i) => createKitCards([rowsAll[i]!], t).querySelector('[data-kit-card]')!);
    expect(new Set(alone.map(shape)).size).toBe(1);
    expect(cards.map((c) => c.querySelector<HTMLElement>('.c-kit-icon')!.dataset['tone'])).toEqual(STATES.map((_, i) => kitTone(i)));
    expect(cards.map((c) => c.querySelector('[data-kit-state]')!.textContent)).toEqual(STATES.map((s) => nb(t.t(`bilan.kit.state.${s}`))));
  });

  it('test_no_state_color_anywhere', () => {
    const src = SRC('screens/bilan/sheetC.ts') + SRC('screens/bilan/bilan.css');
    expect(src).not.toMatch(/KitItemState|data-state|--state|kit-(kept|left|seized)|state-(kept|left|seized)/);
    expect(src).not.toMatch(/\.state\b/);
    expect(SRC('screens/bilan/bilan.css')).not.toMatch(/\[data-(kit-)?state|:nth-child\([^)]*\)[^{]*\{[^}]*background/);
  });

  it('test_kit_text_never_below_18_and_card_grows', () => {
    const css = SRC('screens/bilan/bilan.css');
    const rule = (sel: string): string => new RegExp(`${sel.replace(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)![1]!;
    expect(rule('.c-kit-card')).toMatch(/height:\s*auto/);
    expect(css).not.toMatch(/max-height|text-overflow|line-clamp|overflow:\s*hidden/);
    expect(rule('.c-kit-label')).toContain('var(--t-kit-label-size)');
    expect(rule('.c-kit-state')).toContain('var(--t-kit-state-size)');
    const type = JSON.parse(readFileSync(join(__dirname, '../../../src/data/ui/theme.json'), 'utf8')).type as Record<string, { v: { px: number; weight: number; family: string } }>;
    expect(type['kitLabel']!.v).toMatchObject({ family: 'text', weight: 500 });
    expect(type['kitState']!.v).toMatchObject({ family: 'text', weight: 500 });
    expect(type['kitLabel']!.v.px).toBeGreaterThanOrEqual(18);
    expect(type['kitState']!.v.px).toBeGreaterThanOrEqual(18);
    // le libellé le plus long de la donnée du monde passe par la même carte, sans troncature
    const longestKey = W10.kit.map((k) => k.labelKey).sort((x, y) => t.t(y).length - t.t(x).length)[0]!;
    const card = createKitCards([{ ...rowsAll[0]!, labelKey: longestKey }], t).querySelector('[data-kit-card]')!;
    expect(card.querySelector('.c-kit-label')!.textContent).toBe(nb(t.t(longestKey)));
  });
});

describe('bilan C : message du dernier relevé', () => {
  it('test_message_in_w10_block_not_seal', () => {
    const dom = render(withMsg(sheetOf(weekEndOf()), 'patience'));
    const block = dom.querySelector('[data-testid="bilan-w10-block"]')!;
    const msg = dom.querySelector('[data-testid="bilan-message"]')!;
    expect(msg.parentElement).toBe(block);
    expect(msg.textContent).toBe(nb(t.t('w10.msg.patience')));
    expect(msg.querySelector('.c-eye__pupil')).not.toBeNull();
    expect(msg.querySelector('.c-eye')!.getAttribute('style')).toContain('24px');
    for (const e of [msg, block, ...msg.querySelectorAll('*')]) {
      expect(e.getAttribute('style') ?? '').not.toMatch(/rotate/);
      expect(e.className.toString()).not.toMatch(/sticker|seal|badge|stamp/);
    }
    const fate = dom.querySelector('[data-testid="bilan-fate"]')!;
    expect(fate.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('test_four_messages_same_bilan_treatment', () => {
    const shape = (m: PalierId): string => render(withMsg(sheetOf(weekEndOf()), m)).querySelector('[data-testid="bilan-w10-block"]')!.outerHTML.replace(nb(t.t(`w10.msg.${m}`)), '');
    expect(new Set(PALIERS.map(shape)).size).toBe(1);
  });

  it('test_share_image_has_no_w10_msg', () => {
    for (const lang of ['fr', 'en'] as const) {
      const i18n = realI18n(lang);
      const input = weekEndOf();
      const data = buildBilan(input, { core: bilanCtx().core, common: loadBilanCommon(), lived: W10, computedFile: null, has: (k) => i18n.has(k) });
      expect(data.sheet!.lastMessage).not.toBeNull();
      const blob = JSON.stringify(shareLines(data, i18n, true));
      for (const [k, v] of Object.entries((lang === 'fr' ? fr : en) as Record<string, string>)) if (k.startsWith('w10.msg.')) expect(blob, k).not.toContain(v);
    }
  });
});

describe('bilan C : sobriété', () => {
  it('test_bilan_has_no_confetti_and_no_juice_event', async () => {
    const src = SRC('screens/bilan/index.ts') + SRC('screens/bilan/sheetC.ts');
    expect(src).not.toMatch(/confetti|regime\.|bracelet\.|oeil\.|ui\.(cost|price|confirm|designate)/);
    const events = createUiEvents();
    const { root } = await mountScreen(createBilanScreen({ animator: createInstantAnimator(), events, reducedMotion: false }), bilanCtx(), { input: weekEndOf() });
    root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button').forEach((b) => b.click());
    expect(events.log().every((e) => e === 'ui.page')).toBe(true);
    expect(root.querySelector('[class*="confetti"], [data-confetti]')).toBeNull();
  });

  it('test_page_change_emits_ui_page_and_plays_page_change', async () => {
    const events = createUiEvents();
    const animator = createInstantAnimator();
    const { root } = await mountScreen(createBilanScreen({ animator, events, reducedMotion: false }), bilanCtx(), { input: weekEndOf() });
    expect(events.log()).toEqual([]);   // le premier rendu n'est pas un changement de page
    expect(animator.played()).toHaveLength(0);
    root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button')[2]!.click();
    expect(events.log()).toEqual(['ui.page']);
    const played = animator.played();
    expect(played).toHaveLength(1);
    expect(played[0]!.el).toBe(root.querySelector('[data-testid="bilan-page"]'));
    const timing = loadUi().timing.motion.pageChange.v;
    expect(played[0]!.spec.options.duration).toBe(timing.ms);
    expect(JSON.stringify(played[0]!.spec.keyframes)).toContain('translateX');
    toggle(root).click();   // la bascule douce ne change pas de page
    expect(events.log()).toEqual(['ui.page']);
  });

  it('test_page_change_reduced_motion_is_a_short_fade', async () => {
    const animator = createInstantAnimator();
    const { root } = await mountScreen(createBilanScreen({ animator, events: createUiEvents(), reducedMotion: true }), bilanCtx(), { input: weekEndOf() });
    root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button')[1]!.click();
    const p = animator.played();
    expect(p).toHaveLength(1);
    expect(JSON.stringify(p[0]!.spec.keyframes)).not.toContain('translate');
    expect(Number(p[0]!.spec.options.duration)).toBeLessThanOrEqual(loadUi().timing.juice.reducedMaxMs.v);
  });

  it('test_bilan_pages_are_sober', async () => {
    const css = SRC('screens/bilan/bilan.css');
    expect(css).not.toMatch(/rotate|animation|transition|@keyframes|filter|mix-blend|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/);
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    const pages = root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button');
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((b) => {
      b.click();
      for (const e of root.querySelectorAll('[data-testid="bilan-page"] *')) expect(e.getAttribute('style') ?? '', e.outerHTML.slice(0, 60)).not.toMatch(e.closest('.c-eye') !== null ? /rotate|#[0-9a-f]{3,8}|rgb/i : /rotate|transform|#[0-9a-f]{3,8}|rgb/i);   // le reflet de l'Œil se décale par translate, fixe [P-1]
    });
    expect(root.querySelector('main')!.className).toContain('c-bilan');
  });

  it('test_tabs_and_actions_follow_the_c_pills', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    const css = SRC('screens/bilan/bilan.css');
    expect(css).toMatch(/\[aria-current="page"\][^{]*\{[^}]*background:\s*var\(--c-encre\)[^}]*color:\s*var\(--c-blanc\)/);
    expect(css).toMatch(/\[data-ui="page-nav"\] button\s*\{[^}]*background:\s*var\(--c-lavande-claire\)[^}]*color:\s*var\(--c-encre\)/);
    expect(root.querySelector('[data-testid="bilan-replay"]')!.className).toContain('c-action');
    for (const id of ['bilan-sources']) expect(root.querySelector(`[data-testid="${id}"]`)!.className).toContain('c-pill--creme');
    expect(root.querySelector('[data-testid="bilan-sources"]')!.className).not.toContain('c-action');
  });

  it('test_bilan_text_comes_from_keys', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    const known = new Set(Object.values(fr as Record<string, string>));
    // l'onglet est « intitulé · libellé » : deux clés assemblées, couvertes par bilan_screen_test
    for (const s of visibleTexts(root, '[data-ui="page-nav"]')) expect(known.has(s) || /^[\p{L}\d' ,.:;·()\-–—!?]+$/u.test(s) && [...known].some((k) => k.includes(s)), `texte hors clés : « ${s} »`).toBe(true);
  });
});

describe('bilan C : typographie et grille', () => {
  it('test_nbsp_before_colon_semicolon_question_exclamation', () => {
    expect(frenchSpaces('Tu as répondu : personne.')).toBe('Tu as répondu\u00A0: personne.');
    expect(frenchSpaces('a ; b ? c !')).toBe('a\u00A0; b\u00A0? c\u00A0!');
    expect(frenchSpaces('Monday, March 4')).toBe('Monday, March 4');
    const span = createDaysRow([{ day: 1, dateKey: 'q.Q11.date', textKey: 'w10.bilan.day.audition.j7.none', origin: 'evening' }], t);
    expect(span.textContent).not.toMatch(/ [:;?!]/);
    // la chaîne de la langue ne bouge pas
    expect((fr as Record<string, string>)['bilan.sheet.title']).toBeDefined();
  });

  it('test_day_line_with_colon_keeps_the_colon_on_the_line', () => {
    const key = Object.entries(fr as Record<string, string>).find(([k, v]) => /^w10\.bilan\.day\./.test(k) && / :/.test(v));
    expect(key, 'une ligne de jour porte un deux-points').toBeDefined();
    const row = createDaysRow([{ day: 1, dateKey: 'q.Q11.date', textKey: key![0], origin: 'evening' }], t);
    expect(row.querySelector('[data-day-line]')!.textContent).toContain('\u00A0:');
  });

  it('test_days_use_the_same_seven_column_grid_as_the_kit', () => {
    const css = SRC('screens/bilan/bilan.css');
    const cols = (sel: string): string => new RegExp(`${sel.replace(/\./g, '\\.')}\\s*\\{[^}]*grid-template-columns:\\s*([^;]+);[^}]*gap:\\s*([^;]+);`).exec(css)!.slice(1, 3).join('|');
    expect(cols('.c-days')).toBe(cols('.c-kit'));
  });

  it('test_world_name_tokens_72_max_44_min_no_hyphens', () => {
    const { theme } = loadUi();
    expect(theme.type.worldName.v.px).toBe(72);
    expect(theme.type.worldName.v.weight).toBe(600);
    expect(theme.shape.worldNameMin.v).toBe(44);
    const css = SRC('screens/bilan/bilan.css');
    const rule = /\.c-world-name\s*\{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toContain('hyphens: none');
    expect(rule).toContain('var(--s-world-name-min)');
    expect(rule).toContain('var(--t-world-name-size)');
    expect(rule).not.toMatch(/overflow-wrap:\s*(anywhere|break-word)/);
  });
});
