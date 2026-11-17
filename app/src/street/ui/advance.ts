/**
 * « Continuer » et avance rapide [rue guidée T10]. Le bouton dit la règle que la joueuse ne devinait pas : un texte qui attend se poursuit
 * par un clic, Espace ou Entrée. L'avance rapide (« Passer », « Avancer jusqu'à mon tour ») saute la file. Aucun texte en dur, tout vient de clés.
 */
import type { I18n } from '../../i18n/i18n';
import { make, onLang } from './dom';
import type { Part } from './dom';
import './guided.css';

export type SkipLabel = 'queue' | 'pass';
export interface Advance extends Part {
  /** La barre (« Continuer », avance rapide) : la réplique se pose au-dessus, jamais dessus [revue T14 #1]. */
  readonly bar: HTMLElement;
  showContinue(visible: boolean): void;
  showSkip(label: SkipLabel | null): void;
  onAdvance(cb: () => void): () => void;
  /** Le bouton d'avance rapide a été activé (clic ; Espace et Entrée le font nativement quand il a le focus). */
  onSkip(cb: () => void): () => void;
}

/** Une touche qui agit déjà par elle-même (bouton, champ) n'avance pas en plus : le clic natif s'en charge, une seule fois. */
const selfActing = (t: EventTarget | null): boolean => t instanceof HTMLElement && ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);

/** Dans un panneau de choix : Espace et Entrée y appartiennent au panneau, pas à Continuer. */
const inChoices = (t: EventTarget | null): boolean => t instanceof Element && t.closest('[data-ui="choices"], [data-ui="destinations"]') !== null;

export function mountAdvance(root: HTMLElement, i18n: I18n): Advance {
  const doc = root.ownerDocument;
  const bar = make(doc, 'div', { 'data-ui': 'advance', class: 'c-advance' });
  bar.hidden = true; root.appendChild(bar);
  let cont: HTMLButtonElement | null = null; let skip: HTMLButtonElement | null = null; let skipLabel: SkipLabel | null = null;
  const advance: (() => void)[] = []; const skips: (() => void)[] = [];
  const text = (l: SkipLabel): string => i18n.t(l === 'queue' ? 'street.ui.skipQueue' : 'street.ui.skip');
  const sync = (): void => { bar.hidden = cont === null && skip === null; };
  const render = (): void => { if (cont) cont.textContent = i18n.t('street.ui.continue'); if (skip && skipLabel) skip.textContent = text(skipLabel); };
  const off = onLang(i18n, render);
  const fire = (list: (() => void)[]): void => { for (const cb of [...list]) cb(); };
  const onKey = (e: KeyboardEvent): void => {
    if (cont === null || e.defaultPrevented || e.repeat || selfActing(e.target) || inChoices(e.target)) return;
    if (e.key !== ' ' && e.key !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault(); fire(advance);
  };
  doc.addEventListener('keydown', onKey);
  const sub = (list: (() => void)[], cb: () => void): (() => void) => { list.push(cb); return () => { const i = list.indexOf(cb); if (i >= 0) list.splice(i, 1); }; };
  return {
    bar,
    showContinue(visible) {
      if (!visible) { cont?.remove(); cont = null; sync(); return; }
      if (cont === null) {
        cont = make(doc, 'button', { type: 'button', 'data-ui': 'continue', class: 'c-advance__continue' });
        cont.addEventListener('click', () => { fire(advance); });
        bar.prepend(cont);
      }
      render(); sync();
    },
    showSkip(label) {
      skipLabel = label;
      if (label === null) { skip?.remove(); skip = null; sync(); return; }
      if (skip === null) {
        skip = make(doc, 'button', { type: 'button', 'data-ui': 'skip', class: 'c-advance__skip' });
        skip.addEventListener('click', () => { fire(skips); });
        bar.append(skip);
      }
      skip.dataset['kind'] = label; render(); sync();
    },
    onAdvance: (cb) => sub(advance, cb),
    onSkip: (cb) => sub(skips, cb),
    dispose() { off(); doc.removeEventListener('keydown', onKey); bar.remove(); },
  };
}
