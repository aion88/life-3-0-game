/**
 * Chargeur des données du fast-forward et des causes [plan 03 R-03.1, R-03.25 a] : `CoreData` ne porte ni les titres ni les causes,
 * `data/load.ts` ne les lit pas. Propriété du plan 03, hors couche pure : l'import JSON est ici et nulle part sous `src/fastforward`.
 */
import causesRaw from '../data/causes.json';
import headlinesRaw from '../data/headlines.json';
import { parseCauses, type CauseSet } from '../data/schema/causes';
import { parseHeadlines, type HeadlineSet } from '../data/schema/headlines';

export interface FastForwardData { readonly headlines: HeadlineSet; readonly causes: CauseSet }

let cache: FastForwardData | null = null;

/** Titres et causes validés (`DataLoadError` avec chemin sinon) ; lus une fois par session. */
export function loadFastForwardData(): FastForwardData {
  cache ??= { headlines: parseHeadlines(headlinesRaw), causes: parseCauses(causesRaw) };
  return cache;
}
