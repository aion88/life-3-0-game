import { fnv1a32, mix32, mulberry32 } from './rng';

/** Domaine d'un tirage ; `street` sert aux tirages de rue fixés par jour [GDD 03 §3.2 ; bible w10 §7.4]. */
export type DiceDomain = 'world' | 'event' | 'line' | 'street';

/** Dé : une valeur dans [0, 1[ ; l'interface ne promet pas l'absence d'état [PHASE V m5 ; GDD 03 §3.2]. */
export interface Dice {
  roll(domain: DiceDomain, day: number, hour: number, key: string): number;
}

const TAG: Readonly<Record<DiceDomain, number>> = { world: 1, event: 2, line: 3, street: 4 };
const KEY = /^[A-Za-z0-9._-]+$/;

/**
 * Dé pur, sans état : le tirage ne dépend que de (graine, domaine, jour, heure, clé), jamais de l'ordre
 * des appels. Refuse une clé hors de `[A-Za-z0-9._-]`. Pour `street`, `hour` est l'heure d'ancrage de la bible
 * [GDD 03 §3.2, T-1d ; bible w10 §7.4].
 */
export function createDice(worldSeed: number): Dice {
  return {
    roll(domain, day, hour, key) {
      if (!KEY.test(key)) throw new Error(`clé de dé invalide (ASCII [A-Za-z0-9._-] requis) : ${key}`);
      return mulberry32(mix32(worldSeed, TAG[domain], day, hour, fnv1a32(key)))();
    },
  };
}
