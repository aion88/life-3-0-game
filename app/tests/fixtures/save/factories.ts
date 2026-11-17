import { SAVE_KEY, type StorageLike } from '../../../src/save/save';

/** Stockage en mémoire, sans DOM : la doublure de `localStorage` des tests de sauvegarde. */
export function memStorage(initial: Readonly<Record<string, string>> = {}): StorageLike {
  const m = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

/** Stockage qui contient déjà `raw` sous la clé de sauvegarde. */
export function withRaw(raw: string): StorageLike {
  return memStorage({ [SAVE_KEY]: raw });
}

/** Stockage dont la lecture lève (mode privé, `SecurityError`). */
export function throwingGet(name: string): StorageLike {
  return {
    getItem: () => { throw Object.assign(new Error(name), { name }); },
    setItem: () => undefined,
    removeItem: () => undefined,
  };
}

/** Stockage lisible dont l'écriture lève (quota plein). */
export function throwingSet(name: string): StorageLike {
  const inner = memStorage();
  return {
    getItem: (k) => inner.getItem(k),
    setItem: () => { throw Object.assign(new Error(name), { name }); },
    removeItem: (k) => { inner.removeItem(k); },
  };
}

/** JSON d'une sauvegarde valide (`v: 1`, `rev: 0`, `contentHash: 'h1'`) avec `patch` appliqué par-dessus. */
export function rawSave(patch: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    v: 1, rev: 0, contentHash: 'h1', lang: null, softened: null, phase: 'new', answers: {}, acts: [], ...patch,
  });
}
