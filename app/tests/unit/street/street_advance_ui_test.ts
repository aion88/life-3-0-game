// @vitest-environment happy-dom
/** Continuer, avance rapide, choix-destinations [rue guidée T10 ; D136]. */
import { choiceViews } from '../../../src/street/runtime';
import { ctxW10 } from '../../support/street';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, GestureEvent, UiHandle } from '../../../src/street/ui';
import type { PriceLine } from '../../../src/engine/moments';
import { createInstantAnimator } from '../../../src/ui/motion';
import { realI18n } from '../../support/street_ui';

const i18n = realI18n('fr');
const t = (k: string, p?: Record<string, string | number>): string => i18n.t(k, p);
const q = (s: string): Element => document.body.querySelector(s)!;
const qa = (s: string): Element[] => [...document.body.querySelectorAll(s)];
const press = (init: KeyboardEventInit): void => { document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })); };
const space = (): void => press({ key: ' ', code: 'Space' });
const enter = (): void => press({ key: 'Enter', code: 'Enter' });
const key2 = (code: string, extra: KeyboardEventInit = {}): void => press({ key: code.replace('Digit', ''), code, ...extra });
const key = (code: string): void => key2(code);
const clickContinue = (): void => { (q('[data-ui="continue"]') as HTMLElement).click(); };

let ui: UiHandle; let gestures: GestureEvent[]; let calls: number;
const view = (id: string, words: readonly number[], priced = true): ChoiceView => ({
  id, labelKey: 'street.ui.choices.milestone', blocksExit: false, priced,
  options: words.map((w, i) => ({ id: String.fromCharCode(97 + i), labelKey: 'street.ui.sleep', isRefusal: false, words: w })),
});
const view3 = view('dest.test', [0, 0, 0]);
const viewNarrative = view('dest.narr', [8, 5, 0]);
const view3Priced = view('dest.priced', [3, 2, 1]);
const priceOf = (v: ChoiceView, i: number): PriceLine => ({ choiceId: v.id, optionId: v.options[i]!.id, textKey: 'street.ui.controls', isRefusal: false, inventoryParams: {} });
const css = readFileSync('src/street/ui/guided.css', 'utf8');
const ruleOf = (sel: string): string => css.split('\n').find((l) => l.startsWith(`${sel} {`)) ?? '';

beforeEach(() => {
  document.body.innerHTML = ''; gestures = []; calls = 0;
  ui = mountUi(document.body.appendChild(document.createElement('div')), i18n, { reducedMotion: false, animator: createInstantAnimator() });
  ui.onGesture((e) => { gestures.push(e); }); ui.onAdvance(() => { calls += 1; });
});
afterEach(() => { ui.dispose(); });

describe('Continuer et avance rapide', () => {
  it('test_continue_button_visible_and_named', () => { ui.showContinue(true); expect(q('[data-ui="continue"]').textContent).toBe(t('street.ui.continue')); });
  it('test_space_enter_click_advance_once_each', () => { ui.showContinue(true); for (const fire of [space, enter, clickContinue]) fire(); expect(calls).toBe(3); });
  it('test_keys_do_nothing_when_continue_hidden', () => { space(); enter(); expect(calls).toBe(0); ui.showContinue(true); ui.showContinue(false); space(); expect(calls).toBe(0); });
  it('test_skip_queue_label', () => { ui.showSkip('queue'); expect(q('[data-ui="skip"]').textContent).toBe(t('street.ui.skipQueue')); });
  it('test_skip_pass_label_and_removal', () => { ui.showSkip('pass'); expect(q('[data-ui="skip"]').textContent).toBe(t('street.ui.skip')); ui.showSkip(null); expect(document.body.querySelector('[data-ui="skip"]')).toBeNull(); });
  it('test_skip_click_calls_onSkip', () => { let n = 0; ui.onSkip(() => { n += 1; }); ui.showSkip('queue'); (q('[data-ui="skip"]') as HTMLElement).click(); expect(n).toBe(1); expect(calls).toBe(0); });
});

describe('choix-destinations', () => {
  const kd = (code: string, extra: KeyboardEventInit = {}): void => key2(code, extra);
  it('test_digit_keys_designate_then_confirm', () => {
    ui.showDestinations(view3); key('Digit2'); ui.showPrice(priceOf(view3, 1)); key('Digit2');
    expect(gestures).toEqual([{ choiceId: view3.id, optionId: 'b', gesture: 'designate' }, { choiceId: view3.id, optionId: 'b', gesture: 'confirm' }]);
  });
  it('test_second_press_before_price_does_not_confirm', () => {
    ui.showDestinations(view3); key('Digit2'); key('Digit2');
    expect(gestures.map((g) => g.gesture)).toEqual(['designate']);
  });
  it('test_unpriced_destination_confirms_on_second_press', () => {
    const v = view('dest.free', [0, 0, 0], false); ui.showDestinations(v); key('Digit1'); key('Digit1');
    expect(gestures.map((g) => g.gesture)).toEqual(['designate', 'confirm']);
  });
  it('test_held_key_repeat_is_ignored', () => { ui.showDestinations(view3); kd('Digit1', { repeat: true }); expect(gestures).toEqual([]); });
  it('test_destination_view_keeps_every_option_it_is_given', () => {   // le checkpoint présente jusqu'à 7 voies : aucune ne tombe en silence
    const v6 = view('dest.six', [0, 0, 0, 0, 0, 0]);
    ui.showDestinations(v6);
    expect(qa('[data-ui="destinations"] [data-option]').map((e) => e.getAttribute('data-option'))).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    key('Digit5'); expect(gestures).toEqual([{ choiceId: v6.id, optionId: 'e', gesture: 'designate' }]);
  });
  it('test_real_w10_checkpoint_and_j2_component_show_all_their_options', () => {   // 7e voie du checkpoint (refuse) et 4e option de j2.component (leaveVisible)
    const views = choiceViews(['checkpoint.j1', 'j2.component'], ctxW10(), { has: () => false }).map((v) => ({ ...v, labelKey: 'street.ui.choices.milestone', options: v.options.map((o) => ({ ...o, labelKey: 'street.ui.sleep' })) }));   // ids et nombre viennent des données, les libellés du banc d'essai
    expect(views.map((v) => v.options.length)).toEqual([7, 4]);
    for (const v of views) {
      ui.showDestinations(v);
      expect(qa('[data-ui="destinations"] [data-option]').map((e) => e.getAttribute('data-option'))).toEqual(v.options.map((o) => o.id));
    }
    expect(views[0]!.options.at(-1)!.id).toBe('refuse');
    expect(views[1]!.options.at(-1)!.id).toBe('leaveVisible');
  });
  it('test_options_are_numbered_one_to_three', () => { ui.showDestinations(view3); expect(qa('[data-ui="destinations"] [data-ui="number"]').map((e) => e.textContent)).toEqual(['1', '2', '3']); });
  it('test_other_digit_moves_designation_instead_of_confirming', () => {
    ui.showDestinations(view3); key('Digit1'); key('Digit3');
    expect(gestures.map((g) => `${g.optionId}:${g.gesture}`)).toEqual(['a:designate', 'c:designate']);
  });
  it('test_word_cost_shown_before_confirm', () => {
    ui.showDestinations(viewNarrative);
    const costs = qa('[data-ui="destinations"] li [data-ui="words"]').map((e) => e.textContent);
    expect(costs).toEqual([t('street.ui.words.price.other', { n: 8 }), t('street.ui.words.price.other', { n: 5 }), t('street.ui.words.none')]);
    expect(gestures).toEqual([]);
    key('Digit1');
    expect(q('[data-ui="destinations"] li [data-ui="words"]').textContent).toBe(costs[0]);
  });
  it('test_accessible_name_names_place_and_cost', () => {
    ui.showDestinations(viewNarrative);
    const name = q('[data-ui="destinations"] [data-option="a"]').getAttribute('aria-label')!;
    expect(name).toContain(t('street.ui.goTo', { place: t('street.ui.sleep') })); expect(name).toContain(t('street.ui.words.price.other', { n: 8 }));
  });
  it('test_priced_destination_shows_price_before_confirm', () => {
    ui.showDestinations(view3Priced); key('Digit1');
    expect(gestures).toEqual([{ choiceId: view3Priced.id, optionId: view3Priced.options[0]!.id, gesture: 'designate' }]);
    expect(document.body.querySelector('[data-ui="price"]')).toBeNull();
    ui.showPrice(priceOf(view3Priced, 0)); expect(q('[data-ui="price"]').textContent).not.toBe('');
    key('Digit1'); expect(gestures.at(-1)).toMatchObject({ gesture: 'confirm', optionId: view3Priced.options[0]!.id });
  });
  it('test_confirm_button_emits_confirm', () => {
    ui.showDestinations(view3Priced); key('Digit2'); ui.showPrice(priceOf(view3Priced, 1)); (q('[data-ui="confirm"]') as HTMLElement).click();
    expect(gestures.at(-1)).toEqual({ choiceId: view3Priced.id, optionId: 'b', gesture: 'confirm' });
  });
  it('test_pipeline_events_designate_undesignate_confirm_and_reveal', () => {
    const keep = new Set(['ui.designate', 'ui.undesignate', 'ui.confirm', 'ui.price.reveal']); const seen: string[] = []; ui.events.on((n) => { if (keep.has(n)) seen.push(n); });
    ui.showDestinations(view3Priced); (q('[data-option="a"]') as HTMLElement).click(); ui.showPrice(priceOf(view3Priced, 0));
    (q('[data-ui="destinations"] [data-option="a"]') as HTMLElement).click();   // second clic : relâche
    (q('[data-option="b"]') as HTMLElement).click(); ui.showPrice(priceOf(view3Priced, 1)); (q('[data-ui="confirm"]') as HTMLElement).click();
    expect(seen).toEqual(['ui.designate', 'ui.price.reveal', 'ui.undesignate', 'ui.designate', 'ui.price.reveal', 'ui.confirm']);
  });
  it('test_destination_coexists_with_an_ordinary_priced_choice', () => {
    const other = view('other.priced', [4, 2]);
    ui.showChoices([other]); ui.showDestinations(view3Priced);
    expect(qa('[data-choice]').map((e) => e.getAttribute('data-choice')).sort()).toEqual(['dest.priced', 'other.priced']);
    (q('[data-choice="other.priced"] [data-option="a"]') as HTMLElement).click(); ui.showPrice(priceOf(other, 0));
    expect(q('[data-choice="other.priced"] [data-ui="price"]')).toBeTruthy();
    ui.showChoices([other]); expect(qa('[data-choice]').length).toBe(2);   // un renvoi des choix ordinaires garde la destination
  });
  it('test_refusal_routes_through_the_panel', () => {
    ui.showDestinations(view3Priced); ui.showRefusal({ act: { day: 1, kind: 'choice', id: 'x', minute: 450 } as never, reason: 'choiceClosed' });
    expect(q('[data-ui="refusal"]').textContent).toBe(t('street.ui.refusal.choiceClosed'));
  });
  it('test_removed_destinations_ignore_digits', () => { ui.showDestinations(view3); ui.showDestinations(null); key('Digit1'); expect(gestures).toEqual([]); expect(document.body.querySelector('[data-ui="destinations"]')).toBeNull(); });
  it('test_onGesture_returns_unsubscribe', () => { const got: GestureEvent[] = []; const off = ui.onGesture((e) => { got.push(e); }); off(); ui.showDestinations(view3); key('Digit1'); expect(got).toEqual([]); });
  it('test_space_inside_choices_does_not_advance', () => {
    ui.showContinue(true); ui.showDestinations(view3);
    q('[data-ui="destinations"]').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })); expect(calls).toBe(0);
  });
});

describe('feuille de style guidée', () => {
  it('test_new_css_has_no_literal_color_size_or_font', () => { expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|\d+px|font-family:\s*(?!\s|var\()/i); });   // `\s*[^v]` (brief) rétro-suit sur l'espace et rejette « font-family: var( » lui-même : lookahead à la place
  it('test_text_never_touches_frame', () => {
    for (const sel of ['[data-ui="continue"]', '[data-ui="skip"]', '[data-ui="destinations"] li']) expect(ruleOf(sel), sel).toMatch(/padding(-inline|-block)?\s*:\s*var\(--s-[a-z0-9-]+\)/);
  });
});
