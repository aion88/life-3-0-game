/** Narration : une ligne de la rue, dite par sa clé [plan 02a T11]. Aucun mot du monde n'est écrit ici. */
import type { I18n } from '../../i18n/i18n';
import { make, onLang } from './dom';
import type { Part } from './dom';

export type Params = Readonly<Record<string, string | number>>;
export interface Narrator extends Part { setNarration(key: string, params?: Params): void; clearNarration(): void }

export function mountNarrator(root: HTMLElement, i18n: I18n): Narrator {
  const el = make(root.ownerDocument, 'p', { 'data-ui': 'narration', 'aria-live': 'polite', class: 'c-card c-card--secondary c-card--ink' });
  const text = el.appendChild(make(root.ownerDocument, 'span', { class: 'c-window' }));   // la fenêtre qui défile en lignes entières, le remplissage reste au cadre [zones UX §7.2]
  root.appendChild(el);
  let current: { key: string; params: Params | undefined } | null = null;
  const render = (): void => { text.textContent = current === null ? '' : i18n.t(current.key, current.params); el.toggleAttribute('data-empty', current === null); };   // vide : aucune pastille d'encre sans texte
  const off = onLang(i18n, render);
  render();
  return {
    setNarration(key, params) { current = { key, params }; render(); },
    clearNarration() { current = null; render(); },
    dispose() { off(); el.remove(); },
  };
}
