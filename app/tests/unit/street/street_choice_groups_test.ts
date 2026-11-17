// @vitest-environment happy-dom
/**
 * Choix simultanés en rue, option C : groupes, un seul déplié [design/ui/2026-11-02-choix-simultanes-ux.md ; critères A-2 à A-8, A-11, A-12 ; condition GD sur la désignation conservée].
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, GestureEvent, UiHandle } from '../../../src/street/ui';
import type { PriceLine } from '../../../src/engine/moments';
import { choiceViews, priceLineOf } from '../../../src/street/runtime';
import { createInstantAnimator } from '../../../src/ui/motion';
import { ruleFor } from '../../../src/i18n/i18n';
import type { StringMeta } from '../../../src/i18n/i18n';
import { checkPlayerString } from '../../../src/validate/numbers';
import metaJson from '../../../src/data/strings/meta.json';
import { ctxW10 } from '../../support/street';
import { EN, FR, realI18n } from '../../support/street_ui';

const meta = metaJson as StringMeta;
const ctx = ctxW10();
const i18n = realI18n('fr');
const view = (id: string): ChoiceView => choiceViews([id], ctx, i18n)[0]!;
/** Le pire cas mesuré (A-1) : sept choix ouverts ensemble, jour 1. */
const WORST = ['j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'relecture.j1', 'permit.j1'];

const q = (s: string): HTMLElement | null => document.body.querySelector(s);
const qa = (s: string): HTMLElement[] => [...document.body.querySelectorAll<HTMLElement>(s)];
const key = (el: Element, k: string): void => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); };
const header = (id: string): HTMLElement => q(`[data-choice="${CSS.escape(id)}"] [data-ui="choice-name"]`)!;
const opt = (c: string, o: string): HTMLElement => q(`[data-choice="${CSS.escape(c)}"] [data-option="${CSS.escape(o)}"]`)!;
const priceFor = (c: string, o: string): PriceLine => ({ choiceId: c, optionId: o, textKey: 'w10.price.relecture', isRefusal: false, inventoryParams: {} });
let ui: UiHandle; let animator: ReturnType<typeof createInstantAnimator>; let gestures: GestureEvent[];
const mount = (reduced = false): UiHandle => {
  animator = createInstantAnimator(); gestures = [];
  ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n('fr'), { reducedMotion: reduced, animator });
  ui.onGesture((e) => gestures.push(e));
  return ui;
};
/** Éléments qu'on peut atteindre : boutons hors de tout sous-arbre `hidden`, dans l'ordre du DOM (= l'ordre visuel). */
const focusables = (): HTMLElement[] => qa('[data-ui="choices"] button').filter((b) => b.closest('[hidden]') === null);

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('groupes et en-têtes [A-2, A-3, A-4]', () => {
  it('test_two_or_more_groups_one_visible_header_button_each_and_exactly_one_expanded', () => {
    mount(); ui.showChoices(WORST.slice(0, 3).map(view));
    const heads = qa('[data-ui="choice-name"]');
    expect(heads.length).toBe(3);
    for (const h of heads) { expect(h.tagName).toBe('BUTTON'); expect(h.closest('[hidden]')).toBeNull(); expect(h.hasAttribute('aria-expanded')).toBe(true); }
    expect(heads.filter((h) => h.getAttribute('aria-expanded') === 'true').length).toBe(1);
    expect(heads[0]!.getAttribute('aria-expanded')).toBe('true');                       // le premier de l'ordre
    const groups = qa('[role="group"]');
    expect(groups.filter((g) => !g.hasAttribute('hidden')).length).toBe(1);
  });

  it('test_one_group_has_no_visible_header_and_no_aria_expanded', () => {
    mount(); ui.showChoices([view('j3.marlene')]);
    const h = q('[data-ui="choice-name"]')!;
    expect(h.closest('[hidden]') !== null || h.hasAttribute('hidden')).toBe(true);
    expect(h.hasAttribute('aria-expanded')).toBe(false);
    expect(q('[role="group"]')!.hasAttribute('hidden')).toBe(false);
  });

  it('test_every_group_of_the_worst_case_is_labelled_by_an_existing_non_empty_header', () => {
    mount(); ui.showChoices(WORST.map(view));
    const groups = qa('[role="group"]'); expect(groups.length).toBe(7);
    for (const g of groups) {
      const h = document.getElementById(g.getAttribute('aria-labelledby') ?? '');
      expect(h, 'en-tête existant').not.toBeNull(); expect(h!.matches('[data-ui="choice-name"]')).toBe(true);
      expect(h!.textContent?.trim(), 'nom non vide').not.toBe('');
      expect(h!.getAttribute('aria-controls')).toBe(g.id);
    }
  });
});

describe('noms de groupes [A-8]', () => {
  it('test_every_choice_milestone_and_sleep_group_has_a_resolved_name_never_the_continue_key', () => {
    const ids = [...ctx.street.choices.map((c) => c.id), ...ctx.street.jalons.map((j) => j.id)];
    for (const id of ids) {
      const v = view(id);
      expect(v.labelKey, id).not.toBe('street.ui.continue');
      expect(i18n.has(v.labelKey), `${id} : ${v.labelKey}`).toBe(true);
      for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
        expect(table[v.labelKey]?.trim(), `${lang} ${v.labelKey}`).toBeTruthy();
        expect(checkPlayerString(table[v.labelKey]!, lang, ruleFor(meta, v.labelKey), ctx.world.forbiddenWords), `${lang} ${v.labelKey}`).toEqual([]);
        expect(table[v.labelKey]!.length, `${lang} ${id} : 24 caractères au plus`).toBeLessThanOrEqual(24);
      }
    }
    expect(FR['street.ui.sleep']).toBeTruthy();
  });

  it('test_announcement_keys_exist_in_both_locales_and_are_provisional', () => {
    for (const k of ['street.ui.choices.opened', 'street.ui.choices.closed', 'street.ui.choices.milestone']) for (const t of [FR, EN]) expect(t[k], k).toBeTruthy();
  });
});

describe('clavier [A-5, A-6]', () => {
  it('test_tab_order_is_headers_then_expanded_options_then_confirm_and_collapsed_options_are_out', () => {
    const [a, b, c] = ['checkpoint.j1', 'm3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView, ChoiceView];
    mount(); ui.showChoices([a, b, c]);
    (opt(a.id, 'bypass')).click(); ui.showPrice(priceFor(a.id, 'bypass'));
    const seq = focusables().map((e) => e.getAttribute('data-ui') === 'choice-name' ? `H:${e.closest('[data-choice]')!.getAttribute('data-choice')}` : e.getAttribute('data-ui') === 'confirm' ? 'confirm' : `o:${e.getAttribute('data-option')}`);
    const optsOfA = a.options.map((o) => `o:${o.id}`);
    const at = optsOfA.indexOf('o:bypass');
    expect(seq).toEqual([`H:${a.id}`, ...optsOfA.slice(0, at + 1), 'confirm', ...optsOfA.slice(at + 1), `H:${b.id}`, `H:${c.id}`]);
    for (const g of qa('[role="group"]').filter((x) => x.closest('[data-choice]')!.getAttribute('data-choice') !== a.id)) expect(g.hasAttribute('hidden')).toBe(true);
  });

  it('test_arrows_walk_the_whole_panel_with_stops_at_the_ends_and_home_end', () => {
    const [a, b] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView];
    mount(); ui.showChoices([a, b]);
    const optsA = a.options.map((o) => opt(a.id, o.id));
    optsA.at(-1)!.focus(); key(optsA.at(-1)!, 'ArrowDown');
    expect(document.activeElement, 'bas depuis la dernière option : l\'en-tête suivant').toBe(header(b.id));
    key(header(b.id), 'ArrowUp'); expect(document.activeElement, 'haut depuis l\'en-tête : la dernière option du groupe déplié').toBe(optsA.at(-1));
    optsA[0]!.focus(); key(optsA[0]!, 'ArrowUp'); expect(document.activeElement, 'haut depuis la première option : l\'en-tête du groupe').toBe(header(a.id));
    key(header(a.id), 'ArrowUp'); expect(document.activeElement, 'butée en haut').toBe(header(a.id));
    header(b.id).focus(); key(header(b.id), 'ArrowDown'); expect(document.activeElement, 'butée en bas (groupe replié)').toBe(header(b.id));
    key(header(b.id), 'Home'); expect(document.activeElement).toBe(focusables()[0]);
    key(document.activeElement!, 'End'); expect(document.activeElement).toBe(focusables().at(-1));
  });

  it('test_enter_on_a_header_expands_its_group_and_focus_stays_on_the_header', () => {
    const [a, b] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView];
    mount(); ui.showChoices([a, b]);
    header(b.id).focus(); header(b.id).click();
    expect(header(b.id).getAttribute('aria-expanded')).toBe('true'); expect(header(a.id).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(header(b.id));
    expect(opt(a.id, a.options[0]!.id).closest('[hidden]')).not.toBeNull();
    expect(opt(b.id, b.options[0]!.id).closest('[hidden]')).toBeNull();
  });
});

describe('désignation et groupes [A-7, A-11, condition GD]', () => {
  it('test_expanding_another_group_releases_the_designation_and_removes_confirm', () => {
    const [a, b] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView];
    mount(); ui.showChoices([a, b]);
    opt(a.id, 'keep').click(); ui.showPrice(priceFor(a.id, 'keep')); expect(q('[data-ui="confirm"]')).not.toBeNull();
    ui.events.clear(); gestures.length = 0;
    header(b.id).click();
    expect(ui.events.log()).toEqual(['ui.undesignate']);
    expect(gestures).toEqual([{ choiceId: a.id, optionId: null, gesture: 'designate' }]);
    expect(q('[data-ui="confirm"]')).toBeNull(); expect(q('[data-ui="price"]')).toBeNull();
    expect(header(b.id).getAttribute('aria-expanded')).toBe('true');
  });

  it('test_a_new_group_arriving_keeps_the_designation_the_focus_the_expanded_group_and_the_order', () => {
    const [a, b, c] = ['m3.letter', 'm4.list', 'relecture.j1'].map(view) as [ChoiceView, ChoiceView, ChoiceView];
    mount(); ui.showChoices([a, b]);
    header(b.id).click(); opt(b.id, 'read').click(); ui.showPrice(priceFor(b.id, 'read'));
    opt(b.id, 'read').focus(); ui.events.clear(); gestures.length = 0;
    ui.showChoices([a, b, c]);
    expect(opt(b.id, 'read').getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-ui="price"]')).not.toBeNull(); expect(q('[data-ui="confirm"]')).not.toBeNull();
    expect(document.activeElement).toBe(opt(b.id, 'read'));
    expect(header(b.id).getAttribute('aria-expanded')).toBe('true');
    expect(qa('[data-choice]').map((e) => e.getAttribute('data-choice'))).toEqual([a.id, b.id, c.id]);   // l'arrivant est en bas
    expect(ui.events.log()).toEqual([]); expect(gestures).toEqual([]);
  });

  it('test_kept_designation_is_released_when_its_price_changed_meanwhile', () => {   // le second geste ne confirme jamais un prix non vu
    const c = view('checkpoint.j1'); mount(); ui.showChoices([c, view('m3.letter')]);
    opt(c.id, 'comply').click(); ui.showPrice(priceFor(c.id, 'comply'));
    ui.events.clear(); gestures.length = 0;
    const changed: ChoiceView = { ...c, options: c.options.map((o) => (o.id === 'comply' ? { ...o, words: o.words + 1 } : o)) };
    ui.showChoices([changed, view('m3.letter')]);
    expect(opt(c.id, 'comply').getAttribute('aria-pressed')).toBe('false');
    expect(q('[data-ui="confirm"]')).toBeNull(); expect(q('[data-ui="price"]')).toBeNull();
    expect(ui.events.log()).toEqual(['ui.undesignate']);
    expect(gestures).toEqual([{ choiceId: c.id, optionId: null, gesture: 'designate' }]);
  });

  it('test_kept_designation_is_released_when_the_option_is_no_longer_offered_or_its_choice_leaves', () => {
    const c = view('checkpoint.j1'); const other = view('m3.letter');
    mount(); ui.showChoices([c, other]); opt(c.id, 'courtesy').click(); ui.showPrice(priceFor(c.id, 'courtesy'));
    ui.events.clear(); gestures.length = 0;
    ui.showChoices([{ ...c, options: c.options.filter((o) => o.id !== 'courtesy') }, other]);
    expect(q('[aria-pressed="true"]')).toBeNull(); expect(q('[data-ui="confirm"]')).toBeNull();
    expect(ui.events.log()).toEqual(['ui.undesignate']); expect(gestures).toEqual([{ choiceId: c.id, optionId: null, gesture: 'designate' }]);
    document.body.innerHTML = ''; ui.dispose(); mount(); ui.showChoices([c, other]); opt(c.id, 'bypass').click(); ui.showPrice(priceFor(c.id, 'bypass'));
    ui.events.clear(); gestures.length = 0;
    ui.showChoices([other]);
    expect(q('[data-ui="confirm"]')).toBeNull(); expect(ui.events.log()).toEqual(['ui.undesignate']);
    expect(gestures).toEqual([{ choiceId: c.id, optionId: null, gesture: 'designate' }]);
  });

  it('test_kept_designation_with_an_unchanged_price_survives_a_neighbour_leaving', () => {
    const [a, b] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView];
    mount(); ui.showChoices([a, b]); opt(a.id, 'keep').click(); ui.showPrice(priceFor(a.id, 'keep'));
    ui.showChoices([a]);
    expect(opt(a.id, 'keep').getAttribute('aria-pressed')).toBe('true'); expect(q('[data-ui="confirm"]')).not.toBeNull();
  });
});

describe('ligne de prix absente [GD 2026-11-02, ligne-prix-manquante]', () => {
  it('test_no_price_line_shows_confirm_alone_never_continue', () => {
    const c = view('m3.letter'); mount(); ui.showChoices([c]);
    opt(c.id, 'keep').click(); ui.showPrice({ choiceId: c.id, optionId: 'keep', textKey: '', isRefusal: false, inventoryParams: {} });
    expect(q('[data-ui="price"]'), 'aucune ligne : un trou visible, pas un faux prix').toBeNull();
    expect(q('[data-ui="confirm"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain(FR['street.ui.continue']!);
  });
  it('test_runtime_price_fallback_is_empty_for_every_option_not_the_continue_key', () => {
    for (const c of ctx.street.choices) for (const o of c.options) {
      const p = priceLineOf(c.id, o.id, { choiceId: c.id, optionId: o.id, textKey: o.priceLineKey ?? '', isRefusal: o.isRefusal, inventoryParams: {} });
      expect(p.textKey, `${c.id}.${o.id}`).not.toBe('street.ui.continue');
      if (o.priceLineKey == null) expect(p.textKey, `${c.id}.${o.id} : aucune ligne`).toBe('');
    }
    expect(priceLineOf('x', 'y', null).textKey).toBe('');
  });
});

describe('annonce, mouvement réduit, bandes [A-12, §3.5, §3.6]', () => {
  it('test_a_group_arriving_or_leaving_is_announced_in_a_polite_live_region', () => {
    const [a, b] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView];
    mount(); ui.showChoices([a]);
    const live = q('[data-ui="choices-live"]')!; expect(live.getAttribute('aria-live')).toBe('polite');
    ui.showChoices([a, b]); expect(live.textContent).toBe(i18n.t('street.ui.choices.opened', { name: i18n.t(b.labelKey) }));
    ui.showChoices([a]); expect(live.textContent).toBe(i18n.t('street.ui.choices.closed', { name: i18n.t(b.labelKey) }));
    expect(q('[data-ui="refusal"]')).toBeNull();
  });

  it('test_expanding_a_group_fades_in_under_120ms_when_motion_is_reduced_and_never_rises', () => {
    const [a, b] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView];
    mount(true); ui.showChoices([a, b]); const n = animator.played().length;
    header(b.id).click();
    const played = animator.played().slice(n);
    expect(played.length).toBeGreaterThan(0);
    for (const p of played) { expect(p.spec.options.duration).toBeLessThanOrEqual(120); expect(JSON.stringify(p.spec.keyframes)).not.toContain('translate'); }
  });

  it('test_ui_exposes_the_letterbox_band_as_one_css_variable_and_the_sheet_reads_it', () => {
    mount(); ui.setLetterboxBand(138);
    expect(q('[data-ui="root"]')!.style.getPropertyValue('--s-letterbox-band-px')).toBe('138px');
    ui.setLetterboxBand(0); expect(q('[data-ui="root"]')!.style.getPropertyValue('--s-letterbox-band-px')).toBe('0px');
    const css = readFileSync(resolve(process.cwd(), 'src/street/ui/ui.css'), 'utf8');
    expect(css).toMatch(/\[data-ui="choices"\]\s*\{[^}]*bottom:[^;}]*var\(--s-letterbox-band-px/);
    expect(css).toMatch(/\[data-ui="choices"\]\s*\{[^}]*max-height:[^;}]*var\(--s-letterbox-band-px/);
  });
});
