// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDotRow } from '../../../src/ui/components/dotRow';
import { createTwoStep } from '../../../src/ui/components/twoStep';
import { createSoftToggle } from '../../../src/ui/components/softToggle';
import { createPageNav } from '../../../src/ui/components/pageNav';
import { createLangSwitch } from '../../../src/ui/components/langSwitch';
import { createFrame } from '../../../src/ui/frame';
import { contrastRatio } from '../../../src/ui/color';
import { loadUi } from '../../../src/data/ui/load';
import { realI18n } from '../../support/street_ui';

const hasDigit = (s: string): boolean => /\d/.test(s);
const ariaValues = (el: Element): string[] =>
  [el, ...el.querySelectorAll('*')].flatMap((e) => [...e.attributes].filter((a) => a.name.startsWith('aria-') && a.name !== 'aria-hidden').map((a) => a.value));

beforeEach(() => { document.body.replaceChildren(); document.documentElement.lang = ''; });

describe('rangée de points', () => {
  it('test_dot_row_fill_sets_aria_and_count : aucun chiffre dans le DOM', () => {
    const row = createDotRow(5);
    document.body.append(row.el);
    expect(row.el.querySelectorAll('[data-filled]').length).toBe(5);
    row.fill(3);
    expect(row.el.querySelectorAll('[data-filled="true"]').length).toBe(3);
    expect(row.el.getAttribute('aria-hidden')).toBe('true');
    expect(hasDigit(row.el.textContent ?? '')).toBe(false);
    expect(ariaValues(row.el).some(hasDigit)).toBe(false);
    row.fill(99);
    expect(row.el.querySelectorAll('[data-filled="true"]').length).toBe(5);
    row.fill(-2);
    expect(row.el.querySelectorAll('[data-filled="true"]').length).toBe(0);
  });
});

describe('deux gestes', () => {
  const opts = (onConfirm = vi.fn()) => ({ options: [{ id: 'x', label: 'Premier' }, { id: 'y', label: 'Second' }, { id: 'z', label: 'Troisième' }] as const, onConfirm });
  const btn = (el: HTMLElement, id: string): HTMLButtonElement => el.querySelector<HTMLButtonElement>(`[data-option="${id}"]`)!;

  it('test_two_step_first_gesture_designates_second_confirms', () => {
    const onConfirm = vi.fn();
    const t = createTwoStep<string>(opts(onConfirm));
    expect(t.phase()).toBe('idle');
    btn(t.el, 'x').click();
    expect(t.phase()).toBe('designated');
    expect(btn(t.el, 'x').getAttribute('aria-pressed')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
    btn(t.el, 'x').click();
    expect(t.phase()).toBe('confirmed');
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('x');
    btn(t.el, 'x').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('test_two_step_designate_other_option_moves_designation', () => {
    const onConfirm = vi.fn();
    const t = createTwoStep<string>(opts(onConfirm));
    btn(t.el, 'x').click();
    btn(t.el, 'y').click();
    expect(t.phase()).toBe('designated');
    expect(btn(t.el, 'x').getAttribute('aria-pressed')).toBe('false');
    expect(btn(t.el, 'y').getAttribute('aria-pressed')).toBe('true');
    expect(onConfirm).not.toHaveBeenCalled();
    btn(t.el, 'y').click();
    expect(onConfirm).toHaveBeenCalledWith('y');
  });

  it('confirm sans désignation ne fait rien', () => {
    const onConfirm = vi.fn();
    const t = createTwoStep<string>(opts(onConfirm));
    t.confirm();
    expect(t.phase()).toBe('idle');
    t.designate('z');
    t.confirm();
    expect(onConfirm).toHaveBeenCalledWith('z');
  });

  it('test_two_step_fade_others_after_confirm', () => {
    const t = createTwoStep<string>(opts());
    t.designate('y');
    t.fadeOthers();
    expect(btn(t.el, 'x').dataset['faded']).toBeUndefined();
    t.confirm();
    t.fadeOthers();
    expect(btn(t.el, 'x').dataset['faded']).toBe('true');
    expect(btn(t.el, 'z').dataset['faded']).toBe('true');
    expect(btn(t.el, 'y').dataset['faded']).toBeUndefined();
    expect(btn(t.el, 'x').disabled).toBe(true);
  });

  it('le libellé est celui qu\'on passe, sans lettre ni numéro ajoutés', () => {
    const t = createTwoStep<string>(opts());
    expect([...t.el.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Premier', 'Second', 'Troisième']);
  });
});

describe('bascule douce', () => {
  it('test_soft_toggle_exposes_pressed_state', () => {
    const onToggle = vi.fn();
    const s = createSoftToggle({ pressed: false, onToggle });
    expect(s.el.getAttribute('aria-pressed')).toBe('false');
    s.el.click();
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(s.el.getAttribute('aria-pressed')).toBe('true');
    s.set(false);
    expect(s.el.getAttribute('aria-pressed')).toBe('false');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('pages', () => {
  it('test_page_nav_has_no_number', () => {
    const go = vi.fn();
    const nav = createPageNav(['Alpha', 'Beta', 'Gamma'], go);
    expect(hasDigit(nav.el.textContent ?? '')).toBe(false);
    expect(ariaValues(nav.el).some(hasDigit)).toBe(false);
    expect(nav.index()).toBe(0);
    nav.el.querySelectorAll('button')[2]!.click();
    expect(go).toHaveBeenCalledWith(2);
    expect(nav.index()).toBe(2);
    expect(nav.el.querySelectorAll('button')[2]!.getAttribute('aria-current')).toBe('page');
    nav.go(1);
    expect(nav.index()).toBe(1);
    expect(go).toHaveBeenCalledTimes(1);
  });
});

describe('choix de langue', () => {
  it('test_lang_switch_calls_set_lang', () => {
    const i18n = realI18n('fr');
    const spy = vi.spyOn(i18n, 'setLang');
    const onChange = vi.fn();
    const sw = createLangSwitch(i18n, onChange);
    document.body.append(sw.el);
    expect(sw.el.querySelector('[data-lang="fr"]')!.getAttribute('aria-pressed')).toBe('true');
    sw.el.querySelector<HTMLElement>('[data-lang="en"]')!.click();
    expect(spy).toHaveBeenCalledWith('en');
    expect(document.documentElement.lang).toBe('en');
    expect(onChange).toHaveBeenCalledWith('en');
    expect(sw.el.querySelector('[data-lang="en"]')!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('thème', () => {
  it('test_text_panel_contrast_at_least_4_5 : panelText sur panelBg', () => {
    const { colors } = loadUi().theme;
    expect(contrastRatio(colors.panelText, colors.panelBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 6);
  });
});

describe('cadre', () => {
  it('pose scène, canvas sous le DOM et deux bandes noires 2,39:1 ; dispose retire tout', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const f = createFrame(root);
    expect(f.canvas.parentElement).not.toBeNull();
    expect(root.querySelectorAll('[data-band]').length).toBe(2);
    expect(f.stage.parentElement).not.toBeNull();
    expect(root.firstElementChild!.getAttribute('data-ui')).toBe('frame');
    const kids = [...f.canvas.parentElement!.children];
    expect(kids.indexOf(f.canvas)).toBeLessThan(kids.indexOf(f.stage));
    f.dispose();
    expect(root.children.length).toBe(0);
  });
});
