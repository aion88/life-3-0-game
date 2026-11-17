// @vitest-environment happy-dom
/**
 * Interface de la rue : textes par clé, deux gestes, prix avant confirmation, focus, Échap [plan 02a T11].
 * La locale d'essai entoure chaque texte de `[!!` `!!]` : une chaîne écrite en dur ressort sans marqueurs et fait échouer.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, UiHandle } from '../../../src/street/ui';
import type { RejectReason, Rejected, PriceLine } from '../../../src/engine/moments';
import type { EveningLine } from '../../../src/engine/moments/evening';
import { lineHalves } from '../../../src/engine/moments/rights';
import { RIGHT_IDS } from '../../../src/shared/types/street';
import { createI18n, ruleFor } from '../../../src/i18n/i18n';
import { checkPlayerString } from '../../../src/validate/numbers';
import metaJson from '../../../src/data/strings/meta.json';
import type { StringMeta } from '../../../src/i18n/i18n';
import { ctxW10 } from '../../support/street';
import { EN, FR, pseudo, pseudoI18n, realI18n, visibleElements, visibleTexts } from '../../support/street_ui';

const meta = metaJson as StringMeta;
const forbidden = ctxW10().world.forbiddenWords;       // la liste RÉELLE de w10, la même que les tests de plan 00 et 02b
const ARRIVAL = 'w10.street.trace.absent';             // seule famille `w10.street.*` existante : la ligne d'arrivée d'essai

const CHOICES: readonly ChoiceView[] = [
  { id: 'checkpoint.j1', labelKey: 'w10.price.checkpoint.bypass', blocksExit: false, options: [
    { id: 'comply', labelKey: 'w10.price.inv.checkpoint.comply', isRefusal: false, words: 14 },
    { id: 'bypass', labelKey: 'w10.price.checkpoint.bypass', isRefusal: true, words: 0 }] },
];
const J2_DOOR: ChoiceView = { id: 'j2.component', labelKey: 'w10.price.j2.component.hide', blocksExit: true, options: [
  { id: 'hide', labelKey: 'w10.price.j2.component.hide', isRefusal: false, words: 0 }, { id: 'take', labelKey: 'w10.price.j1.component.take', isRefusal: false, words: 0 }] };
const PRICE: PriceLine = { choiceId: 'checkpoint.j1', optionId: 'comply', textKey: 'w10.price.inv.checkpoint.comply', isRefusal: false, inventoryParams: {} };
const REJECTED: Rejected = { act: { day: 1, kind: 'choice', id: 'checkpoint.j1', minute: 450 } as Rejected['act'], reason: 'choiceClosed' };

const q = (s: string): Element | null => document.body.querySelector(s);
const click = (s: string): void => { (q(s) as HTMLElement).click(); };
const key = (k: string): void => { document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); };
const depth = (e: Element | null): number => { let d = 0; for (let n = e; n && n !== document.body; n = n.parentElement) d++; return d; };
let ui: UiHandle;
const mount = (lang: 'fr' | 'en' = 'fr'): UiHandle => (ui = mountUi(document.body.appendChild(document.createElement('div')), pseudoI18n(lang)));

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('interface de la rue [plan 02a T11]', () => {
  it('test_every_visible_text_comes_from_a_key', () => {
    mount();
    ui.setNarration(ARRIVAL); ui.setBracelet(3); ui.showChoices(CHOICES); ui.showPrice(PRICE); ui.showCard('nadia'); ui.showControls(true); ui.showNotSaved();
    ui.showCarnet(['move', 'speak']);
    const halves = lineHalves(FR['w10.right.move']!); ui.showRightLine({ first: pseudo(halves.first), second: pseudo(halves.second) });
    ui.showEvening([{ axis: 'vie', key: 'w10.evening.vie.fait' }, { axis: 'ia', key: 'w10.evening.ia.rien' }]);
    ui.showRefusal(REJECTED);
    const texts = visibleTexts(document.body, '[data-ui="bracelet"], [data-ui="card"]');
    expect(texts.length).toBeGreaterThan(8);
    for (const t of texts) expect(t, t).toMatch(/^\[!!.*!!\]$/s);
    ui.showNoGpu();
    for (const t of visibleTexts(q('[data-ui="nogpu"]')!)) expect(t).toMatch(/^\[!!.*!!\]$/s);
  });

  it('test_only_bracelet_and_card_show_digits', () => {
    mount();
    ui.setBracelet(3); ui.showChoices(CHOICES); ui.showPrice(PRICE); ui.showControls(true); ui.showNotSaved(); ui.showCard('nadia');
    ui.showEvening([{ axis: 'vie', key: 'w10.evening.vie.fait' }]); ui.showRefusal(REJECTED);
    ui.showCarnet([...RIGHT_IDS]);                                   // R-02a.17 (e), R-02a.19 : les deux zones à dates du monde sont montées
    const halves = lineHalves(FR['w10.right.move']!); ui.showRightLine({ first: pseudo(halves.first), second: pseudo(halves.second) });
    expect(q('[data-ui="carnet"]')).not.toBeNull(); expect(q('[data-ui="right-line"]')).not.toBeNull();
    const withDigits = visibleElements(document.body).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /\d/.test(n.textContent ?? '')));
    expect(withDigits.length).toBeGreaterThan(0);
    // La pièce de prix « N mots » dit le prix en mots de l'option : inventaire du bracelet, politique `inventory` [GD 3f, R-C2, plan UI-C T6].
    expect(withDigits.every((e) => e.matches('[data-ui="bracelet"], [data-ui="bracelet"] *, [data-ui="card"] *, [data-ui="carnet"] *, [data-ui="right-line"] *, [data-ui="price-pill"]'))).toBe(true);
    expect(withDigits.some((e) => e.matches('[data-ui="price-pill"]'))).toBe(true);
    expect(q('[data-ui="bracelet-value"]')?.textContent).toBe('3');
  });

  it('test_carnet_and_right_line_digits_come_verbatim_from_the_right_keys', () => {   // R-02a.19 : aucun chiffre composé par le code
    const digits = (s: string): string[] => s.match(/\d+/g) ?? [];
    document.body.innerHTML = ''; ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n('fr'));
    ui.showCarnet([...RIGHT_IDS]);
    const expectedCarnet = RIGHT_IDS.flatMap((id) => digits(FR[`w10.right.${id}`]!));
    expect(expectedCarnet.length).toBeGreaterThan(0);
    expect(digits(q('[data-ui="carnet"]')!.textContent ?? '')).toEqual(expectedCarnet);
    for (const id of RIGHT_IDS) {
      const h = lineHalves(FR[`w10.right.${id}`]!); ui.showRightLine({ first: h.first, second: h.second });
      expect(digits(q('[data-ui="right-line"]')!.textContent ?? ''), id).toEqual(digits(FR[`w10.right.${id}`]!));
    }
  });

  it('test_price_line_shows_before_confirm_and_confirm_is_a_separate_gesture', () => {
    mount(); const got: { gesture: string; optionId: string | null }[] = [];
    ui.onGesture((e) => got.push({ gesture: e.gesture, optionId: e.optionId })); ui.showChoices(CHOICES);
    expect(q('[data-ui="price"]')).toBeNull(); expect(q('[data-ui="confirm"]')).toBeNull();
    click('[data-choice="checkpoint.j1"] [data-option="comply"]');
    expect(got).toEqual([{ gesture: 'designate', optionId: 'comply' }]);
    ui.showPrice(PRICE);
    expect(q('[data-ui="price"]')?.textContent).toBe(pseudo(FR['w10.price.inv.checkpoint.comply']!));
    click('[data-ui="confirm"]');
    expect(got.map((g) => g.gesture)).toEqual(['designate', 'confirm']);
  });

  it('test_designating_again_deselects_and_emits_null', () => {
    mount(); const got: (string | null)[] = []; ui.onGesture((e) => got.push(e.optionId)); ui.showChoices(CHOICES);
    click('[data-option="comply"]'); ui.showPrice(PRICE); click('[data-option="comply"]');
    expect(got).toEqual(['comply', null]); expect(q('[data-ui="price"]')).toBeNull(); expect(q('[data-ui="confirm"]')).toBeNull();
  });

  it('test_refusal_has_the_same_rank_as_a_choice', () => {
    mount(); ui.showChoices(CHOICES); ui.showRefusal(REJECTED);
    const r = q('[data-ui="refusal"]')!; const c = q('[data-choice]')!;
    // option C : le refus vit sous la liste qui défile (jamais par-dessus un groupe), au même niveau que la liste des choix
    expect(r.parentElement).toBe(c.parentElement!.parentElement); expect(depth(r)).toBe(depth(c.parentElement!));
  });

  it('test_refusal_shows_without_open_choices_and_clears_on_next_choices', () => {
    mount(); ui.showRefusal(REJECTED);
    expect(q('[data-ui="refusal"]')).not.toBeNull(); expect(document.activeElement?.closest('[data-ui="choices"]') ?? null).toBeNull();
    ui.showChoices(CHOICES); expect(q('[data-ui="refusal"]')).toBeNull();
  });

  it('test_escape_closes_panels_but_not_a_blocking_choice', () => {
    mount(); ui.showCard('nadia'); key('Escape'); expect(q('[data-ui="card"]')).toBeNull();
    ui.showChoices([J2_DOOR]); key('Escape'); expect(q('[data-choice="j2.component"]')).not.toBeNull();
    ui.showChoices(CHOICES); key('Escape'); expect(q('[data-choice]')).toBeNull();
  });

  it('test_choice_panel_takes_and_returns_focus', () => {
    mount(); const opener = document.body.appendChild(document.createElement('button')); opener.focus(); expect(document.activeElement).toBe(opener);
    ui.showChoices(CHOICES); expect(document.activeElement?.closest('[data-ui="choices"]')).not.toBeNull();
    ui.showChoices([]); expect(document.activeElement).toBe(opener);
  });

  it('test_every_gesture_is_reachable_by_keyboard', () => {
    mount(); ui.showChoices(CHOICES); ui.showPrice(PRICE);
    const controls = [...document.body.querySelectorAll('[data-choice] button, [data-ui="confirm"]')];
    expect(controls.length).toBeGreaterThan(0);
    for (const c of controls) { expect(c.tagName).toBe('BUTTON'); expect((c as HTMLButtonElement).tabIndex).toBeGreaterThanOrEqual(0); }
  });

  it('test_ui_keys_exist_in_both_locales_and_pass_the_player_string_check', () => {
    const keys = ['street.ui.confirm', 'street.ui.continue', 'street.ui.noGpu', 'street.ui.controls', 'street.ui.sleep', 'street.ui.notSaved', 'street.ui.refusal.generic'];
    for (const k of keys) for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
      expect(table[k], `${lang} ${k}`).toBeTruthy();
      const rule = ruleFor(meta, k); expect(rule.policy).toBe('voice');
      expect(checkPlayerString(table[k]!, lang, rule, forbidden), `${lang} ${k}`).toEqual([]);
    }
  });

  it('test_every_reject_reason_has_a_refusal_key_in_both_locales', () => {
    const ALL: Record<RejectReason, true> = {          // typé contre l'union : une nouvelle raison casse la compilation
      invalidAct: true, unknownKind: true, unknownChoice: true, unknownOption: true, choiceClosed: true, outOfOrder: true, dayGap: true, exitBlocked: true,
      auditionPending: true, stallClosed: true, registreClosed: true, bonsInsufficient: true, stallEmpty: true, ended: true, unknownLine: true,
    };
    for (const reason of Object.keys(ALL)) for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
      const k = `street.ui.refusal.${reason}`;
      expect(table[k], `${lang} ${k}`).toBeTruthy();
      expect(checkPlayerString(table[k]!, lang, ruleFor(meta, k), forbidden), `${lang} ${k}`).toEqual([]);
    }
  });

  it('test_go_to_label_takes_a_numbered_place_but_only_in_place', () => {   // meta `street.ui.goTo` : numericParams ['place']
    const i18n = createI18n({ fr: FR, en: EN }, meta, 'fr', { mode: 'dev', report: () => undefined });
    expect(i18n.t('street.ui.goTo', { place: 'Marlène Kessel, du 9-B.' })).toBe('Aller à Marlène Kessel, du 9-B.');
    expect(() => i18n.t('street.ui.goTo', { place: 'la porte', n: 9 })).toThrow(/numeric/);   // un autre paramètre chiffré reste refusé
  });

  it('test_refusal_reads_its_reason_key_and_falls_back_to_generic', () => {
    mount(); ui.showRefusal({ ...REJECTED, reason: 'dayGap' });
    expect(q('[data-ui="refusal"]')?.textContent).toBe(pseudo(FR['street.ui.refusal.dayGap']!));
    ui.showRefusal({ ...REJECTED, reason: 'nope' as RejectReason });
    expect(q('[data-ui="refusal"]')?.textContent).toBe(pseudo(FR['street.ui.refusal.generic']!));
  });

  it('test_evening_renders_each_line_by_key_with_its_axis', () => {
    mount(); const lines: EveningLine[] = [{ axis: 'vie', key: 'w10.evening.vie.fait' }, { axis: 'ia', key: 'w10.evening.ia.rien' }];
    ui.showEvening(lines);
    const rows = [...document.body.querySelectorAll('[data-ui="evening"] [data-axis]')];
    expect(rows.map((r) => r.getAttribute('data-axis'))).toEqual(['vie', 'ia']);
    expect(rows.map((r) => r.textContent)).toEqual(lines.map((l) => pseudo(FR[l.key]!)));
  });

  it('test_carnet_lists_met_rights_by_key_and_hides_when_empty', () => {
    mount(); ui.showCarnet(['speak', 'move']);
    expect([...document.body.querySelectorAll('[data-ui="carnet"] li')].map((e) => e.textContent)).toEqual([pseudo(FR['w10.right.speak']!), pseudo(FR['w10.right.move']!)]);
    ui.showCarnet([]); expect(q('[data-ui="carnet"]')).toBeNull();
    for (const r of RIGHT_IDS) expect(FR[`w10.right.${r}`]).toBeTruthy();
  });

  it('test_right_line_shows_two_halves_and_clears_on_null', () => {
    mount(); ui.showRightLine({ first: 'A', second: 'B' });
    expect([...document.body.querySelectorAll('[data-ui="right-line"] [data-half]')].map((e) => e.textContent)).toEqual(['A', 'B']);
    ui.showRightLine(null); expect(q('[data-ui="right-line"]')).toBeNull();
  });

  it('test_controls_toggle', () => {
    mount(); ui.showControls(true); expect(q('[data-ui="controls"]')?.textContent).toBe(pseudo(FR['street.ui.controls']!));
    ui.showControls(false); expect(q('[data-ui="controls"]')).toBeNull();
  });

  it('test_narration_comes_from_an_existing_key', () => {
    mount(); ui.setNarration(ARRIVAL); expect(q('[data-ui="narration"]')?.textContent).toBe(pseudo(FR[ARRIVAL]!));
  });

  it('test_no_gpu_panel', () => { mount(); ui.showNoGpu(); expect(q('[data-ui="nogpu"]')).not.toBeNull(); });

  it('test_not_saved_notice_does_not_block', () => {
    mount(); ui.showChoices(CHOICES); ui.showNotSaved();
    expect(q('[data-ui="notSaved"]')).not.toBeNull(); expect(q('[data-choice]')).not.toBeNull();
    expect(document.activeElement?.closest('[data-ui="choices"]')).not.toBeNull();
  });

  it('test_language_change_rerenders_with_the_new_language', () => {
    const i18n = pseudoI18n('fr'); ui = mountUi(document.body.appendChild(document.createElement('div')), i18n);
    ui.setNarration(ARRIVAL); i18n.setLang('en');
    expect(q('[data-ui="narration"]')?.textContent).toBe(pseudo(EN[ARRIVAL]!));
  });

  it('test_real_texts_have_no_pseudo_markers_and_dispose_removes_everything', () => {
    const host = document.body.appendChild(document.createElement('div')); ui = mountUi(host, realI18n('en'));
    ui.showChoices(CHOICES); ui.showControls(true); expect(host.textContent).not.toContain('[!!');
    ui.dispose(); expect(host.childElementCount).toBe(0);
  });
});
