// @vitest-environment happy-dom
/** Questionnaire 2026, habillage C : pas d'Œil, pas de pièces, désignation et confirmation identiques [plan UI-C T5 ; spec C §3.1 ; ND §3, §4 ; I-4]. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQuestionnaireScreen } from '../../../src/screens/questionnaire';
import { resetDraft } from '../../../src/screens/draft';
import { createScreenClock } from '../../../src/ui/clock';
import { createInstantAnimator, type MotionSpec } from '../../../src/ui/motion';
import { createUiEvents } from '../../../src/ui/events';
import { loadUi } from '../../../src/data/ui/load';
import { fakeCtx, mountScreen } from '../../support/screens';
import { manualFrames } from '../../support/screens_causes';
import { continueBtn, costLine, optionBtns, stubCanvas, TIMING } from '../../support/screens_q';
import fr from '../../../src/data/strings/fr.json';

let stub: ReturnType<typeof stubCanvas>;
beforeEach(() => { stub = stubCanvas(); resetDraft(); });
afterEach(() => { stub.restore(); });

async function open(reducedMotion = false) {
  const ctx = fakeCtx();
  const frames = manualFrames();
  const animator = createInstantAnimator();
  const events = createUiEvents();
  const { root } = await mountScreen(createQuestionnaireScreen({ frames, clock: createScreenClock(), reducedMotion, animator, events }), ctx, undefined);
  frames.advance(0);
  return { root, ctx, frames, animator, events };
}
const SRC = (rel: string): string => readFileSync(join(__dirname, '../../../src', rel), 'utf8');
const textNodes = (root: HTMLElement): string[] => {
  const out: string[] = [];
  const walk = (n: Node): void => {
    if(n instanceof Element && n.matches('[data-testid="q-scene"]')){const copy=n.cloneNode(true) as Element;copy.querySelectorAll('.q-source-sticker').forEach(el=>el.remove());out.push(copy.textContent!.trim());return;}
    if (n.nodeType === 3) { const s = (n.textContent ?? '').trim(); if (s) out.push(s); } else n.childNodes.forEach(walk);
  };
  walk(root);
  return out;
};
const strings = fr as Record<string, string>;
const QKEYS = new Set(Object.entries(strings).filter(([k]) => /^q\.(ui|Q\d+)\./.test(k)).map(([, v]) => v));
const confirmAt = (root: HTMLElement, i: number): void => { const b = optionBtns(root)[i]!; b.click(); };

describe('questionnaire C', () => {
  it('test_q_has_round_disc_without_pupil_and_no_header', async () => {
    const { root } = await open();
    expect(root.querySelectorAll('.c-eye')).toHaveLength(1);
    expect(root.querySelector('.c-eye__pupil')).toBeNull();
    expect(root.querySelector('.c-eye')!.textContent).toBe('');
    for (const s of textNodes(root)) expect(QKEYS.has(s), `texte hors clés q.* : « ${s} »`).toBe(true);
  });

  it('test_q_order_is_date_title_scene_options', async () => {
    const { root } = await open();
    const q = (s: string): Element => root.querySelector(s)!;
    const seq = [q('[data-testid="q-date"]'), q('h1'), q('[data-testid="q-scene"]'), q('[data-ui="single-choice"]')];
    for (let i = 0; i < seq.length - 1; i++) expect(seq[i]!.compareDocumentPosition(seq[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(q('[data-testid="q-date"]').classList.contains('c-pill--soleil')).toBe(true);
  });

  it('test_q_never_shows_eye_coins_thanks_or_confetti', async () => {
    const { root, frames, events } = await open();
    const total = root.querySelectorAll('[data-filled]').length;
    for (let i = 0; i < total; i++) {
      confirmAt(root, 0);
      frames.advance(TIMING.minReadMs + 100);
      expect(root.querySelector('.c-eye__pupil')).toBeNull();
      expect(root.querySelector('[data-ui="coin"], [data-ui="confetti"]')).toBeNull();
      expect(textNodes(root).some((s) => s.includes('w10.') || /merci/i.test(s))).toBe(false);
      if (i < total - 1) continueBtn(root)!.click();
    }
    for (const n of events.log()) expect(/^(bracelet|oeil|regime)\./.test(n)).toBe(false);
  });

  it('test_q_designation_identical_for_every_option', async () => {
    const { root, animator, events } = await open();
    const seen: { cls: string; attrs: string; dot: string | undefined; spec: string }[] = [];
    const n = optionBtns(root).length;
    for (let i = 0; i < n; i++) {
      const b = optionBtns(root)[i]!;
      b.click();
      const plays = animator.played().filter((p) => p.el === b);
      const last = plays[plays.length - 1]!.spec;
      seen.push({
        cls: b.className,
        attrs: `${b.getAttribute('aria-pressed')}|${b.dataset['state']}`,
        dot: b.querySelector<HTMLElement>('[data-dot]')!.dataset['filled'],
        spec: JSON.stringify(last satisfies MotionSpec),
      });
    }
    for (const s of seen) expect(s).toEqual(seen[0]);
    expect(seen[0]!.dot).toBe('true');
    expect(events.log().filter((e) => e === 'ui.designate')).toHaveLength(n);
  });

  it('single choice announces consequence synchronously', async () => {
    const { root, events } = await open();
    optionBtns(root)[1]!.click();
    expect(events.log()).toEqual(['ui.designate', 'ui.cost.reveal']);
    expect(costLine(root)!.hidden).toBe(false);
    expect(costLine(root)!.getAttribute('role')).toBe('status');
  });

  it('test_designation_readable_without_color', async () => {
    const { root } = await open();
    const [a, b] = optionBtns(root);
    a!.click();
    expect(a!.getAttribute('aria-pressed')).toBe('true');
    expect(b!.getAttribute('aria-pressed')).toBe('false');
    expect(a!.querySelector<HTMLElement>('[data-dot]')!.dataset['filled']).toBe('true');
    expect(b!.querySelector<HTMLElement>('[data-dot]')!.dataset['filled']).toBe('false');
  });

  it('unselected answers stay readable and editable', async () => {
    const { root } = await open();
    confirmAt(root, 1);
    for (const b of optionBtns(root)) { expect(b.disabled).toBe(false); expect(b.style.opacity).toBe(''); }
  });

  it('test_q_reduced_motion_plays_only_fades_at_most_120', async () => {
    const { root, frames, animator } = await open(true);
    confirmAt(root, 0);
    frames.advance(TIMING.costDelayMs + 20);
    const played = animator.played();
    expect(played.length).toBeGreaterThan(0);
    for (const p of played) {
      expect(Number(p.spec.options.duration)).toBeLessThanOrEqual(loadUi().timing.juice.reducedMaxMs.v);
      for (const k of p.spec.keyframes) expect(Object.keys(k).filter((x) => x !== 'offset')).toEqual(['opacity']);
    }
  });

  it('test_q_dot_row_stays_aria_hidden_eleven_dots', async () => {
    const { root } = await open();
    const row = root.querySelector('[data-ui="dot-row"]')!;
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelectorAll('[data-filled]')).toHaveLength(11);
    expect(row.textContent).toBe('');
  });

  it('test_q_rest_contours_use_lavande_trait', () => {
    const css = SRC('ui/c.css');
    expect(css).not.toMatch(/border[a-z-]*:[^;{}]*var\(--c-lavande(-claire)?\)/);
    const body = (sel: string): string => new RegExp(`(?:^|[}\\n])\\s*${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(body('.c-option--q')).toContain('var(--c-lavande-trait)');
    expect(body('.c-option--q')).toContain('var(--s-q-option-border-px)');
    expect(body('.c-option__dot')).toContain('var(--c-lavande-trait)');
    expect(body('.c-option__dot')).toContain('var(--s-q-option-dot-ring-px)');
    expect(body('.c-dot')).toContain('var(--c-lavande-trait)');
    expect(body('.c-dot')).toContain('var(--c-lavande-claire)');
    expect(body('.c-dot')).toContain('var(--s-q-dot-ring-px)');
  });
});
