/** Avis système : pas de carte graphique (`GraphicsUnavailable`, la sauvegarde ne bouge pas) et sauvegarde en mémoire seulement. */
import type { I18n } from '../../i18n/i18n';
import { createNotice } from '../../ui/components/c';
import { onLang } from './dom';
import type { Part } from './dom';

export interface Notices extends Part { showNoGpu(): void; showNotSaved(): void }

export function mountNotices(root: HTMLElement, i18n: I18n): Notices {
  const slots: { el: HTMLElement; key: string }[] = [];
  const add = (attrs: Record<string, string>, key: string): void => {
    if (slots.some((s) => s.key === key)) return;
    const el = createNotice(i18n.t(key));
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);   // data-ui et rôle propres à l'avis ; le rôle remplace « status »
    root.appendChild(el); slots.push({ el, key });
  };
  const off = onLang(i18n, () => { for (const s of slots) s.el.textContent = i18n.t(s.key); });
  return {
    showNoGpu() { add({ 'data-ui': 'nogpu', role: 'alertdialog' }, 'street.ui.noGpu'); },
    showNotSaved() { add({ 'data-ui': 'notSaved', role: 'status' }, 'street.ui.notSaved'); },
    dispose() { off(); for (const s of slots) s.el.remove(); slots.length = 0; },
  };
}
