/**
 * Chargeur des données : les quatre fichiers centraux d'emblée, un fichier par monde à la demande
 * [plan 00 « Données » ; GDD 03 §4]. Les valeurs vivent dans les JSON, jamais dans le code.
 */
import catalogueRaw from './catalogue.json';
import engineRaw from './engine.json';
import questionnaireRaw from './questionnaire.json';
import buildRaw from './build.json';
import { fnv1a32 } from '../shared/rng';
import { canonicalJson } from '../shared/canonical';
import { DataLoadError, assertContent, type DataStatus } from './schema/common';
import { parseCatalogue, type Catalogue } from './schema/catalogue';
import { parseEngine, type EngineConfig } from './schema/engine';
import { parseQuestionnaire, type Questionnaire } from './schema/questionnaire';
import { parseBuild, type BuildConfig } from './schema/build';
import type { CoreData } from './schema/core';
import { parseWorld, parseWorldAs, type WorldData } from './schema/world';
import type { ArrivalWorldId, WorldId } from '../shared/types';

export { DataLoadError, assertContent, parseCatalogue, parseEngine, parseQuestionnaire, parseWorld, parseBuild };
export type { DataStatus, Catalogue, EngineConfig, Questionnaire, WorldData, BuildConfig };
export type { CatalogueEntry } from './schema/catalogue';
export type { Condition, Coupling, ExtinctionRule } from './schema/engine';
export type { Question } from './schema/questionnaire';
export type { WorldEngine } from './schema/world';
export type { CoreData } from './schema/core';

/** Chargeur de fichiers de monde à la demande. */
export interface WorldLoader {
  load(id: ArrivalWorldId): Promise<WorldData>;
  available(): readonly ArrivalWorldId[];
}

/** Empreinte stable d'une donnée brute : `fnv1a32` sur le JSON canonique, 8 caractères hexadécimaux [GDD 03 §8]. */
export function contentHashOf(raw: unknown): string {
  return fnv1a32(canonicalJson(raw)).toString(16).padStart(8, '0');
}

const WORLD_KEY = /^\.\/worlds\/(w\d{2})\.json$/;

/**
 * Chargeur de mondes à importeurs injectés. Les clés sont celles de `import.meta.glob`
 * (`./worlds/w10.json`) ; chaque importeur rend le défaut du module, pas le module [plan 00 PHASE V M1].
 * Un échec d'importation devient `fetch`, un fichier invalide `schema`, `grid` ou `reference`.
 */
export function createWorldLoader(
  importers: Readonly<Record<string, () => Promise<unknown>>>,
  catalogue: Catalogue,
): WorldLoader {
  const byId = new Map<WorldId, { readonly key: string; readonly run: () => Promise<unknown> }>();
  for (const [key, run] of Object.entries(importers)) {
    const m = WORLD_KEY.exec(key);
    if (!m) throw new DataLoadError('reference', key.replace(/^\.\//, ''), '', 'clé d\'importeur hors de ./worlds/wNN.json');
    byId.set(m[1] as WorldId, { key, run });
  }
  const cache = new Map<WorldId, Promise<WorldData>>();

  const fetchWorld = async (id: WorldId): Promise<WorldData> => {
    const entry = byId.get(id);
    const file = entry ? entry.key.replace(/^\.\//, '') : `worlds/${id}.json`;
    if (!entry) throw new DataLoadError('reference', file, '', `aucun fichier de monde pour ${id}`);
    let raw: unknown;
    try {
      raw = await entry.run();
    } catch (e) {
      throw new DataLoadError('fetch', file, '', e instanceof Error ? e.message : String(e));
    }
    const world = parseWorldAs(raw, catalogue, file);
    if (world.id !== id) throw new DataLoadError('reference', file, 'id', `le fichier déclare ${world.id}, attendu ${id}`);
    return world;
  };

  return {
    load(id) {
      const hit = cache.get(id);
      if (hit) return hit;
      const p = fetchWorld(id);
      cache.set(id, p);
      p.catch(() => cache.delete(id)); // un échec ne se mémorise pas : on peut réessayer
      return p;
    },
    available() {
      return [...byId.keys()].filter((id) => catalogue.byId[id].kind === 'arrival') as ArrivalWorldId[];
    },
  };
}

/** Importeurs de production : un chunk par monde, défaut du module seulement [plan 00 PHASE V M1]. */
const worldImporters = import.meta.glob('./worlds/*.json', { import: 'default' }) as Readonly<Record<string, () => Promise<unknown>>>;

/** Chargeur de mondes de production, câblé sur `import.meta.glob` [plan 00 « Données »]. */
export function createProductionWorldLoader(catalogue: Catalogue): WorldLoader {
  return createWorldLoader(worldImporters, catalogue);
}

/** Charge et valide les quatre fichiers centraux [plan 00 « Données »]. */
export function loadCore(): CoreData {
  const catalogue = parseCatalogue(catalogueRaw);
  const worldFiles = Object.keys(worldImporters).flatMap((k) => {
    const m = WORLD_KEY.exec(k);
    return m ? [m[1] as WorldId] : [];
  });
  return {
    catalogue,
    engine: parseEngine(engineRaw),
    questionnaire: parseQuestionnaire(questionnaireRaw),
    build: parseBuild(buildRaw, catalogue, worldFiles),
    contentHash: contentHashOf(questionnaireRaw),
  };
}
