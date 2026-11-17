/**
 * Aides de test de la scène de la rue [plan 02a T6, R-02a.14 f]. Un fichier, un écrivain : T6.
 * Les comptes se font sur la structure construite, sans GPU : on parcourt l'arbre, on ne mesure rien d'autre.
 */
import { InstancedMesh, Material, Mesh, type BufferGeometry, type Object3D, type Texture } from 'three/webgpu';
import { liveResourceCount, type LiveResources } from '../../src/street/render/scene/resources';
import type { DistrictHandle } from '../../src/street/render/scene';

/** Aucun asset externe : la rue est procédurale. */
export const noAssets: ReadonlyMap<string, ArrayBuffer> = new Map();

/** Compte les appels de rendu et les triangles de ce qui est VISIBLE sous `root`. Un matériau en tableau coûte un appel par groupe. */
export function describeScene(d: DistrictHandle): { drawCalls: number; triangles: number; wallCounterText: string } {
  let drawCalls = 0;
  let triangles = 0;
  let wallCounterText = '';
  const visible = (o: Object3D): boolean => {
    for (let p: Object3D | null = o; p !== null; p = p.parent) if (!p.visible) return false;
    return true;
  };
  d.root.traverse((o) => {
    if (o.name === 'wallCounter') wallCounterText = String(o.userData['text'] ?? '');
    if (!(o instanceof Mesh) || !visible(o)) return;
    const g = o.geometry as BufferGeometry;
    const per = (g.index ?? g.getAttribute('position')).count / 3;
    const copies = o instanceof InstancedMesh ? o.count : 1;
    const calls = Array.isArray(o.material) ? Math.max(1, g.groups.length) : 1;
    drawCalls += calls;
    triangles += per * copies;
  });
  return { drawCalls, triangles, wallCounterText };
}

/** Ressources GPU vivantes créées par la scène (géométries, matériaux, textures, maillages instanciés). */
export function liveResources(): LiveResources {
  return liveResourceCount();
}

/** Toutes les ressources atteignables depuis `root`, trouvées indépendamment du registre de la scène. */
export function reachableResources(root: Object3D): { geometries: Set<BufferGeometry>; materials: Set<Material>; textures: Set<Texture> } {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    geometries.add(o.geometry as BufferGeometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m as Material);
      for (const v of Object.values(m)) if (v !== null && typeof v === 'object' && (v as Texture).isTexture === true) textures.add(v as Texture);
    }
  });
  return { geometries, materials, textures };
}
