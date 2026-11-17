/**
 * Petit atelier de construction partagé par les modules de la scène [plan 02a T6] : une boîte unité, un cylindre unité, une sphère
 * unité (mises à l'échelle par maillage, donc une seule géométrie chacune) et des matériaux mis en cache par couleur.
 */
import {
  BoxGeometry, Color, CylinderGeometry, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, SphereGeometry,
  Object3D, type BufferGeometry, type Material,
} from 'three/webgpu';
import { color, uniform } from 'three/tsl';
import type { SceneData } from '../../../engine/view/sceneSchema';
import { ResourceBag } from './resources';

/** Tout ce que les modules de la scène se partagent : donnée, registre, matériaux, listes exposées par la poignée. */
export interface Kit {
  readonly d: SceneData;
  readonly bag: ResourceBag;
  /** Gain de sodium dû à l'étalonnage : 0 tant qu'aucun gain n'est écrit (`grade.accent`). */
  readonly accent: { value: number };
  /** Sources émissives hors mur : le Coffre et les lampes [R-02a.14 b]. */
  readonly otherEmissives: Object3D[];
  readonly box: BufferGeometry;
  readonly cylinder: BufferGeometry;
  readonly sphere: BufferGeometry;
  solid(hex: string, roughness?: number): MeshStandardNodeMaterial;
  glow(hex: string, gain: number, sodium?: boolean): MeshBasicNodeMaterial;
}

/** Atelier neuf, ses ressources suivies par `bag`. */
export function createKit(d: SceneData, bag: ResourceBag): Kit {
  const box = bag.geometry(new BoxGeometry(1, 1, 1));
  const cylinder = bag.geometry(new CylinderGeometry(1, 1, 1, 10));
  const sphere = bag.geometry(new SphereGeometry(1, 12, 8));
  const accent = uniform(0);
  const mats = new Map<string, Material>();
  const cached = <M extends Material>(key: string, make: () => M): M => {
    let m = mats.get(key) as M | undefined;
    if (m === undefined) { m = bag.material(make()); mats.set(key, m); }
    return m;
  };
  return {
    d, bag, accent, otherEmissives: [], box, cylinder, sphere,
    solid: (hex, roughness = 0.85) => cached(`s${hex}${roughness}`, () => new MeshStandardNodeMaterial({ color: new Color(hex), roughness, metalness: 0 })),
    glow: (hex, gain, sodium = false) => cached(`g${hex}${gain}${sodium}`, () => {
      const c = new Color(hex).multiplyScalar(gain);
      const m = new MeshBasicNodeMaterial({ color: c });
      // le sodium suit le gain d'accent de l'étalonnage : 1 + accent, donc inchangé tant que le gain vaut 0
      if (sodium) m.colorNode = color(c).mul(accent.add(1));
      return m;
    }),
  };
}

/** Maillage mis à l'échelle sur une géométrie unité, posé à `pos` dans `parent`. */
export function part(parent: Object3D, geometry: BufferGeometry, material: Material, name: string, size: readonly [number, number, number], pos: readonly [number, number, number]): Mesh {
  const m = new Mesh(geometry, material);
  m.name = name;
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  parent.add(m);
  return m;
}

/** Groupe nommé à l'origine. */
export function group(parent: Object3D, name: string): Group {
  const g = new Group();
  g.name = name;
  parent.add(g);
  return g;
}

/** Une instance : position et échelle sur la boîte unité. */
export interface Inst { readonly p: readonly [number, number, number]; readonly s: readonly [number, number, number] }

/** Un maillage instancié de boîtes, nommé, ajouté à `parent` (rien si la liste est vide). */
export function instances(parent: Object3D, k: Kit, name: string, material: Material, list: readonly Inst[]): void {
  if (list.length === 0) return;
  const m = k.bag.instanced(new InstancedMesh(k.box, material, list.length));
  m.name = name;
  const dummy = new Object3D();
  list.forEach((it, i) => {
    dummy.position.set(it.p[0], it.p[1], it.p[2]);
    dummy.scale.set(it.s[0], it.s[1], it.s[2]);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
  parent.add(m);
}
