/** Navigation par pages : un bouton par page, libellé fourni par l'appelant, aucun numéro. `go` ne déclenche pas `onGo`. */
export function createPageNav(pages: readonly string[], onGo: (i: number) => void): { readonly el: HTMLElement; go(i: number): void; index(): number } {
  const el = document.createElement('nav');
  el.dataset['ui'] = 'page-nav';
  let current = 0;
  const buttons = pages.map((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'c-tab';
    b.textContent = label;
    b.addEventListener('click', () => { go(i); onGo(i); });
    el.append(b);
    return b;
  });
  function go(i: number): void {
    if (i < 0 || i >= pages.length) return;
    current = i;
    buttons.forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  go(0);
  return { el, go, index: () => current };
}
