import type { Milli } from '../milli';

/** Les six variables du monde [GDD 03 §3.1]. */
export type WorldVar = 'aiPower' | 'order' | 'abundance' | 'freedom' | 'surveillance' | 'unrest';

/** Les six variables, dans cet ordre, toujours [GDD 03 §3.1]. */
export const WORLD_VARS: readonly WorldVar[] = ['aiPower', 'order', 'abundance', 'freedom', 'surveillance', 'unrest'];

/** État du monde : chaque valeur dans 0..100 000 [GDD 03 §3.1]. */
export type WorldVector = Readonly<Record<WorldVar, Milli>>;

/** Variation signée et non bornée, sur une partie des variables [GDD 03 §4]. */
export type Delta = Readonly<Partial<Record<WorldVar, Milli>>>;

/** Poussée d'une réponse, ×1000 d'un entier [GDD 02 §3.2]. */
export type PushVector = Readonly<Record<WorldVar, Milli>>;

/** Identifiant d'un des douze mondes [GDD 03 §3.2]. */
export type WorldId =
  | 'w01' | 'w02' | 'w03' | 'w04' | 'w05' | 'w06' | 'w07' | 'w08' | 'w09' | 'w10' | 'w11' | 'w12';

/** Les deux mondes d'extinction [GDD 02 §3.5]. */
export type ExtinctionId = 'w07' | 'w12';

/** Les mondes où l'on arrive vivant [GDD 02 §3.5]. */
export type ArrivalWorldId = Exclude<WorldId, ExtinctionId>;

/** Stratégie de couplage : rue et projection séquentiel, fast-forward simultané [D123]. */
export type CouplingStrategy = 'sequential' | 'simultaneous';

/** Numéro d'un monde : 'w10' vers 10, départage D111. */
export function worldNumber(id: WorldId): number {
  return Number(id.slice(1));
}

/** Graine d'un monde : (numéro - 1) × 1000 [GDD 03 §3.2]. */
export function worldSeedOf(id: WorldId): number {
  return (worldNumber(id) - 1) * 1000;
}
