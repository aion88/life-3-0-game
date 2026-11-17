/**
 * Registre des ressources GPU de la scène de la rue [plan 02a T6]. Chaque géométrie, matériau, texture et maillage instancié créé
 * par un module de `scene/` passe par un `ResourceBag`, qui les libère tous à `dispose()`. Le compte global sert au test de fuite.
 */
import type { BufferGeometry, InstancedMesh, Material, Texture } from 'three/webgpu';

/** Ressources encore vivantes (créées et non libérées) par type. */
export interface LiveResources { readonly geometries: number; readonly materials: number; readonly textures: number; readonly instanced: number }

const live = { geometries: 0, materials: 0, textures: 0, instanced: 0 };

/** Compte global des ressources vivantes de toutes les scènes construites. */
export function liveResourceCount(): LiveResources {
  return { ...live };
}

type Kind = keyof LiveResources;

/** Propriétaire de ressources : tout ce qu'il a suivi est libéré par `disposeAll`, une seule fois. */
export class ResourceBag {
  private readonly items: { kind: Kind; free: () => void }[] = [];
  private freed = false;

  private track<T>(kind: Kind, r: T, free: () => void): T {
    live[kind]++;
    this.items.push({ kind, free });
    return r;
  }

  geometry<T extends BufferGeometry>(g: T): T { return this.track('geometries', g, () => g.dispose()); }
  material<T extends Material>(m: T): T { return this.track('materials', m, () => m.dispose()); }
  texture<T extends Texture>(t: T): T { return this.track('textures', t, () => t.dispose()); }
  /** Un maillage instancié libère son tampon de matrices ; sa géométrie et son matériau se suivent à part. */
  instanced<T extends InstancedMesh>(m: T): T { return this.track('instanced', m, () => m.dispose()); }

  /** Libère tout, une fois. Un second appel ne fait rien. */
  disposeAll(): void {
    if (this.freed) return;
    this.freed = true;
    for (const it of this.items) { it.free(); live[it.kind]--; }
    this.items.length = 0;
  }
}
