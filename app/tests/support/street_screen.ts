/**
 * Aides des tests de l'écran `street` [plan 02a T12, R-02a.20] : un fichier, un écrivain. Rien sous `src/` ne l'importe.
 * Tout passe par la couture `deps` : aucun GPU, aucun réseau, aucune horloge murale.
 */
import { vi } from 'vitest';
import { loadCore, createProductionWorldLoader } from '../../src/data/load';
import { createSaveStore, type SaveStore, type StorageLike } from '../../src/save/save';
import { isValidAct } from '../../src/shared/acts';
import { knownActKinds } from '../../src/engine/moments/verbs';
import type { ActRecord, DayIndex } from '../../src/shared/types/street';
import type { GuidedData } from '../../src/data/schema/guided';
import type { RunResult } from '../../src/shared/types';
import type { AppContext, ScreenPayloads } from '../../src/app/shell';
import type { RenderBackend } from '../../src/street/render/backend';
import type { FrameLoop, RenderPost } from '../../src/street/runtime';
import type { StreetScreenDeps } from '../../src/street/screen';
import { createMannequinProvider } from '../../src/street/render/characters/mannequin';
import { realI18n } from './street_ui';
import { runLivingIn } from './week';
import { CLIP_NAMES } from '../../src/engine/view/glb';
import { PLAYER_BODY_ID } from '../../src/engine/view/crowd';
import type { Manifest } from '../../src/street/load/worldPayload';
import { SCENE } from './street_walk';

/** Corps exigés (même liste que `street_crowd.ts`, qui lit le disque par `import.meta.url` et ne tourne pas sous happy-dom). */
export const REQUIRED_BODIES: string[] = [
  PLAYER_BODY_ID,
  ...Object.values(SCENE.npcPlaces).filter((p) => p.kind === 'person').map((p) => p.bodyId),
  SCENE.characters.crowdBodies.v[0] as string,
];

function validGlb(): ArrayBuffer {
  const bones = ['hips', 'spine', 'head'];
  const json = {
    asset: { version: '2.0' }, nodes: bones.map((name) => ({ name })), skins: [{ joints: bones.map((_, i) => i) }],
    animations: CLIP_NAMES.map((name) => ({ name, channels: [], samplers: [] })),
    accessors: [{ count: 30, componentType: 5123, type: 'SCALAR' }], meshes: [{ primitives: [{ indices: 0, attributes: {}, mode: 4 }] }],
  };
  const raw = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(raw.length / 4) * 4).fill(0x20);
  padded.set(raw);
  const buf = new ArrayBuffer(20 + padded.length);
  const v = new DataView(buf);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, buf.byteLength, true);
  v.setUint32(12, padded.length, true); v.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buf, 20).set(padded);
  return buf;
}
/** Manifeste synthétique : un corps `own` par corps exigé, palier `core`. */
export function syntheticManifest(): Manifest {
  return {
    budgetBytes: 30_000_000,
    assets: REQUIRED_BODIES.map((id) => ({ id: `char.${id}`, path: `/worlds/w10/characters/char.${id}.glb`, bytes: 1, tier: 'core' as const, license: 'own' as const, source: 'MPFB synthétique', verifiedOn: null })),
  };
}
export function syntheticAssets(): ReadonlyMap<string, ArrayBuffer> {
  return new Map(REQUIRED_BODIES.map((id) => [`char.${id}`, validGlb()]));
}

const core = loadCore();

/** Stockage en mémoire : ce que la sauvegarde écrit s'y lit. */
export function memStorage(initial: Record<string, string> = {}): StorageLike & { readonly data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  } as StorageLike & { readonly data: Record<string, string> };
}

/** Sauvegarde réelle (mêmes arguments que `main.ts`) portant déjà `acts`. */
export function saveWith(acts: readonly ActRecord[] = []): { readonly save: SaveStore; readonly storage: ReturnType<typeof memStorage> } {
  const storage = memStorage();
  const save = createSaveStore(storage, core.contentHash, () => true, { isValidAct, known: knownActKinds() });
  if (acts.length > 0) for (const a of acts) save.appendAct(a);
  return { save, storage };
}

export interface FakeApp {
  readonly ctx: AppContext;
  readonly run: RunResult;
  readonly payload: ScreenPayloads['street'];
  readonly navigate: ReturnType<typeof vi.fn>;
  readonly save: SaveStore;
  readonly storage: ReturnType<typeof memStorage>;
}

/**
 * Contexte d'application : vraie langue, vraies données, vrai chargeur de mondes, navigation espionnée.
 * `guided` faux (défaut) : le monde est servi SANS `street.guided`, l'écran monte la marche libre (`runtime.ts`), que ces suites éprouvent ;
 * vrai : le monde réel, l'écran monte la rue guidée [rue guidée T14].
 */
/**
 * `guided` : le monde garde ses journées guidées (sinon `guided: null`). `demoAfter` : leur `endOfDemo` vaut `{ afterDay: demoAfter }`
 * (clés `w10.demo.*`), la fin de démo d'un monde partiel, pour les cas qui la jouaient sur w10 avant `endOfDemo: null` [J3-J7 T13].
 */
export function fakeApp(acts: readonly ActRecord[] = [], opts: { readonly guided?: boolean; readonly demoAfter?: DayIndex } = {}): FakeApp {
  // These fixtures intentionally exercise the historical week/free street, not the canonical short game.
  if (typeof history !== 'undefined') history.replaceState(null, '', '?episode=semaine');
  const { save, storage } = saveWith(acts);
  const navigate = vi.fn(() => Promise.resolve());
  const run = runLivingIn('w10');
  const real = createProductionWorldLoader(core.catalogue);
  const demo = (g: GuidedData | null): GuidedData | null => (g === null || opts.demoAfter === undefined ? g
    : { ...g, endOfDemo: { afterDay: opts.demoAfter, titleKey: 'w10.demo.title', lineKey: 'w10.demo.line' } });
  const worlds = { ...real, load: async (id: Parameters<typeof real.load>[0]) => { const w = await real.load(id); return { ...w, street: { ...w.street, guided: opts.guided === true ? demo(w.street.guided) : null } }; } };
  const ctx = { i18n: realI18n('fr'), save, core, worlds, navigate } as unknown as AppContext;
  return { ctx, run, payload: { run }, navigate, save, storage };
}

/** Boucle d'images manuelle : `step(ms)` rejoue les rappels en attente avec un temps qui avance de `ms`. */
export interface ManualFrames extends FrameLoop {
  step(ms: number): void;
  pending(): number;
}
export function manualFrames(): ManualFrames {
  let id = 0;
  let now = 0;
  const q = new Map<number, (t: number) => void>();
  return {
    request(cb) { q.set(++id, cb); return id; },
    cancel(h) { q.delete(h); },
    pending: () => q.size,
    step(ms) {
      now += ms;
      const run = [...q.entries()];
      q.clear();
      for (const [, cb] of run) cb(now);
    },
  };
}

/** Un rendu factice : compte ce qu'on lui demande, ne dessine rien. */
export interface FakePost extends RenderPost {
  readonly renders: () => number;
  readonly disposed: () => number;
}
export function fakePost(): FakePost {
  let renders = 0;
  let disposed = 0;
  return {
    setGrade: vi.fn(), setFocus: vi.fn(), setDof: vi.fn(), setAspect: vi.fn(), setTime: vi.fn(),
    render: () => { renders++; },
    dispose: () => { disposed++; },
    renders: () => renders,
    disposed: () => disposed,
  };
}

/** Un backend factice (aucun GPU) : un canevas hors écran et un moteur qui sait seulement se dimensionner et se libérer. */
export function fakeBackend(): { readonly make: StreetScreenDeps['backend']; readonly disposed: () => number } {
  let disposed = 0;
  return {
    disposed: () => disposed,
    make: (host: HTMLElement) => {
      const canvas = host.ownerDocument.createElement('canvas');
      host.appendChild(canvas);
      const renderer = { domElement: canvas, setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: () => { disposed++; canvas.remove(); } };
      return Promise.resolve({ renderer, kind: 'webgl2' } as unknown as RenderBackend);
    },
  };
}

/** Réseau factice : sert le manifeste et un corps synthétique valide par fichier ; `calls` journalise les chemins demandés. */
export function fakeFetch(opts: { readonly failOnce?: (path: string) => boolean; readonly calls?: string[] } = {}): typeof fetch {
  const manifest = syntheticManifest();
  const byPath = new Map(manifest.assets.map((a) => [a.path, a.id]));
  const files = syntheticAssets();
  const failed = new Set<string>();
  return ((input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    const path = url.replace(/^\/+/, '');
    opts.calls?.push(path);
    if (url.endsWith('manifest.json')) return Promise.resolve(new Response(JSON.stringify(manifest), { status: 200 }));
    if (opts.failOnce?.(path) === true && !failed.has(path)) { failed.add(path); return Promise.resolve(new Response('', { status: 500 })); }
    const id = [...byPath].find(([p]) => p === path || `/${p}` === url || url.endsWith(p))?.[1];
    const buf = id === undefined ? undefined : files.get(id);
    return Promise.resolve(buf === undefined ? new Response('', { status: 404 }) : new Response(buf.slice(0), { status: 200 }));
  }) as typeof fetch;
}

/** Les dépendances d'essai par défaut : tout est factice sauf la sauvegarde et les données. */
export function testDeps(over: Partial<StreetScreenDeps> = {}): StreetScreenDeps & { readonly frames: ManualFrames; readonly post: StreetScreenDeps['post'] } {
  const frames = manualFrames();
  const post = fakePost();
  const backend = fakeBackend();
  return {
    fetch: fakeFetch(),
    backend: backend.make,
    post: () => post,
    characters: () => createMannequinProvider(),
    frames,
    loadRuntime: () => import('../../src/street/runtime'),
    loadGuided: () => import('../../src/street/guidedRuntime'),
    ...over,
  } as StreetScreenDeps & { readonly frames: ManualFrames; readonly post: StreetScreenDeps['post'] };
}

