/** Aides de T4 : stub de `getContext` (aucun rendu dans happy-dom) et parcours des onze questions [plan 03 T4, R-03.25]. */
import { vi } from 'vitest';
import { fakeCanvas2d } from './screens';
import { manualFrames, type ManualFrames } from './screens_causes';
import { createQuestionnaireScreen } from '../../src/screens/questionnaire';
import { createScreenClock } from '../../src/ui/clock';
import { fakeCtx, mountScreen } from './screens';
import { loadUi } from '../../src/data/ui/load';
import type { AppContext } from '../../src/app/shell';
import type { AnswerKey } from '../../src/shared/types';

export const TIMING = loadUi().timing;

/** Remplace `getContext` des canvas : le contexte 2D enregistre, tout autre type est compté (`gl`). */
export function stubCanvas(): { readonly requested: string[]; restore(): void } {
  const requested: string[] = [];
  const rec = fakeCanvas2d();
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
    requested.push(kind);
    return kind === '2d' ? rec.ctx : null;
  }) as never);
  return { requested, restore: () => spy.mockRestore() };
}

export async function openQ(opts: { readonly ctx?: ReturnType<typeof fakeCtx>; readonly reducedMotion?: boolean } = {}) {
  const ctx = opts.ctx ?? fakeCtx();
  const frames: ManualFrames = manualFrames();
  const clock = createScreenClock();
  const mounted = await mountScreen(createQuestionnaireScreen({ frames, clock, reducedMotion: opts.reducedMotion ?? false }), ctx, undefined);
  frames.advance(0);
  return { ...mounted, ctx, frames, clock };
}

export const optionBtns = (root: HTMLElement): HTMLButtonElement[] => [...root.querySelectorAll<HTMLButtonElement>('[data-option]')];
export const costLine = (root: HTMLElement): HTMLElement | null => root.querySelector<HTMLElement>('[data-testid="q-cost"]');
export const continueBtn = (root: HTMLElement): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>('[data-testid="q-continue"]');

/** Sélectionne une option en un geste. */
export function answerWith(root: HTMLElement, index: number): void {
  const b = optionBtns(root)[index]!;
  b.click();
}

/** Répond à `n` questions (première option) en attendant la lecture et en cliquant « continuer » entre elles (pas après la n-ième). */
export function answerN(root: HTMLElement, frames: ManualFrames, n: number, index = 0): void {
  for (let i = 0; i < n; i++) {
    answerWith(root, index);
    if (i < n - 1) { frames.advance(TIMING.minReadMs + 100); continueBtn(root)!.click(); }
  }
}

export const firstAnswers = (ctx: AppContext): Record<string, AnswerKey> =>
  Object.fromEntries(ctx.core.questionnaire.questions.map((x) => [x.key, x.answers[0]!.key]));
