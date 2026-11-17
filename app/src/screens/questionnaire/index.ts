import { mayorScreen } from '../mayor';
import { annotateSources } from './help';
import { clearExploration } from '../../worlds/exploration';
import { clearShortProgress } from '../../save/shortProgress';
import { runSeed } from '../../shared/seed';
/**
 * Écran du questionnaire : onze questions sur un mur de CRT 2D, un choix puis Continuer [GDD 01 §3.2, §5.6, §9.3 ; plan 03 T4].
 * Aucun numéro, lettre, compteur chiffré ni marque d'hypothèse à l'écran [U-1, U-7] : la progression est un `dotRow`.
 * Le mur est un Canvas 2D sous le DOM, poussé par la boucle d'images de l'écran (pas de boucle propre, une seule horloge).
 * Partie neuve : chaque réponse est écrite. « Rejoue » (phase `fastforward`, `street` ou `bilan`) : les réponses restent en
 * mémoire, la sauvegarde n'est écrite qu'à la onzième confirmation [décision 5 ; R-03.8].
 */
import type { Screen, ScreenFactory } from '../../app/shell';
import type { Question, Questionnaire } from '../../data/load';
import { loadUi } from '../../data/ui/load';
import type { SavePhase } from '../../save/save';
import { answersOf, type AnswerKey } from '../../shared/types';
import { prefersReducedMotion } from '../../ui/backdrop';
import { createCrtWall, type CrtWall } from '../../ui/backdrops/crtWall';
import { createFrameClock, createScreenClock, type DisposableClock, type FrameLoop } from '../../ui/clock';
import { createActionButton, createEye, createPill } from '../../ui/components/c';
import { createDotRow } from '../../ui/components/dotRow';
import { createChoices } from './choices';
import { createUiEvents, type UiEvents } from '../../ui/events';
import { createFrame, type Frame } from '../../ui/frame';
import { createInstantAnimator, reducedMotionOf, type Animator } from '../../ui/motion';
import { getDraft } from '../draft';
import { fitQuestionCard } from './fit';
import '../../ui/font';
import '../../ui/tokens.css';
import './chambre.css';

const REPLAY_PHASES: readonly SavePhase[] = ['fastforward', 'street', 'bilan'];
/** Graine du mur [builder] : fixe, le rendu ne dépend que de (graine, état, temps). */
const WALL_SEED = 1984;

/** Première question sans réponse par `order`, `null` si toutes sont répondues [GDD 01 F-12]. */
export function nextQuestion(q: Questionnaire, answers: Readonly<Record<string, AnswerKey>>): Question | null {
  const sorted = [...q.questions].sort((a, b) => a.order - b.order);
  return sorted.find((x) => answers[x.key] === undefined) ?? null;
}

/** Dépendances injectables : boucle d'images, horloge, mouvement réduit (R-03.4), animateur et bus d'événements d'interface (spec C §4, §5). */
export interface QuestionnaireDeps { readonly frames?: FrameLoop; readonly clock?: DisposableClock; readonly reducedMotion?: boolean; readonly animator?: Animator; readonly events?: UiEvents }

const rafLoop = (): FrameLoop => ({ request: (cb) => requestAnimationFrame(cb), cancel: (h) => cancelAnimationFrame(h) });

export function createQuestionnaireScreen(deps: QuestionnaireDeps = {}): ScreenFactory<'questionnaire'> {
  return (ctx) => {
    let frame: Frame | null = null;
    let wall: CrtWall | null = null;
    let loop: { start(): void; stop(): void } | null = null;
    let clock: DisposableClock | null = null;
    let resizes: ResizeObserver | null = null;
    let disposeWindow: (() => void) | null = null;
    const screen: Screen = {
      mount(root) {
        clearExploration();
        const q = ctx.core.questionnaire;
        const total = q.questions.length;
        const { theme } = loadUi();
        const t = ctx.i18n.t.bind(ctx.i18n);
        const saved = ctx.save.load().data;
        const replay = REPLAY_PHASES.includes(saved.phase);
        const mem: Record<string, AnswerKey> = replay ? {} : (Object.fromEntries(Object.entries(saved.answers).filter((e): e is [string, AnswerKey] => e[1] !== undefined)));

        if (nextQuestion(q, mem) === null) { void ctx.navigate('fastforward', { answers: answersOf(mem) }); return; }

        const reduced = reducedMotionOf(deps.reducedMotion ?? (prefersReducedMotion() || undefined));
        const events = deps.events ?? createUiEvents();
        frame = createFrame(root);
        wall = createCrtWall(frame.canvas, { seed: WALL_SEED, reducedMotion: reduced });
        const main = document.createElement('main');
        main.className = 'c-q chambre';
        frame.stage.append(main);
        const dots = createDotRow(total);
        const card = document.createElement('section');
        card.className = 'c-card c-q-card';
        main.append(card);

        clock = deps.clock ?? createScreenClock();
        const screenClock = clock;
        let costEl: HTMLElement | null = null;
        let goBtn: HTMLButtonElement | null = null;
        let finished = false;

        const paintWall = (ms: number): void => wall?.renderAt(ms);
        /** Zone qui défile (scène et options) et son indicateur « il reste du texte plus bas », recréés à chaque question. */
        let body: HTMLElement | null = null;
        let more: HTMLElement | null = null;
        /**
         * Tient l'état de la zone qui défile : `data-more-above` / `data-more-below` règlent le fondu de 24 px de chaque bord, et l'indicateur
         * ne se montre que s'il reste du contenu dessous. Le haut et le bas de la carte ne défilent jamais (retour du 2026-11-03 : points et consigne
         * coupés par le bord de la carte avec les vrais textes).
         */
        const syncMore = (): void => {
          if (!body || !more) return;
          const below = body.scrollTop + body.clientHeight < body.scrollHeight - 0.5;
          body.toggleAttribute('data-more-above', body.scrollTop > 0.5);
          body.toggleAttribute('data-more-below', below);
          more.hidden = !below;
        };
        /**
         * Fait tenir la carte : mesurée avec le pire contenu (la ligne de coût la plus longue des réponses, « Continuer » montré), puis remise dans son état.
         * Refaite quand la fenêtre change de taille ; le facteur ne bouge donc pas entre l'ouverture et la confirmation.
         */
        let costWorst = '';
        const fit = (): void => {
          if (!body) return;
          const wasHidden = costEl?.hidden ?? true;
          const wasText = costEl?.textContent ?? '';
          const btnHidden = goBtn?.hidden ?? true;
          if (costEl) { costEl.hidden = false; costEl.textContent = costWorst; }
          if (goBtn) goBtn.hidden = false;
          fitQuestionCard(main, body);
          if (costEl) { costEl.hidden = wasHidden; costEl.textContent = wasText; }
          if (goBtn) goBtn.hidden = btnHidden;
          syncMore();
        };
        const onWindow = (): void => fit();
        window.addEventListener('resize', onWindow);
        disposeWindow = (): void => window.removeEventListener('resize', onWindow);
        resizes = typeof ResizeObserver === 'function' ? new ResizeObserver(() => syncMore()) : null;
        const tick = (ms: number): void => paintWall(ms);

        const show = (question: Question): void => {
          const answered = Object.keys(mem).length;
          dots.fill(answered);
          wall?.setParams({ state: (question.order - 1) % 3 });
          const bar = document.createElement('div');
          bar.className = 'c-q-bar';
          const date = createPill(t(`q.${question.key}.date`), 'soleil');
          date.classList.add('c-q-date');
          date.dataset['testid'] = 'q-date';
          bar.append(createEye({ pupil: false, sizePx: theme.questionnaire.eyeDiscPx.v }).el, date);
          const h = document.createElement('h1');
          h.className = 'c-q-title';
          h.textContent = t(`q.${question.key}.title`);
          const scene = document.createElement('p');
          scene.className = 'c-q-scene';
          scene.dataset['testid'] = 'q-scene';
          scene.textContent = t(`q.${question.key}.scene`);
          const hint = document.createElement('p');
          hint.className = 'c-q-hint';
          hint.setAttribute('aria-live', 'polite');
          hint.textContent = t('q.ui.pick');
          const choices = createChoices<AnswerKey>({
            options: question.answers.map((a) => ({ id: a.key, label: t(`q.${question.key}.${a.key}.label`) })),
            onSelect(id) { onSelect(question, id, hint); },
            events,
            animator: deps.animator ?? createInstantAnimator(),   // le bulletin papier ne grossit ni ne tourne : l'état se lit par la forme
            reducedMotion: reduced,
          });
          costEl = document.createElement('p');
          costEl.className = 'c-card c-card--secondary c-q-cost';
          costEl.dataset['testid'] = 'q-cost';
          costEl.setAttribute('role', 'status'); costEl.setAttribute('aria-live', 'polite'); costEl.setAttribute('aria-atomic', 'true');
          costEl.hidden = true;
          goBtn = createActionButton(t('q.ui.continue'), 'q-continue');
          goBtn.disabled = true;
          goBtn.hidden = true;
          goBtn.addEventListener('click', () => { void onContinue(); });
          const foot = document.createElement('div');
          foot.className = 'c-q-foot';
          const bar2 = document.createElement('progress'); bar2.className = 'c-q-progress'; bar2.max = total; bar2.value = answered; bar2.setAttribute('aria-hidden', 'true');
          foot.append(dots.el, bar2, hint);
          const act = document.createElement('div');
          act.className = 'c-q-act';
          act.append(costEl, goBtn);
          body = document.createElement('div');
          body.className = 'c-q-body';
          body.tabIndex = 0;   // la zone se fait défiler au clavier
          body.append(scene);
          if(ctx.i18n.lang()==='fr')annotateSources(scene,question.key);
          body.append(choices);
          body.addEventListener('scroll', syncMore, { passive: true });
          // Indicateur souris : un clic descend d'une page. Décoratif pour les aides techniques, la zone elle-même se lit et défile.
          const moreBtn = document.createElement('button');
          moreBtn.type = 'button';
          more = moreBtn;
          more.className = 'c-q-more';
          more.dataset['testid'] = 'q-more';
          more.tabIndex = -1;
          more.setAttribute('aria-hidden', 'true');
          more.hidden = true;
          const zone = body;
          more.addEventListener('click', () => { zone.scrollBy({ top: zone.clientHeight * 0.8, behavior: reduced ? 'auto' : 'smooth' }); });
          const scroll = document.createElement('div');
          scroll.className = 'c-q-scroll';
          scroll.append(body, more);
          card.replaceChildren(bar, h, scroll, act, foot);
          resizes?.disconnect();
          resizes?.observe(body);
          resizes?.observe(choices);
          costWorst = question.answers.map((a) => t(`q.${question.key}.${a.key}.cost`)).reduce((a, b) => (b.length > a.length ? b : a), '');
          fit();
        };

        const onSelect = (question: Question, id: AnswerKey, hint: HTMLElement): void => {
          mem[question.key] = id;
          const count = Object.keys(mem).length;
          const last = nextQuestion(q, mem) === null;
          if (last) {
            clearShortProgress(undefined, runSeed(answersOf(mem)));
            const patch = { answers: answersOf(mem), acts: [], phase: 'fastforward' as const };
            ctx.save.update(replay ? { ...patch, softened: getDraft().softened ?? false } : patch);
          } else if (!replay) {
            ctx.save.update({ answers: answersOf(mem), phase: 'questionnaire' });
          }
          dots.fill(count);
          hint.textContent = '';
          if (costEl) { costEl.hidden = false; costEl.textContent = t(`q.${question.key}.${id}.cost`); }
          if (goBtn) { goBtn.hidden = false; goBtn.disabled = false; }
          events.emit('ui.cost.reveal');
          syncMore();
        };

        const onContinue = async (): Promise<void> => {
          if (finished) return;
          const next = nextQuestion(q, mem);
          if (next) { show(next); return; }
          finished = true;
          await ctx.navigate('fastforward', { answers: answersOf(mem) });
        };

        show(nextQuestion(q, mem)!);
        paintWall(screenClock.now());
        loop = createFrameClock(deps.frames ?? rafLoop(), screenClock, tick);
        loop.start();
      },
      unmount() {
        loop?.stop(); loop = null;
        resizes?.disconnect(); resizes = null;
        disposeWindow?.(); disposeWindow = null;
        wall?.stop(); wall = null;
        clock?.dispose(); clock = null;
        frame?.dispose(); frame = null;
      },
    };
    return screen;
  };
}

export const questionnaireScreen: ScreenFactory<'questionnaire'> = (ctx, payload) =>
  ctx.i18n.lang() === 'fr' ? mayorScreen(ctx, payload) : createQuestionnaireScreen()(ctx, payload);
