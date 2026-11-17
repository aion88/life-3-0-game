/**
 * Mur de téléviseurs CRT du questionnaire, Canvas 2D derrière le DOM [art bible §B.1 ; plan 03 décision 1].
 * Trois états (neige, éteint, mire), sans glyphe. Chaque image est une fonction de (graine, état, tMs).
 */
import { loadUi } from '../../data/ui/load';
import { mix32, mulberry32 } from '../../shared/rng';
import { createBackdrop, surface2d, type Backdrop, type BackdropOptions } from '../backdrop';
import { rgba } from '../color';

export type WallState = 'snow' | 'dark' | 'testcard';
const STATES: readonly WallState[] = ['snow', 'dark', 'testcard'];

export type CrtWall = Backdrop & { states(): readonly WallState[]; exit(): Promise<void> };

/** Crée le mur. `setParams({ state })` choisit l'état par son rang dans `states()`. */
export function createCrtWall(canvas: HTMLCanvasElement, opts: BackdropOptions): CrtWall {
  const { theme, timing } = loadUi();
  const c = theme.colors;
  const w = theme.wall;
  const cells = w.columns * w.rows;
  const bars = [c.light, c.crtPale, c.crtCyan, c.crtMagenta, c.mid, c.base];
  let exitFrom: number | null | undefined; // undefined : pas de sortie ; null : sortie demandée, départ au prochain rendu
  let exitDone: (() => void) | null = null;
  let exited = false;
  let exiting: Promise<void> | null = null;

  const draw = (tMs: number, params: Readonly<Record<string, number>>): void => {
    const { ctx, width: W, height: H } = surface2d(canvas);
    const state = STATES[Math.min(STATES.length - 1, Math.max(0, Math.round(params['state'] ?? 0)))]!;
    ctx.fillStyle = w.screenOff;
    ctx.fillRect(0, 0, W, H);
    let progress = exited ? 1 : 0;
    if (exitFrom === null) exitFrom = tMs;
    if (typeof exitFrom === 'number') progress = Math.min(1, (tMs - exitFrom) / timing.wallExitMs);
    const cw = W / w.columns;
    const ch = H / w.rows;
    const gx = cw * w.gapRatio;
    const gy = ch * w.gapRatio;
    const frame = Math.floor(tMs / w.noiseMs);
    for (let i = 0; i < cells; i++) {
      const col = i % w.columns;
      const row = Math.floor(i / w.columns);
      const x = col * cw + gx;
      const y = row * ch + gy;
      const sw = cw - 2 * gx;
      const sh = ch - 2 * gy;
      const cellRng = mulberry32(mix32(opts.seed, i));
      const gain = w.gainMin + (1 - w.gainMin) * cellRng();
      const off = progress >= (i + 1) / cells;
      ctx.save();
      ctx.fillStyle = c.mid;
      ctx.fillRect(x, y, sw, sh);
      const inset = Math.min(sw, sh) * w.screenInset;
      const sx = x + inset; const sy = y + inset; const ssw = sw - 2 * inset; const ssh = sh - 2 * inset;
      ctx.beginPath();
      ctx.rect(sx, sy, ssw, ssh);
      ctx.clip();
      const shown: WallState = off ? 'dark' : state;
      if (shown === 'dark') {
        ctx.fillStyle = rgba(w.screenOff, 1);
        ctx.fillRect(sx, sy, ssw, ssh);
        ctx.fillStyle = rgba(c.crtPale, w.darkGlintAlpha * gain);
        ctx.fillRect(sx, sy, ssw, ssh * w.glintHeight);
      } else if (shown === 'snow') {
        const [gc, gr] = w.snowGrid;
        const nrng = mulberry32(mix32(opts.seed, i, frame));
        const bw = ssw / gc; const bh = ssh / gr;
        for (let by = 0; by < gr; by++) for (let bx = 0; bx < gc; bx++) {
          ctx.fillStyle = rgba(c.crtPale, nrng() * w.snowAlpha * gain);
          ctx.fillRect(sx + bx * bw, sy + by * bh, bw + 0.5, bh + 0.5);
        }
      } else {
        const bwid = ssw / bars.length;
        bars.forEach((col2, b) => {
          ctx.fillStyle = rgba(col2, gain);
          ctx.fillRect(sx + b * bwid, sy, bwid + 0.5, ssh);
        });
      }
      ctx.restore();
    }
    if (progress >= 1 && exitDone) { exited = true; exitFrom = undefined; const d = exitDone; exitDone = null; exiting = null; d(); }
  };

  const base = createBackdrop(opts, draw, () => { if (exitDone) { const d = exitDone; exitDone = null; exiting = null; exitFrom = undefined; d(); } });
  return {
    ...base,
    /** Changer d'état (`state`) rouvre le mur : une sortie accomplie ne le garde pas éteint. */
    setParams(p) { if ('state' in p && !exiting) exited = false; base.setParams(p); },
    states: () => STATES,
    exit() {
      if (opts.reducedMotion) { exited = true; return Promise.resolve(); }
      if (exited) return Promise.resolve();
      exiting ??= new Promise<void>((resolve) => { exitDone = resolve; exitFrom = null; });
      return exiting;
    },
  };
}
