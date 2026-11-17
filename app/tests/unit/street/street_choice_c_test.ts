// @vitest-environment happy-dom
/**
 * Panneau d'options de la rue, interface C [plan UI-C T6 ; spec C §3.2, I-4, I-5, I-8 ; D1, D5].
 * Désignation identique pour toutes les options, pièce de prix, ligne de prix sobre, refus système, libellés des 104 options.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, UiHandle } from '../../../src/street/ui';
import type { PriceLine, Rejected } from '../../../src/engine/moments';
import { choiceViews, optionLabelKey } from '../../../src/street/runtime';
import { buildLedger } from '../../../src/engine/moments/words';
import type { ActRecord } from '../../../src/shared/types/street';
import { createInstantAnimator } from '../../../src/ui/motion';
import { loadUi } from '../../../src/data/ui/load';
import { PROVISIONAL } from '../../../src/validate/provisional';
import { ruleFor } from '../../../src/i18n/i18n';
import type { StringMeta } from '../../../src/i18n/i18n';
import { checkPlayerString } from '../../../src/validate/numbers';
import metaJson from '../../../src/data/strings/meta.json';
import { ctxW10 } from '../../support/street';
import { EN, FR, realI18n } from '../../support/street_ui';

const meta = metaJson as StringMeta;
const ctx = ctxW10();
const forbidden = ctx.world.forbiddenWords;
const street = loadUi().theme.street;
const HIDDEN: readonly string[] = street.hidePricePillFor.v;
const ALL_IDS = ctx.street.choices.map((c) => c.id);
const i18nFr = realI18n('fr');
const viewOf = (id: string): ChoiceView => choiceViews([id], ctx, i18nFr)[0]!;

const q = (s: string): Element | null => document.body.querySelector(s);
const qa = (s: string): Element[] => [...document.body.querySelectorAll(s)];
const key = (el: Element, k: string): void => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); };
let ui: UiHandle;
let animator: ReturnType<typeof createInstantAnimator>;
const mount = (extra: { arrowKeys?: boolean } = {}): UiHandle => {
  animator = createInstantAnimator();
  return (ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n('fr'), { reducedMotion: false, animator, ...extra }));
};
const priceFor = (c: ChoiceView, optionId: string): PriceLine => ({ choiceId: c.id, optionId, textKey: 'w10.price.relecture', isRefusal: false, inventoryParams: {} });
const REJECTED: Rejected = { act: { day: 1, kind: 'choice', id: 'checkpoint.j1', minute: 450 } as Rejected['act'], reason: 'choiceClosed' };
const attrsOf = (e: Element, skip: readonly string[] = []): Record<string, string> =>
  Object.fromEntries([...e.attributes].filter((a) => !skip.includes(a.name)).map((a) => [a.name, a.value]));
/** Forme d'un bouton hors texte : balises, classes, attributs (hors `data-option`), présence de la pièce. */
const shape = (b: Element): unknown => ({ attrs: attrsOf(b, ['data-option']), kids: [...b.children].map((k) => ({ tag: k.tagName, cls: k.className, attrs: attrsOf(k) })) });

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('libellés des options (D1)', () => {
  it('test_option_label_never_reads_a_price_key', () => {
    for (const id of ALL_IDS) for (const o of viewOf(id).options) {
      expect(o.labelKey, `${id}.${o.id}`).not.toMatch(/^w10\.price\./);
      expect(o.labelKey).not.toBe('street.ui.continue');
    }
  });

  it('test_every_option_has_a_choice_label_key', () => {
    for (const c of ctx.street.choices) for (const o of c.options) {
      const k = optionLabelKey(c.id, o.id);   // `buy:bons` devient `buy.bons` : la grammaire des clés refuse `:`
      expect(viewOf(c.id).options.find((x) => x.id === o.id)!.labelKey).toBe(k);
      for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
        expect(table[k], `${lang} ${k}`).toBeTruthy();
        expect(checkPlayerString(table[k]!, lang, ruleFor(meta, k), forbidden), `${lang} ${k}`).toEqual([]);
      }
    }
  });

  it('test_no_two_options_of_a_choice_share_a_label_key_or_text', () => {
    for (const id of ALL_IDS) {
      const opts = viewOf(id).options;
      expect(new Set(opts.map((o) => o.labelKey)).size, id).toBe(opts.length);
      for (const table of [FR, EN]) expect(new Set(opts.map((o) => table[o.labelKey])).size, id).toBe(opts.length);
    }
  });

  it('test_choice_labels_are_provisional_owned_by_writer', () => {
    const e = PROVISIONAL.find((p) => p.kind === 'strings' && p.prefix === 'w10.choice');
    expect(e?.owner).toBe('writer');
    expect(meta['w10.choice']?.policy).toBe('voice');
  });

  it('test_new_ui_keys_exist_in_both_locales_and_are_provisional', () => {
    for (const k of ['street.ui.words.unit', 'street.ui.words.price.one', 'street.ui.words.price.other', 'street.ui.words.none']) for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
      expect(table[k], `${lang} ${k}`).toBeTruthy();
      expect(ruleFor(meta, k).policy).toBe('inventory');
      expect(checkPlayerString(table[k]!, lang, ruleFor(meta, k), forbidden), `${lang} ${k}`).toEqual([]);
    }
    expect(ruleFor(meta, 'street.ui.words.price.other').numericParams).toContain('n');
    const e = PROVISIONAL.find((p) => p.kind === 'strings' && p.prefix === 'street.ui.words');
    expect(e?.owner).toBe('writer');
  });
});

describe('repos et désignation identiques [I-4, GD 3d]', () => {
  it('test_all_options_identical_at_rest', () => {
    for (const id of ALL_IDS) {
      mount(); ui.showChoices([viewOf(id)]);
      const shapes = qa('[data-choice] button[data-option]').map(shape);
      expect(shapes.length, id).toBe(viewOf(id).options.length);
      for (const s of shapes) expect(s, id).toEqual(shapes[0]);
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  it('test_designation_identical_for_every_option_including_refusal', () => {
    const c = viewOf('j3.marlene'); expect(c.options.some((o) => o.isRefusal)).toBe(true);
    const seen: { attrs: unknown; spec: unknown; log: unknown }[] = [];
    for (const o of c.options) {
      mount(); ui.showChoices([c]);
      const before = animator.played().length;      // l'entrée des options (décalée par rang) n'est pas la désignation
      (q(`[data-option="${o.id}"]`) as HTMLElement).click();
      ui.showPrice(priceFor(c, o.id));
      const b = q(`[data-option="${o.id}"]`)!;
      const played = animator.played().slice(before).filter((p) => p.el.matches(`[data-option="${CSS.escape(o.id)}"]`));   // l'élément a été redessiné : on suit l'option, pas le nœud
      seen.push({ attrs: attrsOf(b, ['data-option']), spec: played.map((p) => p.spec), log: ui.events.log() });
      ui.dispose(); document.body.innerHTML = '';
    }
    expect(seen.length).toBe(c.options.length);
    for (const s of seen) expect(s).toEqual(seen[0]);
    expect((seen[0]!.log as string[])).toEqual(['ui.designate', 'ui.price.reveal']);
    expect((seen[0]!.spec as unknown[]).length).toBeGreaterThan(0);
  });

  it('test_designation_readable_without_color', () => {   // D5
    const c = viewOf('j3.marlene'); mount(); ui.showChoices([c]);
    (q('[data-option="name"]') as HTMLElement).click();
    const b = q('[data-option="name"]') as HTMLElement;
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-option="banal"]')?.getAttribute('aria-pressed')).toBe('false');
    const spec = animator.played().find((p) => p.el.matches('[data-option="name"]') && p.spec.keyframes.length === 2 && p.spec.keyframes[1]!['width'] !== undefined)!.spec;
    const last = spec.keyframes.at(-1)!;
    expect(last['width']).toBe(`${street.optionDesignatedWidthPx.v}px`);      // largeur 720
    expect(last['transform']).toContain(`${street.designatedRotationDeg.v}deg`);
    // le liseré blanc et la largeur sont posés par la feuille, sur l'état aria-pressed, depuis les jetons
    const css = readCss() + readFileSync(resolve(process.cwd(), 'src/ui/c.css'), 'utf8');   // placement dans ui.css, aspect dans c.css
    expect(css).toMatch(/\[aria-pressed="true"\][^}]*var\(--s-street-designated-rim-px\)/);
    expect(css).toMatch(/var\(--s-street-option-designated-width-px\)/);
  });

  it('test_designating_again_deselects_and_emits_undesignate', () => {
    const c = viewOf('j3.marlene'); mount(); ui.showChoices([c]);
    (q('[data-option="name"]') as HTMLElement).click(); (q('[data-option="name"]') as HTMLElement).click();
    expect(ui.events.log()).toEqual(['ui.designate', 'ui.undesignate']);
    expect(q('[data-option="name"]')?.getAttribute('aria-pressed')).toBe('false');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
function readCss(): string { return readFileSync(resolve(process.cwd(), 'src/street/ui/ui.css'), 'utf8'); }

describe('pièce de prix [I-4, GD 3e, P-3]', () => {
  it('test_price_pill_hidden_for_every_option_of_a_hidden_choice', () => {
    expect(HIDDEN.length).toBe(4);
    for (const id of HIDDEN) { mount(); ui.showChoices([viewOf(id)]); expect(qa('[data-ui="price-pill"]').length, id).toBe(0); ui.dispose(); document.body.innerHTML = ''; }
  });

  it('test_every_unsourced_naming_price_is_hidden', () => {
    const named = ctx.street.choices.filter((c) => c.options.some((o) => (o.id === 'name' || o.id === 'declare') && o.words > 0));
    expect(named.length).toBeGreaterThan(0);
    for (const c of named) expect(HIDDEN, c.id).toContain(c.id);
  });

  it('test_price_pill_shows_words_for_other_choices', () => {
    const other = ALL_IDS.filter((id) => !HIDDEN.includes(id) && viewOf(id).options.some((o) => o.words > 0));
    expect(other.length).toBeGreaterThan(0);
    for (const id of other) {
      const v = viewOf(id); mount(); ui.showChoices([v]);
      for (const o of v.options) {
        const pill = q(`[data-choice="${id}"] [data-option="${CSS.escape(o.id)}"] [data-ui="price-pill"]`);
        expect(pill?.textContent, `${id}.${o.id}`).toBe(o.words > 0 ? i18nFr.tPlural('street.ui.words.price', o.words, { n: o.words }) : i18nFr.t('street.ui.words.none'));
      }
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  it('test_price_pill_for_one_word_is_singular_in_both_locales', () => {
    // « 1 mots » était affiché : la pièce passe par le pluriel de la langue (clés `.one` / `.other`)
    const one: ChoiceView = { id: 'c.one', labelKey: 'w10.choice.checkpoint.j1.comply', blocksExit: false, options: [{ id: 'a', labelKey: 'w10.choice.checkpoint.j1.comply', isRefusal: false, words: 1 }, { id: 'b', labelKey: 'w10.choice.checkpoint.j1.bypass', isRefusal: false, words: 2 }] };
    for (const [lang, want] of [['fr', ['1 mot', '2 mots']], ['en', ['1 word', '2 words']]] as const) {
      animator = createInstantAnimator();
      ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n(lang), { reducedMotion: false, animator });
      ui.showChoices([one]);
      expect(qa('[data-ui="price-pill"]').map((e) => e.textContent), lang).toEqual(want);
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  // Décision GD 2026-11-02 (piece-prix-checkpoint-gd.md) : la pièce lit le coût que le relevé retire vraiment.
  it('test_checkpoint_pill_equals_the_words_the_ledger_takes', () => {
    const cps = ctx.street.choices.filter((c) => c.id.startsWith('checkpoint.'));
    expect(cps.length).toBe(7);
    for (const c of cps) for (const o of viewOf(c.id).options) {
      const act: ActRecord = { day: 1, minute: 450, kind: 'lane', id: 'checkpoint', option: o.id } as ActRecord;
      const taken = buildLedger(1, [act], ctx).wordsSpent - buildLedger(1, [], ctx).wordsSpent;
      expect(o.words, `${c.id}.${o.id}`).toBe(taken);
    }
  });

  it('test_no_zero_words_pill_on_the_checkpoint_options', () => {
    for (const c of ctx.street.choices.filter((x) => x.id.startsWith('checkpoint.'))) {
      mount(); ui.showChoices([viewOf(c.id)]);
      const pills = qa('[data-ui="price-pill"]');
      expect(pills.length, c.id).toBe(c.options.length);              // la pièce reste sur chaque option, contourner compris [I-4]
      for (const p of pills) expect(p.textContent, c.id).not.toMatch(/(^|\D)0 mots/);
      const by = (id: string): string | null | undefined => q(`[data-option="${CSS.escape(id)}"] [data-ui="price-pill"]`)?.textContent;
      expect(by('comply')).toBe(i18nFr.tPlural('street.ui.words.price', ctx.street.checkpoint.forcedWords.comply, { n: ctx.street.checkpoint.forcedWords.comply }));
      expect(by('buy:bons')).toBe(i18nFr.tPlural('street.ui.words.price', ctx.street.checkpoint.forcedWords.buy, { n: ctx.street.checkpoint.forcedWords.buy }));
      expect(by('courtesy')).toBe(i18nFr.tPlural('street.ui.words.price', ctx.street.checkpoint.forcedWords.comply, { n: ctx.street.checkpoint.forcedWords.comply }));   // la file courte est une forme de « se plier » [GD 2026-11-02, bible §7.4]
      expect(by('bypass')).toBe(i18nFr.t('street.ui.words.none'));
      expect(by('refuse')).toBe(i18nFr.t('street.ui.words.none'));
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  it('test_courtesy_costs_what_comply_costs_in_the_ledger_and_on_the_pill', () => {
    const forced = ctx.street.checkpoint.forcedWords;
    const spent = (option: string): number => buildLedger(1, [{ day: 1, minute: 450, kind: 'lane', id: 'checkpoint', option } as ActRecord], ctx).wordsSpent;
    expect(spent('courtesy')).toBe(forced.comply);
    expect(viewOf('checkpoint.j1').options.find((o) => o.id === 'courtesy')!.words).toBe(forced.comply);
  });

  it('test_a_choice_with_any_effective_cost_keeps_the_pill_on_every_option_and_zero_cost_choices_show_none', () => {
    for (const id of ALL_IDS.filter((x) => !HIDDEN.includes(x))) {
      const v = viewOf(id); mount(); ui.showChoices([v]);
      const pills = qa('[data-ui="price-pill"]').length;
      expect(pills, id).toBe(v.options.some((o) => o.words > 0) ? v.options.length : 0);   // le coût effectif (celui du relevé), jamais `words` brut
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  it('test_no_pill_text_reads_zero_words_anywhere', () => {
    for (const id of ALL_IDS) {
      mount(); ui.showChoices([viewOf(id)]);
      for (const p of qa('[data-ui="price-pill"]')) expect(p.textContent, id).not.toMatch(/(^|\D)0 (mots|words)/);
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  it('test_permit_choices_show_no_pill_because_no_option_costs_words', () => {
    for (const id of ALL_IDS.filter((x) => x.startsWith('permit.'))) {
      expect(viewOf(id).options.every((o) => o.words === 0), id).toBe(true);
      mount(); ui.showChoices([viewOf(id)]); expect(qa('[data-ui="price-pill"]').length, id).toBe(0);
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  it('test_choice_views_carry_words', () => {
    const j3 = viewOf('j3.marlene');
    expect(j3.options.find((o) => o.id === 'banal')!.words).toBe(8);
  });
});

describe('gestes, jus, refus système [I-4, I-5, I-6, I-8]', () => {
  it('test_confirm_emits_ui_confirm_for_refusal_and_non_refusal_alike', () => {
    const c = viewOf('j3.marlene'); const logs: string[][] = [];
    for (const o of c.options) {
      mount(); ui.showChoices([c]); (q(`[data-option="${o.id}"]`) as HTMLElement).click(); ui.showPrice(priceFor(c, o.id));
      ui.events.clear();
      (q('[data-ui="confirm"]') as HTMLElement).click();
      logs.push([...ui.events.log()]);
      ui.dispose(); document.body.innerHTML = '';
    }
    expect(logs[0]).toEqual(['ui.confirm']); expect(logs[1]).toEqual(logs[0]);
  });

  it('test_no_juice_event_before_confirm', () => {
    const c = viewOf('j3.marlene'); mount(); ui.showChoices([c]);
    (q('[data-option="name"]') as HTMLElement).click(); ui.showPrice(priceFor(c, 'name'));
    (q('[data-option="banal"]') as HTMLElement).click(); ui.showPrice(priceFor(c, 'banal'));
    (q('[data-option="banal"]') as HTMLElement).click();
    expect(ui.events.log().length).toBeGreaterThan(3);
    for (const e of ui.events.log()) expect(e).not.toMatch(/^(bracelet|oeil|regime)\./);
  });

  it('test_system_refusal_shakes_and_option_refusal_never_does', () => {
    const c = viewOf('j3.marlene'); mount(); ui.showChoices([c]);
    const refOpt = c.options.find((o) => o.isRefusal)!;
    (q(`[data-option="${refOpt.id}"]`) as HTMLElement).click(); ui.showPrice(priceFor(c, refOpt.id));
    (q('[data-ui="confirm"]') as HTMLElement).click();
    expect(ui.events.log()).not.toContain('ui.refusal.system');
    expect(q('[data-ui="refusal"]')).toBeNull();
    const shakes = (): number => animator.played().filter((p) => p.el.matches('[data-ui="refusal"]')).length;
    expect(shakes()).toBe(0);
    ui.showRefusal(REJECTED);
    const r = q('[data-ui="refusal"]')!;
    expect(r.getAttribute('role')).toBe('alert');
    expect(r.className).toContain('c-refusal');
    expect(ui.events.log().at(-1)).toBe('ui.refusal.system');
    const played = animator.played().filter((p) => p.el === r);
    expect(played.length).toBe(1);
    expect(played[0]!.spec.keyframes.map((k) => k['transform'])).toEqual(
      ['translateX(0px)', 'translateX(-4px)', 'translateX(4px)', 'translateX(-4px)', 'translateX(4px)', 'translateX(0px)']);
  });

  it('test_price_line_is_sober_and_rises_8px_with_a_fade', () => {   // I-6 : ni rotation ni récompense ; §4 : fondu et montée de 8 px
    const c = viewOf('j3.marlene'); mount(); ui.showChoices([c]);
    (q('[data-option="name"]') as HTMLElement).click(); ui.showPrice(priceFor(c, 'name'));
    const p = q('[data-ui="price"]')!;
    expect(p.className).toContain('c-card--ink'); expect(p.className).not.toContain('c-sober');   // c-sober annule la montée (transform: none !important)
    expect(ui.events.log()).toEqual(['ui.designate', 'ui.price.reveal']);
    const played = animator.played().filter((x) => x.el === p);
    expect(played.length).toBe(1);
    expect(played[0]!.spec.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateY(8px)' });
    expect(played[0]!.spec.keyframes.some((k) => String(k['transform'] ?? '').includes('rotate'))).toBe(false);
    expect(p.getAttribute('data-refusal')).toBeNull();
  });

  it('test_one_price_line_at_most', () => {   // I-8
    const a = viewOf('j3.marlene'); const b = viewOf('j4.neighbour'); mount(); ui.showChoices([a, b]);
    (q('[data-choice="j3.marlene"] [data-option="name"]') as HTMLElement).click(); ui.showPrice(priceFor(a, 'name'));
    (q('[data-choice="j4.neighbour"] [data-option="name"]') as HTMLElement).click(); ui.showPrice(priceFor(b, 'name'));
    expect(qa('[data-ui="price"]').length).toBe(1);
  });

  it('test_arrow_keys_move_focus_within_a_choice', () => {
    const a = viewOf('checkpoint.j1'); const b = viewOf('j3.marlene'); mount(); ui.showChoices([a, b]);
    const opts = qa('[data-choice="checkpoint.j1"] button[data-option]') as HTMLElement[];
    opts[0]!.focus(); key(opts[0]!, 'ArrowDown'); expect(document.activeElement).toBe(opts[1]);
    key(opts[1]!, 'ArrowUp'); expect(document.activeElement).toBe(opts[0]);
    const last = opts.at(-1)!; last.focus(); key(last, 'ArrowDown');
    expect(document.activeElement, 'la flèche continue vers l\'en-tête du groupe suivant (option C, spec §3.4)').toBe(qa('[data-choice="j3.marlene"] [data-ui="choice-name"]')[0]);
    ui.showChoices([a]); const only = qa('button[data-option]').at(-1)! as HTMLElement; only.focus(); key(only, 'ArrowDown');
    expect(document.activeElement, 'butée en bas d\'un panneau à un seul choix').toBe(only);
  });

  it('test_arrow_keys_off_when_flag_false', () => {
    const a = viewOf('checkpoint.j1'); mount({ arrowKeys: false }); ui.showChoices([a]);
    const opts = qa('button[data-option]') as HTMLElement[];
    opts[0]!.focus(); key(opts[0]!, 'ArrowDown'); expect(document.activeElement).toBe(opts[0]);
  });

  it('test_options_enter_from_the_right_with_stagger_only_on_opening', () => {
    const c = viewOf('checkpoint.j1'); mount(); ui.showChoices([c]);
    const entered = animator.played().filter((p) => p.el.matches('button[data-option]'));
    expect(entered.length).toBe(c.options.length);
    expect(entered.map((e) => e.spec.options.delay)).toEqual(c.options.map((_, i) => i * 60));
    const n = animator.played().length;
    (q('[data-option="comply"]') as HTMLElement).click();
    expect(animator.played().slice(n).some((p) => p.spec.keyframes.some((k) => String(k['transform'] ?? '').includes('translateX(40px)')))).toBe(false);
  });
});

describe('revue T6 : ligne de prix sous l\'option désignée, groupes nommés, focus', () => {
  const CP = (): ChoiceView => viewOf('checkpoint.j1');

  it('test_price_line_and_confirm_follow_the_designated_option_not_the_last', () => {   // spec §3.2 : « sous l'option désignée »
    const c = CP();
    for (const o of c.options) {
      mount(); ui.showChoices([c]);
      (q(`[data-option="${CSS.escape(o.id)}"]`) as HTMLElement).click(); ui.showPrice(priceFor(c, o.id));
      const b = q(`[data-option="${CSS.escape(o.id)}"]`)!;
      const dec = b.nextElementSibling;
      expect(dec?.getAttribute('data-ui'), `${o.id} : le pied suit l'option désignée`).toBe('foot');
      expect(dec?.firstElementChild?.getAttribute('data-ui'), `${o.id} : la ligne de prix en tête du pied`).toBe('price');
      expect(dec?.lastElementChild?.getAttribute('data-ui'), `${o.id} : Confirmer ferme le pied`).toBe('confirm');
      expect(qa('[data-ui="price"]').length).toBe(1);
      ui.dispose(); document.body.innerHTML = '';
    }
  });

  it('test_designation_scrolls_only_the_group_body_never_the_panel_so_headers_stay_put', () => {   // constat 30
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    try {
      const c = CP(); mount(); ui.showChoices([c, viewOf('m3.letter')]);
      (q('[data-option="refuse"]') as HTMLElement).click(); ui.showPrice(priceFor(c, 'refuse'));
      expect(spy, 'aucun scrollIntoView : il ferait défiler la liste des en-têtes').not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });

  it('test_each_open_choice_is_a_named_group_with_a_visible_boundary', () => {
    const a = viewOf('checkpoint.j1'); const b = viewOf('m3.letter'); mount(); ui.showChoices([a, b]);
    const groups = qa('[role="group"]');
    expect(groups.length).toBe(2);
    const names = groups.map((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent);
    expect(names).toEqual([i18nFr.t('w10.choice.checkpoint.j1'), i18nFr.t('w10.choice.m3.letter')]);
    expect(new Set(names).size).toBe(2);
    for (const g of groups) expect(document.getElementById(g.getAttribute('aria-labelledby')!)?.closest('[hidden]'), 'nom visible quand plusieurs choix').toBeNull();
    ui.showChoices([a]);
    const only = q('[role="group"]')!;
    expect(document.getElementById(only.getAttribute('aria-labelledby')!)?.textContent).toBe(i18nFr.t('w10.choice.checkpoint.j1'));   // nommé, sans afficher de titre
    expect(document.getElementById(only.getAttribute('aria-labelledby')!)?.hasAttribute('hidden')).toBe(true);
  });

  it('test_every_choice_has_a_group_name_key_in_both_locales', () => {
    for (const c of ctx.street.choices) {
      expect(viewOf(c.id).labelKey).toBe(`w10.choice.${c.id}`);
      for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
        const k = `w10.choice.${c.id}`;
        expect(table[k], `${lang} ${k}`).toBeTruthy();
        expect(checkPlayerString(table[k]!, lang, ruleFor(meta, k), forbidden), `${lang} ${k}`).toEqual([]);
      }
    }
  });

  it('test_focus_ring_keeps_the_designated_rim_and_the_drop_shadow', () => {   // revue 16 : le focus ne remplace pas l'ombre de l'option
    const css = readFileSync(resolve(process.cwd(), 'src/ui/c.css'), 'utf8');
    expect(css).toMatch(/\.c-street-option\[aria-pressed="true"\]:focus-visible\s*\{[^}]*var\(--s-street-designated-rim-px\)/);
    expect(css).toMatch(/\.c-street-option:focus-visible\s*\{[^}]*var\(--sh-encre\)/);
  });
});
