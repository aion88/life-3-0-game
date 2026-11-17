/** Rappel des commandes : `street.ui.controls`, affiché ou retiré. */
import type { I18n } from '../../i18n/i18n';
import { make, onLang } from './dom';
import type { Part } from './dom';

export interface Controls extends Part { showControls(visible: boolean): void; /** Séquence jouée : la ligne « un clic passe la scène » reste à l'écran tant que la séquence joue. */ showSkipHint(visible: boolean): void }

export function mountControls(root: HTMLElement, i18n: I18n): Controls {
  const doc = root.ownerDocument; let el: HTMLElement | null = null; let hint: HTMLElement | null = null;
  const render = (): void => { if (el) el.textContent = i18n.t('street.ui.controls'); if (hint) hint.textContent = i18n.t('street.ui.sequence.skip'); };
  const off = onLang(i18n, render);
  const clear = (): void => { el?.remove(); el = null; };
  return {
    showControls(visible) {
      if (!visible) { clear(); return; }
      if (el === null) { el = make(doc, 'p', { 'data-ui': 'controls', class: 'c-card c-card--secondary c-card--ink c-sober c-controls' }); root.appendChild(el); }
      render();
    },
    showSkipHint(visible) {
      if (!visible) { hint?.remove(); hint = null; return; }
      if (hint === null) { hint = make(doc, 'p', { 'data-ui': 'sequence-skip', class: 'c-card c-card--secondary c-card--ink c-sober c-controls', 'aria-live': 'polite' }); root.appendChild(hint); }
      render();
    },
    dispose() { off(); clear(); hint?.remove(); hint = null; },
  };
}
