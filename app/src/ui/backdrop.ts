/**
 * Contrat commun des fonds Canvas 2D et leurs aides : surface à la densité de l'écran, boucle d'images injectable,
 * mouvement réduit [plan 03 T1]. Un fond ne dessine jamais de glyphe. Le rendu est une fonction pure de (graine, paramètres, tMs).
 */
import type { FrameLoop } from './clock';

export type { FrameLoop };

export interface Backdrop {
  start(): void;
  stop(): void;
  renderAt(tMs: number): void;
  setParams(p: Readonly<Record<string, number>>): void;
  /** Ignoré en 2D. */
  setFocus(depth01: number): void;
  /** Ignoré en 2D. */
  setParallax(dx: number, dy: number): void;
}

export interface BackdropOptions {
  readonly seed: number;
  readonly reducedMotion: boolean;
  /** Boucle d'images ; `requestAnimationFrame` par défaut. */
  readonly frames?: FrameLoop;
}

/** `prefers-reduced-motion: reduce` du navigateur courant. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const browserFrames = (): FrameLoop => ({ request: (cb) => requestAnimationFrame(cb), cancel: (h) => cancelAnimationFrame(h) });

/** Contexte 2D en pixels CSS : la surface suit la taille d'affichage fois `devicePixelRatio`. */
export function surface2d(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  const dpr = (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

/** Cadre commun : boucle, mouvement réduit, paramètres. `draw(tMs, params)` est le seul code propre à chaque fond. */
export function createBackdrop(
  opts: BackdropOptions,
  draw: (tMs: number, params: Readonly<Record<string, number>>) => void,
  onStop?: () => void,
): Backdrop {
  const frames = opts.frames ?? browserFrames();
  let params: Readonly<Record<string, number>> = {};
  let handle: number | null = null;
  let t0: number | null = null;
  const renderAt = (tMs: number): void => draw(opts.reducedMotion ? 0 : tMs, params);
  const loop = (nowMs: number): void => {
    t0 ??= nowMs;
    renderAt(nowMs - t0);
    handle = frames.request(loop);
  };
  return {
    start() {
      if (handle !== null) return;
      if (opts.reducedMotion) { renderAt(0); return; }
      t0 = null;
      handle = frames.request(loop);
    },
    stop() { if (handle !== null) { frames.cancel(handle); handle = null; } onStop?.(); },
    renderAt,
    setParams(p) { params = { ...params, ...p }; },
    setFocus() { /* 2D : sans effet */ },
    setParallax() { /* 2D : sans effet */ },
  };
}
