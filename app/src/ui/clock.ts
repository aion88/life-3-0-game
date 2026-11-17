import { loadUi } from '../data/ui/load';

/**
 * Horloge d'écran : le temps d'affichage, jamais `Date.now`. Elle avance seulement par `advance(realMs)`, appelé par la boucle
 * d'images de l'ÉCRAN (R-03.4), s'arrête sur pause de l'utilisateur ou onglet caché, et multiplie l'écart par la vitesse.
 * L'onglet caché ne change ni la vitesse ni la pause de l'utilisateur [plan 03 Review Focus 6 ; GDD 02 F17].
 */

/** Boucle d'images injectable (re-déclarée ici : aucun import de `street/runtime`, R-03.4). */
export interface FrameLoop { request(cb: (nowMs: number) => void): number; cancel(handle: number): void }

/** Vitesses admises [GDD 02 §3.9]. */
export type Speed = 1 | 2 | 4;

export interface ScreenClock {
  now(): number;
  advance(realMs: number): void;
  pause(): void;
  resume(): void;
  paused(): boolean;
  setSpeed(x: Speed): void;
}

/** Horloge d'écran, avec lecture de la vitesse et libération de l'écouteur de visibilité. */
export interface DisposableClock extends ScreenClock { speed(): Speed; dispose(): void }

/** Crée l'horloge ; `doc` est le document dont on suit la visibilité (le global par défaut). */
export function createScreenClock(doc: Document = document): DisposableClock {
  let t = 0;
  let speed: Speed = 1;
  let userPaused = false;
  let hidden = doc.visibilityState === 'hidden';
  const onVisibility = (): void => { hidden = doc.visibilityState === 'hidden'; };
  doc.addEventListener('visibilitychange', onVisibility);
  const paused = (): boolean => userPaused || hidden;
  return {
    now: () => t,
    advance(realMs) { if (!paused() && realMs > 0) t += realMs * speed; },
    pause() { userPaused = true; },
    resume() { userPaused = false; },
    paused,
    setSpeed(x) { speed = x; },
    speed: () => speed,
    dispose() { doc.removeEventListener('visibilitychange', onVisibility); },
  };
}

/**
 * Pousse l'horloge par l'écart entre deux images. Pendant une pause, l'écart est jeté : au retour, le premier
 * écart est celui d'une image, jamais le temps passé en pause. `onTick` reçoit le temps d'écran après avance.
 */
export function createFrameClock(
  frames: FrameLoop,
  clock: ScreenClock,
  onTick?: (screenMs: number) => void,
  opts: { readonly doc?: Document; readonly maxFrameMs?: number } = {},
): { start(): void; stop(): void } {
  const doc = opts.doc ?? document;
  const maxFrameMs = opts.maxFrameMs ?? loadUi().timing.maxFrameMs;
  let handle: number | null = null;
  let last: number | null = null;
  // L'onglet caché suspend les images : `last` garderait l'instant d'avant et le retour avancerait de tout le temps caché.
  const onVisibility = (): void => { last = null; };
  const tick = (nowMs: number): void => {
    handle = frames.request(tick);
    if (clock.paused()) last = nowMs;
    else {
      if (last !== null) clock.advance(Math.min(nowMs - last, maxFrameMs));
      last = nowMs;
    }
    onTick?.(clock.now());
  };
  return {
    start() {
      if (handle !== null) return;
      last = null;
      doc.addEventListener('visibilitychange', onVisibility);
      handle = frames.request(tick);
    },
    stop() {
      doc.removeEventListener('visibilitychange', onVisibility);
      if (handle !== null) { frames.cancel(handle); handle = null; }
    },
  };
}
