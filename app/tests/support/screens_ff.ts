/**
 * Aides des tests de l'écran fast-forward [plan 03 T5, R-03.25 c] : un écrivain. Rien sous `src/` ne l'importe.
 * Parties de référence du plan 01 et boucle d'images pilotée par le temps réel écoulé.
 */
import { loadCore } from '../../src/data/load';
import { loadFastForwardData } from '../../src/screens/data';
import { scheduleHeadlines, type HeadlineShown } from '../../src/fastforward';
import { runFastForward } from '../../src/fastforward/run';
import type { RunResult } from '../../src/shared/types/run';
import { ans } from './answers';
import { manualFrames, type ManualFrames } from './street_screen';

export const core = loadCore();
export const { headlines: H } = loadFastForwardData();

/** Lignes du plan 01 : w10 non redirigé, w03 calculé redirigé vers w10, w07 et w12 (extinctions). */
export const LINES = {
  w10: 'ACBACBACAAD',
  redirected: 'AAAAAAAAAAA',
  w07: 'CBCCBDBACCD',
  w12: 'CBCCBDDACCD',
} as const;

export function runLine(line: string, softened = false): RunResult {
  return runFastForward(core, H, ans(line), softened);
}

export function shownOf(run: RunResult): readonly HeadlineShown[] {
  return scheduleHeadlines(run, H, core.engine);
}

/** Fait avancer la boucle de `realMs` millisecondes réelles par images de `frameMs` (50 ms au plus : plafond de l'horloge). */
export function advance(frames: ManualFrames, realMs: number, frameMs = 50): void {
  let left = realMs;
  while (left > 0) {
    const d = Math.min(frameMs, left);
    frames.step(d);
    left -= d;
  }
}

export { manualFrames };
