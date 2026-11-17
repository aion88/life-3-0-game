// Aides de test du chargement du monde (plan 02a T5, R-02a.2). Rien sous src/ ne les importe.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AssetEntry, Manifest } from '../../src/street/load/worldPayload';

const publicDir = fileURLToPath(new URL('../../public/worlds/w10/', import.meta.url));

/** Le manifeste w10 tel qu'il est servi, non parsé. */
export const w10Manifest: unknown = JSON.parse(readFileSync(`${publicDir}manifest.json`, 'utf8'));
/** Le texte de LICENSES.txt tel qu'il est servi. */
export const licensesTxt: string = readFileSync(`${publicDir}LICENSES.txt`, 'utf8');

const baseAsset = {
  id: 'a1',
  path: '/worlds/w10/a1.bin',
  bytes: 10,
  tier: 'core',
  license: 'own',
  source: 'studio',
  verifiedOn: null,
};

/** Manifeste brut à un seul asset, `over` écrase les champs de l'asset. */
export function withAsset(over: Record<string, unknown>, budgetBytes = 30_000_000): unknown {
  return { budgetBytes, assets: [{ ...baseAsset, ...over }] };
}

/** Manifeste brut dont les `bytes` sont donnés, un asset `own` par entrée. */
export function withBytes(budgetBytes: number, ...bytes: number[]): unknown {
  return { budgetBytes, assets: bytes.map((b, i) => ({ ...baseAsset, id: `b${i}`, path: `/p/b${i}`, bytes: b })) };
}

function asset(id: string, tier: 'core' | 'deferred', bytes: number): AssetEntry {
  return { id, path: `/p/${id}`, tier, bytes, license: 'own', source: 'studio', verifiedOn: null };
}
/** Manifeste parsé à deux assets `core` (c1, c2) et deux `deferred` (d1, d2). */
export function stagedManifest(): Manifest {
  return {
    budgetBytes: 1000,
    assets: [asset('c1', 'core', 10), asset('c2', 'core', 20), asset('d1', 'deferred', 30), asset('d2', 'deferred', 40)],
  };
}

const idOf = (url: string): string => url.split('/').pop() ?? url;
const body = (id: string): Response => new Response(new Uint8Array(id.length).buffer);

/** fetch qui répond toujours et note `start:<id>` à l'appel puis `end:<id>` une fois le corps rendu. */
export function spyFetch(order: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const id = idOf(String(input));
    order.push(`start:${id}`);
    await new Promise((r) => setTimeout(r, id.startsWith('c') ? 10 : 1));
    order.push(`end:${id}`);
    return body(id);
  }) as typeof fetch;
}
export const okFetch: typeof fetch = (async (input: RequestInfo | URL) => body(idOf(String(input)))) as typeof fetch;
/** fetch qui refuse l'asset `bad` (réponse 500) et sert les autres. */
export function failing(bad: string): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const id = idOf(String(input));
    return id === bad ? new Response('no', { status: 500 }) : body(id);
  }) as typeof fetch;
}
/** fetch qui échoue une seule fois sur `bad` (coupure réseau), puis réussit. */
export function flaky(calls: string[], bad: string): typeof fetch {
  let tripped = false;
  return (async (input: RequestInfo | URL) => {
    const id = idOf(String(input));
    calls.push(id);
    if (id === bad && !tripped) {
      tripped = true;
      throw new TypeError('network down');
    }
    return body(id);
  }) as typeof fetch;
}
