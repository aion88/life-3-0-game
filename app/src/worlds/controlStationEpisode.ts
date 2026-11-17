import { createControlStationView } from './controlStationView';
import { CONTROL_STATION_CONTENT as copy } from './controlStationContent';
import { contestRecord, createLedger, wordsLeft, write } from './controlStationLedger';
import './controlStationEpisode.css';

export type ControlStationPhase = 'loading' | 'arrival' | 'approaching' | 'decision' | 'requesting' | 'accepted' | 'crossing' | 'returning' | 'passed' | 'returned' | 'error';
export interface ControlStationOutcome { route: 'passed' | 'returned'; guarantorAdded: boolean; restrictionRemains: true }
export interface ControlStationDriver {
  approach(): Promise<void>;
  requestGuarantee(): Promise<void>;
  authorize(): Promise<void>;
  goHome(): Promise<void>;
  pause(paused: boolean): void;
  skip(): void;
  dispose(): void;
}
export interface ControlStationEpisodeOptions {
  onExit?: () => void;
  onComplete?: (outcome: ControlStationOutcome) => void;
  /** Dependency seam for orchestration tests. Rendering owns no narrative state. */
  createView?: (host: HTMLElement, onEvent: (event: string) => void) => Promise<ControlStationDriver>;
}
const MOVING: readonly ControlStationPhase[] = ['approaching', 'requesting', 'crossing', 'returning'];

/** Embodied slice: only renderer completion advances a gesture; choices never expire. */
export async function mountControlStationEpisode(root: HTMLElement, options: ControlStationEpisodeOptions = {}): Promise<() => void> {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag); element.textContent = text; element.className = className; return element;
  };
  const host = make('main', '', 'control-station-episode'); host.dataset['testid'] = 'control-station-episode'; host.setAttribute('aria-label', '1984 — le passage du dimanche');
  const header = make('header', '', 'cs-header');
  const identity = make('div', '', 'cs-identity'); identity.append(make('span', `LIFE 3.0 / ${copy.arrival.world}`, 'cs-world'), make('h1', copy.arrival.title));
  const controls = make('nav', '', 'cs-controls'); controls.setAttribute('aria-label', 'Commandes de la scène');
  const pauseButton = make('button', copy.shared.pause); pauseButton.type = 'button'; pauseButton.dataset['action'] = 'pause'; pauseButton.setAttribute('aria-pressed', 'false');
  const exit = make('a', copy.shared.leave); exit.href = import.meta.env.BASE_URL; exit.dataset['action'] = 'leave';
  if (options.onExit) exit.addEventListener('click', event => { event.preventDefault(); options.onExit?.(); });
  const hud = make('p', '', 'cs-hud'); hud.dataset['testid'] = 'control-hud'; hud.setAttribute('aria-live', 'polite'); hud.setAttribute('aria-atomic', 'true');
  const hudWords = make('strong'), hudDossier = make('strong');
  const hudW = make('span', '', 'cs-hud-words'); hudW.append(hudWords, ` ${copy.ledger.wordsUnit}`);
  const hudD = make('span', '', 'cs-hud-dossier'); hudD.append(`${copy.ledger.dossierLabel} `, hudDossier); hud.append(hudW, hudD);
  controls.append(pauseButton, exit); header.append(identity, hud, controls);
  const goal = make('p', copy.arrival.goal, 'cs-goal'); goal.dataset['testid'] = 'control-goal';
  const workspace = make('div', '', 'cs-workspace');
  const scene = make('section', '', 'cs-scene'); scene.dataset['testid'] = 'control-scene'; scene.setAttribute('aria-label', 'Ton personnage au contrôle de la station');
  const place = make('p', copy.shared.place, 'cs-place');
  const sceneStatus = make('p', '', 'cs-scene-status'); sceneStatus.setAttribute('aria-live', 'polite'); sceneStatus.setAttribute('aria-atomic', 'true');
  const viewport = make('div', '', 'cs-viewport'); viewport.dataset['testid'] = 'control-viewport'; scene.append(viewport, place, sceneStatus);
  const interaction = make('section', '', 'cs-interaction'); interaction.setAttribute('aria-label', 'Objet et actions disponibles');
  const instrument = make('section', '', 'cs-instrument'); instrument.dataset['testid'] = 'control-instrument';
  const source = make('p', '', 'cs-source');
  const heading = make('h2', '', 'cs-instrument-title'); heading.tabIndex = -1; heading.id = 'cs-instrument-heading'; heading.setAttribute('aria-describedby', 'cs-instrument-line cs-instrument-detail'); instrument.setAttribute('aria-labelledby', heading.id);
  const line = make('p', '', 'cs-line'); line.id = 'cs-instrument-line';
  const detail = make('p', '', 'cs-detail'); detail.id = 'cs-instrument-detail';
  const extra = make('div', '', 'cs-instrument-extra');
  const artifacts = make('div', '', 'cs-artifacts');
  instrument.append(source, heading, line, detail, artifacts, extra); workspace.append(scene, interaction);
  const dock = make('footer', '', 'cs-dock'); dock.setAttribute('aria-label', 'Agir dans la scène');
  const instruction = make('p', '', 'cs-instruction'); instruction.setAttribute('role', 'status'); instruction.setAttribute('aria-atomic', 'true');
  const actions = make('div', '', 'cs-actions'); actions.dataset['testid'] = 'control-actions'; dock.append(instruction, actions);
  interaction.append(instrument, dock);
  host.append(header, goal, workspace); root.append(host);

  let phase: ControlStationPhase = 'loading';
  let driver: ControlStationDriver | undefined;
  let disposed = false;
  let generation = 0;
  let paused = false;
  let outcomeSent = false;
  let ledger = createLedger(copy.ledger.budget, copy.ledger.dossier);
  let settled = false;
  const button = (text: string, action: string, run: () => void, cost?: string): HTMLButtonElement => {
    const b = make('button', '', 'cs-action'); b.type = 'button'; b.dataset['action'] = action;
    b.append(make('span', text, 'cs-action-label'));
    if (cost) b.append(make('small', cost, 'cs-action-cost'));
    b.addEventListener('click', () => { if (!disposed) run(); }); return b;
  };
  const setPhase = (next: ControlStationPhase, focus = false): void => {
    if (disposed) return;
    phase = next; render();
    if (focus) heading.focus({ preventScroll: true });
  };
  const updatePaused = (): void => {
    const actual = paused || doc.hidden;
    driver?.pause(actual); host.dataset['paused'] = String(actual);
    pauseButton.textContent = paused ? copy.shared.resume : copy.shared.pause;
    pauseButton.setAttribute('aria-pressed', String(paused));
    if (MOVING.includes(phase)) instruction.textContent = actual ? 'Scène en pause.' : 'Le personnage agit. Tu peux passer ce mouvement.';
  };
  /** One optional contest: words are spent at once, the reader answers in place. */
  const contest = (index: number): void => {
    if (disposed || phase !== 'decision') return;
    if (contestRecord(ledger, index, { ...copy.record.rule, lineCount: copy.record.lines.length }) === 'ignored') return;
    render();
    host.querySelector<HTMLElement>('.cs-record-result')?.focus({ preventScroll: true });
  };
  /** Writes the route to the dossier exactly once, before the ending is rendered. */
  const settle = (route: 'passed' | 'returned'): void => {
    if (settled) return;
    settled = true;
    const entry = route === 'passed' ? copy.ledger.guarantor : copy.ledger.abandoned;
    write(ledger, entry.label, entry.delta);
  };
  pauseButton.addEventListener('click', () => { if (!driver || disposed) return; paused = !paused; updatePaused(); });

  const complete = (route: 'passed' | 'returned'): void => {
    if (outcomeSent || disposed) return;
    outcomeSent = true;
    options.onComplete?.({ route, guarantorAdded: route === 'passed', restrictionRemains: true });
  };
  const move = async (expected: ControlStationPhase, busy: ControlStationPhase, method: 'approach' | 'requestGuarantee' | 'authorize' | 'goHome', next: ControlStationPhase): Promise<void> => {
    if (disposed || phase !== expected || !driver) return;
    const mine = generation;
    setPhase(busy);
    try {
      await driver[method]();
      if (disposed || mine !== generation) return;
      if (next === 'passed' || next === 'returned') settle(next);
      setPhase(next, true);
      if (next === 'passed' || next === 'returned') complete(next);
    } catch (error) {
      if (disposed || mine !== generation) return;
      console.error('Control-station action failed', error); setPhase('error', true);
    }
  };

  /** The refusal as a piece to read: reader lines against the player's own bracelet log. */
  function recordNode(): HTMLElement {
    const record = make('div', '', 'cs-record'); record.dataset['testid'] = 'control-record';
    const open = ledger.contested === 'none';
    if (open) record.append(make('p', `${copy.record.prompt} ${copy.record.rule.cost} ${copy.ledger.wordsUnit}.`, 'cs-record-prompt'));
    record.append(make('p', copy.record.readerLabel, 'cs-record-label'));
    copy.record.lines.forEach((text, index) => {
      if (open) {
        const b = make('button', text, 'cs-record-line'); b.type = 'button'; b.dataset['action'] = `contest-${index}`;
        b.addEventListener('click', () => contest(index)); record.append(b);
      } else record.append(make('p', text, 'cs-record-line'));
    });
    record.append(make('p', copy.record.ownLabel, 'cs-record-label'), make('p', copy.record.own, 'cs-record-line cs-record-own'));
    if (!open) {
      const result = make('p', ledger.contested === 'founded' ? copy.record.founded : copy.record.unfounded, 'cs-record-result');
      result.tabIndex = -1; result.dataset['result'] = ledger.contested; record.append(result);
    }
    record.append(make('small', `${copy.refused.detail} ${open ? `${copy.record.optional} ` : ''}${copy.shared.fiction}`, 'cs-record-note'));
    return record;
  }
  function render(): void {
    host.dataset['phase'] = phase;
    host.dataset['busy'] = String(MOVING.includes(phase));
    host.dataset['words'] = String(wordsLeft(ledger)); host.dataset['dossier'] = String(ledger.dossier); host.dataset['contested'] = ledger.contested;
    const wordsNow = String(wordsLeft(ledger)), dossierNow = String(ledger.dossier);
    if (hudWords.textContent !== wordsNow) hudWords.textContent = wordsNow;
    if (hudDossier.textContent !== dossierNow) hudDossier.textContent = dossierNow;
    pauseButton.disabled = !driver || phase === 'loading' || phase === 'error';
    source.textContent = ''; heading.textContent = ''; line.textContent = ''; detail.textContent = ''; extra.replaceChildren(); artifacts.replaceChildren(); actions.replaceChildren();
    sceneStatus.textContent = ''; instruction.textContent = ''; goal.textContent = copy.arrival.goal;
    instrument.dataset['kind'] = 'message';
    const showPass = (status: 'pending' | 'refused' | 'authorized', text: string): void => {
      const pass = make('div', '', 'cs-artifact'); pass.dataset['status'] = status;
      pass.append(make('span', 'Titre de transport personnel', 'cs-artifact-label'), make('strong', text, 'cs-artifact-status')); artifacts.append(pass);
    };
    const show = (from: string, title: string, text: string, note = ''): void => { source.textContent = from; heading.textContent = title; line.textContent = text; detail.textContent = note; };
    switch (phase) {
      case 'loading':
        show(copy.arrival.world, copy.shared.loading, 'Le personnage et les objets se préparent.'); break;
      case 'arrival':
        instrument.dataset['kind'] = 'phone';
        show(copy.arrival.speaker, 'On t’attend pour déjeuner.', copy.arrival.line, copy.arrival.role);
        extra.append(make('p', `${copy.ledger.intro} ${copy.ledger.budget} ${copy.ledger.wordsUnit} ${copy.ledger.today}`, 'cs-count'));
        actions.append(button(copy.arrival.action, 'approach', () => { void move('arrival', 'approaching', 'approach', 'decision'); })); break;
      case 'approaching':
        instrument.dataset['kind'] = 'reader';
        showPass('pending', 'Lecture en cours');
        show(copy.approach.speaker, copy.approach.status, copy.approach.line);
        sceneStatus.textContent = 'Titre de transport · présentation au lecteur'; break;
      case 'decision':
        instrument.dataset['kind'] = 'reader';
        showPass('refused', 'Trajet refusé');
        show(copy.shared.reader, copy.refused.status, copy.refused.reason);
        sceneStatus.textContent = 'Passage fermé · autorisation requise';
        extra.append(recordNode());
        instruction.textContent = copy.decision.prompt;
        actions.append(
          button(copy.decision.guarantor.label, 'guarantor', () => { void move('decision', 'requesting', 'requestGuarantee', 'accepted'); }, `${copy.ledger.freeCost} · ${copy.decision.guarantor.cost}`),
          button(copy.decision.return.label, 'return', () => { void move('decision', 'returning', 'goHome', 'returned'); }, `${copy.ledger.freeCost} · ${copy.decision.return.cost}`),
        ); break;
      case 'requesting':
        instrument.dataset['kind'] = 'phone';
        show(copy.requesting.speaker, copy.requesting.status, copy.requesting.line);
        sceneStatus.textContent = 'Téléphone · demande de garantie'; break;
      case 'accepted':
        instrument.dataset['kind'] = 'phone';
        show(copy.accepted.speaker, copy.accepted.status, copy.accepted.line, copy.accepted.receipt);
        sceneStatus.textContent = 'Garantie reçue · ton trajet peut reprendre';
        actions.append(button(copy.accepted.action, 'continue', () => { void move('accepted', 'crossing', 'authorize', 'passed'); })); break;
      case 'crossing':
        instrument.dataset['kind'] = 'reader';
        showPass('authorized', 'Ce trajet est autorisé');
        show(copy.shared.reader, copy.crossing.status, copy.crossing.line);
        sceneStatus.textContent = 'Autorisation du trajet · ouverture du passage'; break;
      case 'returning':
        instrument.dataset['kind'] = 'phone';
        show(copy.returning.speaker, copy.returning.status, copy.returning.line);
        goal.textContent = 'Repartir sans demander de garantie.'; break;
      case 'passed':
      case 'returned': {
        const end = copy[phase]; instrument.dataset['kind'] = 'phone';
        show(end.speaker, end.title, end.reply, end.trace);
        goal.textContent = phase === 'passed' ? 'Tu peux continuer vers le métro.' : 'Tu as quitté le contrôle. Le passage reste refusé.';
        const traces = make('dl', '', 'cs-traces');
        const kept = `${wordsLeft(ledger)} ${copy.ledger.left} ${ledger.budget}.`;
        const written = `${ledger.dossier} · ${ledger.entries.map(entry => `${entry.label} ${entry.delta > 0 ? '+' : ''}${entry.delta}`).join(' · ')}`;
        for (const trace of [...end.summary, { label: copy.ledger.summaryWords, value: kept }, { label: copy.ledger.summaryDossier, value: written }]) { const row = make('div'); row.append(make('dt', trace.label), make('dd', trace.value)); traces.append(row); }
        artifacts.replaceChildren(traces);
        actions.append(button(copy.shared.replay, 'replay', () => { void initialise(); })); break;
      }
      case 'error':
        show('Scène indisponible', copy.error.title, copy.error.line);
        actions.append(button(copy.error.action, 'retry', () => { void initialise(); })); break;
    }
    if (MOVING.includes(phase)) actions.append(button(copy.shared.skip, 'skip', () => { if (MOVING.includes(phase)) driver?.skip(); }));
    interaction.dataset['kind'] = instrument.dataset['kind'];
    artifacts.hidden = artifacts.childElementCount === 0;
    source.hidden = !source.textContent; heading.hidden = !heading.textContent; line.hidden = !line.textContent; detail.hidden = !detail.textContent;
    instruction.hidden = !instruction.textContent && !MOVING.includes(phase); sceneStatus.hidden = !sceneStatus.textContent;
    updatePaused();
  }
  const onEvent = (event: string): void => {
    if (disposed) return;
    host.dataset['sceneEvent'] = event;
    if (event === 'refused') { sceneStatus.textContent = copy.refused.status; sceneStatus.hidden = false; }
    if (event === 'opened') { sceneStatus.textContent = 'Barrière ouverte · passage autorisé'; sceneStatus.hidden = false; }
  };
  async function initialise(): Promise<void> {
    const mine = ++generation;
    driver?.dispose(); driver = undefined; viewport.replaceChildren(); outcomeSent = false; paused = false;
    ledger = createLedger(copy.ledger.budget, copy.ledger.dossier); settled = false;
    setPhase('loading');
    try {
      const create = options.createView ?? ((target: HTMLElement, callback: (event: string) => void) => createControlStationView(target, { onEvent: callback }));
      const next = await create(viewport, event => { if (!disposed && mine === generation) onEvent(event); });
      if (disposed || mine !== generation) { next.dispose(); return; }
      driver = next; setPhase('arrival'); updatePaused();
    } catch (error) {
      if (disposed || mine !== generation) return;
      console.error('Control-station scene failed to initialise', error); setPhase('error');
    }
  }
  const visibility = (): void => updatePaused();
  const dispose = (): void => {
    if (disposed) return;
    disposed = true; generation++; driver?.dispose(); driver = undefined;
    doc.removeEventListener('visibilitychange', visibility); win.removeEventListener('pagehide', pagehide); host.remove();
  };
  const pagehide = (event: PageTransitionEvent): void => { if (!event.persisted) dispose(); };
  doc.addEventListener('visibilitychange', visibility); win.addEventListener('pagehide', pagehide);
  render(); await initialise(); return dispose;
}
