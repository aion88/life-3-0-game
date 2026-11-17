/** Aides de T6 : boucle d'images manuelle qui pousse l'horloge de l'écran par pas de 50 ms [plan 03 T6, R-03.25]. */
import type { FrameLoop } from '../../src/ui/clock';

export interface ManualFrames extends FrameLoop {
  /** Avance de `ms` millisecondes d'écran, image par image (pas de 50 ms, plafond `maxFrameMs`). */
  advance(ms: number): void;
}

export function manualFrames(stepMs = 50): ManualFrames {
  let cb: ((nowMs: number) => void) | null = null;
  let id = 0;
  let now = 0;
  return {
    request(f) { cb = f; return ++id; },
    cancel() { cb = null; },
    advance(ms) {
      for (let left = ms; left > 1e-9; left -= stepMs) {
        now += Math.min(stepMs, left);
        const f = cb;
        if (f) f(now);
      }
    },
  };
}
