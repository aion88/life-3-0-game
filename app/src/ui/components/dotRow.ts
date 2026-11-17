/** Rangée de points : avancement sans chiffre. Décorative (`aria-hidden`) : un compte lu à voix haute contredirait GDD 01 U-1. Habillage dans `c.css` (`.c-dot`) [spec C §3.1]. */
export function createDotRow(total: number): { readonly el: HTMLElement; fill(n: number): void } {
  const el = document.createElement('div');
  el.dataset['ui'] = 'dot-row';
  el.className = 'c-dot-row';
  el.setAttribute('aria-hidden', 'true');
  const dots = Array.from({ length: total }, () => {
    const d = document.createElement('span');
    d.className = 'c-dot';
    d.dataset['filled'] = 'false';
    el.append(d);
    return d;
  });
  return {
    el,
    fill(n) {
      dots.forEach((d, i) => { d.dataset['filled'] = String(i < n); });
    },
  };
}
