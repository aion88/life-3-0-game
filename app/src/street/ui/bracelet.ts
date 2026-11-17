/**
 * Bracelet et Œil [spec C §3.2, §4, §6 ; GD 3a, 3f ; I-5, I-9, I-10] : le seul chiffre vivant de l'écran.
 * L'Œil n'a qu'une apparence, quel que soit le compte (aucune classe ni attribut ne dépend de la valeur). La fête (pièces, obturateur, confettis)
 * ne part qu'après `reactToConfirm` d'une option qui coûte des mots, et seulement quand le nombre baisse ensuite ; sinon le nombre descend à plat.
 * Le lecteur d'écran reçoit la valeur FINALE, écrite une seule fois ; pièces et confettis vivent dans une couche `aria-hidden` à part.
 */
import type { I18n } from '../../i18n/i18n';
import type { UiEvents } from '../../ui/events';
import { motionFor } from '../../ui/motion';
import type { Animator } from '../../ui/motion';
import { createEye } from '../../ui/components/c';
import { loadUi } from '../../data/ui/load';
import { make, onLang } from './dom';
import type { Part } from './dom';
import { coinSteps, confettiLayout, juiceFor } from './juice';
import type { JuicePlan } from './juice';

export interface Bracelet extends Part {
  setBracelet(n: number): void;
  /** Une option est confirmée : la prochaine baisse du nombre jouera ce plan (un refus ou un prix nul : à plat). */
  reactToConfirm(o: { readonly isRefusal: boolean; readonly words: number }): void;
}

export interface BraceletDeps { readonly events: UiEvents; readonly animator: Animator; readonly reduced: boolean }

export function mountBracelet(root: HTMLElement, i18n: I18n, deps: BraceletDeps): Bracelet {
  const doc = root.ownerDocument;
  const { theme, timing } = loadUi();
  const { events, animator, reduced } = deps;
  const el = make(doc, 'output', { 'data-ui': 'bracelet', class: 'c-bracelet' });
  const eye = createEye({ pupil: true, sizePx: theme.street.eyePx.v });
  const value = make(doc, 'span', { 'data-ui': 'bracelet-value', class: 'c-bracelet__value', 'aria-hidden': 'true' });
  const unit = make(doc, 'span', { 'data-ui': 'bracelet-unit', class: 'c-bracelet__unit', 'aria-hidden': 'true' });
  const announce = make(doc, 'span', { 'data-ui': 'bracelet-announce', class: 'c-visually-hidden' });
  el.append(eye.el, value, unit, announce);
  const fx = make(doc, 'div', { 'data-ui': 'fx', class: 'c-fx', 'aria-hidden': 'true' });
  root.append(el, fx);

  let shown: number | null = null;       // valeur visible
  let announced: number | null = null;   // valeur écrite pour le lecteur d'écran
  let plan: JuicePlan | null = null;
  let busy = 0;
  let chain: Promise<void> = Promise.resolve();
  let disposed = false;

  const writeUnit = (): void => { unit.textContent = i18n.t('street.ui.words.unit'); };
  const writeAnnounce = (): void => { if (announced !== null) announce.textContent = i18n.tPlural('street.ui.words.price', announced, { n: announced }); };
  const showValue = (n: number): void => { shown = n; value.textContent = String(n); };
  const announceOnce = (n: number): void => { announced = n; writeAnnounce(); };
  writeUnit();
  const off = onLang(i18n, () => { writeUnit(); writeAnnounce(); });

  const centerOf = (e: Element): { x: number; y: number } => {
    const r = e.getBoundingClientRect(); const o = root.getBoundingClientRect();
    return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
  };
  const place = (e: HTMLElement, c: { x: number; y: number }, size: number): void => {
    e.style.left = `${c.x - size / 2}px`; e.style.top = `${c.y - size / 2}px`; e.style.width = `${size}px`; e.style.height = `${size}px`;
  };

  async function celebrate(from: number, to: number, p: JuicePlan): Promise<void> {
    const coins = Math.min(p.coins, from - to);
    const steps = coinSteps(from, to, coins);
    const target = centerOf(eye.el);
    const origin = root.querySelector('[data-ui="confirm"]');
    const start = origin !== null ? centerOf(origin) : { x: target.x - theme.street.eyePx.v * 2, y: target.y + theme.street.eyePx.v * 2 };
    const coinPx = theme.street.coinPx.v;
    const flights = steps.map((step, i) => {
      const coin = make(doc, 'span', { class: 'c-coin' });
      place(coin, start, coinPx);
      fx.appendChild(coin);
      const spec = motionFor('coin', reduced, timing, { dx: target.x - start.x, dy: target.y - start.y, index: i });
      return (spec === null ? Promise.resolve() : animator.play(coin, spec)).then(() => {
        coin.remove();
        if (disposed) return;
        showValue(step);
        events.emit('bracelet.coin'); events.emit('oeil.shutter');
        if (p.shutter) void eye.shutter(animator, reduced);   // l'obturateur ne retient pas la pièce suivante
      });
    });
    await Promise.all(flights);
    if (disposed) return;
    showValue(to);
    events.emit('bracelet.settle');
    const settle = motionFor('braceletSettle', reduced, timing);
    if (settle !== null) await animator.play(value, settle);
    if (disposed) return;
    announceOnce(to);
    if (p.confetti) await confetti(target);
  }

  async function confetti(from: { x: number; y: number }): Promise<void> {
    events.emit('regime.confetti');
    const size = timing.motion.confetti.v.params['piecePx'] ?? 0;
    const plays = confettiLayout(timing.juice.confettiPieces.v).map((c) => {
      const piece = make(doc, 'span', { class: 'c-confetti' });
      piece.style.background = `var(--c-${c.token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`;
      place(piece, from, size);
      fx.appendChild(piece);
      const spec = motionFor('confetti', reduced, timing, { dx: c.dx, dy: c.dy, rotDeg: c.rotDeg });
      return (spec === null ? Promise.resolve() : animator.play(piece, spec)).then(() => { piece.remove(); });
    });
    await Promise.all(plays);
  }

  function apply(n: number, p: JuicePlan | null): Promise<void> | void {
    const from = shown;
    if (p === null || p.coins <= 0 || from === null || n >= from) { showValue(n); if (announced !== n) announceOnce(n); return; }
    return celebrate(from, n, p);
  }

  return {
    reactToConfirm(o) {
      const mine = juiceFor(o, reduced, timing.juice.maxCoins.v);
      plan = mine;
      queueMicrotask(() => { if (plan === mine) plan = null; });   // le plan ne survit pas au tour de la confirmation : jamais de jus sur une baisse ultérieure (parole)
    },
    setBracelet(n) {
      const p = plan; plan = null;   // le plan ne sert qu'à la baisse qui suit la confirmation
      if (busy === 0) { const r = apply(n, p); if (r === undefined) return; busy++; chain = r.finally(() => { busy--; }); return; }
      busy++; chain = chain.then(() => apply(n, p)).finally(() => { busy--; });
    },
    dispose() { disposed = true; off(); el.remove(); fx.remove(); },
  };
}
