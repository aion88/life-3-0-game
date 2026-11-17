import { describe, expect, it } from 'vitest';
import { contentHashOf, createWorldLoader } from '../../../src/data/load';
import { cat, w10Raw } from '../../fixtures/data/factories';

describe('data loader', () => {
  it('test_world_loader_maps_failures_to_typed_errors', async () => {
    const ok = createWorldLoader({ './worlds/w10.json': async () => w10Raw }, cat);
    await expect(ok.load('w10')).resolves.toMatchObject({ id: 'w10' });
    const down = createWorldLoader({ './worlds/w10.json': async () => { throw new TypeError('Failed to fetch dynamically imported module'); } }, cat);
    await expect(down.load('w10')).rejects.toMatchObject({ kind: 'fetch', file: 'worlds/w10.json' }); // file = clé d'importeur sans le './' initial
    const bad = createWorldLoader({ './worlds/w10.json': async () => ({ schema: 1 }) }, cat);
    await expect(bad.load('w10')).rejects.toMatchObject({ kind: 'schema' });
    expect(ok.available()).toEqual(['w10']);
    const asModule = createWorldLoader({ './worlds/w10.json': async () => ({ default: w10Raw }) }, cat);
    await expect(asModule.load('w10')).rejects.toMatchObject({ kind: 'schema' }); // un module n'est pas un monde : l'importeur doit rendre le défaut
  });
  it('test_content_hash_stable_across_key_order', () => {
    expect(contentHashOf({ a: 1, b: 2 })).toBe(contentHashOf({ b: 2, a: 1 }));
  });
});
