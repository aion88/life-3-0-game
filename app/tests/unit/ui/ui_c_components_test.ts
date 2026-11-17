// @vitest-environment happy-dom
/** Feuille C et composants communs : bouton, pastille, Œil, avis, focus, thème de la rue [plan UI-C T4, spec C §3.0, I-6, I-7, I-10, P-1, D2]. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionButton, createEye, createNotice, createPill } from '../../../src/ui/components/c';
import { createInstantAnimator } from '../../../src/ui/motion';
import { loadUi } from '../../../src/data/ui/load';
import { mountUi } from '../../../src/street/ui';
import { realI18n } from '../../support/street_ui';

const read = (rel: string): string => readFileSync(join(__dirname, '../../../src', rel), 'utf8');
const C_CSS = read('ui/c.css');
const UI_CSS = read('street/ui/ui.css');
/** Corps de la première règle dont le sélecteur contient `sel`. */
const ruleBody = (css: string, sel: string): string => {
  const m = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`).exec(css);
  return m?.[1] ?? '';
};

beforeEach(() => { document.body.replaceChildren(); });
afterEach(() => vi.restoreAllMocks());

describe('bouton, pastille, avis', () => {
  it('test_action_button_is_mint_pill_with_ink_text', () => {
    const b = createActionButton('x', 'go');
    expect(b.tagName).toBe('BUTTON');
    expect(b.type).toBe('button');
    expect(b.classList.contains('c-action')).toBe(true);
    expect(b.dataset['testid']).toBe('go');
    const body = ruleBody(C_CSS, '.c-action');
    expect(body).toMatch(/background:\s*var\(--c-menthe\)/);
    expect(body).toMatch(/color:\s*var\(--c-encre\)/);
    expect(body).toMatch(/border-radius:\s*var\(--s-pill\)/);
    expect(b.getAttribute('style') ?? '').toBe('');
  });

  it('test_pill_has_one_class_per_tone_and_text', () => {
    for (const tone of ['soleil', 'lavande', 'lavandeClaire', 'creme', 'encre'] as const) {
      const p = createPill('t', tone);
      expect(p.classList.contains('c-pill')).toBe(true);
      expect(p.classList.contains(`c-pill--${tone}`)).toBe(true);
      expect(p.textContent).toBe('t');
      expect(ruleBody(C_CSS, `.c-pill--${tone}`)).toMatch(/background:\s*var\(--c-/);
    }
  });

  it('test_notice_is_grey_steel_no_rotation_no_motion', () => {
    const n = createNotice('avis');
    expect(n.classList.contains('c-notice')).toBe(true);
    expect(n.classList.contains('c-sober')).toBe(true);
    expect(n.getAttribute('role')).toBe('status');
    expect(createNotice('a', 'alert').getAttribute('role')).toBe('alert');
    const body = ruleBody(C_CSS, '.c-notice');
    expect(body).toMatch(/background:\s*var\(--c-gris-acier\)/);
    expect(body).toMatch(/color:\s*var\(--c-blanc\)/);
    expect(ruleBody(C_CSS, '.c-sober')).toMatch(/transform:\s*none\s*!important/);
    expect(C_CSS).toMatch(/\.c-sober\s+\*[^{]*\{[^}]*transform:\s*none\s*!important/);
    expect(C_CSS).toMatch(/\.c-sober[^{]*\{[^}]*transition:\s*none\s*!important/);
  });
});

describe('focus', () => {
  it('test_focus_ring_rule_present_for_every_interactive_class', () => {
    for (const cls of ['.c-action', '.c-option', '.c-card--interactive']) {
      const m = new RegExp(`${cls.replace('.', '\\.')}:focus-visible`).test(C_CSS);
      expect(m, cls).toBe(true);
    }
    const ring = ruleBody(C_CSS, '.c-option:focus-visible');
    expect(ring).toMatch(/outline:\s*var\(--s-focus-ring\) solid var\(--c-encre\)/);
    expect(ring).toMatch(/box-shadow:\s*0 0 0 calc\(var\(--s-focus-ring\) \* 2\) var\(--c-creme\)/);   // l'ombre dépasse le contour ; le rendu est mesuré en pixels (tests/e2e-ui/focus_ring_test.ts)
    expect(ruleBody(C_CSS, '.c-option:focus-visible')).not.toMatch(/outline-offset:\s*[1-9]/);
    expect(C_CSS).toMatch(/\[data-ui="choices"\]:focus-visible/);
    expect(loadUi().theme.shape.focusRing.v).toBe(2);
  });
});

describe('carte vide', () => {
  it('test_empty_card_is_not_drawn', () => {
    // la narration vide (cartouche du bas, capture vivante du 2026-11-02) ne doit pas laisser une pastille encre vide à l'écran
    expect(ruleBody(C_CSS, '.c-card:empty')).toMatch(/display:\s*none/);
  });
});

describe('bordures fines et ombres basses (retour de Cynthia, spec C §1 amendée le 2026-11-02)', () => {
  const cssFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? cssFiles(join(dir, d.name)) : d.name.endsWith('.css') ? [join(dir, d.name)] : []));
  const ALL_CSS = cssFiles(join(__dirname, '../../../src'));

  it('test_borders_are_2px_and_shadow_offsets_are_3_and_4', () => {
    const { shape, questionnaire } = loadUi().theme;
    expect([shape.border.v, shape.focusRing.v, questionnaire.optionBorderPx.v, questionnaire.optionDotRingPx.v, questionnaire.dotRingPx.v]).toEqual([2, 2, 2, 2, 2]);
    expect([shape.shadowOffset.v, shape.shadowOffsetCard.v]).toEqual([3, 4]);
    expect([shape.shadowOffset.status, shape.shadowOffsetCard.status]).toEqual(['sourced', 'sourced']);
  });

  it('test_no_css_hardcodes_a_border_width_or_a_shadow_offset', () => {
    expect(ALL_CSS.length).toBeGreaterThan(2);
    for (const f of ALL_CSS) {
      const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/box-shadow\s*:([^;}]*)/g)) {
        for (const layer of m[1]!.split(/,(?![^(]*\))/)) {
          const lengths = layer.replace(/var\([^)]*\)|calc\((?:[^()]|\([^)]*\))*\)/g, ' ').match(/-?\d+(?:\.\d+)?px/g) ?? [];
          // un décalage vertical ou un étalement en px littéral non nul est une valeur en dur (le 0 est permis)
          expect(lengths.filter((l) => parseFloat(l) !== 0), `${f} : ${layer.trim()}`).toEqual([]);
        }
      }
      expect(css.match(/(^|[;{\s])border(-top|-right|-bottom|-left)?(-width)?\s*:\s*[1-9]\d*px/g) ?? [], f).toEqual([]);
    }
  });
});

describe('Œil', () => {
  const theme = () => loadUi().theme;

  it('test_eye_without_pupil_has_no_pupil_node_and_is_aria_hidden', () => {
    const e = createEye({ pupil: false, sizePx: 24 });
    expect(e.el.getAttribute('aria-hidden')).toBe('true');
    expect(e.el.classList.contains('c-eye')).toBe(true);
    expect(e.el.querySelector('.c-eye__pupil')).toBeNull();
    expect(e.el.children).toHaveLength(0);
    expect(e.el.style.getPropertyValue('--eye-px')).toBe('24px');
  });

  it('test_eye_with_pupil_has_one_pupil_one_glint_no_face_part', () => {
    const e = createEye({ pupil: true, sizePx: theme().street.eyePx.v });
    expect(e.el.querySelectorAll('.c-eye__pupil')).toHaveLength(1);
    expect(e.el.querySelectorAll('.c-eye__glint')).toHaveLength(1);
    expect(e.el.querySelectorAll('*')).toHaveLength(2);
    const dump = e.el.outerHTML.toLowerCase();
    for (const part of ['lid', 'brow', 'mouth', 'cheek']) expect(dump).not.toContain(part);
    expect(C_CSS.toLowerCase()).not.toMatch(/c-eye__(lid|brow|mouth|cheek)/);
  });

  it('test_eye_has_no_state_attribute', () => {
    for (const pupil of [false, true]) {
      const e = createEye({ pupil, sizePx: 40 });
      const names = [e.el, ...e.el.querySelectorAll('*')].flatMap((n) => n.getAttributeNames());
      expect(names.filter((n) => n.startsWith('data-') || n.startsWith('aria-') && n !== 'aria-hidden')).toEqual([]);
    }
  });

  it('test_eye_shutter_reduced_motion_plays_nothing', async () => {
    const a = createInstantAnimator();
    const e = createEye({ pupil: true, sizePx: 96 });
    await e.shutter(a, true);
    expect(a.played()).toHaveLength(0);
    await e.shutter(a, false);
    expect(a.played()).toHaveLength(1);
    expect(a.played()[0]?.el).toBe(e.el.querySelector('.c-eye__pupil'));
  });

  it('test_eye_glint_is_fixed_and_off_center', async () => {
    const t = theme().street;
    const snap = (el: HTMLElement): string => el.querySelector('.c-eye__glint')!.getAttribute('style') ?? '';
    const a = createEye({ pupil: true, sizePx: t.eyePx.v });
    const b = createEye({ pupil: true, sizePx: t.eyePx.v });
    const before = snap(a.el);
    expect(before).toBe(snap(b.el));
    expect(before).toContain(`${t.glintOffsetXPx.v}px`);
    expect(before).toContain(`${t.glintOffsetYPx.v}px`);
    expect(t.glintOffsetXPx.v !== 0 || t.glintOffsetYPx.v !== 0).toBe(true);
    await a.shutter(createInstantAnimator(), false);
    expect(snap(a.el)).toBe(before);
  });

  it('test_pupil_never_follows_pointer_or_player', () => {
    const spies = [window, document, HTMLElement.prototype].map((o) => vi.spyOn(o, 'addEventListener'));
    const e = createEye({ pupil: true, sizePx: 96 });
    document.body.append(e.el);
    for (const s of spies) {
      const kinds = s.mock.calls.map((c) => c[0]);
      expect(kinds.filter((k) => ['pointermove', 'mousemove', 'deviceorientation'].includes(k))).toEqual([]);
    }
    const pupil = e.el.querySelector('.c-eye__pupil')!;
    const before = pupil.outerHTML;
    for (let i = 0; i < 20; i++) window.dispatchEvent(new PointerEvent('pointermove', { clientX: i * 90, clientY: i * 50 }));
    expect(pupil.outerHTML).toBe(before);
  });

  it('test_glint_is_30_percent_of_pupil_and_pupil_centered_without_transform', () => {
    const t = theme().street;
    expect(t.glintPx.v).toBeCloseTo(t.pupilPx.v * 0.3, 5);
    expect(t.glintPx.status).toBe('sourced');
    expect(ruleBody(C_CSS, '.c-eye__pupil')).not.toMatch(/transform/);   // l'obturateur anime transform : le centrage ne doit pas en dépendre
  });

  it('test_system_refusal_is_not_sober_so_it_can_shake', () => {
    const h = mountUi(document.body, realI18n('fr'));
    expect(ruleBody(C_CSS, '.c-refusal')).not.toMatch(/transform|animation/);
    expect(readFileSync(join(__dirname, '../../../src/street/ui/choicePanel.ts'), 'utf8')).not.toMatch(/c-refusal c-sober/);
    h.dispose();
  });

  it('test_eye_sizes_come_from_theme_tokens', () => {
    const t = theme().street;
    const e = createEye({ pupil: true, sizePx: t.eyePx.v });
    const p = e.el.querySelector<HTMLElement>('.c-eye__pupil')!;
    expect(p.style.width).toBe(`${t.pupilPx.v}px`);
    const half = createEye({ pupil: true, sizePx: t.eyePx.v / 2 }).el.querySelector<HTMLElement>('.c-eye__pupil')!;
    expect(half.style.width).toBe(`${t.pupilPx.v / 2}px`);
  });
});

describe('thème de la rue (D2) et règles de feuille', () => {
  it('test_street_root_is_themed', () => {
    const h = mountUi(document.body, realI18n('fr'));
    const root = document.querySelector<HTMLElement>('[data-ui="root"]')!;
    expect(root.style.getPropertyValue('--c-encre')).toBe(loadUi().theme.palette.encre.v);
    expect(root.style.getPropertyValue('--font-text')).toContain('Inter C');
    expect(root.dataset['reducedMotion']).toMatch(/^(true|false)$/);
    h.dispose();
  });

  it('test_reduced_motion_flag_sets_attribute', () => {
    const h = mountUi(document.body, realI18n('fr'), { reducedMotion: true });
    expect(document.querySelector<HTMLElement>('[data-ui="root"]')!.dataset['reducedMotion']).toBe('true');
    h.dispose();
  });

  it('test_css_has_no_literal_font_family', () => {
    for (const css of [C_CSS, UI_CSS]) {
      const decls = css.match(/font(-family)?\s*:[^;}]*/g) ?? [];
      for (const d of decls) {
        if (!/font(-family)?\s*:/.test(d)) continue;
        expect(d, d).not.toMatch(/system-ui|sans-serif|serif|monospace|Fredoka|Nunito|Inter|Arial|Helvetica/);
      }
      for (const m of css.matchAll(/font-family\s*:\s*([^;}]*)/g)) expect(m[1]!.trim(), m[0]).toMatch(/^var\(--(font|t)-[a-z-]+\)$/);
    }
  });

  it('test_no_filter_on_ui_layer', () => {
    for (const css of [C_CSS, UI_CSS]) expect(css).not.toMatch(/(^|[;{\s])(backdrop-filter|filter|mix-blend-mode)\s*:/);
  });

  it('test_street_sheets_carry_no_literal_color', () => {
    const named = /(?<![-\w])(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|silver|gold|navy|teal|lime|maroon|olive|aqua|fuchsia|brown|beige|ivory|lavender)(?![-\w])/i;
    for (const css of [C_CSS, UI_CSS]) {
      const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(bare).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(bare).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/i);
      expect(bare).not.toMatch(named);
    }
  });

  it('test_street_sheet_keeps_only_placement', () => {
    const bare = UI_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(bare).not.toMatch(/(^|[;{\s])(background|color|font|font-size|font-style|border|border-radius|box-shadow|opacity)\s*:/);
  });
});
