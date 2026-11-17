/** Date du jour : pastille soleil en haut à gauche, `w10.day.N.date` [spec C §3.2 ; P-10 ouvert, défaut `always`]. */
import type { I18n } from '../../i18n/i18n';
import type { DayIndex } from '../../shared/types/street';
import { createPill } from '../../ui/components/c';
import { onLang } from './dom';
import type { Part } from './dom';

export interface DayDateView extends Part { showDayDate(day: DayIndex | null): void }

/** La date est-elle visible ? `always` : toujours ; `dawn` : jusqu'à la première action du jour (`actsToday` = actes du jour courant). */
export function dayDateShown(mode: 'always' | 'dawn', actsToday: number): boolean {
  return mode === 'always' || actsToday === 0;
}

export function mountDayDate(root: HTMLElement, i18n: I18n): DayDateView {
  let el: HTMLElement | null = null; let day: DayIndex | null = null;
  const render = (): void => {
    el?.remove(); el = null;
    if (day === null) return;
    el = createPill(i18n.t(`w10.day.${day}.date`), 'soleil');
    el.setAttribute('data-ui', 'day-date'); el.classList.add('c-day-date');
    root.appendChild(el);
  };
  const off = onLang(i18n, render);
  return { showDayDate(d) { if (d === day) return; day = d; render(); }, dispose() { off(); el?.remove(); el = null; } };
}
