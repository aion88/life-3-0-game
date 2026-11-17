/** An explicit observation mode gives the cinematic scene space on small screens. */
export function mountSceneReading(host: HTMLElement): () => void {
  const doc = host.ownerDocument;
  const control = doc.createElement('button');
  control.type = 'button'; control.className = 'scene-reading-toggle';
  control.setAttribute('aria-label', 'Voir la scène sans les panneaux de lecture');
  let observing = false;
  const update = (): void => {
    host.dataset['observing'] = String(observing);
    control.textContent = observing ? 'Revenir aux choix' : 'Voir la scène';
    control.setAttribute('aria-pressed', String(observing));
    control.setAttribute('aria-label', observing ? 'Revenir aux dialogues et aux choix' : 'Voir la scène sans les panneaux de lecture');
  };
  control.addEventListener('click', () => { observing = !observing; update(); });
  const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape' && observing) { event.preventDefault(); event.stopPropagation(); observing = false; update(); control.focus(); } };
  host.addEventListener('keydown', escape);
  host.append(control); update();
  return () => { host.removeEventListener('keydown', escape); control.remove(); delete host.dataset['observing']; };
}
