// @vitest-environment happy-dom
/**
 * UI-C T9 : voix sobre de la rue (ligne de droit, carnet, fiche, avis, date, rappel) et relevé du soir avec le message du bracelet.
 * D3 : le message du soir est le palier du relevé que la NUIT du jour courant donnera (`eveningPalier`, pur), pas celui de la veille.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { UiHandle } from '../../../src/street/ui';
import { dayDateShown } from '../../../src/street/ui/dayDate';
import { createInstantAnimator } from '../../../src/ui/motion';
import { loadUi } from '../../../src/data/ui/load';
import { eveningPalier, createStreet, reduceAct } from '../../../src/engine/moments/state';
import { isRejected, ctxW10, week0, SEVEN_DAYS_SLEEP_ONLY } from '../../support/street';
import type { StreetState } from '../../../src/engine/moments/types';
import type { WeekState } from '../../../src/engine/week';
import { FR, realI18n } from '../../support/street_ui';
import { eveningLines } from '../../../src/engine/moments/evening';
import { createStreetScreen } from '../../../src/street/screen';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';

const PALIERS = ['courtesy', 'thanks', 'patience', 'appointment'] as const;
const ctx = ctxW10();
const q = (s: string): HTMLElement | null => document.body.querySelector(s);

const deepFreeze = <T>(o: T): T => {
  if (typeof o === 'object' && o !== null && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

let ui: UiHandle;
let animator: ReturnType<typeof createInstantAnimator>;
const mount = (reducedMotion = false): UiHandle => {
  animator = createInstantAnimator();
  ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n('fr'), { animator, reducedMotion });
  return ui;
};
beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('D3 b : le palier du soir est celui de la nuit du jour courant', () => {
  it('test_evening_palier_equals_the_night_reading_palier', () => {
    let s: StreetState = createStreet(ctx); let w: WeekState = week0;
    const checked: number[] = [];
    for (const a of SEVEN_DAYS_SLEEP_ONLY) {
      const isNight = a.kind === 'sleep' || a.id === 'audition.j7';
      let before: ReturnType<typeof eveningPalier> | null = null;
      if (isNight) { deepFreeze(s); before = eveningPalier(s, ctx); }
      const r = reduceAct(s, w, a, ctx);
      if (isRejected(r)) throw new Error(`acte refusé (${r.reason}) : ${JSON.stringify(a)}`);
      s = r.state; w = r.week;
      if (isNight) { expect(before, `soir du jour ${a.day}`).toBe(s.readings[a.day - 1]!.palier); checked.push(a.day); }
    }
    expect(checked).toEqual([1, 2, 3, 4, 5, 6, 7]);   // le J7 s'affiche avant l'audition (soir à 1050, audition à 1100) : sa nuit est celle de `audition.j7`
  });
});

describe('relevé du soir', () => {
  it('test_evening_shows_the_reading_palier_message', () => {
    mount();
    ui.showEvening(eveningLines(1, [], ctx), 'thanks');
    const m = q('[data-ui="evening-message"]')!;
    expect(m.textContent).toBe(FR['w10.msg.thanks']);
    ui.showEvening([], null);
    expect(q('[data-ui="evening-message"]')).toBeNull();
    expect(q('[data-ui="evening"]')).toBeNull();
  });

  it('test_four_messages_same_treatment', () => {
    const seen = PALIERS.map((p) => {
      mount();
      ui.showEvening(eveningLines(1, [], ctx), p);
      const m = q('[data-ui="evening-message"]')!;
      const out = {
        text: m.textContent, cls: m.className, attrs: [...m.getAttributeNames()].sort(), tag: m.tagName,
        played: animator.played().filter((x) => x.el === m).map((x) => x.spec), events: ui.events.log().filter((e) => e.startsWith('regime.')),
      };
      ui.dispose(); document.body.innerHTML = '';
      return out;
    });
    expect(new Set(seen.map((s) => s.text)).size).toBe(4);
    for (const s of seen) {
      expect(s.text).toBe(FR[`w10.msg.${PALIERS[seen.indexOf(s)]}`]);
      expect(s.cls).toBe(seen[0]!.cls); expect(s.attrs).toEqual(seen[0]!.attrs); expect(s.tag).toBe(seen[0]!.tag);
      expect(s.played).toEqual(seen[0]!.played); expect(s.played).toHaveLength(1);
      expect(s.events).toEqual(['regime.message']);
    }
  });

  it('test_evening_has_no_confetti_and_no_axis_name', () => {
    mount();
    const lines = eveningLines(1, [], ctx);
    ui.showEvening(lines, 'courtesy');
    expect(ui.events.log()).not.toContain('regime.confetti');
    expect(q('.c-confetti')).toBeNull();
    const rows = [...document.body.querySelectorAll('[data-ui="evening"] li')];
    expect(rows).toHaveLength(lines.length);
    rows.forEach((li, i) => { expect(li.children).toHaveLength(0); expect(li.textContent).toBe(FR[lines[i]!.key]); });   // une phrase par ligne, aucun libellé d'axe [V13]
  });

  it('test_evening_message_is_polite_text', () => {
    mount();
    ui.showEvening(eveningLines(1, [], ctx), 'patience');
    const m = q('[data-ui="evening-message"]')!;
    expect(m.getAttribute('aria-live')).toBe('polite');
    expect(m.hasAttribute('aria-hidden')).toBe(false);
    expect(m.textContent).not.toBe('');
  });

  it('test_evening_message_leaves_the_eye_in_reduced_motion_as_a_fade', () => {
    mount(true);
    ui.showEvening(eveningLines(1, [], ctx), 'thanks');
    const spec = animator.played().find((x) => x.el === q('[data-ui="evening-message"]'))!.spec;
    expect(spec.keyframes.every((k) => Object.keys(k).every((p) => p === 'opacity'))).toBe(true);
  });

  it('test_evening_message_origin_is_the_eye', () => {
    // happy-dom ne met rien en page : on pose les boîtes de l'Œil et de l'autocollant, puis on compare à l'origine calculée à la main
    const rect = (left: number, top: number, width: number, height: number): DOMRect => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('c-eye')) return rect(1500, 20, 96, 96);
      if (this.dataset['ui'] === 'evening-message') return rect(1400, 200, 300, 80);
      return rect(0, 0, 0, 0);
    });
    try {
      mount();
      ui.showEvening(eveningLines(1, [], ctx), 'thanks');
      expect(q('[data-ui="evening-message"]')!.style.transformOrigin).toBe('148px -132px');   // centre de l'Œil (1548, 68) moins le coin de l'autocollant (1400, 200)
    } finally { spy.mockRestore(); }
  });
});

describe('voix sobre [I-6]', () => {
  it('test_right_line_and_carnet_are_sober', () => {
    mount();
    ui.showRightLine({ first: 'Ici,', second: 'En 2026, c\'est écrit.' }); ui.showCarnet(['move', 'speak']);
    for (const s of ['[data-ui="right-line"]', '[data-ui="carnet"]']) expect(q(s)!.classList.contains('c-sober'), s).toBe(true);
    expect(animator.played()).toHaveLength(0);
    expect(ui.events.log().filter((e) => e.startsWith('regime.'))).toEqual([]);
    expect(q('[data-ui="carnet"] [data-sticker], [data-ui="carnet"] .c-pill')).toBeNull();   // jamais d'autocollant
    const halves = [...document.body.querySelectorAll('[data-ui="right-line"] [data-half]')];
    expect(halves.map((h) => h.getAttribute('data-half'))).toEqual(['1', '2']);
    expect(halves[0]!.className).toContain('c-half--ink'); expect(halves[1]!.className).toContain('c-half--creme');   // moitié 1 encre/crème, moitié 2 crème/encre
  });

  it('test_system_notices_use_notice_component', () => {
    mount();
    ui.showNoGpu(); ui.showNotSaved();
    for (const s of ['[data-ui="nogpu"]', '[data-ui="notSaved"]']) expect(q(s)!.classList.contains('c-notice'), s).toBe(true);
  });

  it('test_controls_are_an_ink_pill_at_the_theme_size', () => {
    mount(); ui.showControls(true);
    const c = q('[data-ui="controls"]')!;
    expect(c.className).toContain('c-card--ink'); expect(c.className).toContain('c-sober'); expect(c.className).toContain('c-controls');
    const css = readFileSync('src/ui/c.css', 'utf8');
    expect(css).toMatch(/\.c-controls\s*\{[^}]*border-radius:\s*var\(--s-pill\)[^}]*font-size:\s*var\(--t-controls-size\)/);
    const px = loadUi().theme.type.controls.v.px;
    expect(px).toBe(20);
    expect(q('[data-ui="root"]')!.style.getPropertyValue('--t-controls-size')).toContain(`${px}px`);
  });
});

describe('fiche de passant', () => {
  it('test_card_closes_on_escape_and_click_with_events', () => {
    mount();
    ui.showCard('nadia');
    expect(q('[data-ui="card"]')).not.toBeNull();
    expect(ui.events.log().filter((e) => e === 'ui.card.open')).toHaveLength(1);
    expect(animator.played().some((x) => x.el === q('[data-ui="card"]'))).toBe(true);   // entrée `cardIn`
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(q('[data-ui="card"]')).toBeNull();
    expect(ui.events.log().filter((e) => e === 'ui.card.close')).toHaveLength(1);
    ui.showCard('nadia'); q('[data-ui="card"]')!.click();
    expect(q('[data-ui="card"]')).toBeNull();
    expect(ui.events.log().filter((e) => e === 'ui.card.close')).toHaveLength(2);
  });

  it('test_card_is_a_main_card_and_reads_the_theme_rotation', () => {
    mount(); ui.showCard('nadia');
    const c = q('[data-ui="card"]')!;
    expect(c.classList.contains('c-card')).toBe(true); expect(c.classList.contains('c-card--secondary')).toBe(false);
    expect(c.classList.contains('c-card--document')).toBe(true);
    const css = readFileSync('src/ui/c.css', 'utf8');
    expect(css).toMatch(/\.c-card--document\s*\{[^}]*rotate:\s*var\(--s-street-card-rotation-deg\)/);   // la feuille lit la variable
    const root = q('[data-ui="root"]')!;
    expect(root.style.getPropertyValue('--s-street-card-rotation-deg')).toBe(`${loadUi().theme.street.cardRotationDeg.v}deg`);   // et le thème la pose
  });
});

describe('date du jour [P-10]', () => {
  it('test_day_date_always_by_default', () => {
    expect(loadUi().theme.street.dayDate.v).toBe('always');
    expect(dayDateShown('always', 0)).toBe(true); expect(dayDateShown('always', 9)).toBe(true);
    mount(); ui.showDayDate(3);
    const d = q('[data-ui="day-date"]')!;
    expect(d.textContent).toBe(FR['w10.day.3.date']); expect(d.className).toContain('c-pill--soleil');
    ui.showDayDate(null);
    expect(q('[data-ui="day-date"]')).toBeNull();
  });

  it('test_day_date_dawn_mode_hides_after_first_act', () => {
    expect(dayDateShown('dawn', 0)).toBe(true);
    expect(dayDateShown('dawn', 1)).toBe(false);
  });
});

describe('runtime : le soir du J3 dit la nuit 3', () => {
  it('test_runtime_evening_j3_shows_night_3_palier', async () => {
    payloadCache('w10').clear();
    // la vérité : la semaine entière jouée par le moteur
    let s: StreetState = createStreet(ctx); let w: WeekState = week0;
    for (const a of SEVEN_DAYS_SLEEP_ONLY) { const r = reduceAct(s, w, a, ctx); if (isRejected(r)) throw new Error(r.reason); s = r.state; w = r.week; }
    const nights = s.readings.map((r) => r.palier);
    expect(nights[2], 'la fixture doit distinguer la nuit 3 de la nuit 2, sinon ce test ne discrimine plus').not.toBe(nights[1]);
    const acts = SEVEN_DAYS_SLEEP_ONLY.slice(0, SEVEN_DAYS_SLEEP_ONLY.findIndex((a) => a.day === 3 && a.kind === 'sleep'));   // J3 vécu, pas encore couché
    const host = document.body.appendChild(document.createElement('div'));
    const app = fakeApp(acts);
    const deps = testDeps({ sink: app.save });
    const screen = createStreetScreen(app.ctx, app.payload, deps);
    await screen.mount(host);
    const rt = screen.runtime() as unknown as { driver: { state(): { live: { clock: { minute: number } } } } };
    deps.frames.step(16);
    const evening = ctx.street.moments.eveningMinute;
    let n = 0;
    while (rt.driver.state().live.clock.minute < evening && n++ < 200_000) deps.frames.step(50);
    deps.frames.step(16);
    const m = q('[data-ui="evening-message"]')!;
    expect(m, 'message du soir présent').not.toBeNull();
    expect(m.textContent).toBe(FR[`w10.msg.${nights[2]}`]);
    expect(q('[data-ui="day-date"]')!.textContent).toBe(FR['w10.day.3.date']);
    screen.unmount(); host.remove();
  });
});
