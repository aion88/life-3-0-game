/**
 * Shell de la semaine 1984 en 3D : lit les beats de `runWeek` (weekScript.ts), les montre dans le DOM
 * et transmet la scène à `weekStage` (ou à la vue du contrôle pour le jour 1) sans jamais décider à la place du joueur.
 *
 * Règles (plan semaine-1984-3d §1, §7, §8.5, fiche W3) :
 * - Une décision = un appui (cible, ligne de pièce, glisser l'objet). Aucun bouton « Continuer ».
 * - Avis du matin et relevé du soir : un papier posé sur la scène, qui reste jusqu'à ce que le joueur le touche
 *   (ou Espace). Aucune minuterie ne le ferme, y compris sous `prefers-reduced-motion`.
 * - Les lignes de texte avancent seules (lecture), un appui ou Espace accélère. Aucune décision n'avance seule.
 * - Mots, dossier, jour, noms : relus depuis le `WeekState` après chaque beat, jamais recalculés depuis les beats.
 * - Un seul contexte WebGL vivant : la scène de la semaine est détruite avant de monter la vue du contrôle, et l'inverse.
 * - Aucun stockage navigateur : rien n'est sauvegardé.
 *
 * Attributs pour la recette : voir `weekContracts.ts` (§7). `data-names` = noms donnés, séparés par des virgules.
 * Hiérarchie : vert = ce que tu dois faire, ambre = ce que ça coûte, blanc = dit, gris = raconté, machine à écrire = le Registre.
 */
import type { ControlStationDriver } from '../controlStationEpisode';
import type { Beat, Line, PieceRow, TicketRow, Target, WeekCast, WeekStageDriver } from './weekContracts';
import { createWeek, type WeekState } from './weekState';
import { runWeek } from './weekScript';
import { createWeekSound, type WeekSound } from './weekSound';
import '../../ui/font';
import './weekEpisode.css';

export type WeekBeatKind = 'loading' | 'lines' | 'gesture' | 'piece' | 'ticket' | 'control' | 'stage' | 'ending' | 'error';

export interface WeekEpisodeOptions {
  onExit?: () => void;
  /** Couture de test : la scène 3D de la semaine. Par défaut `createWeekStage` + `buildWeekSet`. */
  createStage?: (host: HTMLElement, onEvent: (event: string) => void) => Promise<WeekStageDriver>;
  /** Couture de test : la vue du contrôle du jour 1. Par défaut `createControlStationView`. */
  createControlView?: (host: HTMLElement, onEvent: (event: string) => void) => Promise<ControlStationDriver>;
  /** Attente de lecture entre deux lignes. Par défaut `setTimeout`. */
  wait?: (ms: number) => Promise<void>;
  /** Horloge de la durée de partie affichée à la fin. */
  now?: () => number;
  sound?: WeekSound;
}

const MAX_LINES = 3;
const PRINT_STEP_MS = 260;
const FLASH_MS = 1600;
const READ_BASE_MS = 900;
const READ_PER_CHAR_MS = 30;

/** Fabriques par défaut : chargées à la demande pour que ni le portail ni les tests n'embarquent Three sans l'avoir demandé. */
async function defaultCreateStage(host: HTMLElement, onEvent: (event: string) => void): Promise<WeekStageDriver> {
  const [{ createWeekStage }, { buildWeekSet }] = await Promise.all([import('./weekStage'), import('./weekSets')]);
  return createWeekStage(host, { buildSet: buildWeekSet, onEvent });
}
async function defaultCreateControl(host: HTMLElement, onEvent: (event: string) => void): Promise<ControlStationDriver> {
  const { createControlStationView } = await import('../controlStationView');
  return createControlStationView(host, { onEvent });
}

const signed = (n: number): string => (n > 0 ? '+' : n < 0 ? '−' : '') + String(Math.abs(n));

/**
 * Monte la semaine dans `root` et la lance. Rend la fonction de démontage.
 * @example
 * const dispose = await mountWeekEpisode(root, { onExit: () => location.assign('/') });
 */
export async function mountWeekEpisode(root: HTMLElement, options: WeekEpisodeOptions = {}): Promise<() => void> {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const sound = options.sound ?? createWeekSound(win);
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => { win.setTimeout(resolve, ms); }));
  const now = options.now ?? (() => Date.now());

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };

  /* ------------------------------ DOM ------------------------------ */
  const host = make('main', '', 'week-episode');
  host.dataset['testid'] = 'week-episode';
  host.setAttribute('aria-label', '1984, la semaine');

  const header = make('header', '', 'we-header');
  const identity = make('div', '', 'we-id');
  const dayLabel = make('span', 'Jour 1', 'we-day');
  identity.append(dayLabel, make('h1', '1984, la semaine'));
  const hud = make('p', '', 'we-hud');
  hud.dataset['testid'] = 'week-hud';
  hud.setAttribute('aria-live', 'polite');
  hud.setAttribute('aria-atomic', 'true');
  const hudRing = make('strong');
  const hudWordsDelta = make('span', '', 'we-delta');
  const bracelet = make('span', '', 'we-bracelet');
  bracelet.dataset['testid'] = 'week-words';
  const ring = make('span', '', 'we-ring');
  ring.append(hudRing);
  bracelet.append(ring, make('small', 'mots'), hudWordsDelta);
  const hudDossier = make('strong');
  const hudDossierDelta = make('span', '', 'we-delta');
  const dossierBox = make('span', '', 'we-dossier');
  dossierBox.dataset['testid'] = 'week-dossier';
  dossierBox.append(make('small', 'Dossier'), hudDossier, hudDossierDelta);
  hud.append(bracelet, dossierBox);

  const controls = make('nav', '', 'we-controls');
  controls.setAttribute('aria-label', 'Commandes de la scène');
  const pauseButton = make('button', 'Pause');
  pauseButton.type = 'button';
  pauseButton.dataset['action'] = 'pause';
  pauseButton.setAttribute('aria-pressed', 'false');
  const soundButton = make('button', 'Son');
  soundButton.type = 'button';
  soundButton.dataset['action'] = 'sound';
  soundButton.setAttribute('aria-pressed', 'true');
  const exit = make('a', 'Quitter');
  exit.href = import.meta.env.BASE_URL;
  exit.dataset['action'] = 'leave';
  if (options.onExit) exit.addEventListener('click', (event) => { event.preventDefault(); options.onExit?.(); });
  controls.append(pauseButton, soundButton, exit);
  header.append(identity, hud, controls);

  const stage = make('section', '', 'we-stage');
  stage.setAttribute('aria-label', 'La scène');
  const viewport = make('div', '', 'we-viewport');
  viewport.dataset['testid'] = 'week-viewport';
  const place = make('p', '', 'we-place');
  const overlay = make('div', '', 'we-overlay');
  stage.append(viewport, place, overlay);

  const dock = make('footer', '', 'we-dock');
  const text = make('div', '', 'we-text');
  text.dataset['action'] = 'advance';
  text.setAttribute('aria-live', 'polite');
  const gesture = make('div', '', 'we-gesture');
  const moves = make('div', '', 'we-moves');
  const skipButton = make('button', 'Passer le mouvement', 'we-skip');
  skipButton.type = 'button';
  skipButton.dataset['action'] = 'skip';
  moves.append(skipButton);
  dock.append(text, gesture, moves);
  host.append(header, stage, dock);
  root.append(host);

  /* ------------------------------ état du shell ------------------------------ */
  let state: WeekState = createWeek();
  let disposed = false;
  let generation = 0;
  let startedAt = now();
  let paused = false;
  let stageDriver: WeekStageDriver | undefined;
  let controlDriver: ControlStationDriver | undefined;
  /** Dernier lieu montré par la scène de la semaine (pour ne pas remonter deux fois le même). */
  let shown: { place: string; cast: string } | null = null;
  let advanceNow: (() => void) | null = null;
  let abortAnswer: (() => void) | null = null;
  const resumeWaiters: Array<() => void> = [];
  const timers = new Set<number>();

  const stale = (mine: number): boolean => disposed || mine !== generation;
  const isPaused = (): boolean => paused || doc.hidden;
  const setBeat = (kind: WeekBeatKind): void => { host.dataset['beat'] = kind; };
  const setBusy = (busy: boolean): void => { host.dataset['busy'] = String(busy); };
  const later = (fn: () => void, ms: number): void => {
    const id = win.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };

  /** HUD et attributs : toujours lus depuis le `WeekState`. */
  function syncHud(): void {
    const left = state.budget - state.said;
    const leftText = left < 0 ? `−${-left}` : String(left);
    if (hudRing.textContent !== leftText) hudRing.textContent = leftText;
    if (hudDossier.textContent !== String(state.dossier)) hudDossier.textContent = String(state.dossier);
    bracelet.dataset['over'] = String(left < 0);
    ring.setAttribute('aria-label', `${leftText} mots restants aujourd'hui`);
    dayLabel.textContent = `Jour ${state.day}`;
    host.dataset['words'] = String(left);
    host.dataset['dossier'] = String(state.dossier);
    host.dataset['names'] = state.names.join(',');
  }

  const flash = (delta: HTMLElement, owner: HTMLElement, value: number): void => {
    delta.textContent = signed(value);
    delta.dataset['sign'] = value >= 0 ? 'plus' : 'moins';
    owner.dataset['flash'] = value >= 0 ? 'plus' : 'moins';
    // Rejoue l'animation même si la précédente n'est pas finie.
    delta.getAnimations?.().forEach((a) => a.cancel());
    later(() => { delta.textContent = ''; delete delta.dataset['sign']; delete owner.dataset['flash']; }, FLASH_MS);
  };

  /* ------------------------------ pause ------------------------------ */
  function updatePaused(): void {
    const actual = isPaused();
    stageDriver?.pause(actual);
    controlDriver?.pause(actual);
    host.dataset['paused'] = String(actual);
    pauseButton.textContent = paused ? 'Reprendre' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(paused));
    if (!actual) for (const wake of resumeWaiters.splice(0)) wake();
  }
  const untilResumed = (): Promise<void> => new Promise<void>((resolve) => { resumeWaiters.push(resolve); });

  /* ------------------------------ réponses du joueur ------------------------------ */
  /** Attend une réponse ; `abortAnswer` la libère quand la partie est détruite ou rejouée. */
  function answer<T>(setup: (done: (value: T) => void) => void): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve) => {
      let finished = false;
      const done = (value: T): void => {
        if (finished || disposed) return;
        finished = true;
        abortAnswer = null;
        resolve(value);
      };
      abortAnswer = () => { finished = true; resolve(undefined); };
      setup(done);
    });
  }

  /** Lecture : avance seule après `ms`, ou tout de suite sur appui, Espace, ou [data-action=advance]. */
  function readFor(ms: number, mine: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let finished = false;
      const finish = (): void => { if (!finished) { finished = true; advanceNow = null; resolve(); } };
      advanceNow = finish;
      abortAnswer = finish;
      void wait(ms).then(async () => {
        while (!finished && !stale(mine) && isPaused()) await untilResumed();
        finish();
      });
    });
  }

  /* ------------------------------ scène : un seul contexte WebGL ------------------------------ */
  function resetViewportAttributes(): void {
    for (const key of ['speaker', 'segment', 'drawCalls', 'reader', 'barrier', 'paused']) delete viewport.dataset[key];
  }
  function disposeStage(): void {
    const driver = stageDriver;
    stageDriver = undefined;
    shown = null;
    driver?.dispose();
    if (driver) viewport.replaceChildren();
  }
  function disposeControl(): void {
    const driver = controlDriver;
    controlDriver = undefined;
    driver?.dispose();
    if (driver) viewport.replaceChildren();
  }
  const onSceneEvent = (event: string): void => { if (!disposed) host.dataset['sceneEvent'] = event; };

  async function ensureStage(mine: number): Promise<WeekStageDriver | undefined> {
    if (stageDriver) return stageDriver;
    disposeControl();
    setBeat('loading');
    setBusy(true);
    const next = await (options.createStage ?? defaultCreateStage)(viewport, onSceneEvent);
    if (stale(mine)) { next.dispose(); return undefined; }
    stageDriver = next;
    updatePaused();
    return next;
  }
  async function ensureControl(mine: number): Promise<ControlStationDriver | undefined> {
    if (controlDriver) return controlDriver;
    disposeStage();
    setBeat('loading');
    setBusy(true);
    resetViewportAttributes();
    const next = await (options.createControlView ?? defaultCreateControl)(viewport, onSceneEvent);
    if (stale(mine)) { next.dispose(); return undefined; }
    controlDriver = next;
    updatePaused();
    return next;
  }

  /* ------------------------------ texte ------------------------------ */
  function clearText(): void { text.replaceChildren(); }
  function addLine(line: Line): void {
    for (const old of Array.from(text.children)) old.classList.add('old');
    while (text.children.length >= MAX_LINES) text.firstElementChild?.remove();
    const p = make('p', '', `we-line ${line.voice}`);
    if (line.who) p.append(make('span', line.who, 'we-who'));
    p.append(doc.createTextNode(line.text));
    text.append(p);
  }
  /** Ligne d'effet : ce que le geste vient de coûter ou de rapporter, dite par le Registre. */
  function addEffect(label: string): void {
    addLine({ who: null, text: label, voice: 'machine' });
    text.lastElementChild?.classList.add('fx');
  }

  /* ------------------------------ beats ------------------------------ */
  async function showLines(lines: readonly Line[], mine: number): Promise<void> {
    setBeat('lines');
    setBusy(false);
    for (const line of lines) {
      addLine(line);
      stageDriver?.speak(line.cast ?? (line.voice === 'dit' ? 'player' : null));
      sound.line();
      await readFor(READ_BASE_MS + READ_PER_CHAR_MS * line.text.length, mine);
      if (stale(mine)) return;
    }
    stageDriver?.speak(null);
  }

  function showScene(beat: Extract<Beat, { kind: 'scene' }>, mine: number): Promise<void> {
    host.dataset['day'] = String(beat.day);
    host.dataset['scene'] = beat.id;
    place.textContent = beat.label;
    clearText();
    gesture.replaceChildren();
    overlay.replaceChildren();
    return (async () => {
      if (beat.place === 'controle-j1') {
        await ensureControl(mine);
        if (stale(mine)) return;
        viewport.dataset['place'] = 'controle-j1';
        viewport.dataset['cast'] = '';
        setBusy(false);
        return;
      }
      const driver = await ensureStage(mine);
      if (!driver || stale(mine)) return;
      const cast = beat.cast.join(',');
      const same = shown !== null && shown.place === beat.place && shown.cast === cast;
      // Le relevé du soir et la fin se jouent dans la salle où le joueur est déjà.
      const keep = same && (beat.id.endsWith('-R') || beat.id.startsWith('P-FIN'));
      if (!keep) {
        setBeat('stage');
        setBusy(true);
        await driver.show(beat.place, beat.cast as readonly WeekCast[]);
        if (stale(mine)) return;
        shown = { place: beat.place, cast };
      }
      setBusy(false);
    })();
  }

  /** Un geste : objet facultatif, cibles (libellé blanc, prix ambre, détail gris). Un appui décide ; glisser l'objet aussi. */
  function showGesture(beat: Extract<Beat, { kind: 'gesture' }>): Promise<number | undefined> {
    setBeat('gesture');
    setBusy(false);
    stageDriver?.speak(null);
    return answer<number>((done) => {
      gesture.replaceChildren();
      gesture.dataset['kind'] = 'gesture';
      const ask = make('div', '', 'we-ask');
      const prompt = make('p', beat.prompt, 'we-prompt');
      prompt.tabIndex = -1;
      ask.append(prompt);
      const buttons: HTMLButtonElement[] = [];
      let object: HTMLElement | null = null;
      if (beat.object) {
        object = make('div', beat.object.label, 'we-object');
        if (beat.object.sub) object.append(make('small', beat.object.sub));
        ask.append(object);
      }
      const targets = make('div', '', 'we-targets');
      const decide = (index: number): void => {
        sound.unlock();
        sound.pose();
        for (const b of buttons) b.disabled = true;
        gesture.replaceChildren();
        done(index);
      };
      beat.targets.forEach((target: Target, index) => {
        const b = make('button', '', 'we-target');
        b.type = 'button';
        b.dataset['choice'] = target.id;
        const row = make('span', '', 'we-t-row');
        row.append(make('span', target.label, 'we-t-label'), make('span', target.price, `we-t-price${target.gain ? ' gain' : ''}`));
        b.append(row);
        if (target.detail) b.append(make('small', target.detail, 'we-t-detail'));
        b.addEventListener('click', () => decide(index));
        buttons.push(b);
        targets.append(b);
      });
      gesture.append(ask, targets);
      if (object) enableDrag(object, buttons, decide);
      prompt.focus({ preventScroll: true });
    });
  }

  /** Glisser l'objet sur une cible décide aussi (le prototype validé). Sans `elementFromPoint`, l'appui seul décide. */
  function enableDrag(object: HTMLElement, buttons: readonly HTMLButtonElement[], decide: (index: number) => void): void {
    let pid: number | null = null;
    let x0 = 0;
    let y0 = 0;
    let moved = false;
    const under = (x: number, y: number): number => {
      if (typeof doc.elementFromPoint !== 'function') return -1;
      object.style.pointerEvents = 'none';
      const hit = doc.elementFromPoint(x, y)?.closest<HTMLElement>('.we-target') ?? null;
      object.style.pointerEvents = '';
      return hit ? buttons.indexOf(hit as HTMLButtonElement) : -1;
    };
    object.addEventListener('pointerdown', (event) => {
      sound.unlock();
      pid = event.pointerId;
      x0 = event.clientX;
      y0 = event.clientY;
      moved = false;
      object.setPointerCapture?.(event.pointerId);
      object.classList.add('held');
    });
    object.addEventListener('pointermove', (event) => {
      if (pid !== event.pointerId) return;
      const dx = event.clientX - x0;
      const dy = event.clientY - y0;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (!moved) return;
      object.style.transform = `translate(${dx}px, ${dy}px) rotate(-2deg)`;
      const index = under(event.clientX, event.clientY);
      buttons.forEach((b, i) => b.classList.toggle('aimed', i === index));
    });
    const release = (event: PointerEvent, drop: boolean): void => {
      if (pid !== event.pointerId) return;
      pid = null;
      object.classList.remove('held');
      object.style.transform = '';
      const index = drop && moved ? under(event.clientX, event.clientY) : -1;
      buttons.forEach((b) => b.classList.remove('aimed'));
      if (index >= 0) decide(index);
    };
    object.addEventListener('pointerup', (event) => release(event, true));
    object.addEventListener('pointercancel', (event) => release(event, false));
  }

  /** Une pièce à lire : le joueur touche une ligne, ou laisse passer. Rend l'indice de ligne (titres exclus) ou -1. */
  function showPiece(beat: Extract<Beat, { kind: 'piece' }>): Promise<number | undefined> {
    setBeat('piece');
    setBusy(false);
    stageDriver?.speak(null);
    return answer<number>((done) => {
      overlay.replaceChildren();
      const paper = make('section', '', 'we-paper we-piece');
      paper.dataset['testid'] = 'week-piece';
      paper.setAttribute('aria-label', beat.title);
      const title = make('h2', beat.title);
      const prompt = make('p', beat.prompt, 'we-prompt');
      prompt.tabIndex = -1;
      paper.append(title, prompt);
      const finish = (index: number): void => {
        sound.unlock();
        sound.pose();
        overlay.replaceChildren();
        done(index);
      };
      let line = 0;
      beat.rows.forEach((row: PieceRow) => {
        if ('heading' in row) { paper.append(make('h3', row.heading)); return; }
        const index = line++;
        const b = make('button', row.line, 'we-pl');
        b.type = 'button';
        b.dataset['line'] = String(index);
        b.addEventListener('click', () => finish(index));
        paper.append(b);
      });
      const none = make('button', '', 'we-pl we-none');
      none.type = 'button';
      none.dataset['action'] = 'piece-none';
      none.append(make('span', beat.none.label), make('span', beat.none.price, 'we-t-price'));
      none.addEventListener('click', () => finish(-1));
      paper.append(none);
      overlay.append(paper);
      prompt.focus({ preventScroll: true });
    });
  }

  /** Un avis ou un relevé : reste à l'écran jusqu'au toucher du papier (E6 refusé). Les lignes s'impriment une à une, le papier ne part jamais seul. */
  function showTicket(beat: Extract<Beat, { kind: 'ticket' }>): Promise<number | undefined> {
    setBeat('ticket');
    setBusy(false);
    stageDriver?.speak(null);
    return answer<number>((done) => {
      overlay.replaceChildren();
      // Le papier lui-même est la surface à toucher : pas de bouton « Continuer » à côté.
      const paper = make('div', '', 'we-paper we-ticket');
      paper.dataset['testid'] = 'week-ticket';
      paper.dataset['action'] = 'close-ticket';
      paper.setAttribute('role', 'button');
      paper.tabIndex = 0;
      paper.append(make('h2', beat.title));
      // Les lignes s'impriment une à une. Tant que tout n'est pas imprimé, un toucher FINIT l'impression (il ne ferme pas)
      // et l'invite est cachée ; le toucher suivant ferme. Rien ne ferme le papier seul.
      const pending: HTMLElement[] = [];
      const printable = (el: HTMLElement): HTMLElement => { el.classList.add('we-wait'); pending.push(el); return el; };
      beat.rows.forEach((row: TicketRow) => {
        if (typeof row === 'string') { paper.append(printable(make('p', row, 'we-tline'))); return; }
        const el = make('div', '', `we-trow${row.total ? ' total' : ''}`);
        el.append(make('span', row.label), make('span', row.value));
        paper.append(printable(el));
      });
      if (beat.footer) paper.append(printable(make('p', beat.footer, 'we-tfoot')));
      const hint = make('p', 'Touche le papier pour continuer.', 'we-hint we-wait');
      paper.append(hint);
      let printed = false;
      const finishPrint = (): void => {
        printed = true;
        paper.dataset['printed'] = 'true';
        for (const el of pending) el.classList.remove('we-wait');
        hint.classList.remove('we-wait');
      };
      const printFrom = async (k: number): Promise<void> => {
        const el = pending[k];
        if (printed) return;
        if (!el) { finishPrint(); return; }
        el.classList.remove('we-wait');
        sound.line();
        await wait(PRINT_STEP_MS);
        if (printed || disposed || !paper.isConnected) return;
        await printFrom(k + 1);
      };
      paper.dataset['printed'] = 'false';
      const touch = (): void => {
        sound.unlock();
        if (!printed) { finishPrint(); return; }
        sound.pose();
        overlay.replaceChildren();
        done(0);
      };
      paper.addEventListener('click', touch);
      paper.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); touch(); }
      });
      overlay.append(paper);
      const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      if (reduced) finishPrint(); else void printFrom(0);
      paper.focus({ preventScroll: true });
      closeTicket = touch;
    }).finally(() => { closeTicket = null; });
  }
  let closeTicket: (() => void) | null = null;

  function showEnding(beat: Extract<Beat, { kind: 'ending' }>): void {
    setBeat('ending');
    setBusy(false);
    host.dataset['ending'] = beat.ending;
    stageDriver?.speak(null);
    gesture.replaceChildren();
    overlay.replaceChildren();
    const sec = Math.max(0, Math.round((now() - startedAt) / 1000));
    const duration = `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s`;
    const panel = make('section', '', `we-paper we-ending`);
    panel.dataset['testid'] = 'week-ending';
    panel.dataset['ending'] = beat.ending;
    const title = make('h2', beat.title);
    title.tabIndex = -1;
    panel.append(title, make('p', beat.regime, 'we-regime'), make('p', beat.fact, 'we-fact'));
    if (beat.mother) panel.append(make('p', beat.mother, 'we-fact we-mother'));
    const facts = make('dl', '', 'we-facts');
    const fact = (label: string, value: string): void => {
      const row = make('div');
      row.append(make('dt', label), make('dd', value));
      facts.append(row);
    };
    fact('Dossier', `${beat.dossier} (seuil d'arrestation : ${beat.threshold})`);
    fact('Noms donnés', String(beat.names.length));
    fact('Durée de ta partie', duration);
    panel.append(facts);
    const replay = make('button', 'Rejouer', 'we-replay');
    replay.type = 'button';
    replay.dataset['action'] = 'replay';
    replay.addEventListener('click', () => { void start(); });
    panel.append(replay);
    overlay.append(panel);
    title.focus({ preventScroll: true });
  }

  function showError(): void {
    setBeat('error');
    setBusy(false);
    gesture.replaceChildren();
    overlay.replaceChildren();
    const panel = make('section', '', 'we-paper we-error');
    const title = make('h2', 'La scène ne répond pas.');
    title.tabIndex = -1;
    const replay = make('button', 'Rejouer', 'we-replay');
    replay.type = 'button';
    replay.dataset['action'] = 'replay';
    replay.addEventListener('click', () => { void start(); });
    panel.append(title, make('p', 'Rien n’est perdu : la partie reprend du début.', 'we-fact'), replay);
    overlay.append(panel);
    title.focus({ preventScroll: true });
  }

  /** Traite un beat ; rend la réponse attendue par le générateur. */
  async function handle(beat: Beat, mine: number): Promise<number | undefined> {
    switch (beat.kind) {
      case 'scene':
        await showScene(beat, mine);
        return undefined;
      case 'lines':
        await showLines(beat.lines, mine);
        return undefined;
      case 'say':
        sound.tic();
        flash(hudWordsDelta, bracelet, -beat.words);
        return undefined;
      case 'written':
        sound.dossier(beat.delta);
        flash(hudDossierDelta, dossierBox, beat.delta);
        addEffect(`${beat.label} ${signed(beat.delta)}`);
        return undefined;
      case 'gain':
        sound.gain();
        flash(hudWordsDelta, bracelet, beat.words);
        return undefined;
      case 'gesture':
        return showGesture(beat);
      case 'piece':
        return showPiece(beat);
      case 'ticket':
        return showTicket(beat);
      case 'control': {
        const driver = controlDriver;
        if (!driver) throw new Error(`Acte du contrôle sans vue : ${beat.act}`);
        setBeat('control');
        setBusy(true);
        await driver[beat.act]();
        if (!stale(mine)) setBusy(false);
        return undefined;
      }
      case 'stage': {
        const driver = stageDriver;
        if (!driver) return undefined;
        setBeat('stage');
        setBusy(true);
        await driver.act(beat.act);
        if (!stale(mine)) setBusy(false);
        return undefined;
      }
      case 'prop':
        stageDriver?.prop(beat.id, beat.visible);
        return undefined;
      case 'ending':
        showEnding(beat);
        return undefined;
    }
  }

  /** Joue la semaine du début à la fin. Toute exception montre l'écran d'erreur, jamais un écran blanc. */
  async function play(mine: number): Promise<void> {
    try {
      const run = runWeek(state);
      let step = run.next();
      while (!step.done) {
        if (stale(mine)) return;
        // Le générateur a déjà écrit l'effet dans l'état : on le montre avant le beat (relevé, fin comprises).
        syncHud();
        const reply = await handle(step.value, mine);
        if (stale(mine)) return;
        step = run.next(reply);
      }
    } catch (error) {
      if (stale(mine)) return;
      console.error('La semaine a échoué', error);
      showError();
    }
  }

  /** (Re)lance une partie neuve : 20 mots, dossier 60, jour 1. */
  async function start(): Promise<void> {
    const mine = ++generation;
    abortAnswer?.();
    advanceNow = null;
    for (const id of timers) win.clearTimeout(id);
    timers.clear();
    disposeStage();
    disposeControl();
    resetViewportAttributes();
    viewport.replaceChildren();
    overlay.replaceChildren();
    gesture.replaceChildren();
    clearText();
    for (const key of ['ending', 'scene', 'sceneEvent']) delete host.dataset[key];
    hudWordsDelta.textContent = '';
    hudDossierDelta.textContent = '';
    state = createWeek();
    startedAt = now();
    paused = false;
    host.dataset['day'] = '1';
    setBeat('loading');
    setBusy(true);
    syncHud();
    updatePaused();
    await play(mine);
  }

  /* ------------------------------ commandes ------------------------------ */
  pauseButton.addEventListener('click', () => { paused = !paused; updatePaused(); });
  soundButton.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled);
    soundButton.setAttribute('aria-pressed', String(sound.enabled));
    soundButton.textContent = sound.enabled ? 'Son' : 'Muet';
    if (sound.enabled) sound.unlock();
  });
  skipButton.addEventListener('click', () => { stageDriver?.skip(); controlDriver?.skip(); });
  const advance = (): void => { advanceNow?.(); };
  text.addEventListener('click', advance);
  viewport.addEventListener('click', advance);
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== ' ' || event.repeat || disposed) return;
    const target = event.target as Partial<Element> | null;
    if (typeof target?.closest === 'function' && target.closest('button, a, input, select, textarea')) return;
    if (closeTicket) { event.preventDefault(); closeTicket(); return; }
    if (advanceNow) { event.preventDefault(); advanceNow(); }
  };
  const onVisibility = (): void => updatePaused();
  const onPageHide = (event: PageTransitionEvent): void => { if (!event.persisted) dispose(); };
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', onPageHide);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    generation++;
    abortAnswer?.();
    for (const id of timers) win.clearTimeout(id);
    timers.clear();
    for (const wake of resumeWaiters.splice(0)) wake();
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', onPageHide);
    disposeStage();
    disposeControl();
    host.remove();
  }

  void start();
  return dispose;
}
