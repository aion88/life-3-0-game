/**
 * Jus du bracelet [spec C §4, I-4, I-5, I-9] : pures, sans DOM ni hasard. Le jus n'existe qu'après la confirmation d'une option qui coûte
 * des mots et n'est pas un refus ; un refus, un prix nul et le mouvement réduit descendent le nombre à plat.
 */
import type { PaletteToken } from '../../data/schema/ui';
import { loadUi } from '../../data/ui/load';

export interface JuicePlan { readonly coins: number; readonly shutter: boolean; readonly confetti: boolean }

const FLAT: JuicePlan = { coins: 0, shutter: false, confetti: false };

/** Le plan de fête d'une option confirmée. */
export function juiceFor(o: { readonly isRefusal: boolean; readonly words: number }, reduced: boolean, maxCoins: number): JuicePlan {
  if (o.isRefusal || o.words <= 0 || reduced) return FLAT;
  return { coins: Math.min(o.words, maxCoins), shutter: true, confetti: true };
}

/** Valeurs affichées après chaque pièce, la dernière vaut `to` : `from − round((i + 1) × (from − to) / coins)`. */
export function coinSteps(from: number, to: number, coins: number): readonly number[] {
  return Array.from({ length: Math.max(0, coins) }, (_, i) => from - Math.round(((i + 1) * (from - to)) / coins));
}

const CONFETTI_TOKENS: readonly PaletteToken[] = ['rose', 'ciel', 'soleil', 'menthe', 'lavande', 'creme'];
const GOLDEN = 0.6180339887498949;
const frac = (x: number): number => x - Math.floor(x);

/** Dispersion déterministe (suite de la section dorée) de `pieces` confettis ; grandeurs : `timing.motion.confetti.v.params`. */
export function confettiLayout(pieces: number): readonly { readonly dx: number; readonly dy: number; readonly token: PaletteToken; readonly rotDeg: number }[] {
  const p = loadUi().timing.motion.confetti.v.params;
  const spread = p['spreadPx'] ?? 0; const fall = p['fallPx'] ?? 0; const rise = p['riseMaxPx'] ?? 0; const rot = p['rotMaxDeg'] ?? 0;
  return Array.from({ length: pieces }, (_, i) => {
    const a = frac((i + 1) * GOLDEN); const b = frac((i + 1) * GOLDEN * GOLDEN * 7); const c = frac((i + 1) * 0.7548776662466927);
    return {
      dx: Math.round((a * 2 - 1) * spread),
      dy: Math.round(fall * (0.35 + 0.65 * b) - rise * (1 - b) * c),
      token: CONFETTI_TOKENS[i % CONFETTI_TOKENS.length]!,
      rotDeg: Math.round((c * 2 - 1) * rot),
    };
  });
}
