// @vitest-environment happy-dom
/**
 * Relevé du soir de la semaine, rendu [plan rue guidée J3-J7, T5] : `{noms}` rempli (« personne », « A, B et C »), bouton du dernier jour.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { UiHandle } from '../../../src/street/ui';
import { createInstantAnimator } from '../../../src/ui/motion';
import { eveningRecap } from '../../../src/engine/moments/recap';
import type { Recap } from '../../../src/engine/moments/recap';
import { FR } from '../../support/street_ui';
import { ACTS_AUDITION, ACTS_NONE, ACTS_THREE_NAMES, FIXTURE_ENDING, FR_WEEK, ctxRecapWeek, stateWith, weekI18n } from '../../support/recap_week';

const q = (s: string): HTMLElement => document.body.querySelector(s) as HTMLElement;
let ui: UiHandle; let i18n = weekI18n('fr');
const recapAt = (day: 1 | 4 | 7, acts: Parameters<typeof stateWith>[1]): Recap => eveningRecap(stateWith(day, acts), ctxRecapWeek, {});
const render = (r: Recap): void => { ui.showEvening([], 'courtesy', r.day, r); };
beforeEach(() => { document.body.innerHTML = ''; i18n = weekI18n('fr'); ui = mountUi(document.body.appendChild(document.createElement('div')), i18n, { animator: createInstantAnimator(), reducedMotion: false }); });
afterEach(() => { ui.dispose(); });

describe('relevé de la semaine : rendu [J3-J7 T5]', () => {
  it('test_no_names_renders_personne', () => {
    render(recapAt(4, ACTS_NONE));
    expect(q('[data-ui="recap"] ol').textContent).toContain(FR['street.recap.names.none']!);
    expect(q('[data-ui="recap"] ol').textContent).not.toContain('{noms}');
  });
  it('test_names_joined_with_et', () => {
    render(recapAt(4, ACTS_THREE_NAMES));
    expect(q('[data-ui="recap"] ol').textContent).toMatch(/Théodore, .+ et .+/u);
    expect(q('[data-ui="recap"] ol').textContent).toContain(`Théodore, ${FR_WEEK['w10.dw.name.fille']!} ${FR['street.recap.names.and']!} Marlène`);
  });
  it('test_names_in_english', () => {
    i18n.setLang('en');
    render(recapAt(4, ACTS_THREE_NAMES));
    expect(q('[data-ui="recap"] ol').textContent).toContain('Theodore, the girl from the fourth floor and Marlene');
  });
  it('test_last_day_button_says_see_week', () => {
    render(recapAt(7, ACTS_AUDITION));
    expect(q('[data-ui="recap"] button').textContent).toBe(FR_WEEK[FIXTURE_ENDING.weekButtonKey]);
  });
  it('test_last_day_button_fires_week_callback', () => {
    let n = 0; ui.onWeek(() => { n += 1; });
    render(recapAt(7, ACTS_AUDITION));
    q('[data-ui="recap"] button').click();
    expect(n).toBe(1);
  });
  it('test_no_button_before_last_day', () => {
    render(recapAt(4, ACTS_THREE_NAMES));
    expect(document.body.querySelector('[data-ui="recap"] button')).toBeNull();
  });
});
