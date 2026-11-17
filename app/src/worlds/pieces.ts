/**
 * Graphic pieces of a scene, on the plateau: a phone screen, a sheet of paper, an object card.
 *
 * Pure presentation. A piece shows what the scene already says (`presentation.prop`, the speaker, the incident, the title):
 * it invents no text and decides nothing. Touching it opens a larger reading over the picture (`openReading`),
 * touching the reading closes it. After a choice, `mark` puts the choice on the piece (stamp, sent reply, flipped card).
 */

import './pieces.css';

/** The four props a scene can present (`none` shows no piece). */
export type PieceProp = 'phone' | 'document' | 'tool' | 'object' | 'card' | 'ticket';

/** What a piece displays, all of it taken from the scene. */
export interface PieceSpec {
  prop: PieceProp;
  /** Who it comes from (the scene's speaker). */
  sender: string;
  /** The scene's title (the card's name). */
  title: string;
  /** The scene's incident (the message, the typed text, the card's line). */
  text: string;
  /** `card`: the rows of the pass (label, value); `title` is its heading. */
  fields?: readonly (readonly [string, string])[];
  /** `ticket`: the printed lines, the first one being the heading. */
  lines?: readonly string[];
}

/** A piece on the plateau. */
export interface Piece {
  /** The touchable piece. */
  readonly el: HTMLButtonElement;
  /** Opens the large reading over `host`; touching it again, or Escape, closes it. */
  openReading(host: HTMLElement): void;
  /** Closes the reading if open. */
  closeReading(): void;
  /** Puts the player's choice on the piece. Returns a promise that resolves once the gesture has been seen, or `null` when there is nothing to wait for (no animation support): the caller then goes on synchronously. */
  mark(label: string): Promise<void> | null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
type Glyph = 'wheel' | 'wrench' | 'box';

/** Which drawing a card carries: a wheel for the wheel and the trailer, a box for a plain object, a hammer otherwise. */
export function glyphFor(spec: PieceSpec): Glyph {
  if (spec.prop === 'object') return 'box';
  return /roue|remorque/i.test(`${spec.title} ${spec.text}`) ? 'wheel' : 'wrench';
}

/** Cuts a text at a word boundary with an ellipsis, in the text itself (CSS clipping would hide it from the layout checks). */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max); const space = head.lastIndexOf(' ');
  return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[\s,;:.]+$/, '')}…`;
}

const kindOf = (prop: PieceProp): 'phone' | 'doc' | 'card' | 'pass' | 'ticket' => prop === 'phone' ? 'phone' : prop === 'document' ? 'doc' : prop === 'card' ? 'pass' : prop === 'ticket' ? 'ticket' : 'card';

/** Builds the drawing of a card as an inline SVG (stroke only: the card's ink colour does the rest). */
function glyphSvg(doc: Document, glyph: Glyph): SVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg'); svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'pc-glyph');
  const add = (tag: string, attrs: Record<string, string>): void => { const node = doc.createElementNS(SVG_NS, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); svg.append(node); };
  if (glyph === 'wheel') {
    add('circle', { cx: '32', cy: '32', r: '24' }); add('circle', { cx: '32', cy: '32', r: '5' });
    for (const [x, y] of [[32, 8], [32, 56], [8, 32], [56, 32], [15, 15], [49, 49], [15, 49], [49, 15]] as const) add('line', { x1: '32', y1: '32', x2: String(x), y2: String(y) });
  } else if (glyph === 'wrench') {
    add('line', { x1: '14', y1: '52', x2: '38', y2: '28' }); add('rect', { x: '30', y: '10', width: '26', height: '14', transform: 'rotate(45 43 17)' });
  } else {
    add('polygon', { points: '32,8 56,20 56,46 32,58 8,46 8,20' }); add('polyline', { points: '8,20 32,32 56,20' }); add('line', { x1: '32', y1: '32', x2: '32', y2: '58' });
  }
  return svg;
}

/** The body of a piece, compact on the plateau or full in the reading. */
function body(doc: Document, spec: PieceSpec, full: boolean): HTMLElement {
  const make = (tag: string, cls: string, text = ''): HTMLElement => { const node = doc.createElement(tag); node.className = cls; node.textContent = text; return node; };
  const text = full ? spec.text : cutText(spec.text, 38);
  if (spec.prop === 'phone') {
    const phone = make('div', 'piece-phone'); const top = make('div', 'pp-top'); top.append(make('span', 'pp-who', spec.sender));
    const bubble = make('div', 'pp-bubble', text); phone.append(top, bubble, make('div', 'pp-reply')); return phone;
  }
  if (spec.prop === 'document') {
    const sheet = make('div', 'piece-doc'); sheet.append(make('div', 'pd-head', spec.sender), make('p', 'pd-text', text), make('div', 'pd-stamp')); return sheet;
  }
  if (spec.prop === 'card') {
    const pass = make('div', 'piece-id'); pass.append(make('div', 'pi-head', spec.title));
    for (const [label, value] of spec.fields ?? []) { const row = make('div', 'pi-row'); row.append(make('span', 'pi-label', label), make('span', 'pi-value', value)); pass.append(row); }
    return pass;
  }
  if (spec.prop === 'ticket') {
    const strip = make('div', 'piece-ticket'); (spec.lines ?? []).forEach((line, index) => strip.append(make('p', index === 0 ? 'pt-line pt-head' : 'pt-line', line))); return strip;
  }
  const card = make('div', 'piece-card'); const name = make('b', 'pc-name', full ? spec.title : cutText(spec.title, 30));
  card.append(glyphSvg(doc, glyphFor(spec)), name, make('small', 'pc-line', text)); return card;
}

/** Builds one piece for a scene. */
export function createPiece(doc: Document, spec: PieceSpec, hooks: { onTouch?: () => void; full?: boolean } = {}): Piece {
  const el = doc.createElement('button'); el.type = 'button';
  el.className = `piece${spec.prop === 'tool' ? ' metal' : ''}`; el.dataset['ui'] = 'objet'; el.dataset['prop'] = spec.prop; el.dataset['kind'] = kindOf(spec.prop);
  el.setAttribute('aria-expanded', 'false');
  el.setAttribute('aria-label', `${spec.prop === 'phone' ? 'Message de' : spec.prop === 'document' ? 'Papier de' : spec.prop === 'card' ? 'Carte' : spec.prop === 'ticket' ? 'Ticket' : 'Objet de'} ${spec.prop === 'card' ? spec.title : spec.prop === 'ticket' ? (spec.lines ?? []).join(', ') : `${spec.sender} : ${spec.text}`}. Toucher pour lire.`);
  if (hooks.full) el.dataset['full'] = '1';
  el.append(body(doc, spec, Boolean(hooks.full)));
  let reading: HTMLElement | null = null; let onKey: ((event: KeyboardEvent) => void) | null = null;
  const closeReading = (): void => {
    if (!reading) return;
    reading.remove(); reading = null; el.setAttribute('aria-expanded', 'false');
    if (onKey) doc.removeEventListener('keydown', onKey); onKey = null;
  };
  const openReading = (host: HTMLElement): void => {
    if (reading) { closeReading(); return; }
    const sheet = doc.createElement('div'); sheet.className = `piece-reading${spec.prop === 'tool' ? ' metal' : ''}`; sheet.dataset['prop'] = spec.prop; sheet.dataset['kind'] = kindOf(spec.prop);
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Lecture'); sheet.tabIndex = -1;
    sheet.append(body(doc, spec, true)); const hint = doc.createElement('small'); hint.className = 'pr-hint'; hint.textContent = 'Touche pour fermer'; sheet.append(hint);
    sheet.addEventListener('click', () => { closeReading(); el.focus({ preventScroll: true }); });
    onKey = event => { if (event.key === 'Escape') { closeReading(); el.focus({ preventScroll: true }); } };
    doc.addEventListener('keydown', onKey); host.append(sheet); reading = sheet; el.setAttribute('aria-expanded', 'true'); hooks.onTouch?.();
  };
  const mark = (label: string): Promise<void> | null => {
    closeReading();
    // Nothing to wait for when the piece cannot be seen (no layout) or the browser cannot animate.
    const canMove = typeof el.animate === 'function' && el.getBoundingClientRect().width > 0;
    const reduced = Boolean(doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const hold = (ms: number): Promise<void> | null => canMove ? new Promise(resolve => setTimeout(resolve, ms)) : null;
    const shown = cutText(label, 30);
    el.dataset['marked'] = '1';
    if (spec.prop === 'phone') {
      const reply = el.querySelector<HTMLElement>('.pp-reply'); if (reply) reply.textContent = shown;
      if (reply && canMove && !reduced) reply.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, fill: 'both' });
      return hold(reduced ? 300 : 620);
    }
    if (spec.prop === 'document') {
      const zone = el.querySelector<HTMLElement>('.pd-stamp'); const stamp = doc.createElement('span'); stamp.className = 'pd-mark'; stamp.textContent = shown; zone?.append(stamp);
      if (canMove && !reduced) stamp.animate([{ opacity: 0, transform: 'scale(1.8) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1) rotate(-6deg)' }], { duration: 220, easing: 'ease-in', fill: 'both' });
      return hold(reduced ? 300 : 620);
    }
    if (spec.prop === 'ticket') {
      const strip = el.querySelector<HTMLElement>('.piece-ticket'); const line = doc.createElement('p'); line.className = 'pt-line pt-mark'; line.textContent = `› ${shown}`; strip?.append(line);
      if (canMove && !reduced) line.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, fill: 'both' });
      return hold(reduced ? 300 : 620);
    }
    const card = el.querySelector<HTMLElement>('.piece-card, .piece-id'); const turn = (): void => { if (!card) return; card.dataset['back'] = '1'; card.replaceChildren(); const back = doc.createElement('b'); back.className = 'pc-name'; back.textContent = shown; card.append(back); };
    if (canMove && !reduced) {
      const half = el.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: 160, fill: 'forwards' });
      return half.finished.then(() => { turn(); el.animate([{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0deg)' }], { duration: 160, fill: 'forwards' }); return hold(560) ?? undefined; });
    }
    turn(); return hold(300);
  };
  return { el, openReading, closeReading, mark };
}

/** One line of a printed ticket: plain text, a label with a value on the right (`total` underlines the sum), an intertitle, a line of what the player can no longer do, or the stamp. */
export type TicketLine = string | { label: string; value: string; total?: boolean } | { heading: string } | { ban: string } | { stamp: string; sub?: string };

/** A printed ticket: lines are laid down one after the other. */
export interface Ticket {
  readonly el: HTMLElement;
  /** Prints the lines one by one (`onLine` fires for each, for the sound). Resolves when the last one is down, or at once when nothing can be seen or `skip()` is called. */
  print(onLine?: () => void): Promise<void>;
  /** Puts every remaining line down now. */
  skip(): void;
  /** Adds one line after the last (already printed), with the same gesture. */
  add(line: TicketLine, onLine?: () => void): void;
}

/** The node of one ticket line. Intertitles are `h4`, the stamp a `div`, every other line a `p` (or a label / value `div`). */
function lineNode(doc: Document, line: TicketLine): HTMLElement {
  const text = (tag: string, cls: string, value: string): HTMLElement => { const node = doc.createElement(tag); if (cls) node.className = cls; node.textContent = value; return node; };
  if (typeof line === 'string') return text('p', '', line);
  if ('heading' in line) return text('h4', 'tp-heading', line.heading);
  if ('ban' in line) return text('p', 'tp-ban', line.ban);
  if ('stamp' in line) {
    const holder = doc.createElement('div'); holder.className = 'tp-stamp'; const stamp = text('span', 'tampon sur-papier', line.stamp); stamp.setAttribute('aria-hidden', 'true');
    if (line.sub) stamp.append(text('small', '', line.sub)); holder.append(stamp); return holder;
  }
  const node = doc.createElement('div'); node.className = `tp-line${line.total ? ' tp-total' : ''}`;
  node.append(text('span', '', line.label), text('span', '', line.value)); return node;
}

/** Builds a paper ticket (title, lines, optional foot, optional header line). Nothing is shown until `print()` is called. */
export function createTicket(doc: Document, spec: { title: string; lines: readonly TicketLine[]; foot?: string; head?: { left: string; right: string } }): Ticket {
  const el = doc.createElement('div'); el.className = 'ticket-print'; el.dataset['ui'] = 'ticket';
  if (spec.head) { const head = doc.createElement('div'); head.className = 'tp-head'; const left = doc.createElement('b'); left.textContent = spec.head.left; const right = doc.createElement('span'); right.textContent = spec.head.right; head.append(left, right); el.append(head); }
  const heading = doc.createElement('h3'); heading.textContent = spec.title; el.append(heading);
  const nodes: HTMLElement[] = spec.lines.map(line => { const node = lineNode(doc, line); node.hidden = true; el.append(node); return node; });
  if (spec.foot) { const foot = doc.createElement('p'); foot.className = 'tp-foot'; foot.textContent = spec.foot; foot.hidden = true; nodes.push(foot); el.append(foot); }
  let timer: ReturnType<typeof setTimeout> | null = null; let finish: (() => void) | null = null; let next = 0;
  const lay = (node: HTMLElement, animate: boolean, onLine?: () => void): void => { node.hidden = false; if (animate) node.classList.add('tp-new'); onLine?.(); };
  const skip = (): void => {
    if (timer) clearTimeout(timer); timer = null;
    for (; next < nodes.length; next++) nodes[next]!.hidden = false;
    finish?.(); finish = null;
  };
  const print = (onLine?: () => void): Promise<void> => {
    const visible = el.getBoundingClientRect().width > 0 && typeof el.animate === 'function';
    if (!visible) { for (const node of nodes) lay(node, false, onLine); next = nodes.length; return Promise.resolve(); }
    return new Promise(resolve => {
      finish = resolve;
      const step = (): void => { const node = nodes[next]; if (!node) { finish = null; resolve(); return; } next++; lay(node, true, onLine); timer = setTimeout(step, 240); };
      step();
    });
  };
  const add = (line: TicketLine, onLine?: () => void): void => {
    const node = lineNode(doc, line);
    el.append(node); nodes.push(node); next = nodes.length; lay(node, true, onLine);
  };
  return { el, print, skip, add };
}
