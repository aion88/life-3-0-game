// @vitest-environment happy-dom
/**
 * Bracelet, Œil, décompte des mots et confettis : après confirmation seulement [plan UI-C T7 ; spec C §3.2, §4, §6, I-4, I-5, I-9, I-10 ; GD 3a, 3f].
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { ChoiceView, UiHandle } from '../../../src/street/ui';
import { coinSteps, confettiLayout, juiceFor } from '../../../src/street/ui/juice';
import { createInstantAnimator } from '../../../src/ui/motion';
import type { Animator } from '../../../src/ui/motion';
import { loadUi } from '../../../src/data/ui/load';
import { PALETTE_TOKENS } from '../../../src/data/schema/ui';
import type { PaletteToken } from '../../../src/data/schema/ui';
import { choiceViews } from '../../../src/street/runtime';
import { ctxW10 } from '../../support/street';
import { realI18n } from '../../support/street_ui';

const { timing } = loadUi();
const MAX = timing.juice.maxCoins.v;
const PIECES = timing.juice.confettiPieces.v;
const SIX: readonly PaletteToken[] = ['rose', 'ciel', 'soleil', 'menthe', 'lavande', 'creme'];
const ctx = ctxW10();
const marlene = choiceViews(['j3.marlene'], ctx, realI18n('fr'))[0]!;

const q = (s: string): HTMLElement | null => document.body.querySelector<HTMLElement>(s);
const flush = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });
const NOISE = new Set(['ui.designate', 'ui.undesignate', 'ui.price.reveal', 'ui.cost.reveal']);
const juiceLog = (ui: UiHandle): string[] => ui.events.log().filter((e) => !NOISE.has(e));

let ui: UiHandle;
let animator: ReturnType<typeof createInstantAnimator>;
const mount = (reduced = false, a?: Animator): UiHandle => {
  animator = createInstantAnimator();
  return (ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n('fr'), { reducedMotion: reduced, animator: a ?? animator }));
};
/** Le geste du joueur : désigne, confirme ; le « runtime » du test appelle `reactToConfirm` avant d'ôter les mots (comme `runtime.ts`). */
function confirmOption(h: UiHandle, c: ChoiceView, optionId: string): void {
  h.onGesture((e) => {
    if (e.gesture !== 'confirm') return;
    const o = c.options.find((x) => x.id === e.optionId)!;
    h.reactToConfirm({ isRefusal: o.isRefusal, words: o.words });
  });
  h.showChoices([c]);
  q(`[data-option="${optionId}"]`)!.click();
  h.showPrice({ choiceId: c.id, optionId, textKey: 'w10.price.relecture', isRefusal: false, inventoryParams: {} });
  h.events.clear();
  q('[data-ui="confirm"]')!.click();
}
const plain = (words: number, isRefusal = false): ChoiceView => ({ id: 'c1', blocksExit: false, priced: true, labelKey: 'street.ui.continue', options: [{ id: 'a', labelKey: 'street.ui.continue', isRefusal, words }] });

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('juiceFor, coinSteps, confettiLayout (purs)', () => {
  it('test_juice_for_refusal_is_flat', () => {
    expect(juiceFor({ isRefusal: true, words: 8 }, false, MAX)).toEqual({ coins: 0, shutter: false, confetti: false });
    expect(juiceFor({ isRefusal: true, words: 0 }, false, MAX)).toEqual({ coins: 0, shutter: false, confetti: false });
  });

  it('test_zero_price_non_refusal_has_no_juice', () => {
    expect(juiceFor({ isRefusal: false, words: 0 }, false, MAX)).toEqual({ coins: 0, shutter: false, confetti: false });
  });

  it('test_juice_for_non_refusal_and_reduced', () => {
    expect(juiceFor({ isRefusal: false, words: 8 }, false, MAX)).toEqual({ coins: 8, shutter: true, confetti: true });
    expect(juiceFor({ isRefusal: false, words: 8 }, true, MAX)).toEqual({ coins: 0, shutter: false, confetti: false });
  });

  it('test_coins_capped_at_twelve', () => {
    expect(juiceFor({ isRefusal: false, words: 30 }, false, MAX).coins).toBe(12);
    expect(juiceFor({ isRefusal: false, words: 12 }, false, MAX).coins).toBe(12);
  });

  it('test_coin_steps_end_exactly_at_target', () => {
    expect(coinSteps(41, 33, 8)).toEqual([40, 39, 38, 37, 36, 35, 34, 33]);
    const s = coinSteps(41, 21, 12);
    expect(s).toHaveLength(12);
    expect(s[0]).toBe(41 - Math.round(20 / 12));
    expect(s.at(-1)).toBe(21);
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeLessThanOrEqual(s[i - 1]!);
    expect(coinSteps(5, 5, 0)).toEqual([]);
  });

  it('test_confetti_layout_is_deterministic_and_40_pieces', () => {
    const a = confettiLayout(PIECES); const b = confettiLayout(PIECES);
    expect(a).toHaveLength(40);
    expect(a).toEqual(b);
    const tokens = new Set(a.map((p) => p.token));
    expect([...tokens].sort()).toEqual([...SIX].sort());
    for (const t of tokens) expect(PALETTE_TOKENS).toContain(t);
    expect(new Set(a.map((p) => `${p.dx}/${p.dy}`)).size).toBeGreaterThan(30);   // des pièces dispersées, pas empilées
  });
});

describe('bracelet vivant [spec C §3.2, §4]', () => {
  it('test_refusal_with_words_counts_down_flat', () => {
    const c = marlene; const ref = c.options.find((o) => o.isRefusal)!;
    expect(ref.words).toBe(8);
    mount(); ui.setBracelet(41);
    confirmOption(ui, c, ref.id);
    ui.setBracelet(33);
    expect(q('[data-ui="bracelet-value"]')!.textContent).toBe('33');
    expect(juiceLog(ui)).toEqual(['ui.confirm']);
    expect(document.body.querySelectorAll('.c-coin, .c-confetti')).toHaveLength(0);
    expect(animator.played().filter((p) => p.el.closest('[data-ui="fx"]') !== null || p.el.matches('.c-eye__pupil'))).toHaveLength(0);
  });

  it('test_zero_price_non_refusal_has_no_juice_in_the_bracelet', () => {
    mount(); ui.setBracelet(41);
    confirmOption(ui, plain(0), 'a');
    ui.setBracelet(41);
    expect(juiceLog(ui)).toEqual(['ui.confirm']);
  });

  it('test_non_refusal_with_words_plays_coins_shutter_confetti_after_confirm', async () => {
    mount(); ui.setBracelet(41);
    confirmOption(ui, plain(8), 'a');
    expect(juiceLog(ui)).toEqual(['ui.confirm']);   // rien avant que le moteur ait ôté les mots
    ui.setBracelet(33);
    await flush();
    const pairs = Array.from({ length: 8 }, () => ['bracelet.coin', 'oeil.shutter']).flat();
    expect(juiceLog(ui)).toEqual(['ui.confirm', ...pairs, 'bracelet.settle', 'regime.confetti']);
    expect(q('[data-ui="bracelet-value"]')!.textContent).toBe('33');
    const shutters = animator.played().filter((p) => p.el.matches('.c-eye__pupil'));
    expect(shutters).toHaveLength(8);
    expect(animator.played().filter((p) => p.el.matches('.c-coin'))).toHaveLength(8);
    expect(animator.played().filter((p) => p.el.matches('.c-confetti'))).toHaveLength(PIECES);
  });

  it('test_displayed_value_follows_coin_steps', async () => {
    const seen: string[] = [];
    mount(); ui.setBracelet(41);
    ui.events.on((n) => { if (n === 'bracelet.coin') seen.push(q('[data-ui="bracelet-value"]')!.textContent ?? ''); });
    confirmOption(ui, plain(8), 'a'); ui.setBracelet(33); await flush();
    expect(seen).toEqual(['40', '39', '38', '37', '36', '35', '34', '33']);
  });

  it('test_coins_beyond_twelve_never_drawn', async () => {
    mount(); ui.setBracelet(60);
    confirmOption(ui, plain(30), 'a'); ui.setBracelet(30); await flush();
    expect(ui.events.log().filter((e) => e === 'bracelet.coin')).toHaveLength(12);
    expect(q('[data-ui="bracelet-value"]')!.textContent).toBe('30');
  });

  it('test_screen_reader_value_written_once_at_final_value', async () => {
    mount(); ui.setBracelet(41);
    const node = q('[data-ui="bracelet-announce"]')!;
    let writes = 0;
    let proto: object | null = node; let desc: PropertyDescriptor | undefined;
    while (proto !== null && desc === undefined) { desc = Object.getOwnPropertyDescriptor(proto, 'textContent'); proto = Object.getPrototypeOf(proto) as object | null; }
    if (desc === undefined) throw new Error('textContent introuvable');
    Object.defineProperty(node, 'textContent', { configurable: true, get: () => desc!.get!.call(node) as string, set: (v: string) => { writes++; desc!.set!.call(node, v); } });   // compte les écritures, pas les enregistrements du DOM
    confirmOption(ui, plain(8), 'a'); ui.setBracelet(33); await flush(); await flush();
    expect(writes).toBe(1);
    expect(node.textContent).toContain('33');
    expect(q('[data-ui="bracelet-value"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(q('[data-ui="bracelet"]')!.tagName).toBe('OUTPUT');
  });

  it('test_reduced_motion_jumps_to_final_value_no_coin_no_confetti_no_shutter', async () => {
    mount(true); ui.setBracelet(41);
    confirmOption(ui, plain(8), 'a'); ui.setBracelet(33); await flush();
    expect(q('[data-ui="bracelet-value"]')!.textContent).toBe('33');
    expect(juiceLog(ui)).toEqual(['ui.confirm']);
    expect(animator.played().filter((p) => p.el.matches('.c-coin, .c-confetti, .c-eye__pupil'))).toHaveLength(0);
  });

  it('test_speaking_words_decrease_counter_without_juice', async () => {
    mount(); ui.setBracelet(41); ui.setBracelet(38); await flush();
    expect(q('[data-ui="bracelet-value"]')!.textContent).toBe('38');
    expect(ui.events.log()).toEqual([]);
    expect(animator.played()).toHaveLength(0);
  });

  it('test_confirm_juice_never_fires_on_a_later_decrease', async () => {
    mount(); ui.setBracelet(41);
    confirmOption(ui, plain(8), 'a');   // le moteur n'a rien ôté dans ce tour (compte inchangé) : le plan expire avec le tour
    await flush();
    ui.events.clear();
    ui.setBracelet(33);                 // une parole ôte des mots, bien plus tard
    await flush();
    expect(ui.events.log()).toEqual([]);
    expect(q('[data-ui="bracelet-value"]')!.textContent).toBe('33');
    expect(animator.played().filter((p) => p.el.matches('.c-coin, .c-confetti, .c-eye__pupil'))).toHaveLength(0);
  });

  it('test_coins_and_confetti_are_aria_hidden', async () => {
    const held: { resolve: () => void }[] = [];
    const gate: Animator = { play: () => new Promise<void>((r) => { held.push({ resolve: r }); }) };
    mount(false, gate); ui.setBracelet(41);
    confirmOption(ui, plain(3), 'a'); ui.setBracelet(38); await flush();
    const coins = [...document.body.querySelectorAll('.c-coin')];
    expect(coins.length).toBe(3);
    const fx = q('[data-ui="fx"]')!;
    expect(fx.getAttribute('aria-hidden')).toBe('true');
    for (const c of coins) expect(fx.contains(c)).toBe(true);
    for (let i = 0; i < 50 && document.body.querySelector('.c-confetti') === null; i++) { held.splice(0).forEach((h) => { h.resolve(); }); await flush(); }
    expect(document.body.querySelectorAll('.c-confetti').length).toBe(PIECES);
    for (const el of document.body.querySelectorAll('.c-confetti')) expect(fx.contains(el)).toBe(true);
    expect(q('[data-ui="bracelet"]')!.querySelector('.c-coin, .c-confetti')).toBeNull();
    for (let i = 0; i < 5; i++) { held.splice(0).forEach((h) => { h.resolve(); }); await flush(); }
  });
});

describe('l\'Œil et le bracelet ne dépendent jamais du compte [GD 3a, 3f, I-10]', () => {
  /** Sérialise le sous-arbre sans les nœuds de texte du nombre et de l'annonce, avec styles posés et calculés. */
  function fingerprint(): unknown {
    const root = q('[data-ui="bracelet"]')!;
    const nodes = [root, ...root.querySelectorAll('*')];
    return nodes.map((n) => {
      const cs = getComputedStyle(n);
      const value = n.matches('[data-ui="bracelet-value"], [data-ui="bracelet-announce"]');
      return {
        tag: n.tagName,
        attrs: [...n.attributes].map((a) => `${a.name}=${a.value}`).sort(),
        kids: [...n.childNodes].filter((k) => !(k.nodeType === 3 && value)).map((k) => (k.nodeType === 3 ? `#text:${k.textContent}` : (k as Element).tagName)),
        computed: [cs.color, cs.backgroundColor, cs.borderColor, cs.width],
      };
    });
  }

  it('test_bracelet_subtree_never_depends_on_count', () => {
    const prints = [59, 20, 0].map((n) => { mount(); ui.setBracelet(n); const f = JSON.stringify(fingerprint()); ui.dispose(); document.body.innerHTML = ''; return f; });
    expect(prints[1]).toBe(prints[0]);
    expect(prints[2]).toBe(prints[0]);
  });

  it('test_bracelet_has_one_eye_with_fixed_pupil_and_no_gauge', () => {
    mount(); ui.setBracelet(59);
    const b = q('[data-ui="bracelet"]')!;
    expect(b.querySelectorAll('.c-eye')).toHaveLength(1);
    expect(b.querySelectorAll('.c-eye__pupil')).toHaveLength(1);
    expect(b.querySelectorAll('.c-eye__glint')).toHaveLength(1);
    expect(b.querySelector('meter, progress, svg, canvas')).toBeNull();
    expect(b.querySelector('.c-eye')!.getAttribute('aria-hidden')).toBe('true');
    expect(b.querySelector('.c-eye')!.getAttribute('style')).toContain(`${loadUi().theme.street.eyePx.v}px`);
  });

  it('test_bracelet_shows_the_unit_from_a_key', () => {
    mount(); ui.setBracelet(5);
    expect(q('[data-ui="bracelet-unit"]')!.textContent).toBe('mots');
  });
});
