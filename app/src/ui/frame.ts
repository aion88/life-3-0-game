/**
 * Cadre commun des écrans : une scène, le canvas de fond SOUS le DOM, deux bandes noires 2,39:1 (art bible §E).
 * Aucun grain sur l'interface [plan 03 T1].
 */
import { loadUi } from '../data/ui/load';
import './font';
import './c.css';
import { applyTheme } from './theme';

export interface Frame { readonly stage: HTMLElement; readonly canvas: HTMLCanvasElement; dispose(): void }

/** Monte le cadre dans `root` ; `stage` reçoit le contenu DOM de l'écran. */
export function createFrame(root: HTMLElement): Frame {
  const { colors, letterboxRatio } = loadUi().theme;
  const scene = document.createElement('div');
  scene.dataset['ui'] = 'frame';
  applyTheme(scene);
  Object.assign(scene.style, {
    position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden',
    background: colors.base, fontFamily: 'var(--font-ui)', color: colors.panelText,
  });
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  const stage = document.createElement('div');
  Object.assign(stage.style, { position: 'absolute', inset: '0' });
  const bandHeight = `max(0px, calc((100vh - 100vw / ${letterboxRatio}) / 2))`;
  scene.style.setProperty('--band-h', bandHeight);   // zone utile = entre les bandes : les écrans bornent leur mise en page dessus
  const band = (edge: 'top' | 'bottom'): HTMLElement => {
    const b = document.createElement('div');
    b.dataset['band'] = edge;
    b.setAttribute('aria-hidden', 'true');
    Object.assign(b.style, { position: 'absolute', left: '0', right: '0', [edge]: '0', height: bandHeight, background: colors.band, pointerEvents: 'none' });
    return b;
  };
  scene.append(canvas, stage, band('top'), band('bottom'));
  root.append(scene);
  return { stage, canvas, dispose() { scene.remove(); } };
}
