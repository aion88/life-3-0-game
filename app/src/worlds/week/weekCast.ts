import {AnimationMixer, Box3, Group, Mesh, type AnimationAction, type BufferGeometry, type Material, type Object3D, type Texture} from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone as cloneRig} from 'three/addons/utils/SkeletonUtils.js';
import {applyCastAppearance} from '../castAppearance';
import type {WeekCast} from './weekContracts';

/** Body (GLB suffix of `char.<body>.glb`) and wardrobe of one person of the week. */
export interface WeekCastEntry { readonly body: string; readonly appearance?: string }

/**
 * Distribution of the week. Maman and Papa wear PROVISIONAL borrowed bodies (plan section 6):
 * Maman is NOT `npc.marlene`, Marlène is another person in this week.
 */
export const WEEK_CAST: Readonly<Record<WeekCast, WeekCastEntry>> = {
  roux: {body: 'crowd_b', appearance: 'voisine'},
  theodore: {body: 'crowd_a', appearance: 'anselme'},
  nadia: {body: 'npc.nadia', appearance: 'nadia'},
  marlene: {body: 'npc.marlene', appearance: 'marlene'},
  bruno: {body: 'npc.bruno'},
  agente: {body: 'npc.berenice', appearance: 'agente'},
  maman: {body: 'npc.berenice', appearance: 'mireille'},
  papa: {body: 'crowd_c', appearance: 'hubert'},
};

/** Height, in metres, every person is normalised to (same volume as the player, 1.72 m). */
export const CAST_HEIGHT = 1.72;

/** URL of a body GLB. Example: `castBodyUrl('crowd_b')`. */
export function castBodyUrl(body: string): string {
  return `${import.meta.env.BASE_URL}worlds/w10/characters/char.${body}.glb`;
}

/** A person on stage: a normalised, animated clone of a cached body. */
export interface CastActor {
  readonly cast: WeekCast;
  readonly root: Group;
  /** `talk` clip while true, `idle` otherwise (idle when the clip is missing). */
  setTalking(talking: boolean): void;
  update(dt: number): void;
  /** Stops the mixer, detaches the clone and frees what is NOT shared with the cached body. */
  dispose(): void;
}

/**
 * Lazy loader: bodies are fetched on first `spawn`, cached for the loader's life, one clone per appearance.
 * Thread-safety: single-threaded, not reentrant across loaders.
 * @example
 * const loader = createCastLoader();
 * const roux = await loader.spawn('roux'); // loads only crowd_b
 * scene.add(roux!.root); loader.dispose();
 */
export interface CastLoader {
  spawn(cast: WeekCast): Promise<CastActor | null>;
  /** Bodies requested so far (test and diagnostics). */
  requestedBodies(): string[];
  /** Releases cached bodies, including those still loading. Later `spawn` calls resolve `null`. */
  dispose(): void;
}

interface Resources { geometries: Set<BufferGeometry>; materials: Set<Material>; textures: Set<Texture> }

function collect(root: Object3D): Resources {
  const r: Resources = {geometries: new Set(), materials: new Set(), textures: new Set()};
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    r.geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      r.materials.add(m);
      for (const v of Object.values(m)) if (v && typeof v === 'object' && 'isTexture' in v) r.textures.add(v as Texture);
    }
  });
  return r;
}

function release(r: Resources, except?: Resources): void {
  for (const g of r.geometries) if (!except?.geometries.has(g)) g.dispose();
  for (const m of r.materials) if (!except?.materials.has(m)) m.dispose();
  for (const t of r.textures) if (!except?.textures.has(t)) t.dispose();
}

/** @param loadGltf test seam; defaults to GLTFLoader with the meshopt decoder. */
export function createCastLoader(loadGltf?: (url: string) => Promise<GLTF>): CastLoader {
  let disposed = false;
  let defaultLoader: GLTFLoader | undefined;
  const load = loadGltf ?? ((url: string) => (defaultLoader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)).loadAsync(url));
  const cache = new Map<string, Promise<{gltf: GLTF; shared: Resources}>>();
  const live = new Set<CastActor>();

  const bodyOf = (body: string) => {
    let p = cache.get(body);
    if (!p) {
      p = load(castBodyUrl(body)).then(gltf => ({gltf, shared: collect(gltf.scene)}));
      cache.set(body, p);
      p.catch(() => { if (cache.get(body) === p) cache.delete(body); });
    }
    return p;
  };

  const spawn = async (cast: WeekCast): Promise<CastActor | null> => {
    if (disposed) return null;
    const entry = WEEK_CAST[cast];
    const {gltf, shared} = await bodyOf(entry.body);
    // The stage may have been disposed while the body loaded: build nothing, `dispose` frees the body.
    if (disposed) return null;
    const body = cloneRig(gltf.scene);
    if (entry.appearance) applyCastAppearance(body, {id: entry.appearance, body: entry.body});
    const bounds = new Box3().setFromObject(body);
    const height = bounds.max.y - bounds.min.y;
    if (Number.isFinite(height) && height > 0) {
      const scale = CAST_HEIGHT / height;
      body.scale.multiplyScalar(scale);
      body.position.y -= bounds.min.y * scale;
    }
    body.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    const root = new Group();
    root.name = `week.cast.${cast}`;
    root.add(body);
    const mixer = new AnimationMixer(body);
    const clips = new Map<string, AnimationAction>(gltf.animations.map(c => [c.name, mixer.clipAction(c)]));
    let current: AnimationAction | undefined;
    const play = (name: 'idle' | 'talk') => {
      const next = clips.get(name) ?? clips.get('idle');
      if (!next || next === current) return;
      current?.fadeOut(.2);
      next.reset().fadeIn(.2).play();
      current = next;
    };
    play('idle');
    const actor: CastActor = {
      cast, root,
      setTalking: talking => play(talking ? 'talk' : 'idle'),
      update: dt => mixer.update(dt),
      dispose: () => {
        if (!live.delete(actor)) return;
        mixer.stopAllAction();
        root.removeFromParent();
        release(collect(root), shared);
      },
    };
    live.add(actor);
    return actor;
  };

  return {
    spawn,
    requestedBodies: () => [...cache.keys()],
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const a of [...live]) a.dispose();
      // Also covers bodies still loading: the release runs when their promise settles.
      for (const p of cache.values()) void p.then(({gltf, shared}) => { gltf.scene.removeFromParent(); release(shared); }, () => undefined);
      cache.clear();
    },
  };
}
