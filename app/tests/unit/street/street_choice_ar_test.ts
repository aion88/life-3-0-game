// @vitest-environment happy-dom
/**
 * Arbitrages ux du panneau de choix [design/ui/2026-11-02-choix-simultanes-ux.md §6, AR-3 à AR-10] : mode petit (bloc de décision, rangée « + N »),
 * dépli du checkpoint à l'arrivée (origine default / player, garde I-8), côté miroir conservé. Les mesures de boîtes (AR-1, AR-2, AR-10, AR-11) sont en e2e.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, GestureEvent, UiHandle } from '../../../src/street/ui';
import type { PriceLine } from '../../../src/engine/moments';
import { choiceViews } from '../../../src/street/runtime';
import { createInstantAnimator } from '../../../src/ui/motion';
import { ctxW10 } from '../../support/street';
import { EN, FR, realI18n } from '../../support/street_ui';

const ctx = ctxW10();
const i18n = realI18n('fr');
const view = (id: string): ChoiceView => choiceViews([id], ctx, i18n)[0]!;
const WORST = ['j1.phone', 'j1.component', 'm3.letter', 'm4.list', 'm5.yusuf', 'relecture.j1', 'permit.j1'];
const q = (s: string): HTMLElement | null => document.body.querySelector(s);
const qa = (s: string): HTMLElement[] => [...document.body.querySelectorAll<HTMLElement>(s)];
const key = (el: Element, k: string): void => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); };
const header = (id: string): HTMLElement => q(`[data-choice="${CSS.escape(id)}"] [data-ui="choice-name"]`)!;
const opt = (c: string, o: string): HTMLElement => q(`[data-choice="${CSS.escape(c)}"] [data-option="${CSS.escape(o)}"]`)!;
const price = (c: string, o: string): PriceLine => ({ choiceId: c, optionId: o, textKey: 'w10.price.relecture', isRefusal: false, inventoryParams: {} });
const visible = (e: Element): boolean => e.closest('[hidden]') === null;
let ui: UiHandle; let gestures: GestureEvent[];
const mount = (mode?: 'small' | 'medium' | 'large'): UiHandle => {
  gestures = [];
  ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n('fr'), { reducedMotion: false, animator: createInstantAnimator() });
  if (mode !== undefined) q('[data-ui="root"]')!.dataset['zoneMode'] = mode;
  ui.onGesture((e) => gestures.push(e));
  return ui;
};
beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('mode petit : l\'option tient son prix [AR-3, AR-5]', () => {
  it('test_small_mode_price_lives_in_a_decision_block_with_its_option_and_confirm_stays_out', () => {
    const c = view('m3.letter'); mount('small'); ui.showChoices([c]);
    opt(c.id, 'keep').click(); ui.showPrice(price(c.id, 'keep'));
    const dec = q('[data-ui="decision"]')!; expect(dec).not.toBeNull();
    const p = q('[data-ui="price"]')!;
    expect(dec.contains(p)).toBe(true); expect(dec.contains(opt(c.id, 'keep'))).toBe(true);
    expect(opt(c.id, 'keep').getAttribute('aria-describedby')).toBe(p.id); expect(p.id).not.toBe('');
    const ok = q('[data-ui="confirm"]')!;
    expect(dec.contains(ok)).toBe(false);
    expect(ok.parentElement!.querySelector('[data-ui="price"]'), 'le pied ne contient aucune ligne de prix').toBeNull();
  });

  it('test_small_mode_without_a_price_line_the_block_holds_the_option_alone', () => {
    const c = view('m3.letter'); mount('small'); ui.showChoices([c]);
    opt(c.id, 'keep').click(); ui.showPrice({ ...price(c.id, 'keep'), textKey: '' });
    expect(q('[data-ui="decision"]')!.contains(opt(c.id, 'keep'))).toBe(true); expect(q('[data-ui="price"]')).toBeNull();
  });

  it('test_medium_and_large_have_no_decision_block_and_the_price_is_in_the_foot', () => {
    for (const mode of ['medium', 'large'] as const) {
      document.body.innerHTML = ''; const c = view('m3.letter'); mount(mode); ui.showChoices([c]);
      opt(c.id, 'keep').click(); ui.showPrice(price(c.id, 'keep'));
      expect(q('[data-ui="decision"]'), mode).toBeNull();
      expect(q('[data-ui="foot"]')!.contains(q('[data-ui="price"]')!), mode).toBe(true);
      ui.dispose();
    }
  });

  it('test_small_mode_seven_groups_show_one_header_and_a_plus_n_button_that_lists_all', () => {
    mount('small'); ui.showChoices(WORST.map(view));
    const heads = qa('[data-ui="choice-name"]').filter(visible); expect(heads.length).toBe(1);
    const more = q('[data-ui="more-groups"]')!; expect(more).not.toBeNull();
    expect(more.textContent).toBe(i18n.t('street.ui.choices.more', { n: 6 }));
    expect(more.getAttribute('aria-label')).toBe(i18n.t('street.ui.choices.moreLabel', { n: 6 }));
    expect(more.getAttribute('aria-expanded')).toBe('false');
    more.click();
    expect(q('[data-ui="more-groups"]')!.getAttribute('aria-expanded')).toBe('true');
    expect(qa('[data-ui="choice-name"]').filter(visible).length, 'les sept en-têtes').toBe(7);
    key(document.activeElement ?? document.body, 'Escape');
    expect(q('[data-ui="more-groups"]')!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(q('[data-ui="more-groups"]'));
    expect(q('[data-ui="choices"]'), 'Échap ne ferme que la liste, pas le panneau').not.toBeNull();
  });

  it('test_small_mode_choosing_another_header_from_the_list_releases_the_designation', () => {
    const ids = ['m3.letter', 'm4.list', 'relecture.j1']; const [a, b] = ids.map(view) as [ChoiceView, ChoiceView, ChoiceView];
    mount('small'); ui.showChoices(ids.map(view));
    opt(a.id, 'keep').click(); ui.showPrice(price(a.id, 'keep'));
    ui.events.clear(); gestures.length = 0;
    q('[data-ui="more-groups"]')!.click(); header(b.id).click();
    expect(ui.events.log()).toContain('ui.undesignate');
    expect(gestures).toEqual([{ choiceId: a.id, optionId: null, gesture: 'designate' }]);
    expect(header(b.id).getAttribute('aria-expanded')).toBe('true');
    expect(q('[data-ui="more-groups"]')!.getAttribute('aria-expanded'), 'la liste se referme').toBe('false');
  });

  it('test_one_group_has_no_plus_n_row_in_small_mode', () => {
    mount('small'); ui.showChoices([view('m3.letter')]);
    expect(q('[data-ui="more-groups"]')).toBeNull();
  });
});

describe('dépli du checkpoint à l\'arrivée [AR-6 à AR-10]', () => {
  const cp = (): ChoiceView => view('checkpoint.j1');
  it('test_AR6_a_checkpoint_arriving_unfolds_when_the_player_holds_nothing', () => {
    const z = view('m3.letter'); mount(); ui.showChoices([z]);
    const live = q('[data-ui="choices-live"]')!;
    ui.showChoices([cp(), z]);
    expect(header(cp().id).getAttribute('aria-expanded')).toBe('true'); expect(header(z.id).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement?.closest('[data-choice]')?.getAttribute('data-choice'), 'le focus ne saute pas vers l\'arrivant').toBe(z.id); expect(live.textContent).not.toBe('');
  });
  it('test_AR7_a_designation_in_the_zone_keeps_it_unfolded', () => {
    const z = view('m3.letter'); mount(); ui.showChoices([z]);
    opt(z.id, 'keep').click(); ui.showPrice(price(z.id, 'keep')); ui.events.clear(); gestures.length = 0;
    ui.showChoices([cp(), z]);
    expect(header(z.id).getAttribute('aria-expanded')).toBe('true'); expect(opt(z.id, 'keep').getAttribute('aria-pressed')).toBe('true');
    expect(ui.events.log()).toEqual([]); expect(gestures).toEqual([]);
  });
  // AR-8 révisé par Cynthia (build 35ed56c) : le choix actif, celui qui vient d'arriver, est déplié d'office, même si le joueur avait déplié une autre zone
  it('test_AR8_the_arriving_active_choice_unfolds_even_over_a_zone_the_player_unfolded', () => {
    const [z, y] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView]; mount(); ui.showChoices([z, y]);
    header(y.id).click(); ui.showChoices([cp(), z, y]);
    expect(header(cp().id).getAttribute('aria-expanded')).toBe('true'); expect(header(y.id).getAttribute('aria-expanded')).toBe('false');
    expect(document.body.querySelectorAll(`[data-choice="${cp().id}"] [data-option]`).length, 'ses options sont visibles sans clic').toBeGreaterThan(0);
  });
  it('test_the_arriving_choice_unfolds_even_with_the_pointer_on_the_panel', () => {
    const z = view('m3.letter'); mount(); ui.showChoices([z]);
    document.body.querySelector('[data-ui="choices"] button')!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    ui.showChoices([cp(), z]);
    expect(header(cp().id).getAttribute('aria-expanded'), 'le survol ne retient pas le dépli du choix actif').toBe('true');
  });
  it('test_AR9_focus_in_the_panel_defers_the_unfold_until_it_leaves', () => {
    const z = view('m3.letter'); mount(); ui.showChoices([z]);
    opt(z.id, 'keep').focus(); key(opt(z.id, 'keep'), 'ArrowDown');   // le joueur tient le panneau au clavier
    ui.showChoices([cp(), z]);
    expect(header(z.id).getAttribute('aria-expanded'), 'focus dedans : rien ne bouge').toBe('true');
    (document.activeElement as HTMLElement).blur();
    document.body.querySelector('[data-ui="choices"]')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(header(cp().id).getAttribute('aria-expanded'), 'le focus est sorti : le checkpoint se déplie').toBe('true');
  });
  it('test_AR10_an_arriving_group_is_inserted_at_its_rank_not_at_the_bottom', () => {
    const [a, b] = ['m3.letter', 'm4.list'].map(view) as [ChoiceView, ChoiceView]; mount(); ui.showChoices([a, b]);
    ui.showChoices([cp(), a, b]);
    expect(qa('[data-choice]').map((e) => e.getAttribute('data-choice'))).toEqual([cp().id, a.id, b.id]);
  });
});

describe('côté miroir conservé', () => {
  it('test_the_panel_side_survives_a_re_render', () => {
    const c = view('m3.letter'); mount(); ui.showChoices([c]);
    q('[data-ui="choices"]')!.dataset['side'] = 'left';
    opt(c.id, 'keep').click(); ui.showPrice(price(c.id, 'keep'));
    expect(q('[data-ui="choices"]')!.dataset['side']).toBe('left');
  });
});

describe('textes de « + N »', () => {
  it('test_plus_n_keys_exist_in_both_locales', () => {
    for (const k of ['street.ui.choices.more', 'street.ui.choices.moreLabel']) for (const t of [FR, EN]) expect(t[k], k).toBeTruthy();
  });
});
