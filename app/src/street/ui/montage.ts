/**
 * Carte de montage, rue guidée [plan semaine condensée, T3, décision 5] : le jour résumé tient en une carte de TEXTE SEUL, au centre.
 * Titre (date du jour), puis au plus 4 lignes : lignes S1 du jour, posture, fait réel (fait et source courte dans un seul bloc) si cette carte
 * en porte un, ligne de fin (message du bracelet de la nuit, ou arrestation dans la nuit). Les boutons sont ceux de la barre d'avance
 * (« Continuer ») et du panneau d'options de Z-droite : la carte n'en porte aucun. Aucun texte en dur : tout passe par `i18n.t`.
 */
import type { I18n } from '../../i18n/i18n';
import type { PalierId } from '../../data/schema/world';
import type { DayIndex } from '../../shared/types/street';
import { make, onLang, type Part } from './dom';
import './montage.css';

/** Fin de la carte : le message du bracelet (palier du relevé de la nuit), ou la nuit qui arrête la partie. */
export type MontageTail = { readonly kind: 'palier'; readonly palier: PalierId } | { readonly kind: 'arrested'; readonly key: string; readonly day: DayIndex };

/** Ce que la carte montre. `tail` est nul tant que la nuit n'a pas eu lieu (temps `montage` et choix de carte). */
export interface MontageView {
  readonly day: DayIndex;
  /** Lignes S1 du jour, déjà résolues en clés. */
  readonly lineKeys: readonly string[];
  readonly postureKey: string;
  /** Fait réel placé sur cette carte et sa source courte ; `null` sur une carte sans fait. */
  readonly fact: { readonly key: string; readonly sourceKey: string } | null;
  readonly tail: MontageTail | null;
}

/** Clé de texte de la ligne de fin ; `{jour}` de l'arrestation = la date du jour de la nuit (comme au bilan, `dateKey`). */
export const tailKeyOf = (t: MontageTail): string => (t.kind === 'palier' ? `w10.msg.${t.palier}` : t.key);

export interface MontageHandle extends Part {
  /** Montre (ou met à jour) la carte ; `null` la retire. */
  showMontage(v: MontageView | null): void;
}

/** Monte la carte sous `parent` (le centre de l'écran) ; rien n'est affiché avant `showMontage`. */
export function mountMontage(parent: HTMLElement, i18n: I18n): MontageHandle {
  const doc = parent.ownerDocument;
  let view: MontageView | null = null;
  let box: HTMLElement | null = null;
  const render = (): void => {
    box?.remove(); box = null;
    if (view === null) return;
    box = make(doc, 'section', { 'data-ui': 'montage', 'data-day': String(view.day), role: 'region', 'aria-label': i18n.t('street.ui.montage.label'), class: 'c-card c-card--secondary c-card--ink c-sober c-montage' });
    box.appendChild(make(doc, 'h2', { 'data-ui': 'montage-title', class: 'c-montage-title' }, i18n.t(`w10.day.${view.day}.date`)));
    for (const k of view.lineKeys) box.appendChild(make(doc, 'p', { 'data-ui': 'montage-line', class: 'c-montage-line' }, i18n.t(k)));
    box.appendChild(make(doc, 'p', { 'data-ui': 'montage-posture', class: 'c-montage-posture' }, i18n.t(view.postureKey)));
    if (view.fact !== null) {
      const fact = box.appendChild(make(doc, 'p', { 'data-ui': 'montage-fact', class: 'c-montage-fact' }, i18n.t(view.fact.key)));
      fact.appendChild(make(doc, 'span', { 'data-ui': 'montage-source', class: 'c-montage-source' }, ` ${i18n.t(view.fact.sourceKey)}`));
    }
    if (view.tail !== null) box.appendChild(make(doc, 'p', { 'data-ui': 'montage-tail', 'data-tail': view.tail.kind, 'aria-live': 'polite', class: 'c-montage-tail' }, i18n.t(tailKeyOf(view.tail), view.tail.kind === 'arrested' ? { jour: i18n.t(`w10.day.${view.tail.day}.date`) } : {})));
    parent.appendChild(box);
  };
  const off = onLang(i18n, render);
  return {
    showMontage(v) { view = v; render(); },
    dispose() { off(); box?.remove(); box = null; view = null; },
  };
}
