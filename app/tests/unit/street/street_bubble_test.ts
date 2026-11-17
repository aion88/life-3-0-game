// @vitest-environment happy-dom
/**
 * Réplique en bulle et narration en cartouche [plan UI-C T8 ; spec C §3.2 ; I-3, I-8].
 * Une seule bulle, jamais d'historique, queue vers la personne ; la narration est un cartouche encre sans queue.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { UiHandle } from '../../../src/street/ui';
import { createInstantAnimator } from '../../../src/ui/motion';
import { pseudoI18n } from '../../support/street_ui';

const LINE_A = 'w10.npc.marlene.1', LINE_B = 'w10.npc.marlene.2', NAME = 'w10.card.marlene';
const q = (s: string): Element | null => document.body.querySelector(s);
const qa = (s: string): Element[] => [...document.body.querySelectorAll(s)];
let ui: UiHandle; let anim: ReturnType<typeof createInstantAnimator>;
const mount = (): UiHandle => {
  anim = createInstantAnimator();
  return (ui = mountUi(document.body.appendChild(document.createElement('div')), pseudoI18n('fr'), { animator: anim }));
};
beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('bulle de réplique', () => {
  it('test_one_bubble_at_most', () => {
    mount();
    ui.showLine(LINE_A); ui.showLine(LINE_B);
    expect(qa('[data-ui="bubble"]')).toHaveLength(1);
  });

  it('test_bubble_has_no_history', () => {
    mount();
    ui.showLine(LINE_A); ui.showLine(LINE_B);
    const text = q('[data-ui="bubble"]')!.textContent!;
    expect(text).toContain(pseudoI18n('fr').t(LINE_B));
    expect(text).not.toContain(pseudoI18n('fr').t(LINE_A));
  });

  it('test_bubble_text_is_an_i18n_key_and_named_role', () => {
    mount();
    ui.showLine(LINE_A);
    const b = q('[data-ui="bubble"]')!;
    expect(b.getAttribute('aria-live')).toBe('polite');
    expect(b.className).toContain('c-bubble');
    expect(b.textContent).toBe(pseudoI18n('fr').t(LINE_A));   // marqueurs de la locale d'essai présents : rien n'est écrit en dur
  });

  it('test_name_chip_only_when_a_name_key_is_given', () => {
    mount();
    ui.showLine(LINE_A);                               // le runtime ne passe de clé que si le nom existe
    expect(q('[data-ui="name-chip"]')).toBeNull();
    ui.showLine(LINE_A, { nameKey: NAME });
    expect(q('[data-ui="name-chip"]')!.textContent).toBe(pseudoI18n('fr').t(NAME));
    ui.showLine(LINE_B);                               // pas de puce vide ni de puce héritée
    expect(q('[data-ui="name-chip"]')).toBeNull();
  });

  it('test_bubble_in_out_events_and_motion', async () => {
    mount();
    ui.showLine(LINE_A);
    expect(ui.events.log()).toEqual(['ui.bubble.in']);
    expect(anim.played().length).toBe(1);
    ui.clearLine();
    await Promise.resolve(); await Promise.resolve();
    expect(ui.events.log()).toEqual(['ui.bubble.in', 'ui.bubble.out']);
    expect(q('[data-ui="bubble"]')).toBeNull();
  });

  it('test_bubble_escape_closes_it', async () => {
    mount();
    ui.showLine(LINE_A);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve(); await Promise.resolve();
    expect(q('[data-ui="bubble"]')).toBeNull();
  });

  it('test_bubble_side_comes_from_the_placement_not_from_the_default', () => {
    mount();
    ui.showLine(LINE_A);
    expect(q('[data-ui="bubble-tail"]')).not.toBeNull();
    const w = document.defaultView!.innerWidth;
    ui.setSpeakerRect({ x: w - 40, y: 300, w: 24, h: 200 });   // collée au bord droit : à droite rien ne tient, la bulle passe à gauche
    expect((q('[data-ui="bubble"]') as HTMLElement).dataset['side']).toBe('left');
    expect((q('[data-ui="bubble-tail"]') as HTMLElement).dataset['side']).toBe('left');
    ui.setSpeakerRect({ x: 20, y: 300, w: 24, h: 200 });       // collée au bord gauche : à droite
    expect((q('[data-ui="bubble"]') as HTMLElement).dataset['side']).toBe('right');
  });

  it('test_bubble_reanchors_after_escape_when_the_speaker_has_not_moved', () => {
    mount();
    const w = document.defaultView!.innerWidth;
    ui.setSpeakerRect({ x: w - 40, y: 300, w: 24, h: 200 });
    ui.showLine(LINE_A);
    expect((q('[data-ui="bubble"]') as HTMLElement).dataset['side']).toBe('left');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ui.setSpeakerRect({ x: w - 40, y: 300, w: 24, h: 200 });   // même rectangle : le cache ne le renvoie pas
    ui.showLine(LINE_B);
    expect((q('[data-ui="bubble"]') as HTMLElement).dataset['side']).toBe('left');   // reste ancrée, pas retombée au défaut
  });

  it('test_clear_then_show_never_leaves_two_bubbles', async () => {
    mount();
    ui.showLine(LINE_A);
    ui.clearLine();
    ui.showLine(LINE_B);                                       // la sortie de la première dure encore
    expect(qa('[data-ui="bubble"]')).toHaveLength(1);
    await Promise.resolve(); await Promise.resolve();
    expect(qa('[data-ui="bubble"]')).toHaveLength(1);
    expect(q('[data-ui="bubble"]')!.textContent).toContain(pseudoI18n('fr').t(LINE_B));
  });
});

describe('narration en cartouche', () => {
  it('test_narration_is_ink_cartouche_without_tail', () => {
    mount();
    ui.setNarration(LINE_A);
    const n = q('[data-ui="narration"]')!;
    expect(n.className).toContain('c-card--ink');
    expect(n.querySelector('[data-ui="bubble-tail"]')).toBeNull();
    expect(n.querySelector('[data-ui="name-chip"]')).toBeNull();
    expect(n.getAttribute('data-side')).toBeNull();
  });

  it('test_one_narration_at_most', () => {
    mount();
    ui.setNarration(LINE_A); ui.setNarration(LINE_B);
    expect(qa('[data-ui="narration"]')).toHaveLength(1);
    expect(q('[data-ui="narration"]')!.textContent).toBe(pseudoI18n('fr').t(LINE_B));
  });

  it('test_narration_and_bubble_are_different_elements', () => {
    mount();
    ui.setNarration(LINE_A); ui.showLine(LINE_B);
    expect(q('[data-ui="narration"]')).not.toBe(q('[data-ui="bubble"]'));
    expect(q('[data-ui="bubble"]')!.contains(q('[data-ui="narration"]'))).toBe(false);
  });
});
