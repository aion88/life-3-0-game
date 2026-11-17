/**
 * Choix en deux gestes : le premier désigne, le second (sur la désignée) confirme [GDD 01 §3.2 étape 4].
 * Aucun délai ici : le coût et « continuer » sont à l'écran (T4). Les libellés viennent de l'appelant.
 * Désignation et confirmation sont identiques pour toutes les options : mêmes classes, même mouvement, mêmes événements [I-4 ; spec C §3.1, §4, §5].
 */
import { loadUi } from '../../data/ui/load';
import type { ChoicePhase } from '../../engine/moments/types';
import type { UiEvents } from '../events';
import { designateParams, motionFor, reducedMotionOf, type Animator } from '../motion';

export function createTwoStep<T extends string>(opts: {
  options: readonly { id: T; label: string }[];
  onConfirm(id: T): void;
  events?: UiEvents;
  animator?: Animator;
  reducedMotion?: boolean;
}): { readonly el: HTMLElement; phase(): ChoicePhase; designate(id: T): void; confirm(): void; fadeOthers(): void } {
  const { theme, timing } = loadUi();
  const fadedOpacity = theme.fadedOpacity;
  const reduced = reducedMotionOf(opts.reducedMotion);
  const params = designateParams(theme, 'questionnaire');
  const play = (el: Element, id: Parameters<typeof motionFor>[0], extra: Record<string, number | string> = {}): Promise<void> => {
    const spec = motionFor(id, reduced, timing, extra);
    return spec && opts.animator ? opts.animator.play(el, spec) : Promise.resolve();
  };
  const el = document.createElement('div');
  el.dataset['ui'] = 'two-step';
  let phase: ChoicePhase = 'idle';
  let chosen: T | null = null;
  const buttons = new Map<T, HTMLButtonElement>();
  const dots = new Map<T, HTMLElement>();

  const paint = (): void => {
    for (const [id, b] of buttons) {
      b.setAttribute('aria-pressed', String(chosen === id));
      b.dataset['state'] = chosen === id ? phase : 'idle';
      dots.get(id)!.dataset['filled'] = String(chosen === id);
    }
  };
  const designate = (id: T): void => {
    if (phase === 'confirmed') return;
    const previous = chosen;
    chosen = id;
    phase = 'designated';
    paint();
    if (previous !== null && previous !== id) void play(buttons.get(previous)!, 'undesignate', params);
    void play(buttons.get(id)!, 'designate', params);
    opts.events?.emit('ui.designate');
  };
  const confirm = (): void => {
    if (phase !== 'designated' || chosen === null) return;
    phase = 'confirmed';
    paint();
    const b = buttons.get(chosen)!;
    void play(b, 'confirmPress', { shadowColor: 'var(--sh-rose)' }).then(() => play(b, 'confirmRelease', { shadowColor: 'var(--sh-rose)' }));
    opts.events?.emit('ui.confirm');
    opts.onConfirm(chosen);
  };
  for (const o of opts.options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'c-option c-option--q';
    b.dataset['option'] = o.id;
    const dot = document.createElement('span');
    dot.className = 'c-option__dot';
    dot.dataset['dot'] = '';
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = o.label;
    b.append(dot, label);
    b.addEventListener('click', () => { if (phase === 'designated' && chosen === o.id) confirm(); else designate(o.id); });
    buttons.set(o.id, b);
    dots.set(o.id, dot);
    el.append(b);
  }
  paint();
  return {
    el,
    phase: () => phase,
    designate,
    confirm,
    fadeOthers() {
      if (phase !== 'confirmed') return;
      for (const [id, b] of buttons) if (id !== chosen) {
        b.dataset['faded'] = 'true';
        b.style.opacity = String(fadedOpacity);
        void play(b, 'fadeOthers', { opacity: fadedOpacity });
      }
      for (const b of buttons.values()) b.disabled = true;
    },
  };
}
