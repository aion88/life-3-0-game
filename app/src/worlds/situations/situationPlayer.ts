/**
 * Lecteur de situations (atelier `?atelier=situations&monde=w10`).
 * Papers, Please : on LIT la situation, on choisit entre DEUX options, on voit la contrepartie. Rien à manipuler.
 * Écran : barre fine, (bandeau des interdits), image du lieu dégagée, conséquence du choix précédent, règle, situation, plateau (pièce, deux cibles).
 * Un choix mène tout de suite à la situation suivante : aucune étape « continuer ». Le tampon s'imprime sur la pièce pendant 0,4 s au plus ; un second appui passe la transition.
 * Le contenu vient de situations.json ; l'état de situationState.ts (pur). Ici : seulement le DOM, le son et la vue illustrée.
 */
import frStrings from '../../data/strings/fr.json';
import enStrings from '../../data/strings/en.json';
import { journeys } from '../catalogue';
import { createIllustratedJourneyView } from '../illustratedView';
import type { JourneyView } from '../view';
import { createPiece, createTicket, type Piece, type PieceSpec, type TicketLine } from '../pieces';
import { createWeekSound } from '../week/weekSound';
import { choose, ending, forbidden, hasInterdits, previousSuite, setSituationLang, situationsData, start, worldIds, worldIntro, type Choice, type PieceData, type PlayState, type Situation } from './situationState';
import illustrationData from '../illustrations.json';
import { playerFrame } from './situationFrame';
import '../../ui/font';
import '../../ui/tokens.css';
import '../../ui/worlds.css';
import './situationPlayer.css';

/** The piece spec of a situation's piece (the JSON's four types onto the four graphic components). */
export function pieceSpec(piece: PieceData): PieceSpec {
  switch (piece.type) {
    case 'telephone': return { prop: 'phone', sender: piece.expediteur, title: '', text: piece.message };
    case 'papier': return { prop: 'document', sender: piece.emetteur, title: '', text: piece.texte };
    case 'carte': return { prop: 'card', sender: '', title: piece.titre, text: '', fields: piece.champs };
    case 'ticket': return { prop: 'ticket', sender: '', title: '', text: '', lines: piece.lignes };
  }
}

/** Mounts the player into `root`; `search` is the page's query string (`monde=w10`). Returns the disposer. */
/** How the public game mounts the player: the world the questionnaire computed, and the ways out shown at the end. */
export interface SituationOptions {
  /** The world to play. When set, the atelier address is neither read nor written. */
  readonly world?: string;
  /** Extra ways out under the end ticket (answers of 2026, atlas, contact). */
  readonly endLinks?: (world: string) => HTMLElement[];
  /** Where the game in progress is kept (the public game): a reload or a return from the atlas finds the same screen. */
  readonly saveKey?: string;
  /** The player's language (French by default). */
  readonly lang?: string;
}

/** The player's own words, in both languages. `prefix` is how every interdit starts in the data. */
const WORDS = {
  fr: { prefix: 'Tu ne peux plus ', banLabel: 'Tu ne peux plus :', banAria: 'Ce que tu ne peux plus faire', situation: 'Situation ', count: (n: number) => `${n} sur 4`, end: 'Fin', after: 'CE QUI S\'EST PASSÉ', choice: 'Ton choix', ticket: 'Ce que tu ne peux plus faire', next: 'Et maintenant ?', replay: 'Rejouer', other: 'Un autre monde', out: 'Sortir de ce monde', bans: (n: number) => `${n} ${n > 1 ? 'interdits' : 'interdit'}`, arrival: 'Arrivée · 2030', wake: 'Tu te réveilles ici', price: 'Prix :', sejour: 'Carte de séjour', stamp: 'Arrivée', year: '2030', done: '4 sur 4', played: 'Joué', no: 'N°', who: 'Qui décide', gain: 'Ce que tu y gagnes', cost: 'Ce que ça coûte', ask: 'La question ouverte', enter: 'Entrer', story: 'Ton histoire', card: 'Ce monde en bref' },
  en: { prefix: 'You can no longer ', banLabel: 'You can no longer:', banAria: 'What you can no longer do', situation: 'Situation ', count: (n: number) => `${n} of 4`, end: 'End', after: 'WHAT HAPPENED', choice: 'Your choice', ticket: 'What you can no longer do', next: 'What now?', replay: 'Play again', other: 'Another world', out: 'Leave this world', bans: (n: number) => `${n} ${n > 1 ? 'things lost' : 'thing lost'}`, arrival: 'Arrival · 2030', wake: 'You wake up here', price: 'Price:', sejour: 'Residence card', stamp: 'Arrival', year: '2030', done: '4 of 4', played: 'Played', no: 'No.', who: 'Who decides', gain: 'What you gain', cost: 'What it costs', ask: 'The open question', enter: 'Enter', story: 'Your story', card: 'This world in brief' },
} as const;

export async function mountSituations(root: HTMLElement, search = '', options: SituationOptions = {}): Promise<() => void> {
  const doc = root.ownerDocument; const win = doc.defaultView;
  const words = WORDS[options.lang === 'en' ? 'en' : 'fr']; await setSituationLang(options.lang ?? 'fr');
  // « Un autre monde » liste les mondes par leur nom (Utopie libertarienne, 1984…), pas par le titre de leur histoire [demande Cynthia 2026-11-14].
  const names: Record<string, string> = options.lang === 'en' ? enStrings : frStrings;
  const nameOfWorld = (id: string): string => names[`world.${id}.name`] ?? situationsData[id]!.titre;
  const sound = createWeekSound(win);
  const host = doc.createElement('main'); host.className = 'sp'; root.replaceChildren(host);
  let disposed = false; let state: PlayState = start('w10'); let pending: { id: number; timer: ReturnType<typeof setTimeout> } | null = null; let seq = 0; let popOpen = false; let intro = false; let view: JourneyView | null = null; let piece: Piece | null = null; const timers: ReturnType<typeof setTimeout>[] = [];
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const node = doc.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; };

  const bar = make('header', 'sp-bar'); const worldName = make('strong', 'sp-world'); const story = make('span', 'sp-story');
  const duo = make('span', 'sp-duo'); duo.setAttribute('aria-hidden', 'true'); duo.append(make('i'), make('i'));
  const legend = make('div', 'sp-legend'); legend.append(duo, worldName, story);
  const count = make('span', 'sp-count');
  const banCount = make('button', 'sp-ban-count'); banCount.type = 'button'; banCount.hidden = true; banCount.setAttribute('aria-expanded', 'false');
  const right = make('div', 'sp-bar-right'); right.append(banCount, count); bar.append(legend, right);
  const ban = make('div', 'sp-ban'); ban.hidden = true; ban.setAttribute('aria-label', words.banAria);
  const pop = make('ul', 'sp-ban-pop'); pop.hidden = true;
  const stage = make('div', 'sp-stage'); const frame = make('div', 'sp-frame'); stage.append(frame);
  const text = make('section', 'sp-text'); text.setAttribute('aria-live', 'polite');
  const plateau = make('div', 'sp-plateau');
  host.append(bar, ban, stage, text, plateau, pop);

  const unlock = (): void => sound.unlock();
  host.addEventListener('pointerdown', unlock);

  const paintWaiting = (): boolean => view === null || frame.querySelector('[data-image-state=loading]') !== null;
  const currentSituation = (): Situation => situationsData[state.world]!.situations[state.step]!;

  /** Loads a world: new view, new state. */
  const keep = (): void => { if (options.saveKey) try { win?.localStorage.setItem(options.saveKey, JSON.stringify({ world: state.world, picks: state.picks })); } catch { /* sans stockage : la partie repart du début */ } };
  const kept = (): { world: string; picks: Choice[] } | null => {
    if (!options.saveKey) return null;
    try { const read = JSON.parse(win?.localStorage.getItem(options.saveKey) ?? 'null') as { world?: unknown; picks?: unknown } | null; return read && typeof read.world === 'string' && situationsData[read.world] && Array.isArray(read.picks) && read.picks.length <= 4 && read.picks.every(pick => pick === 'a' || pick === 'b') ? { world: read.world, picks: read.picks as Choice[] } : null; } catch { return null; }
  };
  const load = async (id: string, picks: readonly Choice[] = [], arrival = true): Promise<void> => {
    const data = situationsData[id]; if (!data) return;
    cancelTransition(); view?.dispose(); view = null; frame.replaceChildren(); state = picks.reduce(choose, start(id)); keep(); intro = arrival && picks.length === 0 && worldIntro(id, options.lang ?? 'fr') !== null;
    host.dataset['world'] = id; host.dataset['busy'] = 'true';
    if (options.world === undefined) try { win?.history?.replaceState(null, '', `?atelier=situations&monde=${id}${options.lang === 'en' ? '&lang=en' : ''}`); } catch { /* sans historique : l'URL reste */ }
    const journey = journeys[id as keyof typeof journeys] ?? { id: 'w10' as const, title: data.titre, locations: data.situations.map(s => ({ id: s.lieu, name: s.lieu })) };
    render();
    const created = await createIllustratedJourneyView(frame, journey as Parameters<typeof createIllustratedJourneyView>[1]);
    if (disposed || state.world !== id) { created.dispose(); return; }
    view = created; view.show(data.situations[state.step]!.lieu, []);
    render();
  };

  const clearTimers = (): void => { for (const timer of timers.splice(0)) clearTimeout(timer); };
  const cancelTransition = (): void => { if (pending) clearTimeout(pending.timer); pending = null; };

  /** Zooms the picture on the player's body (see situationFrame.ts); called on every screen and whenever the picture's window changes size. */
  const fit = (): void => {
    const width = stage.clientWidth; const height = stage.clientHeight; if (!width || !height) return;
    const place = (illustrationData as unknown as Record<string, Record<string, { actorSpots?: [number, number][]; actorHeights?: number[] }>>)[state.world]?.[currentSituation().lieu];
    const box = playerFrame(width, height, place?.actorSpots?.[0] ?? [0.6, 0.8], place?.actorHeights?.[0] ?? 0.36);
    Object.assign(frame.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` }); frame.dataset['zoom'] = box.zoom.toFixed(2);
  };
  const fitObserver = new ResizeObserver(fit); fitObserver.observe(stage);

  /** The banner of the interdits (desktop) and its counter (phone): one more tag per choice. */
  function renderBan(data: typeof situationsData[string], fresh: boolean): void {
    const list = forbidden(data, state.picks); const shown = hasInterdits(data);
    const over = state.phase === 'end'; ban.hidden = !shown || list.length === 0 || over; ban.replaceChildren(); pop.replaceChildren();
    if (!shown) { banCount.hidden = true; return; }
    if (list.length) ban.append(make('span', 'sp-ban-label', words.banLabel));
    list.forEach((item, index) => { const chip = make('span', 'sp-chip', (item.startsWith(words.prefix) ? item.slice(words.prefix.length) : item).split(/ ?: /)[0]!); chip.title = item; if (fresh && index === list.length - 1) chip.dataset['new'] = '1'; ban.append(chip); pop.append(make('li', '', item)); });
    banCount.hidden = list.length === 0 || over; banCount.textContent = words.bans(list.length);
    popOpen = false; pop.hidden = true; banCount.setAttribute('aria-expanded', 'false');
  }

  /** Rebuilds the text band and the plateau for the current state. The image is not rebuilt. */
  function render(fresh = false): void {
    clearTimers(); piece?.closeReading(); piece = null;
    const data = situationsData[state.world]!; const ended = state.phase === 'end';
    if (fresh) host.dataset['fresh'] = '1'; else delete host.dataset['fresh'];
    host.dataset['phase'] = intro ? 'intro' : state.phase; host.dataset['situation'] = String(state.step + 1); host.dataset['busy'] = String(paintWaiting()); delete host.dataset['transition'];
    worldName.textContent = nameOfWorld(state.world); story.textContent = intro ? '' : data.titre; if (intro || ended) count.textContent = intro ? words.arrival : words.end; else count.replaceChildren(make('span', 'sp-count-pre', words.situation), words.count(state.step + 1));
    renderBan(data, fresh); fit();
    text.replaceChildren(); plateau.replaceChildren();
    if (intro) { renderIntro(data.titre); return; }
    if (ended) { renderEnd(data.titre); return; }
    const situation = currentSituation(); const before = previousSuite(state);
    if (before) text.append(make('p', 'sp-suite', before));
    text.append(make('p', 'sp-rule', situation.regle), make('p', 'sp-situation', situation.situation));
    // The piece is the star of the screen: large, complete, readable without opening it.
    const made = createPiece(doc, pieceSpec(situation.piece), { full: true }); piece = made; made.el.tabIndex = -1;
    plateau.append(made.el);
    // Two large targets: the choice in clear, the price in amber under it.
    const targets = make('nav', 'sp-targets'); targets.setAttribute('aria-label', words.choice);
    for (const key of ['a', 'b'] as const) {
      const option = situation[key]; const button = make('button', 'sp-target'); button.type = 'button'; button.dataset['choice'] = key;
      const price = make('small', 'sp-price'); price.append(make('span', 'sp-price-label', words.price), ` ${option.contrepartie}`);
      button.append(make('strong', 'sp-choice', option.choix), price);
      button.setAttribute('aria-label', `${option.choix}. ${words.price} ${option.contrepartie}`);
      button.disabled = paintWaiting(); button.addEventListener('click', event => { event.stopPropagation(); pickChoice(key); });
      targets.append(button);
    }
    plateau.append(targets);
  }

  /** The arrival card, before the first situation: how this future works (under the picture), then who decides, what it gives, what it takes, the open question, and one way in. Shown once per arrival; « Rejouer » skips it. */
  function renderIntro(title: string): void {
    const card = worldIntro(state.world, options.lang ?? 'fr')!; const name = nameOfWorld(state.world);
    text.append(make('h1', 'sp-intro-title', name), make('p', 'sp-situation', card.monde));
    const sejour = make('article', 'sp-sejour'); sejour.setAttribute('aria-label', `${words.sejour} : ${name}`);
    const bands = make('div', 'sp-bandes'); bands.setAttribute('aria-hidden', 'true'); bands.append(make('i'), make('i'));
    const head = make('header', 'sp-sejour-head'); const etiq = make('span', 'sp-etiq', words.sejour); etiq.append(make('span', 'sp-wake', ` · ${words.wake}`));
    head.append(etiq, make('h2', 'sp-sejour-nom', name), make('span', 'sp-no', words.year));
    const stamp = make('span', 'tampon sp-arrivee-tampon', words.stamp); stamp.setAttribute('aria-hidden', 'true'); stamp.append(make('small', '', words.year));
    const sheet = make('dl', 'sp-intro'); sheet.dataset['ui'] = 'world-intro'; sheet.setAttribute('aria-label', words.card);
    for (const [kind, label, value] of [['who', words.who, card.decide], ['gain', words.gain, card.gagne], ['cost', words.cost, card.cout], ['ask', words.ask, card.question]] as const) {
      const row = make('div', 'sp-intro-row'); row.dataset['kind'] = kind; row.append(make('dt', '', label), make('dd', '', value)); sheet.append(row);
    }
    const enter = make('button', 'sp-enter'); enter.type = 'button'; enter.dataset['action'] = 'enter';
    enter.append(make('strong', '', words.enter));
    enter.addEventListener('click', event => { event.stopPropagation(); enterWorld(); });
    const foot = make('footer', 'sp-sejour-foot'); foot.append(make('p', 'sp-enter-note', `${words.story} : ${title}`), enter);
    sejour.append(bands, head, stamp, sheet, foot); plateau.append(sejour);
  }
  /** Leaves the arrival card for the first situation. */
  function enterWorld(): void { if (disposed || !intro) return; sound.pose(); intro = false; render(); }

  /** Moves on to what the state already says (the next situation, or the end). Safe to call twice: only the current transition counts. */
  function finishTransition(id: number): void {
    if (disposed || !pending || pending.id !== id) return;
    clearTimeout(pending.timer); pending = null;
    if (state.phase !== 'end') view?.show(currentSituation().lieu, []);
    render(true);
  }

  /** The player's choice. The state moves on at once; the screen follows after the mark has printed on the piece (0.4 s at most). A press during that time passes it. */
  function pickChoice(key: Choice): void {
    if (disposed) return;
    if (pending) { finishTransition(pending.id); return; }
    if (intro || state.phase !== 'choose' || paintWaiting()) return;
    sound.pose(); const situation = currentSituation(); const marking = piece;
    state = choose(state, key); keep();
    host.dataset['transition'] = '1';
    // Not `disabled` (a disabled button swallows the press that passes on): the targets are marked and ignored.
    for (const button of plateau.querySelectorAll<HTMLButtonElement>('.sp-target')) { button.dataset['state'] = button.dataset['choice'] === key ? 'chosen' : 'gone'; button.tabIndex = -1; button.setAttribute('aria-disabled', 'true'); }
    const id = ++seq; pending = { id, timer: setTimeout(() => finishTransition(id), 400) };
    const printing = marking?.mark(situation[key].choix) ?? null;
    if (printing) void printing.then(() => finishTransition(id)); else finishTransition(id);
  }

  function renderEnd(title: string): void {
    const world = situationsData[state.world]!; const list = forbidden(world, state.picks);
    const bare = (text: string): string => text.startsWith(words.prefix) ? text.charAt(words.prefix.length).toUpperCase() + text.slice(words.prefix.length + 1) : text;
    const tail = previousSuite(state);
    const lines: TicketLine[] = [
      ...(list.length ? [{ stamp: words.prefix.trim(), sub: words.bans(list.length) }, ...list.map(item => ({ ban: bare(item) })), { heading: words.after }] : []),
      ...(tail ? [tail] : []), { heading: words.end }, ...(ending(state) ?? []),
    ];
    const ticket = createTicket(doc, { title: list.length ? words.ticket : title, lines, head: { left: nameOfWorld(state.world), right: `${words.year} · ${words.done}` } });
    const end = make('div', 'sp-end'); end.dataset['ui'] = 'situation-end'; end.append(ticket.el);
    const actions = make('nav', 'sp-actions'); actions.setAttribute('aria-label', words.next);
    const replay = make('button', 'sp-action', words.replay); replay.type = 'button'; replay.dataset['action'] = 'replay'; replay.addEventListener('click', () => { void load(state.world, [], false); });
    const other = make('button', 'sp-action', words.other); other.type = 'button'; other.dataset['action'] = 'worlds';
    const worlds = make('ul', 'sp-worlds'); worlds.hidden = true; worlds.dataset['ui'] = 'world-list';
    worldIds().forEach(id => {
      const item = make('li'); const go = make('button', 'sp-world-link'); go.type = 'button'; go.dataset['world'] = id; go.setAttribute('aria-label', nameOfWorld(id));
      const picture = make('span', 'sp-vign-img'); const image = doc.createElement('img'); image.src = `${import.meta.env.BASE_URL}illustrated/thumbs/${id}.jpg`; image.alt = ''; image.loading = 'lazy'; image.width = 560; image.height = 315; picture.append(image);
      const bands = make('span', 'sp-vign-duo'); bands.setAttribute('aria-hidden', 'true'); bands.append(make('i'), make('i'));
      const caption = make('span', 'sp-vign-leg'); caption.append(make('span', 'sp-vign-nom', nameOfWorld(id)));
      if (id === state.world) { go.dataset['played'] = '1'; picture.append(make('span', 'sp-vign-joue', words.played)); }
      go.append(picture, bands, caption); go.addEventListener('click', () => { void load(id); }); item.append(go); worlds.append(item);
    });
    other.addEventListener('click', () => { worlds.hidden = !worlds.hidden; other.setAttribute('aria-expanded', String(!worlds.hidden)); });
    actions.append(other, replay);
    const buttons = make('div', 'sp-buttons'); buttons.append(actions); end.append(buttons, worlds);
    const links = options.endLinks?.(state.world) ?? [];
    const out = make('nav', 'sp-out'); out.setAttribute('aria-label', words.out); out.append(...links); out.hidden = true;
    if (links.length) buttons.append(out);
    plateau.append(end);
    // Lines are printed one after the other; the actions wait for the last one.
    actions.hidden = true;
    void ticket.print(() => sound.line()).then(() => { if (!disposed) { actions.hidden = false; out.hidden = false; } });
    end.addEventListener('click', event => { if (!(event.target as HTMLElement).closest('button')) { ticket.skip(); actions.hidden = false; out.hidden = false; } });
  }

  const setPop = (open: boolean): void => { popOpen = open; pop.hidden = !open; banCount.setAttribute('aria-expanded', String(open)); };
  banCount.addEventListener('click', event => { event.stopPropagation(); setPop(!popOpen); });
  host.addEventListener('click', event => {
    if (popOpen && !(event.target as HTMLElement).closest('.sp-ban-pop,.sp-ban-count')) setPop(false);
    else if (pending && !(event.target as HTMLElement).closest('.sp-bar')) finishTransition(pending.id);
  });

  const onKey = (event: KeyboardEvent): void => {
    if (disposed || event.ctrlKey || event.metaKey || event.altKey) return;
    sound.unlock();
    if (event.key === 'Escape' && popOpen) { setPop(false); return; }
    if (pending) { if (['1', '2', 'Enter', ' '].includes(event.key)) { event.preventDefault(); finishTransition(pending.id); } return; }
    if (intro) { if (['1', 'Enter', ' '].includes(event.key) && !(event.target as HTMLElement | null)?.closest?.('button')) { event.preventDefault(); enterWorld(); } return; }
    if (state.phase !== 'choose') return;
    if (event.key === '1') pickChoice('a');
    else if (event.key === '2') pickChoice('b');
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const buttons = [...plateau.querySelectorAll<HTMLButtonElement>('.sp-target')]; if (!buttons.length) return;
      event.preventDefault(); const at = buttons.indexOf(doc.activeElement as HTMLButtonElement);
      buttons[at < 0 ? (event.key === 'ArrowLeft' ? 1 : 0) : (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]!.focus();
    }
  };
  doc.addEventListener('keydown', onKey);
  // The picture says when it is painted: the targets are not live before that.
  const watch = new MutationObserver(() => { const waiting = paintWaiting(); host.dataset['busy'] = String(waiting); if (state.phase === 'choose' && !pending) for (const button of plateau.querySelectorAll<HTMLButtonElement>('.sp-target')) button.disabled = waiting; });
  watch.observe(frame, { subtree: true, attributes: true, attributeFilter: ['data-image-state'] });

  const wanted = options.world ?? new URLSearchParams(search).get('monde') ?? 'w10';
  const saved = kept();
  if (saved) await load(saved.world, saved.picks); else await load(situationsData[wanted] ? wanted : 'w10');
  host.dataset['ready'] = '1';
  return (): void => { disposed = true; sound.setEnabled(false); cancelTransition(); clearTimers(); watch.disconnect(); fitObserver.disconnect(); doc.removeEventListener('keydown', onKey); view?.dispose(); host.remove(); };
}
