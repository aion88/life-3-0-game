// @vitest-environment happy-dom
/**
 * Barre « Dossier » dans l'interface de la rue [GDD 2026-11-03 §2 option A, décision Cynthia, playtest 2026-11-03] : sœur du bracelet,
 * sans nombre, couleur de palier par jeton, segments gris en attente, consolidation animée au relevé (sautée en mouvement réduit).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { UiHandle } from '../../../src/street/ui';
import { createInstantAnimator } from '../../../src/ui/motion';
import { integrityOf, parseWorld } from '../../../src/data/schema/world';
import { closeNight, startSurvival, survivalEntry } from '../../../src/survival';
import { dossierView } from '../../../src/survival/dossier';
import type { DossierView } from '../../../src/survival/dossier';
import dossierRaw from '../../../src/data/ui/dossier.json';
import type { Milli } from '../../../src/shared/milli';
import type { DayIndex } from '../../../src/shared/types/street';
import { cat, w10Raw } from '../../fixtures/data/factories';
import { ledgerOf } from '../../support/survival';
import { realI18n } from '../../support/street_ui';

const CFG = integrityOf(parseWorld(w10Raw, cat));
const q = (s: string): HTMLElement | null => document.body.querySelector<HTMLElement>(s);
const at = (p: number): DossierView => dossierView({ value: (p * 1000) as Milli, counters: {} }, ledgerOf(1, []), CFG);

let ui: UiHandle;
let animator: ReturnType<typeof createInstantAnimator>;
const mount = (reduced = false, lang: 'fr' | 'en' = 'fr'): UiHandle => {
  animator = createInstantAnimator();
  return (ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n(lang), { reducedMotion: reduced, animator }));
};
afterEach(() => { ui.dispose(); document.body.innerHTML = ''; });

describe('barre Dossier : place et texte', () => {
  it('test_dossier_is_a_root_sibling_of_the_bracelet_never_inside_it', () => {
    mount(); ui.setBracelet(59); ui.setDossier(at(60));
    const d = q('[data-ui="dossier"]')!;
    expect(d.parentElement).toBe(q('[data-ui="root"]'));
    expect(q('[data-ui="bracelet"] [data-ui="dossier"]')).toBeNull();
    expect(q('[data-ui="bracelet"]')!.nextElementSibling === d || d.previousElementSibling !== null).toBe(true);
  });

  it('test_dossier_shows_its_name_and_the_audition_label_and_no_digit', () => {
    mount(); ui.setDossier(at(42));
    const d = q('[data-ui="dossier"]')!;
    expect(q('[data-ui="dossier-name"]')!.textContent).toBe('Dossier');
    expect(q('[data-ui="dossier-audition"]')!.textContent).toBe('audition');
    expect(d.textContent).not.toMatch(/\d/);   // ligne d'aide comprise
    expect(d.textContent!.toLowerCase()).not.toMatch(/intégrité|integrity|jauge|gauge|score/);
  });

  it('test_dossier_reads_in_english', () => {
    mount(false, 'en'); ui.setDossier(at(42));
    expect(q('[data-ui="dossier-name"]')!.textContent).toBe('File');
    expect(q('[data-ui="dossier-audition"]')!.textContent).toBe('hearing');
  });

  it('test_dossier_audition_mark_sits_at_the_arrest_threshold', () => {
    mount(); ui.setDossier(at(60));
    expect(q('[data-ui="dossier"]')!.style.getPropertyValue('--dossier-audition-at')).toBe('24.5%');
    expect(q('[data-ui="dossier-mark"]')).not.toBeNull();
  });
});

describe('barre Dossier : ligne d\'aide du premier affichage', () => {
  it('test_dossier_hint_explains_the_grey_until_the_first_evening', () => {
    mount(); ui.setDossier(at(60));
    expect(q('[data-ui="dossier-hint"]')!.textContent).toBe('En gris : ce qui sera compté ce soir.');
    expect(q('[data-ui="dossier"]')!.title).toBe('En gris : ce qui sera compté ce soir.');
    ui.setDossier(at(60), true);
    expect(q('[data-ui="dossier-hint"]')).toBeNull();
    ui.setDossier(at(63));
    expect(q('[data-ui="dossier-hint"]')).toBeNull();
    expect(q('[data-ui="dossier"]')!.title).toBe('En gris : ce qui sera compté ce soir.');   // l'infobulle reste
  });

  it('test_dossier_hint_reads_in_english', () => {
    mount(false, 'en'); ui.setDossier(at(60));
    expect(q('[data-ui="dossier-hint"]')!.textContent).toBe('In grey: what will be counted tonight.');
  });
});

describe('barre Dossier : paliers', () => {
  it.each([[60, 'courtesy'], [45, 'thanks'], [30, 'patience'], [10, 'appointment']] as const)('test_dossier_at_%i_wears_the_%s_token', (p, palier) => {
    mount(); ui.setDossier(at(p));
    const fill = q('[data-ui="dossier-fill"]')!;
    expect(fill.dataset['palier']).toBe(palier);
    expect(fill.style.width).toBe(`${p}%`);
    const token = (dossierRaw.palierColor as Record<string, { v: string }>)[palier]!.v;
    expect(fill.style.background).toBe(`var(--c-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`);
  });

  it('test_dossier_palier_colors_are_four_distinct_palette_tokens', () => {
    const v = Object.values(dossierRaw.palierColor).map((c) => c.v);
    expect(new Set(v).size).toBe(4);
    expect(v).not.toContain('rose');   // le rose vif reste la seule couleur de désignation [direction C §1]
  });
});

describe('barre Dossier : segments en attente et consolidation', () => {
  it('test_dossier_draws_one_grey_segment_per_pending_source', () => {
    mount();
    const v = dossierView(startSurvival(CFG), ledgerOf(1, [survivalEntry('patrol', { day: 1 as DayIndex, minute: 600 }, CFG)]), CFG);
    ui.setDossier(v);
    const segs = [...document.body.querySelectorAll<HTMLElement>('[data-ui="dossier-segment"]')];
    expect(segs.map((s) => s.dataset['source'])).toEqual(v.segments.map((s) => s.source));
    expect(segs.every((s) => s.dataset['dir'] === 'down')).toBe(true);
  });

  it('test_dossier_consolidates_with_an_animation_to_the_night_value', async () => {
    mount();
    const s0 = startSurvival(CFG); const l1 = ledgerOf(1, []);
    ui.setDossier(dossierView(s0, l1, CFG));
    const night = closeNight(s0, l1, CFG).state;
    ui.setDossier(dossierView(night, ledgerOf(2, []), CFG));
    const plays = animator.played().filter((p) => p.el === q('[data-ui="dossier-fill"]'));
    expect(plays).toHaveLength(1);
    expect(plays[0]!.spec.keyframes.map((k) => k.width)).toEqual(['60%', '63%']);
    await Promise.resolve(); await Promise.resolve();
    expect(q('[data-ui="dossier-fill"]')!.style.width).toBe('63%');
    expect(document.body.querySelectorAll('[data-ui="dossier-segment"]').length).toBeGreaterThan(0);   // la nuit du J2 attend déjà
  });

  it('test_dossier_consolidates_at_the_evening_relevé_then_holds_still_at_morning', async () => {
    mount();
    const s0 = startSurvival(CFG); const l1 = ledgerOf(1, [survivalEntry('patrol', { day: 1 as DayIndex, minute: 600 }, CFG)]);
    const day = dossierView(s0, l1, CFG);
    ui.setDossier(day);
    ui.setDossier(day, true);                                    // le relevé du soir s'ouvre
    const fill = (): HTMLElement => q('[data-ui="dossier-fill"]')!;
    const plays = (): number => animator.played().filter((p) => p.el === fill()).length;
    expect(plays()).toBe(1);
    await Promise.resolve(); await Promise.resolve();
    expect(fill().style.width).toBe(`${day.pending / 1000}%`);
    expect(fill().dataset['palier']).toBe(day.pendingPalier);
    expect(document.body.querySelectorAll('[data-ui="dossier-segment"]')).toHaveLength(0);
    const night = closeNight(s0, l1, CFG).state;               // D89 : la nuit écrit exactement ce que le soir a montré
    ui.setDossier(dossierView(night, ledgerOf(2, []), CFG));
    expect(plays()).toBe(1);
    expect(fill().style.width).toBe(`${night.value / 1000}%`);
  });

  it('test_dossier_jumps_without_animation_under_reduced_motion', () => {
    mount(true);
    ui.setDossier(at(60)); ui.setDossier(at(63));
    expect(animator.played().filter((p) => p.el === q('[data-ui="dossier-fill"]'))).toHaveLength(0);
    expect(q('[data-ui="dossier-fill"]')!.style.width).toBe('63%');
  });

  it('test_dossier_at_zero_is_empty', () => {
    mount(); ui.setDossier(at(0));
    expect(q('[data-ui="dossier-fill"]')!.style.width).toBe('0%');
  });
});

describe('barre Dossier : battement d\'une séquence jouée [décision Cynthia, playtest 2026-11-03]', () => {
  const pulse = (): HTMLElement => q('[data-ui="dossier-pulse"]')!;
  const dossier = (): HTMLElement => q('[data-ui="dossier"]')!;
  const edge = (): number => parseFloat(pulse().style.left);

  it('test_pulse_follows_the_direction_of_the_effect_at_the_edge_of_the_pending_segment', () => {
    mount(); const v = at(42); ui.setDossier(v);
    expect(dossier().hasAttribute('data-pulse')).toBe(false);
    const w = parseFloat(String((dossierRaw as { pulseWidth: { medium: { v: number } } }).pulseWidth.medium.v)) * 100;
    ui.pulseDossier(1);
    expect(dossier().dataset['pulse']).toBe('up');
    expect(edge()).toBeCloseTo(v.pendingFill * 100, 1);                 // la hausse part du bord du segment en attente
    ui.pulseDossier(-1);
    expect(dossier().dataset['pulse']).toBe('down');
    expect(edge()).toBeCloseTo(Math.max(0, v.pendingFill * 100 - w), 1);   // la baisse finit à ce bord
  });

  it('test_pulse_width_follows_the_weight_of_the_effect', () => {
    mount(); ui.setDossier(at(42));
    const widths = (['low', 'medium', 'strong'] as const).map((w) => { ui.pulseDossier(-1, w); return parseFloat(pulse().style.width); });
    expect(widths[0]).toBeLessThan(widths[1]!); expect(widths[1]).toBeLessThan(widths[2]!);
    expect(dossier().dataset['pulseWeight']).toBe('strong');
  });

  it('test_pulse_moves_to_the_new_pending_edge_when_the_act_redraws_the_bar', () => {
    mount(); ui.setDossier(at(42)); ui.pulseDossier(1);
    const before = edge();
    ui.setDossier(at(50));
    expect(edge()).not.toBe(before);
    expect(dossier().dataset['pulse']).toBe('up');
  });

  it('test_pulse_stops_at_once_in_reduced_motion_and_has_no_animation_state', () => {
    mount(true); ui.setDossier(at(42)); ui.pulseDossier(1);
    expect(dossier().dataset['reduced']).toBe('true');                // le CSS fige le battement, il reste visible
    ui.pulseDossier(null);
    expect(dossier().hasAttribute('data-pulse')).toBe(false);
  });

  it('test_pulse_ends_after_the_running_beat', () => {
    mount(); ui.setDossier(at(42)); ui.pulseDossier(-1); ui.pulseDossier(null);
    expect(dossier().dataset['pulse']).toBe('down');                  // le battement en cours va au bout
    pulse().dispatchEvent(new Event('animationiteration'));
    expect(dossier().hasAttribute('data-pulse')).toBe(false);
  });
});
