/**
 * Aide de test : rejoue le flux aléatoire de la v1 [GDD 03 T-1c ; plan 01 Task 12].
 * `next()` rend l'uint32 brut de `mulberry32Uint32`, le flux de `A.makeRng` de `js/worldstate.js` sans la division finale.
 * Aucun balayage d'événements ne s'en sert : le port n'en a pas [décision en tête de engine_v1_differential_test.ts].
 */
import { mulberry32Uint32 } from '../../src/shared/rng';

export class LegacyStreamDice {
  private readonly stream: () => number;

  constructor(seed: number) {
    this.stream = mulberry32Uint32(seed);
  }

  /** Tirage suivant, entier de 0 à 2^32 − 1. */
  next(): number {
    return this.stream();
  }
}
