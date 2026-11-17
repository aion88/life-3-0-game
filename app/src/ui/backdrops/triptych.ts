/**
 * Triptyque du fast-forward : ciel (aiPower, surveillance), ville (order, abundance), sol (freedom, unrest) [GDD 02 §3.7].
 * Canvas 2D, sans glyphe. Les paramètres sont les six variables, normalisées de 0 à 1 (frontière d'affichage).
 * La forme de chaque bande est provisoire [à confirmer: art-director].
 */
import type { TriptychPairing } from '../../data/schema/ui';
import { loadUi } from '../../data/ui/load';
import { mix32, mulberry32 } from '../../shared/rng';
import { createBackdrop, surface2d, type Backdrop, type BackdropOptions } from '../backdrop';
import { rgba } from '../color';

const clamp01 = (v: number | undefined, d = 0.5): number => Math.min(1, Math.max(0, v ?? d));

export function createTriptych(canvas: HTMLCanvasElement, pairing: TriptychPairing, opts: BackdropOptions): Backdrop {
  const c = loadUi().theme.colors;
  const r = pairing.render;
  const draw = (tMs: number, p: Readonly<Record<string, number>>): void => {
    const { ctx, width: W, height: H } = surface2d(canvas);
    const bandH = H / 3;
    const seed = opts.seed;
    const bandBox = (i: number, fn: (y0: number) => void): void => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, i * bandH, W, bandH);
      ctx.clip();
      fn(i * bandH);
      ctx.restore();
    };
    // Ciel : étoiles (aiPower), faisceaux de balayage (surveillance).
    bandBox(0, (y0) => {
      ctx.fillStyle = c.base; ctx.fillRect(0, y0, W, bandH);
      const rng = mulberry32(mix32(seed, 1));
      const nStars = Math.round(clamp01(p['aiPower']) * r.stars);
      for (let i = 0; i < r.stars; i++) {
        const x = rng() * W; const y = y0 + rng() * bandH; const tw = rng();
        if (i < nStars) { ctx.fillStyle = rgba(c.crtPale, r.starAlphaBase + r.starAlphaSwing * Math.abs(Math.sin(tMs / r.twinkleMs + tw * 6))); ctx.fillRect(x, y, 2, 2); }
      }
      const nBeams = Math.round(clamp01(p['surveillance']) * r.beams);
      for (let i = 0; i < nBeams; i++) {
        const x = ((i + 0.5) / r.beams) * W + Math.sin(tMs / r.beamSwayMs + i) * W * r.beamSway;
        ctx.strokeStyle = rgba(c.crtCyan, r.beamAlpha);
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(W / 2 + (x - W / 2) * r.beamConverge, y0 + bandH); ctx.stroke();
      }
    });
    // Ville : hauteur des immeubles (order), fenêtres allumées (abundance).
    bandBox(1, (y0) => {
      ctx.fillStyle = c.mid; ctx.fillRect(0, y0, W, bandH);
      const rng = mulberry32(mix32(seed, 2));
      const bw = W / r.buildings;
      const order = clamp01(p['order']);
      const lit = clamp01(p['abundance']);
      for (let i = 0; i < r.buildings; i++) {
        const hRel = r.buildingMinRel + r.buildingSpanRel * rng();
        const h = bandH * hRel * (r.orderFloor + (1 - r.orderFloor) * order);
        ctx.fillStyle = c.base;
        ctx.fillRect(i * bw + 1, y0 + bandH - h, bw - 2, h);
        for (let k = 0; k < r.windowsPerBuilding; k++) {
          const wx = i * bw + 4 + rng() * (bw - 10); const wy = y0 + bandH - h + 4 + rng() * Math.max(1, h - 10); const on = rng();
          if (on < lit) { ctx.fillStyle = c.sodium; ctx.fillRect(wx, wy, 3, 3); }
        }
      }
    });
    // Sol : chemins ouverts (freedom), fissures (unrest).
    bandBox(2, (y0) => {
      ctx.fillStyle = c.base; ctx.fillRect(0, y0, W, bandH);
      const rng = mulberry32(mix32(seed, 3));
      const nPaths = Math.round(clamp01(p['freedom']) * r.paths);
      for (let i = 0; i < nPaths; i++) {
        const x = ((i + 0.5) / r.paths) * W;
        ctx.strokeStyle = rgba(c.light, r.pathAlpha);
        ctx.beginPath(); ctx.moveTo(W / 2, y0); ctx.lineTo(x, y0 + bandH); ctx.stroke();
      }
      const unrest = clamp01(p['unrest']);
      const nCracks = Math.round(unrest * r.cracks);
      for (let i = 0; i < r.cracks; i++) {
        const x = rng() * W; const y = y0 + rng() * bandH; const dx = (rng() - 0.5) * r.crackSpan * (0.5 + unrest);
        if (i < nCracks) {
          ctx.strokeStyle = rgba(c.crtMagenta, r.crackAlphaBase + r.crackAlphaSwing * Math.sin(tMs / r.crackMs + i));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + 12); ctx.stroke();
        }
      }
    });
  };
  return createBackdrop(opts, draw);
}
