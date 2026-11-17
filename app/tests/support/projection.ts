/** Aides de test de la projection du bilan [R-01.3] : variantes par spread, hors du validateur ; aucune règle de jeu. */
import { loadCore } from '../../src/data/load';
import type { CoreData } from '../../src/data/schema/core';
import type { WorldData } from '../../src/data/schema/world';
import type { ExtinctionId, WorldVector } from '../../src/shared/types/world';

/** Le noyau sans aucun couplage (par spread : `parseEngine` impose `min(1)`). */
export function withoutCouplings(core: CoreData): CoreData {
  return { ...core, engine: { ...core.engine, couplings: [] } };
}

/** Le monde sans dérive. */
export function withoutDrift(w: WorldData): WorldData {
  return { ...w, engine: { ...w.engine, drift: {} } };
}

/** Le monde avec d'autres extinctions de projection. */
export function withProjectionExtinctions(w: WorldData, ids: readonly ExtinctionId[]): WorldData {
  return { ...w, engine: { ...w.engine, projectionExtinctions: ids } };
}

/** Le vecteur canonique du monde dans le catalogue. */
export function stableVectorOf(w: WorldData): WorldVector {
  const vec = loadCore().catalogue.byId[w.id].vector;
  if (vec === null) throw new Error(`pas de vecteur canonique pour ${w.id}`);
  return vec;
}
