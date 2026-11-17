// @vitest-environment happy-dom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot, handleStorageEvent } from '../../../src/main';
import { SAVE_KEY } from '../../../src/save/save';

const evt = (newValue: string | null, key: string | null = SAVE_KEY): StorageEvent => new StorageEvent('storage', { key, newValue });
const root = document.createElement('div');

beforeAll(async () => {
  // Node's optional global localStorage is not a browser Storage implementation.
  const values = new Map<string,string>();
  vi.stubGlobal('localStorage', {
    getItem: (key:string) => values.get(key) ?? null,
    setItem: (key:string,value:string) => { values.set(key,value); },
    removeItem: (key:string) => { values.delete(key); },
    clear: () => values.clear(), key: (index:number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
  await boot(root);
});
beforeEach(async () => { await boot(root); }); // écran neuf avant chaque test : le marqueur « périmé » ne fuit plus d'un test à l'autre
afterAll(()=>vi.unstubAllGlobals());

describe('storage event', () => {
  it('test_storage_event_older_or_other_key_is_ignored', () => {
    handleStorageEvent(evt(JSON.stringify({ rev: 0 })));
    handleStorageEvent(evt('x', 'autre'));
    expect(root.querySelector('[data-testid="stale-reload"]')).toBeNull();
  });

  it('test_storage_event_newer_rev_marks_stale_without_write', () => {
    const set = vi.spyOn(window.localStorage, 'setItem');
    handleStorageEvent(evt(JSON.stringify({ rev: 5 })));
    expect(root.querySelector('[data-testid="stale-reload"]')).not.toBeNull();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('storage event, unreadable or removed value', () => {
  it.each([[null], ['{pas du json']])('test_storage_event_unreadable_%s_marks_stale', async (v) => {
    await boot(root); // écran neuf
    expect(root.querySelector('[data-testid="stale-reload"]')).toBeNull();
    handleStorageEvent(evt(v));
    expect(root.querySelector('[data-testid="stale-reload"]')).not.toBeNull();
  });
});
