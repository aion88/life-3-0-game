/** Chargeur des réglages d'interface : trois JSON validés, mémorisés [plan 03 T1]. */
import themeRaw from './theme.json';
import triptychRaw from './triptych.json';
import timingRaw from './timing.json';
import { parseTheme, parseTiming, parseTriptych, type Theme, type Timing, type TriptychPairing } from '../schema/ui';

export type { Theme, Timing, TriptychPairing };

/** Les réglages d'interface. */
export interface UiData { readonly theme: Theme; readonly triptych: TriptychPairing; readonly timing: Timing }

let cached: UiData | null = null;

/** Charge et valide les trois fichiers ; lève `DataLoadError` sur un écart. */
export function loadUi(): UiData {
  cached ??= { theme: parseTheme(themeRaw), triptych: parseTriptych(triptychRaw), timing: parseTiming(timingRaw) };
  return cached;
}
