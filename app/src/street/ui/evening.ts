/**
 * Relevé du soir : une ligne par axe, dite par sa clé, jamais pré-traduite [V13], puis le message du bracelet (`w10.msg.<palier>`).
 * Les quatre messages ont le même traitement : même classe, même mouvement (`message`), même événement (`regime.message`) [GD 2.3].
 * L'autocollant part de l'Œil (origine de la transformation) ; aucun confetti au relevé [spec C §3.3].
 */
import type { I18n } from '../../i18n/i18n';
import type { EveningLine } from '../../engine/moments/evening';
import type { Recap } from '../../engine/moments/recap';
import type { PalierId } from '../../data/schema/world';
import type { DayIndex } from '../../shared/types/street';
import { loadUi } from '../../data/ui/load';
import type { UiEvents } from '../../ui/events';
import { motionFor } from '../../ui/motion';
import type { Animator } from '../../ui/motion';
import { make, onLang } from './dom';
import { renderRecap } from './recap';
import './onboarding.css';
import type { Part } from './dom';

/** Ce que reçoit le point d'accroche du soir : la scène ouverte, à compléter (la barre Dossier s'y consolide). */
export interface EveningOpened { readonly day: DayIndex | null; readonly lines: readonly EveningLine[]; readonly palier: PalierId | null; readonly scene: HTMLElement }
export interface EveningView extends Part {
  /** `day` donné : le relevé devient une scène (titre, lignes, message, ligne du narrateur `w10.evening.scene.<palier>`). `recap` donné (rue guidée) : le relevé précis remplace titre et lignes par axe [décision 4] ; sans lui, le soir de la rue libre reste tel quel. */
  showEvening(lines: readonly EveningLine[], palier?: PalierId | null, day?: DayIndex | null, recap?: Recap | null): void;
  /** Appelé à chaque ouverture du relevé (jamais au simple changement de langue) ; rend le désabonnement. */
  onEvening(cb: (e: EveningOpened) => void): () => void;
  /** Le bouton du relevé du dernier jour (`recap.weekButtonKey`) a été activé : la semaine passe à sa fin. */
  onWeek(cb: () => void): () => void;
}
export interface EveningDeps { readonly events: UiEvents; readonly animator: Animator; readonly reduced: boolean }

export function mountEvening(root: HTMLElement, i18n: I18n, deps: EveningDeps): EveningView {
  const doc = root.ownerDocument; const { timing } = loadUi();
  let scene: HTMLElement | null = null; let msg: HTMLElement | null = null;
  let lines: readonly EveningLine[] = []; let palier: PalierId | null = null; let day: DayIndex | null = null; let recap: Recap | null = null;
  const subs = new Set<(e: EveningOpened) => void>(); const weekSubs = new Set<() => void>();
  const clear = (): void => { scene?.remove(); scene = null; msg?.remove(); msg = null; };
  /** Centre de l'Œil du bracelet, en coordonnées de l'autocollant : l'origine de la transformation. */
  const originFrom = (target: HTMLElement): string => {
    const eye = root.querySelector('[data-ui="bracelet"] .c-eye');
    if (eye === null) return '100% 0';
    const e = eye.getBoundingClientRect(); const t = target.getBoundingClientRect();
    return `${e.left + e.width / 2 - t.left}px ${e.top + e.height / 2 - t.top}px`;
  };
  const render = (animate: boolean): void => {
    clear();
    if (lines.length === 0 && recap === null) return;
    scene = make(doc, 'section', { 'data-ui': 'evening-scene', class: 'c-evening-scene' });
    if (recap !== null) scene.appendChild(renderRecap(doc, i18n, recap, () => { for (const cb of [...weekSubs]) cb(); }));
    else {
      if (day !== null) scene.appendChild(make(doc, 'h2', { 'data-ui': 'evening-title', class: 'c-pill c-pill--encre c-evening-title' }, i18n.t('w10.evening.scene.title')));
      const el = scene.appendChild(make(doc, 'ul', { 'data-ui': 'evening', class: 'c-card c-card--secondary c-card--ink c-sober' }));
      for (const l of lines) el.appendChild(make(doc, 'li', { 'data-axis': l.axis }, i18n.t(l.key)));
    }
    if (day !== null && palier !== null) scene.appendChild(make(doc, 'p', { 'data-ui': 'evening-narration', class: 'c-card c-card--secondary c-card--ink c-sober' }, i18n.t(`w10.evening.scene.${palier}`)));
    root.appendChild(scene);
    if (palier !== null) {
      const m = make(doc, 'p', { 'data-ui': 'evening-message', 'data-palier': palier, 'aria-live': 'polite', class: 'c-sticker' }, i18n.t(`w10.msg.${palier}`));
      root.appendChild(m); msg = m;
      if (animate) {
        m.style.transformOrigin = originFrom(m);
        deps.events.emit('regime.message');
        const spec = motionFor('message', deps.reduced, timing);
        if (spec !== null) void deps.animator.play(m, spec);
      }
    }
    if (animate) for (const cb of [...subs]) cb({ day, lines, palier, scene });
  };
  const off = onLang(i18n, () => { render(false); });
  return {
    showEvening(l, p = null, d = null, r = null) { lines = [...l]; palier = p; day = d; recap = r; render(true); },
    onEvening(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
    onWeek(cb) { weekSubs.add(cb); return () => { weekSubs.delete(cb); }; },
    dispose() { off(); subs.clear(); weekSubs.clear(); clear(); },
  };
}
