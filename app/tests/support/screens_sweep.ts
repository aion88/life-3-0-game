/**
 * Aides du balayage des sept écrans [plan 03 T15, R-03.25 c] : monte chaque écran dans l'état où il montre le plus de texte, avec
 * la langue et le `i18n` donnés, et rend les racines. Un écrivain ; rien sous `src/` ne l'importe. Environnement happy-dom.
 */
import { vi } from 'vitest';
import { createProductionWorldLoader } from '../../src/data/load';
import type { AppContext, ScreenId } from '../../src/app/shell';
import { createCausesScreen } from '../../src/screens/causes';
import { createFastForwardScreen } from '../../src/screens/fastforward';
import { langScreen } from '../../src/screens/lang';
import { screenFactories } from '../../src/screens';
import { ans } from './answers';
import { fakeCanvas2d, fakeCtx, mountScreen } from './screens';
import { bilanCtx, extinctionInput, weekEndOf } from './screens_bilan';
import { LINES, advance, core, manualFrames, runLine } from './screens_ff';
import { continueBtn, optionBtns, TIMING } from './screens_q';
import { createQuestionnaireScreen } from '../../src/screens/questionnaire';
import { createScreenClock } from '../../src/ui/clock';
import { sourcesCtx } from './screens_sources';
import { saveWith } from './street_screen';
import { manualFrames as causesFrames } from './screens_causes';

export const SCREEN_IDS = ['lang', 'warning', 'questionnaire', 'fastforward', 'causes', 'bilan', 'sources'] as const satisfies readonly ScreenId[];
export type SweepId = (typeof SCREEN_IDS)[number];

type Lang = 'fr' | 'en';
type Snap = (state: string, root: HTMLElement) => void;

/** Éléments des années : seule chose qui n'est pas une clé, un chiffre d'année venu du moteur . */
export const YEAR_SELECTOR = '[data-testid="ff-year"], [data-ff="year"], [data-year]';

function stubCanvases(): void {
  const rec = fakeCanvas2d();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(rec.ctx as never);
}

/** Parcourt les sept écrans ; `snap(état, racine)` est appelé quand le texte est à l'écran. `i18n` fait foi du langage. */
export async function sweepScreens(i18n: AppContext['i18n'], lang: Lang, only: readonly SweepId[], snap: (id: SweepId) => Snap): Promise<void> {
  stubCanvases();
  const want = (id: SweepId): boolean => only.includes(id);

  if (want('lang')) {
    const { root } = await mountScreen(langScreen, fakeCtx({ i18n }), undefined);
    snap('lang')('rendu', root);
  }
  if (want('warning')) {
    const { root } = await mountScreen(screenFactories.warning, fakeCtx({ i18n }), undefined);
    snap('warning')('rendu', root);
  }
  if (want('questionnaire')) {
    const ctx = fakeCtx({ i18n });
    const frames = causesFrames();
    const clock = createScreenClock();
    const { root } = await mountScreen(createQuestionnaireScreen({ frames, clock, reducedMotion: false }), ctx, undefined);
    frames.advance(0);
    const total = ctx.core.questionnaire.questions.length;
    for (let i = 0; i < total; i++) {
      snap('questionnaire')(`Q${i} rendu`, root);
      const b = optionBtns(root)[0]!;
      b.click();
      snap('questionnaire')(`Q${i} désignée`, root);
      b.click();
      frames.advance(TIMING.minReadMs + TIMING.costDelayMs + 100);
      snap('questionnaire')(`Q${i} confirmée`, root);
      if (i < total - 1) continueBtn(root)!.click();
    }
  }
  if (want('fastforward')) {
    for (const line of [LINES.w10, LINES.redirected, LINES.w07]) {
      const frames = manualFrames();
      const { save } = saveWith([]);
      save.update({ answers: ans(line), phase: 'fastforward', lang });
      const ctx = fakeCtx({ save, i18n, worlds: createProductionWorldLoader(core.catalogue) });
      const factory = createFastForwardScreen({ frames, reducedMotion: false });
      const { root } = await mountScreen(factory, ctx, { answers: ans(line) });
      // plus de mode manuel (2026-11-03) : une capture par 0,75 s, chaque une et le maintien d'arrivée ou le silence passent
      snap('fastforward')(`${line} début`, root);
      for (let s = 0; s < 16; s++) { advance(frames, 750); snap('fastforward')(`${line} +${(s + 1) * 750} ms`, root); }
    }
  }
  if (want('causes')) {
    const frames = causesFrames();
    const clock = createScreenClock();
    const { root } = await mountScreen(createCausesScreen({ frames, clock }), fakeCtx({ i18n }), { run: runLine(LINES.w07) });
    frames.advance(50);
    const total = TIMING.causesEditionsMs.reduce((a, b) => a + b, 0);
    let at = 0;
    for (const d of TIMING.causesEditionsMs) { snap('causes')(`édition à ${at} ms`, root); frames.advance(d); at += d; }
    snap('causes')(`fin à ${total} ms`, root);
  }
  if (want('bilan')) {
    for (const [name, input] of [['semaine', weekEndOf()], ['extinction', extinctionInput()]] as const) {
      const { root } = await mountScreen(screenFactories.bilan, bilanCtx(undefined, { i18n }), { input });
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button')];
      snap('bilan')(`${name} page 0`, root);
      for (const [i, b] of buttons.entries()) { b.click(); snap('bilan')(`${name} page ${i}`, root); }
    }
  }
  if (want('sources')) {
    const ctx = sourcesCtx(LINES.w10, { withW10: true, lang });
    const { root } = await mountScreen(screenFactories.sources, { ...ctx, i18n } as AppContext, { from: 'bilan' });
    snap('sources')('rendu', root);
  }
}
