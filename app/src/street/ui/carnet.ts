/**
 * Carnet : les droits rencontrés, dans l'ordre, libellés par `w10.right.<id>` [R-L6]. Vide : rien à l'écran.
 * Jamais coupé net [design/ui/2026-11-02-zones-ecran-ux.md §4] : il montre autant de droits ENTIERS que sa zone en contient, puis « + N »,
 * un bouton qui déplie la liste complète en défilement interne ; Échap ou un clic hors de sa zone referme et rend le focus au bouton.
 * Replié (fiche ouverte, ou mode petit) : une ligne « Droits (N) » qui se déplie à la demande en recouvrant sa zone seule [§3, Z-4].
 */
import type { I18n } from '../../i18n/i18n';
import type { RightId } from '../../shared/types/street';
import { make, onLang } from './dom';
import type { Part } from './dom';

export interface CarnetView extends Part {
  showCarnet(rights: readonly RightId[]): void;
  /** Range le carnet dans sa zone : replié ou non, puis lignes entières seulement. Appelé après chaque mise en page des zones. */
  arrange(folded: boolean): void;
}

type State = 'full' | 'folded' | 'open';

export function mountCarnet(root: HTMLElement, i18n: I18n): CarnetView {
  const doc = root.ownerDocument;
  let el: HTMLElement | null = null; let list: HTMLUListElement | null = null;
  let fold: HTMLButtonElement | null = null; let more: HTMLButtonElement | null = null;
  let rights: readonly RightId[] = [];
  let folded = false; let state: State = 'full'; let from: 'fold' | 'more' = 'more'; let cut = 0;   // droits non affichés au dernier rangement en lignes entières

  const items = (): HTMLLIElement[] => (list === null ? [] : [...list.querySelectorAll<HTMLLIElement>(':scope > li')]);
  /** Lignes entières : on retire la dernière tant que la liste déborde de sa boîte (le « + N » prend sa place sous elle). */
  const fit = (): void => {
    if (el === null || list === null || more === null || fold === null) return;
    const had = doc.activeElement === more ? more : doc.activeElement === fold ? fold : null;   // le remesurage masque un instant les boutons : le focus ne doit pas s'y perdre
    delete el.dataset['room'];
    layout();
    // priorité la plus basse [§3] : s'il ne reste même pas la place de sa ligne repliée ou de « + N », le carnet n'est pas affiché (il revient dès que la place revient)
    // `scrollHeight` ne compte pas le remplissage du bas : une ligne repliée serrée par la colonne mordait sur lui (21 px du bord au lieu de 24) sans que rien ne le voie ; on ajoute donc le remplissage au bas du dernier enfant visible
    const card = el;
    const bottomNeed = (): number => {
      const box = card.getBoundingClientRect(); const pad = parseFloat(doc.defaultView?.getComputedStyle(card).paddingBottom ?? '') || 0;
      const low = Math.max(0, ...[...card.children].filter((c) => !(c as HTMLElement).hidden).map((c) => c.getBoundingClientRect().bottom));
      return low === 0 ? 0 : low - box.top - card.clientTop + pad;
    };
    if (state !== 'open' && (el.scrollHeight > el.clientHeight + 0.5 || bottomNeed() > el.clientHeight + 0.5)) el.dataset['room'] = 'none';
    if (had !== null && !had.hidden && doc.activeElement !== had) had.focus();
  };
  const layout = (): void => {
    if (el === null || list === null || more === null || fold === null) return;
    const all = items();
    el.dataset['state'] = state;
    if (state === 'open') el.dataset['from'] = from; else delete el.dataset['from'];
    fold.hidden = state !== 'folded' && !(state === 'open' && from === 'fold');
    fold.textContent = fold.hidden ? '' : i18n.t('street.ui.carnet.folded', { n: all.length });
    fold.setAttribute('aria-expanded', String(state === 'open'));
    list.hidden = state === 'folded';
    for (const li of all) li.hidden = false;
    more.hidden = true; more.textContent = '';
    more.setAttribute('aria-expanded', String(state === 'open' && from === 'more'));
    if (state === 'folded') return;
    if (state === 'open') { if (from === 'more') { more.hidden = false; more.textContent = i18n.t('street.ui.carnet.more', { n: cut }); } return; }
    const overflows = (): boolean => list!.scrollHeight > list!.clientHeight + 0.5;
    cut = 0;
    if (!overflows()) return;
    more.hidden = false;
    let shown = all.length;
    const label = (): void => { more!.textContent = i18n.t('street.ui.carnet.more', { n: all.length - shown }); };
    label();
    while (shown > 0 && overflows()) { shown -= 1; all[shown]!.hidden = true; label(); }
    cut = all.length - shown;
  };

  const close = (): void => {
    if (state !== 'open') return;
    const back = from === 'fold' ? fold : more;
    state = folded ? 'folded' : 'full'; fit();
    back?.focus();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || state !== 'open') return;
    e.stopImmediatePropagation(); e.preventDefault(); close();           // Échap referme le carnet seul, pas la fiche ni la réplique
  };
  const onDown = (e: Event): void => {
    if (state !== 'open' || el === null) return;
    const zone = el.parentElement ?? el;
    if (e.target instanceof Node && !zone.contains(e.target)) close();
  };
  const keyHost: EventTarget = doc.defaultView ?? doc;   // capture sur la fenêtre : le carnet déplié est la couche du dessus, avant la fiche (capture du document)
  keyHost.addEventListener('keydown', onKey as EventListener, true);
  doc.addEventListener('pointerdown', onDown, true);

  const render = (): void => {
    el?.remove(); el = null; list = null; fold = null; more = null;
    if (rights.length === 0) return;
    el = make(doc, 'div', { 'data-ui': 'carnet', class: 'c-card c-card--secondary c-sober', 'data-state': state });
    fold = el.appendChild(make(doc, 'button', { type: 'button', 'data-ui': 'carnet-fold', 'aria-expanded': 'false', hidden: '' }));
    list = el.appendChild(make(doc, 'ul', { class: 'c-carnet__list' }));   // la liste défile, pas la carte : le remplissage de la carte reste autour du texte
    for (const r of rights) list.appendChild(make(doc, 'li', { 'data-right': r }, i18n.t(`w10.right.${r}`)));
    more = el.appendChild(make(doc, 'button', { type: 'button', 'data-ui': 'carnet-more', 'aria-expanded': 'false', hidden: '' }));
    fold.addEventListener('click', () => { if (state === 'open') close(); else { state = 'open'; from = 'fold'; fit(); } });
    more.addEventListener('click', () => { if (state === 'open') close(); else { state = 'open'; from = 'more'; fit(); } });
    root.appendChild(el);
    fit();
  };
  const off = onLang(i18n, render);
  return {
    showCarnet(r) { rights = [...r]; render(); },
    arrange(f) {
      folded = f;
      if (state !== 'open') state = f ? 'folded' : 'full';
      else if (from === 'more' && f) state = 'folded';                     // une fiche s'ouvre pendant le dépli : le carnet se replie
      else if (from === 'fold' && !f) state = 'full';                      // le repli n'a plus de raison d'être : la liste revient en lignes entières
      fit();
    },
    dispose() { off(); keyHost.removeEventListener('keydown', onKey as EventListener, true); doc.removeEventListener('pointerdown', onDown, true); el?.remove(); el = null; },
  };
}
