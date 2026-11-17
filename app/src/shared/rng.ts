/** Générateurs déterministes : mulberry32 identique à la v1, FNV-1a, mélange d'entiers [GDD 03 §3.2, T-1c]. */

/**
 * Suite uint32 de mulberry32, corps de `A.makeRng` de la v1 (`js/worldstate.js`) sans la division finale.
 * Bit-exact avec la v1 sur 100 000 sorties par graine [GDD 03 T-1c].
 */
export function mulberry32Uint32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Mulberry32 dans [0, 1[ : la suite uint32 divisée par 2^32, comme `A.makeRng` [GDD 03 §3.2]. */
export function mulberry32(seed: number): () => number {
  const next = mulberry32Uint32(seed);
  return () => next() / 4294967296;
}

/**
 * FNV-1a 32 bits sur les unités de code UTF-16 (`charCodeAt`), sans `TextEncoder`.
 * Sur l'ASCII c'est le FNV-1a standard ; rend un uint32 [GDD 02 §4.7].
 */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/**
 * Replie des entiers en un uint32 (graine 0x9e3779b9, puis par entrée : xor `p | 0`, multiplication
 * 0x85ebca6b, xorshift 13, multiplication 0xc2b2ae35, xorshift 16 ; masque final `>>> 0`).
 * L'ordre des entrées compte [GDD 03 §3.2].
 */
export function mix32(...parts: readonly number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h = Math.imul(h ^ (p | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
