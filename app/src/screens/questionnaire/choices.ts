/** One click selects an answer; choices remain editable until Continue. */
import { loadUi } from '../../data/ui/load';
import type { UiEvents } from '../../ui/events';
import { designateParams, motionFor, type Animator } from '../../ui/motion';
export function createChoices<T extends string>(opts: {
  options: readonly { id: T; label: string }[];
  onSelect(id: T): void;
  events: UiEvents;
  animator: Animator;
  reducedMotion: boolean;
}): HTMLElement {
  const el = document.createElement('div'); el.dataset['ui'] = 'single-choice';
  el.dataset['fresh'] = ''; el.addEventListener('pointermove', () => { delete el.dataset['fresh']; }, { once: true });   // pas de survol tant que la souris n'a pas bougé
  const { theme, timing } = loadUi();
  const params = designateParams(theme, 'questionnaire');
  const buttons = new Map<T, HTMLButtonElement>();
  let selected: T | null = null;
  for (const option of opts.options) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'c-option c-option--q'; b.dataset['option'] = option.id;
    b.setAttribute('aria-pressed', 'false'); b.dataset['state'] = 'idle';
    const dot = document.createElement('span'); dot.className = 'c-option__dot'; dot.dataset['dot'] = ''; dot.dataset['filled'] = 'false'; dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = option.label; b.append(dot, label);
    b.addEventListener('click', () => {
      if (selected === option.id) return;
      selected = option.id;
      for (const [id, button] of buttons) {
        const chosen = id === selected; button.setAttribute('aria-pressed', String(chosen)); button.dataset['state'] = chosen ? 'selected' : 'idle';
        button.querySelector<HTMLElement>('[data-dot]')!.dataset['filled'] = String(chosen);
        const spec = motionFor(chosen ? 'designate' : 'undesignate', opts.reducedMotion, timing, params);
        if (spec) void opts.animator.play(button, spec);
      }
      opts.events.emit('ui.designate'); opts.onSelect(option.id);
    });
    buttons.set(option.id, b); el.append(b);
  }
  return el;
}
