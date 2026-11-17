/** Bascule douce : un bouton `aria-pressed`. Le libellé est ajouté par l'appelant. `set` ne déclenche pas `onToggle`. */
export function createSoftToggle(opts: { pressed: boolean; onToggle(next: boolean): void }): { readonly el: HTMLElement; set(next: boolean): void } {
  const el = document.createElement('button');
  el.type = 'button';
  el.dataset['ui'] = 'soft-toggle';
  let pressed = opts.pressed;
  const paint = (): void => { el.setAttribute('aria-pressed', String(pressed)); };
  el.addEventListener('click', () => { pressed = !pressed; paint(); opts.onToggle(pressed); });
  paint();
  return { el, set(next) { pressed = next; paint(); } };
}
