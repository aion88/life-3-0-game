/** Explicit new games must not resume an old ending for the same deterministic questionnaire seed. */
import type { StorageLike } from './save';
import { clearExploration } from '../worlds/exploration';

const PREFIXES = ['aftermath.journey.v1.', 'aftermath.episode.1984.v2.'] as const;
type EnumerableStorage = StorageLike & { readonly length: number; key(index: number): string | null };
function browserStorage(): StorageLike | null { try { return localStorage; } catch { return null; } }
/** Omit seed for a new game; pass a seed when a new questionnaire is committed. Never called on resume/exploration. */
export function clearShortProgress(storage: StorageLike | null = browserStorage(), seed?: number): void {
  clearExploration();
  try {
    const enumerable = storage as Partial<EnumerableStorage> | null;
    if (!enumerable || typeof enumerable.length !== 'number' || typeof enumerable.key !== 'function') return;
    const keys: string[] = [];
    for (let i = 0; i < enumerable.length; i++) {
      const key = enumerable.key(i);
      if (key && PREFIXES.some(prefix => key.startsWith(prefix)) && (seed === undefined || key.endsWith(`.${seed}`) || key.endsWith(`.${seed}.dinner`))) keys.push(key);
    }
    for (const key of keys) storage!.removeItem(key);
  } catch { /* A storage refusal must not prevent starting a fresh in-memory game. */ }
}
