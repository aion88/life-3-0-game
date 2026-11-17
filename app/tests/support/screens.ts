/**
 * Aides des tests des écrans et de l'interface [plan 03 T1, R-03.21] : seulement ce qui manquait.
 * `fakeApp`, `saveWith`, `pseudoI18n`, `realI18n`, `visibleTexts` existent déjà (`street_screen.ts`, `street_ui.ts`) et s'importent d'eux.
 * Rien sous `src/` n'importe ce fichier. Les tests qui l'utilisent posent `// @vitest-environment happy-dom` en tête [D25].
 * `answerLine` existe déjà sous le nom `ans` (`answers.ts`), `bilanInputOf` revient à T11/T12 qui connaissent la forme voulue.
 */
import { vi } from 'vitest';
import type { AppContext, Screen, ScreenFactory, ScreenId, ScreenPayloads } from '../../src/app/shell';
import { loadCore } from '../../src/data/load';
import { createSaveStore } from '../../src/save/save';
import { memStorage } from './street_screen';
import { realI18n } from './street_ui';

/** Monte une fabrique d'écran dans une racine neuve rattachée au document et rend l'écran, la racine et l'espion de navigation. */
export async function mountScreen<K extends ScreenId>(
  factory: ScreenFactory<K>,
  ctx: AppContext,
  payload: ScreenPayloads[K],
): Promise<{ readonly screen: Screen; readonly root: HTMLElement }> {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const screen = factory(ctx, payload);
  await screen.mount(root);
  return { screen, root };
}

/** Contexte d'application léger : vraies données et vraie langue, sauvegarde en mémoire, navigation espionnée, aucun monde chargeable. */
export function fakeCtx(over: Partial<AppContext> = {}): AppContext & { readonly navigate: ReturnType<typeof vi.fn> } {
  const core = loadCore();
  const navigate = vi.fn(() => Promise.resolve());
  return {
    i18n: realI18n('fr'),
    save: createSaveStore(memStorage(), core.contentHash, () => true),
    core,
    worlds: { load: () => Promise.reject(new Error('inutilisé')), available: () => [] },
    ...over,
    navigate,
  } as AppContext & { readonly navigate: ReturnType<typeof vi.fn> };
}

/** Faux contexte 2D enregistreur : chaque appel et chaque affectation de propriété devient une ligne de texte, dans l'ordre. */
export interface Recorder2d {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Copie des lignes enregistrées depuis le dernier `reset`. */
  calls(): readonly string[];
  reset(): void;
}

const fmt = (v: unknown): string => {
  if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
  if (typeof v === 'string') return JSON.stringify(v);
  return typeof v === 'object' && v !== null ? '[objet]' : String(v);
};

/** Canvas de happy-dom (qui n'a pas de rendu) dont `getContext('2d')` rend l'enregistreur, avec une taille d'affichage fixée. */
export function fakeCanvas2d(size: { readonly clientWidth?: number; readonly clientHeight?: number } = {}): Recorder2d {
  const log: string[] = [];
  const store: Record<string, unknown> = {};
  const canvas = document.createElement('canvas');
  const target = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (prop in store) return store[prop];
      if (prop === 'canvas') return canvas;
      return (...args: unknown[]): unknown => {
        log.push(`${prop}(${args.map(fmt).join(',')})`);
        if (prop.startsWith('create') && prop.endsWith('Gradient')) return { addColorStop: (...a: unknown[]) => { log.push(`stop(${a.map(fmt).join(',')})`); } };
        return undefined;
      };
    },
    set(_t, prop: string, value: unknown) { store[prop] = value; log.push(`${prop}=${fmt(value)}`); return true; },
  });
  const ctx = target as unknown as CanvasRenderingContext2D;
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: size.clientWidth ?? 1440 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: size.clientHeight ?? 900 });
  (canvas as unknown as { getContext: () => CanvasRenderingContext2D }).getContext = () => ctx;
  return { canvas, ctx, calls: () => [...log], reset: () => { log.length = 0; } };
}
