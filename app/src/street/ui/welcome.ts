/**
 * Accueil du Service de courtoisie [design/gdd/2026-11-03-playtest-enjeu-onboarding.md §1 A ; direction C « Merci ! »].
 * Une ligne à la fois ; l'objet de la ligne s'allume (`data-lit`) dans la rangée du kit, et le vrai bracelet ou le vrai carnet
 * s'allument aussi (`data-welcome-lit` sur la racine). Le téléphone vibre à l'appel. « Suivant » avance, « Passer » ferme tout d'un clic.
 * Aucun mot écrit ici : tout texte vient d'une clé. Ni minuterie ni hasard : on avance au geste.
 */
import type { I18n } from '../../i18n/i18n';
import type { WelcomeLine } from '../onboarding';
import { createActionButton } from '../../ui/components/c';
import { make, onLang } from './dom';
import './onboarding.css';
import type { Part } from './dom';

export interface WelcomeContent {
  readonly lines: readonly WelcomeLine[];
  /** Objets de la rangée, dans l'ordre d'affichage ; clé de libellé `w10.welcome.kit.<id>`. */
  readonly kit: readonly string[];
  /** Le téléphone vibre pendant la première ligne. */
  readonly vibrate: boolean;
}
export interface WelcomeView extends Part {
  showWelcome(c: WelcomeContent, done: () => void): void;
  /** Ferme sans appeler `done` (la partie a déjà avancé, par exemple). */
  close(): void;
  isOpen(): boolean;
}

/** Allume l'objet `lit` du kit (le vrai bracelet, le vrai carnet : `data-welcome-lit` sur la racine) ; `null` l'éteint. La rue guidée s'en sert pour ses lignes. */
export function lightKit(root: HTMLElement, lit: string | null): void {
  if (lit === null) delete root.dataset['welcomeLit']; else root.dataset['welcomeLit'] = lit;
}

/** Rangée du kit seule, sans la boîte de dialogue de l'accueil : la rue guidée la pose au-dessus de la réplique tant qu'une ligne allume un objet. */
export interface KitRow extends Part {
  /** Montre la rangée `kit`, l'objet `lit` allumé (`vibrate` : il vibre, le téléphone de la première ligne) ; `lit` absent du kit ou `null` : aucune rangée. */
  show(kit: readonly string[], lit: string | null, vibrate?: boolean): void;
}

/**
 * Monte la rangée du kit dans `zone` (Z-centre), en tête : mêmes puces et mêmes styles que l'accueil (`onboarding.css`, `[data-ui="welcome-kit"]`).
 * Le bureau 3D ne porte aucun objet du kit : sans elle, l'accueil guidé ne montrait ni le téléphone ni le composant [retour Cynthia 2026-11-08 (c)].
 */
export function mountKitRow(zone: HTMLElement, i18n: I18n): KitRow {
  const doc = zone.ownerDocument;
  let el: HTMLElement | null = null;
  let state: { kit: readonly string[]; lit: string; vibrate: boolean } | null = null;
  const render = (): void => {
    el?.remove(); el = null;
    if (state === null) return;
    el = make(doc, 'ul', { 'data-ui': 'welcome-kit', class: 'c-welcome-kit', 'aria-label': i18n.t('street.ui.welcome.label') });
    for (const id of state.kit) {
      const chip = el.appendChild(make(doc, 'li', { 'data-kit': id, class: 'c-pill c-pill--creme c-welcome-chip' }, i18n.t(`w10.welcome.kit.${id}`)));
      if (id === state.lit) { chip.dataset['lit'] = 'true'; if (state.vibrate) chip.dataset['vibrate'] = 'true'; }
    }
    zone.prepend(el);
  };
  const off = onLang(i18n, render);
  return {
    show(kit, lit, vibrate = false) { state = lit !== null && kit.includes(lit) ? { kit, lit, vibrate } : null; render(); },
    dispose() { off(); state = null; render(); },
  };
}

export function mountWelcome(host: HTMLElement, root: HTMLElement, i18n: I18n): WelcomeView {
  const doc = host.ownerDocument;
  let el: HTMLElement | null = null;
  let content: WelcomeContent | null = null; let at = 0; let onDone: (() => void) | null = null;
  const close = (): void => { el?.remove(); el = null; content = null; onDone = null; lightKit(root, null); };
  const finish = (): void => { const cb = onDone; close(); cb?.(); };
  const render = (): void => {
    el?.remove(); el = null;
    if (content === null) return;
    const line = content.lines[at]!;
    el = make(doc, 'section', { 'data-ui': 'welcome', role: 'dialog', 'aria-label': i18n.t('street.ui.welcome.label'), class: 'c-welcome' });
    const kit = el.appendChild(make(doc, 'ul', { 'data-ui': 'welcome-kit', class: 'c-welcome-kit' }));
    for (const id of content.kit) {
      const chip = kit.appendChild(make(doc, 'li', { 'data-kit': id, class: 'c-pill c-pill--creme c-welcome-chip' }, i18n.t(`w10.welcome.kit.${id}`)));
      if (line.lit === id) chip.dataset['lit'] = 'true';
      if (content.vibrate && at === 0 && id === 'phone') chip.dataset['vibrate'] = 'true';
    }
    el.appendChild(make(doc, 'p', {
      'data-ui': 'welcome-line', 'data-voice': line.voice, 'aria-live': 'polite',
      class: line.voice === 'narrator' ? 'c-card c-card--secondary c-card--ink' : 'c-card c-card--secondary',
    }, i18n.t(line.key)));
    const actions = el.appendChild(make(doc, 'div', { class: 'c-welcome-actions' }));
    const last = at === content.lines.length - 1;
    const next = actions.appendChild(createActionButton(i18n.t(last ? 'street.ui.continue' : 'street.ui.welcome.next')));
    next.dataset['ui'] = 'welcome-next';
    next.addEventListener('click', () => { if (content === null) return; if (at >= content.lines.length - 1) finish(); else { at++; render(); } });
    if (content.lines.length > 1) {
      const skip = actions.appendChild(make(doc, 'button', { type: 'button', 'data-ui': 'welcome-skip', class: 'c-pill c-pill--creme c-welcome-skip' }, i18n.t('street.ui.welcome.skip')));
      skip.addEventListener('click', finish);
    }
    lightKit(root, line.lit);
    host.appendChild(el);
  };
  const off = onLang(i18n, render);
  return {
    showWelcome(c, done) { if (c.lines.length === 0) { done(); return; } content = c; at = 0; onDone = done; render(); },
    close,
    isOpen: () => content !== null,
    dispose() { off(); close(); },
  };
}
