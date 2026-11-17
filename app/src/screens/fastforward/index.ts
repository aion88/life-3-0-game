import { enterExploration, exploration } from '../../worlds/exploration';
/**
 * Écran fast-forward [plan 03 T5 ; GDD 02 §3.7 à §3.10, §4.6, F16, F17 ; D140 (2)].
 * Refonte du 2026-11-03 (playtest Cynthia) : 2026 → 2030 en `timing.fastForward.toChoiceSec` (8 s, 2 s par une) au lieu de 56 s, et une une de journal
 * par année (`fronts.ts`), objet du régime en direction C (carte crème, ombre pleine, rotation statique) ; mouvement réduit : fondu de 120 ms au plus.
 *
 * L'écran ne recalcule ni pas, ni monde, ni titre : il PLACE ce que le plan 01 a décidé (`RunResult`, `scheduleHeadlines`) sur le temps d'écran,
 * lu de `fastforward/timeline.ts` (R-03.3). Plus de pause, de vitesse ni de mode (team-lead 2026-11-03 : « n'ont plus de sens avec 6 s ») :
 * l'écran enchaîne seul, et clic ou Espace sautent à la une suivante, à la fin des pas, puis à la fin du maintien d'arrivée (`nextStopSec`).
 * L'onglet caché arrête l'horloge d'écran sans déplacer un pas ni une une [F17]. Le silence d'une extinction ne se saute pas.
 */
import type { AppContext, Screen, ScreenFactory } from '../../app/shell';
import type { EngineConfig } from '../../data/schema/engine';
import type { HeadlineSet, HeadlineVariant } from '../../data/schema/headlines';
import { loadUi } from '../../data/ui/load';
import type { Timing } from '../../data/ui/load';
import { streetContextOf } from '../../bilan/streetContext';
import { toBilanInput } from '../../engine/moments/bilan';
import { replay } from '../../engine/moments/replay';
import { scheduleHeadlines, yearOfStep, type HeadlineShown } from '../../fastforward';
import { SHORT_WORLDS, shortMode } from '../../worlds/routing';
import { runFastForward } from '../../fastforward/run';
import { HEADLINE_SPACING_SEC } from '../../fastforward/headlines';
import { ARRIVAL_HOLD_SECONDS, EXTINCTION_HOLD_SECONDS, paceOf, screenSecondsOfStep, type Pace } from '../../fastforward/timeline';
import type { I18n } from '../../i18n/i18n';
import type { SaveData } from '../../save/save';
import type { BilanInput } from '../../shared/types';
import type { RunOutcome, RunResult } from '../../shared/types/run';
import { WORLD_VARS, type ArrivalWorldId } from '../../shared/types/world';
import { createScreenClock, createFrameClock, type FrameLoop } from '../../ui/clock';
import { createTriptych } from '../../ui/backdrops/triptych';
import { createDotRow } from '../../ui/components/dotRow';
import { createFrame } from '../../ui/frame';
import { motionFor, reducedMotionOf, webAnimator, type Animator } from '../../ui/motion';
import { loadFastForwardData } from '../data';
import { planFronts, type FrontLine, type PlannedFront } from './fronts';
import './ff.css';
import { mountRetrospective } from './retrospective';

export { planFronts, firstStepOfYear, type FrontLine, type PlannedFront } from './fronts';

type ArrivalOutcome = Extract<RunOutcome, { kind: 'arrival' }>;

/** Secondes retranchées du silence de w07 en version adoucie : « les 3 s finales (le fondu mène droit à l'écran des causes) » [bible w07 §4, version adoucie]. */
export const SOFTENED_W07_SILENCE_CUT_SEC = 3;
/** Un axe du monde va de 0 à 100 000 millièmes ; le triptyque lit des valeurs de 0 à 1 [GDD 02 §3.8]. */
const AXIS_MILLI = 100_000;
/** Tolérance d'arrondi des flottants du temps d'écran, en secondes. */
const EPS_SEC = 1e-6;

/** Un titre retenu pour l'écran : `key` est la clé de texte, `variantKind` dit quelle table remplit la marque ; `year` date par le pas de déclenchement. */
export interface PlannedHeadline {
  readonly id: string;
  readonly key: string;
  readonly year: number;
  readonly variant: number | null;
  readonly variantKind: HeadlineVariant | null;
}

/** Plan de l'écran, en secondes d'écran à ×1 [GDD 02 §3.8, F16]. */
export interface FfPlan {
  readonly kind: RunOutcome['kind'];
  /** Temps d'écran de chaque pas, de 0 au dernier pas (choiceStep, ou la rupture). */
  readonly stepSec: readonly number[];
  /** Fin des pas : début du maintien d'arrivée ou du silence. */
  readonly stepsEndSec: number;
  readonly holdSec: number;
  readonly silenceSec: number;
  readonly totalSec: number;
  /** Titres à montrer, dans l'ordre d'écran ; la version adoucie a ôté le titre de rupture. */
  readonly headlines: readonly PlannedHeadline[];
  /** Une une par année, de 2027 à l'année du dernier pas, chacune à l'instant d'écran du premier pas de son année. */
  readonly fronts: readonly PlannedFront[];
  /** Cadence d'écran tirée du jeton `timing.fastForward.toChoiceSec` (Cynthia 2026-11-03). */
  readonly pace: Pace;
  /** Année de rupture masquée (version adoucie d'une extinction), sinon `null`. */
  readonly hiddenYear: number | null;
  readonly speeds: Timing['speeds'];
}

/**
 * Calcule les temps de pas à la cadence du jeton `timing.fastForward.toChoiceSec`, le maintien, le silence, et range les titres retenus
 * par `scheduleHeadlines` en unes annuelles. Aucun pas ni monde recalculé. Masque adouci [GDD 02 §3.10] : ni année de rupture, ni titre à condition `rupture`, et pour w07 les 3 dernières secondes du silence en moins.
 */
export function planFastForward(run: RunResult, shown: readonly HeadlineShown[], timing: Timing, engine: EngineConfig, set: HeadlineSet): FfPlan {
  const { outcome } = run;
  const inExtinction = outcome.kind === 'extinction';
  const lastStep = inExtinction ? outcome.ruptureStep : engine.steps.choiceStep;
  const pace = paceOf(timing.fastForward.toChoiceSec.v, engine);
  const stepSec = Array.from({ length: lastStep + 1 }, (_, s) => screenSecondsOfStep(s, engine, inExtinction, pace));
  const stepsEndSec = stepSec[lastStep]!;
  const holdSec = inExtinction ? 0 : ARRIVAL_HOLD_SECONDS;
  const cut = run.softened && inExtinction && outcome.world === 'w07' ? SOFTENED_W07_SILENCE_CUT_SEC : 0;
  const silenceSec = inExtinction ? EXTINCTION_HOLD_SECONDS - cut : 0;
  const byId = new Map(set.headlines.map((h) => [h.id, h]));
  const headlines = shown.flatMap((s): PlannedHeadline[] => {
    const h = byId.get(s.id);
    if (h === undefined) throw new Error(`titre affiché inconnu du jeu de données : ${s.id}`);
    if (run.softened && h.when.some((c) => c.kind === 'rupture')) return [];
    return [{ id: s.id, key: `ff.${s.id}`, year: s.year, variant: s.variant, variantKind: h.variant }];
  });
  return {
    kind: outcome.kind, stepSec, stepsEndSec, holdSec, silenceSec, totalSec: stepsEndSec + holdSec + silenceSec, headlines,
    fronts: planFronts(run, headlines, stepSec, lastStep), pace,
    hiddenYear: run.softened && inExtinction ? yearOfStep(outcome.ruptureStep) : null,
    speeds: timing.speeds,
  };
}

/** Pas affiché au temps d'écran `sec` : le dernier pas dont l'instant est atteint, jamais au-delà du dernier pas du plan. */
export function stepAtSec(plan: FfPlan, sec: number): number {
  let step = 0;
  while (step + 1 < plan.stepSec.length && plan.stepSec[step + 1]! <= sec + EPS_SEC) step++;
  return step;
}

/** Année du compteur au temps d'écran `sec`. */
export function yearAtSec(plan: FfPlan, sec: number): number {
  return yearOfStep(stepAtSec(plan, sec));
}

/** Une ligne de texte : clé i18n sans paramètre. */
export interface ArrivalLine { readonly key: string }

/** Lignes de décalage `ff.arrival.offset.<var>.<up|down>`, dans l'ordre des axes de `ArrivalOffset` ; vide sans décalage [D41, D121]. */
export function arrivalLines(outcome: ArrivalOutcome): readonly ArrivalLine[] {
  return outcome.offset.axes.map((a) => ({ key: `ff.arrival.offset.${a.var}.${a.signed > 0 ? 'up' : 'down'}` }));
}

/** Ligne D140 (2) : `redirect.arrival` avec le monde calculé et le monde vécu, `null` sans redirection (une extinction n'en a jamais). */
export function redirectLine(outcome: RunOutcome): { readonly key: 'redirect.arrival'; readonly worlds: { readonly computed: ArrivalWorldId; readonly lived: ArrivalWorldId } } | null {
  if (outcome.kind !== 'arrival' || !outcome.redirected) return null;
  return { key: 'redirect.arrival', worlds: { computed: outcome.computedWorld, lived: outcome.livedWorld } };
}

/** Où va l'écran à son ouverture d'après la sauvegarde [décision 6] : rien à rejouer (`play`), la rue, ou le bilan. */
export function resumeTarget(save: Pick<SaveData, 'phase'>): 'play' | 'street' | 'bilan' {
  return save.phase === 'street' ? 'street' : save.phase === 'bilan' ? 'bilan' : 'play';
}

/** Coutures de test : boucle d'images, mouvement réduit, document dont on suit la visibilité, animateur des unes. */
export interface FastForwardDeps {
  readonly frames?: FrameLoop;
  readonly reducedMotion?: boolean;
  readonly doc?: Document;
  readonly animator?: Animator;
}

const browserFrames = (): FrameLoop => ({ request: (cb) => requestAnimationFrame(cb), cancel: (h) => { cancelAnimationFrame(h); } });
const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Entrée du bilan d'une reprise : rejeu des actes sur le monde vécu ; sans fin de partie ni nuit close, semaine nulle [R-02b.28]. */
async function bilanInputOf(ctx: AppContext, run: RunResult, acts: SaveData['acts']): Promise<BilanInput> {
  if (run.outcome.kind === 'extinction') return { entry: 'extinction', run, week: null, survival: null, acts: [] };
  const world = await ctx.worlds.load(run.outcome.livedWorld);
  const sctx = streetContextOf(ctx.core, world, run);
  const { state, week } = replay(acts, sctx);
  if (state.ended === null) return { entry: 'earlyEnd', run, week: null, survival: null, acts: state.acts };
  return toBilanInput(state, week, sctx);
}

/** Fabrique de l'écran, avec coutures de test. */
export function createFastForwardScreen(deps: FastForwardDeps = {}): ScreenFactory<'fastforward'> {
  return (ctx, payload) => {
    const cleanups: (() => void)[] = [];
    const screen: Screen = {
      async mount(root) {
        const saved = ctx.save.load().data;
        const { headlines: set } = loadFastForwardData();
        const alternate = shortMode(typeof location === 'undefined' ? '' : location.search) ? exploration(ctx) : null;
        const run = runFastForward(ctx.core, set, alternate?.answers ?? payload.answers, saved.softened === true, shortMode(typeof location === 'undefined' ? '' : location.search) ? SHORT_WORLDS : undefined);
        const target = alternate ? (alternate.entered ? 'street' : 'play') : resumeTarget(saved);
        const search = typeof location === 'undefined' ? '' : location.search;
        // Mode court : plus d'écran de chronologie entre les questions et le monde, la carte d'arrivée du monde suffit [demande Cynthia 2026-11-15].
        // L'ancien parcours (`?parcours=ancien`, même test que `legacyJourney` de street/screen, non importé pour ne pas tirer la rue ici) n'a pas cette carte : il garde la chronologie.
        const legacy = new URLSearchParams(search).get('parcours') === 'ancien';
        if (shortMode(search) && (target !== 'play' || !legacy)) {
          if (target === 'play' && !enterExploration(ctx) && run.outcome.kind === 'arrival') ctx.save.update({ phase: 'street' });
          await ctx.navigate(run.outcome.kind === 'arrival' ? 'street' : 'causes', { run }); return;
        }
        if (shortMode(search)) {
          const plan = planFastForward(run, scheduleHeadlines(run, set, ctx.core.engine), loadUi().timing, ctx.core.engine, set);
          cleanups.push(mountRetrospective(ctx, run, plan, root));
          return;
        }
        if (target === 'street') { await ctx.navigate(run.outcome.kind === 'arrival' ? 'street' : 'causes', { run }); return; }
        if (target === 'bilan') { await ctx.navigate('bilan', { input: await bilanInputOf(ctx, run, saved.acts) }); return; }
        play(ctx, run, set, root, deps, cleanups);
      },
      unmount() { for (const c of cleanups.splice(0).reverse()) c(); },
    };
    return screen;
  };
}

/** Écran du fast-forward, coutures de production. */
export const fastforwardScreen: ScreenFactory<'fastforward'> = createFastForwardScreen();

/** Instant d'écran où mène « la suite » depuis `sec` : la une suivante ; après la dernière une, la fin des pas ; puis la fin du maintien d'arrivée. Le silence d'une extinction ne se saute pas [GDD 02 §3.7]. */
export function nextStopSec(plan: FfPlan, sec: number): number | null {
  const next = plan.fronts.find((f) => f.shownAtSec > sec + EPS_SEC);
  if (next !== undefined) return next.shownAtSec;
  if (sec < plan.stepsEndSec - EPS_SEC) return plan.stepsEndSec;
  if (plan.kind === 'arrival' && sec < plan.totalSec - EPS_SEC) return plan.totalSec;
  return null;
}

function play(ctx: AppContext, run: RunResult, set: HeadlineSet, root: HTMLElement, deps: FastForwardDeps, cleanups: (() => void)[]): void {
  const i18n: I18n = ctx.i18n;
  const ui = loadUi();
  const plan = planFastForward(run, scheduleHeadlines(run, set, ctx.core.engine), ui.timing, ctx.core.engine, set);
  const t = (key: string, p?: Readonly<Record<string, string | number>>): string => i18n.t(key, p);

  // --- DOM ---
  const frame = createFrame(root);
  cleanups.push(() => { frame.dispose(); });
  const main = document.createElement('main');
  main.dataset['ui'] = 'fastforward';
  main.className = 'ff-main';
  const head = document.createElement('header');
  head.className = 'ff-head';
  const yearEl = document.createElement('p');
  yearEl.dataset['testid'] = 'ff-year';
  yearEl.dataset['ff'] = 'year';
  yearEl.className = 'ff-counter';
  const months = createDotRow(12);
  head.append(yearEl, months.el);
  // Une une à la fois : la région la remplace d'une année à l'autre, et l'annonce en `polite`.
  const frontEl = document.createElement('section');
  frontEl.dataset['testid'] = 'ff-front';
  frontEl.className = 'ff-fronts';
  frontEl.setAttribute('aria-label', t('ff.ui.journal'));
  frontEl.setAttribute('aria-live', 'polite');
  const live = document.createElement('div');
  live.className = 'ff-live';
  live.setAttribute('aria-live', 'polite');
  // Aucune commande : 6 s ne se règlent pas. Clic ou Espace passent à la suite [team-lead 2026-11-03].
  const hint = document.createElement('p');
  hint.dataset['testid'] = 'ff-next';
  hint.className = 'c-pill c-pill--encre ff-hint';
  hint.textContent = t('ff.ui.next');
  main.append(head, frontEl, live, hint);
  frame.stage.append(main);

  // --- horloge d'écran : la seule source de temps, à ×1 ---
  const doc = deps.doc ?? document;
  const clock = createScreenClock(doc);
  cleanups.push(() => { clock.dispose(); });

  // --- fond : dessiné à l'instant de l'horloge d'écran, jamais par sa propre boucle ---
  const reducedMotion = reducedMotionOf(deps.reducedMotion ?? reduced());
  // Animateur des unes : la couture de test, sinon la Web Animations API si le navigateur l'a (rien à animer sinon : la une est déjà posée).
  const animator: Animator | null = deps.animator ?? (typeof Element.prototype.animate === 'function' ? webAnimator : null);
  const backdrop = createTriptych(frame.canvas, ui.triptych, { seed: run.seed, reducedMotion });
  cleanups.push(() => { backdrop.stop(); });

  // --- rendu ---
  const yearText = (year: number): string => (year === plan.hiddenYear ? t('ff.ui.yearHidden') : String(year));
  const paramsOf = (h: FrontLine): Readonly<Record<string, string>> | undefined => {
    if (h.variantKind === null) return undefined;
    if (h.variant === null) throw new Error(`titre ${h.id} : marque ${h.variantKind} sans indice de variante`);
    return { [h.variantKind]: t(`ff.var.${h.variantKind}.${h.variant}`) };
  };
  let shownStep = -1;
  let nextFront = 0;
  let frontsCleared = false;
  /** Extinction : la dernière une reste 4 s, jamais retirée avant le début du silence [GDD 02 §3.7, appliqué aux unes]. */
  const clearAtSec = plan.kind === 'extinction' ? Math.max(plan.stepsEndSec, (plan.fronts.at(-1)?.shownAtSec ?? 0) + HEADLINE_SPACING_SEC) : Infinity;
  const lineText = (l: FrontLine): string => t(l.key, paramsOf(l));

  /**
   * Une une, objet du régime en papier crème : nom du journal, filet, date (« Édition » et l'année), gros titre,
   * puis une rangée image (aplat tramé, décoratif) et sous-titres.
   */
  function frontOf(f: PlannedFront, index: number): HTMLElement {
    const el = document.createElement('article');
    el.className = 'c-card ff-une';
    el.dataset['testid'] = 'ff-une';
    el.dataset['year'] = String(f.year);
    el.dataset['source'] = f.source;
    el.dataset['tilt'] = index % 2 === 0 ? 'a' : 'b';
    const name = document.createElement('p');
    name.className = 'ff-une__name';
    name.textContent = t('ff.une.masthead');
    const date = document.createElement('p');
    date.className = 'ff-une__date';
    const ed = document.createElement('span');
    ed.textContent = t('causes.ui.edition');
    const y = document.createElement('span');
    y.className = 'c-pill c-pill--soleil ff-une__year';
    y.dataset['ff'] = 'year';
    y.textContent = yearText(f.year);
    date.append(ed, y);
    const [lead, ...subs] = f.lines;
    const h = document.createElement('h2');
    h.className = 'ff-une__lead';
    h.dataset['line'] = lead!.id;
    h.textContent = lineText(lead!);
    const body = document.createElement('div');
    body.className = 'ff-une__body';
    const img = document.createElement('div');
    img.className = 'ff-une__img';
    img.dataset['pattern'] = String(f.year % 3);
    img.setAttribute('aria-hidden', 'true');
    const list = document.createElement('ul');
    list.className = 'ff-une__subs';
    for (const l of subs) {
      const li = document.createElement('li');
      li.className = 'ff-une__sub';
      li.dataset['line'] = l.id;
      li.textContent = lineText(l);
      list.append(li);
    }
    body.append(img, list);
    el.append(name, date, h, body);
    return el;
  }
  let arrivalShown = false;
  let done = false;
  let ended = false;

  function showArrival(outcome: ArrivalOutcome): void {
    const panel = document.createElement('section');
    panel.dataset['testid'] = 'ff-arrival';
    const lines: string[] = [t('ff.arrival.lead'), t(`world.${outcome.livedWorld}.name`), t(`world.${outcome.livedWorld}.clear`), ...arrivalLines(outcome).map((l) => t(l.key))];
    const redirect = redirectLine(outcome);
    if (redirect !== null) lines.push(t(redirect.key, { computed: t(`world.${redirect.worlds.computed}.name`), lived: t(`world.${redirect.worlds.lived}.name`) }));
    for (const text of lines) {
      const p = document.createElement('p');
      p.textContent = text;
      panel.append(p);
    }
    live.append(panel);
  }

  function render(ms: number): void {
    const sec = ms / 1000;
    const step = stepAtSec(plan, sec);
    if (step !== shownStep) {
      shownStep = step;
      yearEl.textContent = yearText(yearOfStep(step));
      months.fill(step === 0 ? 0 : ((step - 1) % 12) + 1);
      const v = run.trajectory.steps[step]!;
      backdrop.setParams(Object.fromEntries(WORLD_VARS.map((k) => [k, v[k] / AXIS_MILLI])));
    }
    let shownFront: PlannedFront | null = null;
    while (nextFront < plan.fronts.length && plan.fronts[nextFront]!.shownAtSec <= sec + EPS_SEC) shownFront = plan.fronts[nextFront++]!;
    if (shownFront !== null && !frontsCleared && !arrivalShown) {
      const el = frontOf(shownFront, nextFront - 1);
      frontEl.replaceChildren(el);
      const spec = motionFor('cardIn', reducedMotion, ui.timing);
      if (spec !== null && animator !== null) void animator.play(el, spec);
    }
    if (!frontsCleared && sec >= clearAtSec - EPS_SEC) { frontsCleared = true; frontEl.replaceChildren(); }
    if (!arrivalShown && run.outcome.kind === 'arrival' && sec >= plan.stepsEndSec - EPS_SEC) { arrivalShown = true; frontEl.replaceChildren(); showArrival(run.outcome); }
    if (sec >= plan.stepsEndSec - EPS_SEC) hint.hidden = !(plan.kind === 'arrival' && sec < plan.totalSec - EPS_SEC);
    backdrop.renderAt(ms);
  }

  function finish(): void {
    if (done) return;
    done = true;
    if (run.outcome.kind === 'arrival') {
      ctx.save.update({ phase: 'street' });
      void ctx.navigate('street', { run });
    } else {
      void ctx.navigate('causes', { run });
    }
  }

  function tick(ms: number): void {
    render(ms);
    if (!ended && ms / 1000 >= plan.totalSec - EPS_SEC) { ended = true; frames.stop(); finish(); }
  }

  /** La suite : avance l'horloge d'écran jusqu'au prochain arrêt, jamais pendant que l'onglet est caché ni dans le silence. */
  function next(): void {
    if (done || clock.paused()) return;
    const to = nextStopSec(plan, clock.now() / 1000);
    if (to === null) return;
    clock.advance(Math.max(0, to * 1000 - clock.now()));
    tick(clock.now());
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    e.preventDefault();
    next();
  };
  const onClick = (): void => { next(); };
  doc.addEventListener('keydown', onKey);
  frame.stage.addEventListener('click', onClick);
  cleanups.push(() => { doc.removeEventListener('keydown', onKey); frame.stage.removeEventListener('click', onClick); });

  const frames = createFrameClock(deps.frames ?? browserFrames(), clock, tick, { doc });
  cleanups.push(() => { frames.stop(); });
  render(0);
  frames.start();
}
