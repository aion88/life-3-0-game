/**
 * Chargeur des réglages communs du bilan [plan 03 T2, R-03.5]. Il vit hors de `src/bilan/**` : la couche pure n'importe jamais un JSON.
 * Les valeurs (dont `sigma100`) viennent de `bilan.json`, jamais du code.
 */
import bilanRaw from './bilan.json';
import { DataLoadError } from './schema/common';
import { bilanCommonSchema } from './schema/bilan';
import type { BilanCommon } from '../shared/types/bilan';
import type { WorldId } from '../shared/types';

let cached: BilanCommon | null = null;

/** Lit et valide `bilan.json` ; lève `DataLoadError('schema')` sur un fichier invalide. */
export function loadBilanCommon(): BilanCommon {
  if (cached) return cached;
  const r = bilanCommonSchema.safeParse(bilanRaw);
  if (!r.success) throw new DataLoadError('schema', 'bilan.json', r.error.issues[0]?.path.join('.') ?? '', r.error.issues[0]?.message ?? 'invalide');
  const d = r.data;
  cached = {
    total: d.total,
    counts: Object.entries(d.counts).map(([world, count]) => ({ world: world as WorldId, count })),
    contentPoints: d.contentPoints, noteKeys: d.noteKeys, sigma100: d.sigma100, sheetMaxLines: d.sheetMaxLines,
    others: d.others, traceback: d.traceback, rightsCount: d.rightsCount,
  };
  return cached;
}
