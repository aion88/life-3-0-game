/**
 * Chargement à la demande du monde de l'écran `street` [plan 02a T5].
 * Manifeste strict d'assets avec licences, deux paliers (`core` puis `deferred`), cache de reprise.
 * Pur fetch : ni Three.js ni DOM.
 */
import { DataLoadError } from '../../data/schema/common';

/** Budget d'octets par monde : hypothèse de l'art bible §C.8 (30 Mo en 60 s à 4 Mbit/s), à valider par technical-director. */
export const WORLD_BUDGET_BYTES = 30_000_000;

export type AssetLicense = 'CC0' | 'MIT' | 'own';
export type AssetTier = 'core' | 'deferred';

export interface AssetEntry {
  readonly id: string;
  readonly path: string;
  readonly bytes: number;
  readonly tier: AssetTier;
  readonly license: AssetLicense;
  readonly source: string;
  readonly verifiedOn: string | null;
  readonly caption?: 'placeholder';
}
export interface Manifest {
  readonly budgetBytes: number;
  readonly assets: readonly AssetEntry[];
}
export interface PayloadDeps {
  readonly fetch: typeof fetch;
  readonly onProgress?: (done: number, total: number) => void;
}
export type Payload = ReadonlyMap<string, ArrayBuffer>;

const MANIFEST_FILE = 'manifest.json';
const LICENSES: readonly string[] = ['CC0', 'MIT', 'own'];
const ASSET_KEYS = new Set(['id', 'path', 'bytes', 'tier', 'license', 'source', 'verifiedOn', 'caption']);

function refuse(path: string, message: string): never {
  throw new DataLoadError('schema', MANIFEST_FILE, path, message);
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function nonEmptyString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v === '') refuse(path, 'chaîne non vide attendue');
  return v;
}

/** Valide un manifeste brut. Lève `DataLoadError('schema')` avec le chemin fautif. */
export function parseManifest(raw: unknown): Manifest {
  if (!isRecord(raw)) refuse('', 'objet attendu');
  for (const k of Object.keys(raw)) if (k !== 'budgetBytes' && k !== 'assets') refuse(k, 'clé inconnue');
  const budgetBytes = raw['budgetBytes'];
  if (typeof budgetBytes !== 'number' || !Number.isInteger(budgetBytes) || budgetBytes < 0) refuse('budgetBytes', 'entier >= 0 attendu');
  if (budgetBytes > WORLD_BUDGET_BYTES) refuse('budgetBytes', `budget ${budgetBytes} au-dessus du plafond ${WORLD_BUDGET_BYTES}`);
  const list = raw['assets'];
  if (!Array.isArray(list)) refuse('assets', 'tableau attendu');

  const ids = new Set<string>();
  let total = 0;
  const assets = list.map((item: unknown, i): AssetEntry => {
    const at = (k: string): string => `assets.${i}.${k}`;
    if (!isRecord(item)) refuse(`assets.${i}`, 'objet attendu');
    for (const k of Object.keys(item)) if (!ASSET_KEYS.has(k)) refuse(at(k), 'clé inconnue');
    const id = nonEmptyString(item['id'], at('id'));
    if (ids.has(id)) refuse(at('id'), `id en double : ${id}`);
    ids.add(id);
    const path = nonEmptyString(item['path'], at('path'));
    const source = nonEmptyString(item['source'], at('source'));
    const bytes = item['bytes'];
    if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 0) refuse(at('bytes'), 'entier >= 0 attendu');
    const tier = item['tier'];
    if (tier !== 'core' && tier !== 'deferred') refuse(at('tier'), 'tier attendu : core | deferred');
    const license = item['license'];
    if (typeof license !== 'string' || !LICENSES.includes(license)) {
      refuse(at('license'), `license hors CC0 | MIT | own : ${String(license)}`);
    }
    const verifiedOn = item['verifiedOn'];
    if (verifiedOn !== null && (typeof verifiedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(verifiedOn))) {
      refuse(at('verifiedOn'), 'date AAAA-MM-JJ ou null attendue');
    }
    if (license !== 'own' && verifiedOn === null) refuse(at('verifiedOn'), `verifiedOn obligatoire pour une license ${license}`);
    if (tier === 'core' && /quaternius/i.test(source)) {
      refuse(at('source'), 'asset Quaternius interdit au palier core (quaternius : licence non tranchée)');
    }
    const caption = item['caption'];
    if (caption !== undefined && caption !== 'placeholder') refuse(at('caption'), "'placeholder' attendu");
    total += bytes;
    return {
      id,
      path,
      bytes,
      tier,
      license: license as AssetLicense,
      source,
      verifiedOn: verifiedOn as string | null,
      ...(caption === 'placeholder' ? { caption } : {}),
    };
  });
  if (total > budgetBytes) refuse('assets', `budget dépassé : ${total} octets pour ${budgetBytes}`);
  return { budgetBytes, assets };
}

const caches = new Map<string, Map<string, ArrayBuffer>>();
/** Cache de reprise propre à un monde, vivant pour la durée de la page : un retry le réutilise. */
export function payloadCache(worldId: string): Map<string, ArrayBuffer> {
  let c = caches.get(worldId);
  if (c === undefined) {
    c = new Map();
    caches.set(worldId, c);
  }
  return c;
}

async function fetchOne(a: AssetEntry, f: typeof fetch): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await f(a.path);
  } catch (e) {
    throw new DataLoadError('fetch', a.path, '', `réseau : ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new DataLoadError('fetch', a.path, '', `réponse ${res.status}`);
  try {
    return await res.arrayBuffer();
  } catch (e) {
    throw new DataLoadError('fetch', a.path, '', `lecture : ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Charge en deux paliers : `core` résout dès que tous ses fichiers sont arrivés (aucun `deferred` n'est
 * demandé avant), `all` résout quand `deferred` est arrivé aussi. Un échec rejette avec un `DataLoadError`
 * `fetch` nommant le fichier ; les fichiers frères déjà en vol finissent et restent dans le cache.
 */
export function loadWorldPayloadStaged(
  m: Manifest,
  deps: PayloadDeps,
  cache: Map<string, ArrayBuffer> = new Map(),
): { readonly core: Promise<Payload>; readonly all: Promise<Payload> } {
  const total = m.assets.reduce((n, a) => n + a.bytes, 0);
  let done = 0;
  const report = (): void => {
    if (total > 0) deps.onProgress?.(done, total);
  };
  const view = (assets: readonly AssetEntry[]): Payload => new Map(assets.map((a) => [a.id, cache.get(a.id) as ArrayBuffer]));

  const loadTier = async (tier: AssetTier): Promise<Payload> => {
    const assets = m.assets.filter((a) => a.tier === tier);
    const results = await Promise.allSettled(
      assets.map(async (a) => {
        if (cache.has(a.id)) return; // déjà compté au départ
        cache.set(a.id, await fetchOne(a, deps.fetch));
        done += a.bytes;
        report();
      }),
    );
    for (const r of results) if (r.status === 'rejected') throw r.reason;
    return view(assets);
  };

  // Les octets déjà en cache comptent comme reçus dès le départ.
  for (const a of m.assets) if (cache.has(a.id)) done += a.bytes;
  if (done > 0) report();

  const core = loadTier('core');
  const all = core.then(async (c) => new Map([...c, ...(await loadTier('deferred'))]) as Payload);
  // Évite un unhandledrejection quand l'appelant n'attend que `core` ; le rejet reste visible à qui attend.
  core.catch(() => undefined);
  all.catch(() => undefined);
  return { core, all };
}

/** Charge tout le monde (`core` puis `deferred`) et résout avec tous les buffers par id d'asset. */
export function loadWorldPayload(m: Manifest, deps: PayloadDeps, cache?: Map<string, ArrayBuffer>): Promise<Payload> {
  return loadWorldPayloadStaged(m, deps, cache).all;
}
