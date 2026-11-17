/**
 * Ligne d'objectif du jour [design/gdd/2026-11-03-playtest-enjeu-onboarding.md §1 A, §3 A] : `w10.goal.<jour>`, tirée du jalon (bible w10 §8.1)
 * et du rendez-vous fixe (§8.2). Elle reste à l'écran, en tête de Z-gauche, dans le cadre utile et jamais collée à un bord.
 */
import type { I18n } from '../../i18n/i18n';
import type { DayIndex } from '../../shared/types/street';
import { objectiveKey } from '../onboarding';
import { make, onLang } from './dom';
import './onboarding.css';
import type { Part } from './dom';

export interface ObjectiveView extends Part { showObjective(day: DayIndex | null): void }

export function mountObjective(root: HTMLElement, i18n: I18n): ObjectiveView {
  const doc = root.ownerDocument;
  let el: HTMLElement | null = null; let day: DayIndex | null = null;
  const render = (): void => {
    el?.remove(); el = null;
    if (day === null) return;
    el = make(doc, 'p', { 'data-ui': 'objective', class: 'c-card c-card--secondary c-sober c-objective' });
    el.appendChild(make(doc, 'strong', { class: 'c-objective-label' }, i18n.t('street.ui.objective.label')));
    el.appendChild(make(doc, 'span', { class: 'c-window' }, i18n.t(objectiveKey(day))));
    root.prepend(el);
  };
  const off = onLang(i18n, render);
  return { showObjective(d) { if (d === day) return; day = d; render(); }, dispose() { off(); el?.remove(); el = null; } };
}
