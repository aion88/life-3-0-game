import { illustratedLocations, plateStyle } from '../../worlds/illustrationAssets';
import { openExploration, explorationReturn } from '../../worlds/exploration';
import { shortMode } from '../../worlds/routing';
/**
 * Écran des causes : trois éditions (14 s, 14 s, 12 s) puis « Rejoue » [GDD 02 §3.9, §5 ; bible w07 §3, w12 §3 ; plan 03 T6].
 * Il ne reçoit que `{run}` d'une extinction ; il n'allume rien lui-même (`causeEditions`). Aucune vitesse, aucune jauge,
 * aucun nombre hors année. Version adoucie : l'année de rupture n'est pas écrite et la balise liée à `rupture` dit
 * « le compte à rebours s'arrête » [GDD 06 B-V10].
 * L'écran n'écrit pas la sauvegarde : la phase `bilan` est posée par l'écran du bilan [R-03.8].
 */
import type { Screen, ScreenFactory } from '../../app/shell';
import { loadUi } from '../../data/ui/load';
import { causeEditions, type Edition } from '../../fastforward';
import { createFrame, type Frame } from '../../ui/frame';
import { createFrameClock, createScreenClock, type DisposableClock, type FrameLoop } from '../../ui/clock';
import { createActionButton } from '../../ui/components/c';
import { loadFastForwardData } from '../data';
import { mountSoberPage } from '../sober';
import '../../ui/font';
import '../../ui/tokens.css';
import '../../ui/chambreScope.css';

/** Dépendances injectables : boucle d'images et horloge (R-03.4). */
export interface CausesDeps { readonly frames?: FrameLoop; readonly clock?: DisposableClock }

/** Defensive fallback for imported copy: never print an unresolved parameter or invent a figure. */
const UNFILLED = '\u0000';
function lineText(t: (key: string, params?: Record<string, string | number>) => string, key: string): string {
  const anyParam = new Proxy({} as Record<string, string>, { get: () => UNFILLED });
  return t(key, anyParam).split(/(?<=[.!?])\s+/).filter((sentence) => !sentence.includes(UNFILLED)).join(' ');
}

const rafLoop = (): FrameLoop => ({ request: (cb) => requestAnimationFrame(cb), cancel: (h) => cancelAnimationFrame(h) });

export function createCausesScreen(deps: CausesDeps = {}): ScreenFactory<'causes'> {
  return (ctx, { run }) => {
    let frame: Frame | null = null;
    let explorer: { dispose(): void } | null = null;
    let loop: { start(): void; stop(): void } | null = null;
    let clock: DisposableClock | null = null;
    const screen: Screen = {
      mount(root) {
        const t = ctx.i18n.t.bind(ctx.i18n);
        const { causesEditionsMs } = loadUi().timing;
        const totalMs = causesEditionsMs.reduce((a, b) => a + b, 0);
        const { headlines, causes } = loadFastForwardData();
        const editions: readonly Edition[] = causeEditions(run, headlines, causes, ctx.core.questionnaire);
        const ruptureBeat = run.outcome.kind === 'extinction'
          ? causes.byExtinction[run.outcome.world].find((b) => b.linkedHeadline === 'rupture')?.id ?? null
          : null;

        frame = createFrame(root);
        const main = document.createElement('main'); if (shortMode(location.search)) main.classList.add('causes');
        if (run.outcome.kind === 'extinction') { const art = document.createElement('div'); art.className = 'illustrated-extinction'; art.setAttribute('role', 'img'); art.setAttribute('aria-label', run.outcome.world === 'w07' ? 'Une ville de machines sans humains' : 'Une ville détruite par l’effondrement humain'); art.style.cssText = plateStyle(illustratedLocations[run.outcome.world]!['end']!); main.append(art); }
        const title = document.createElement('h1');
        title.className = 'c-sober-title';
        title.textContent = t('causes.ui.title');
        const slot = document.createElement('section');
        slot.className = 'c-sober-stack';
        slot.setAttribute('aria-live', 'polite');
        const exit = document.createElement('div');
        exit.className = 'c-sober-row';
        explorationReturn(ctx, exit);
        main.append(title, slot, exit);
        mountSoberPage(frame, main);

        const renderEdition = (e: Edition): void => {
          const el = document.createElement('article');
          el.className = 'c-card c-sober-stack';
          el.dataset['testid'] = 'causes-edition';
          el.dataset['index'] = String(e.index);
          el.dataset['last'] = String(e.isLast);
          const head = document.createElement('h2');
          head.className = 'c-sober-heading';
          head.textContent = t(e.isLast ? 'causes.ui.final' : 'causes.ui.edition');
          el.append(head);
          // Version adoucie : l'année de rupture reste masquée [B-V10].
          if (e.year !== null && !(run.softened && e.isLast)) {
            const y = document.createElement('p');
            y.className = 'c-sober-year';
            y.dataset['year'] = 'true';
            y.textContent = String(e.year);
            el.append(y);
          }
          for (const b of e.beats) {
            if (!b.lit) continue;
            const p = document.createElement('p');
            p.className = 'c-sober-text';
            p.dataset['beat'] = b.beatId;
            p.dataset['lit'] = 'true';
            const swapped = run.softened && b.beatId === ruptureBeat;
            const key = swapped ? 'causes.ui.countdownStops' : b.lineKey;
            const text = key === null ? '' : lineText(t, key);
            if (text === '') continue;
            p.textContent = text;
            el.append(p);
          }
          slot.replaceChildren(el);
        };

        if (shortMode(location.search)) {
          let index = 0;
          const controls = document.createElement('nav'); controls.setAttribute('aria-label', t('causes.ui.read')); controls.className = 'c-sober-row';
          const previous = createActionButton(t('causes.ui.previous'), 'causes-previous');
          const next = createActionButton(t('causes.ui.next'), 'causes-next');
          const replay = createActionButton(t('causes.ui.seeBilan'), 'causes-replay');
          const explore = createActionButton(t('bilan.btn.explore'), 'causes-explore');
          const show = (): void => { renderEdition(editions[index]!); previous.disabled = index === 0; next.hidden = index === editions.length - 1; replay.hidden = !next.hidden; };
          previous.addEventListener('click', () => { if (index > 0) { index--; show(); } });
          next.addEventListener('click', () => { if (index < editions.length - 1) { index++; show(); } });
          replay.addEventListener('click', () => { void ctx.navigate('bilan', { input: { entry: 'extinction', run, week: null, survival: null, acts: [] } }); });
          explore.addEventListener('click', () => { explorer?.dispose(); explorer = openExploration(root, ctx, run); });
          controls.append(previous, next, replay, explore); exit.append(controls); show();
          return;
        }
        let shown = 0;
        let buttonShown = false;
        const sync = (ms: number): void => {
          let start = 0;
          let want = 0;
          causesEditionsMs.forEach((d, i) => { if (ms >= start) want = i + 1; start += d; });
          if (want !== shown && editions[want - 1]) { shown = want; renderEdition(editions[want - 1]!); }
          if (!buttonShown && ms >= totalMs) {
            buttonShown = true;
            const b = createActionButton(t('causes.ui.replay'), 'causes-replay');
            b.addEventListener('click', () => { void ctx.navigate('bilan', { input: { entry: 'extinction', run, week: null, survival: null, acts: [] } }); });
            exit.append(b);
            if (shortMode(location.search)) {
              const explore = createActionButton(t('bilan.btn.explore'), 'causes-explore');
              explore.addEventListener('click', () => { explorer?.dispose(); explorer = openExploration(root, ctx, run); }); exit.append(explore);
            }
          }
        };

        clock = deps.clock ?? createScreenClock();
        sync(clock.now());
        loop = createFrameClock(deps.frames ?? rafLoop(), clock, sync);
        loop.start();
      },
      unmount() {
        explorer?.dispose();
        loop?.stop(); loop = null;
        clock?.dispose(); clock = null;
        frame?.dispose(); frame = null;
      },
    };
    return screen;
  };
}

export const causesScreen: ScreenFactory<'causes'> = createCausesScreen();
