/** Fiche d'un passant : le texte de `w10.card.<id>`, fermable par Échap ou par un clic [V8 : la fiche peut montrer un nombre]. Entrée `cardIn` [spec C §3.2]. */
import type { I18n } from '../../i18n/i18n';
import { loadUi } from '../../data/ui/load';
import type { UiEvents } from '../../ui/events';
import { motionFor } from '../../ui/motion';
import type { Animator } from '../../ui/motion';
import { make, onLang } from './dom';
import type { Part } from './dom';

export interface Card extends Part {
  showCard(cardId: string): void;
  /** Ferme la fiche ouverte, comme un clic (rien si aucune) : la ligne de prix passe avant elle en mode petit [zones UX §7.1, Z-10]. */
  close(): void;
}
export interface CardDeps { readonly events: UiEvents; readonly animator: Animator; readonly reduced: boolean }

export function mountCard(root: HTMLElement, i18n: I18n, deps: CardDeps): Card {
  const doc = root.ownerDocument; const { timing } = loadUi();
  let el: HTMLElement | null = null; let id: string | null = null;
  const close = (): void => {
    if (el === null) return;
    el.remove(); el = null; id = null; deps.events.emit('ui.card.close');
  };
  const render = (): void => { const p = el?.firstElementChild; if (p && id !== null) p.textContent = i18n.t(`w10.card.${id}`); };
  // un Échap, une couche : la fiche passe avant la réplique et le panneau d'options (capture), après le carnet déplié (capture de la fenêtre)
  const onKey = (e: KeyboardEvent): void => { if (e.key !== 'Escape' || el === null || e.defaultPrevented) return; e.preventDefault(); close(); };
  doc.addEventListener('keydown', onKey, true);
  const off = onLang(i18n, render);
  return {
    showCard(cardId) {
      if (el !== null) { el.remove(); el = null; id = null; }
      id = cardId;
      const card = make(doc, 'aside', { 'data-ui': 'card', role: 'dialog', class: 'c-card c-card--interactive c-card--document' });
      el = card;
      card.appendChild(make(doc, 'p'));
      card.addEventListener('click', close);
      root.appendChild(card); render();
      deps.events.emit('ui.card.open');
      const spec = motionFor('cardIn', deps.reduced, timing);
      if (spec !== null) void deps.animator.play(card, spec);
    },
    close,
    dispose() { doc.removeEventListener('keydown', onKey, true); off(); el?.remove(); el = null; id = null; },
  };
}
