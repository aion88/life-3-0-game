/**
 * Coupe de l'immeuble 9 pour la caméra haute [spec rue guidée §4.5] : on annule (échelle 0) les instances de façade et de lampadaire qui
 * cachent le logement, on masque la porte de rue et les nacelles de l'étendue, et on allume les lampes de bureau des logements.
 * Les corps de façade des deux côtés sont rognés en z (il ne reste que le moignon au sud de l'étendue, voir `clipSpan`), les fenêtres des deux
 * côtés qui ne tiennent plus dans le moignon de leur corps et les mâts de l'ouest annulés : la caméra haute regarde par-dessus la façade est, qui cacherait tout le logement. Les matrices d'origine sont gardées telles quelles : fermer la coupe les remet à l'octet près.
 */
import { Matrix4, Quaternion, Vector3, type InstancedMesh, type Light, type Object3D } from 'three/webgpu';
import type { Kit } from './kit';

/** Maillages instanciés qui peuvent boucher la coupe : façades (corps et fenêtres) et lampadaires de la rue. */
const CUT_MESHES = ['facade.body', 'facade.windows.dark', 'facade.windows.lit', 'lamp.masts', 'lamp.arms', 'lamp.heads.body', 'lamp.heads'] as const;

/**
 * Indices des instances (façade et lampadaire) dont le centre est côté ouest (x < 0) et dans [z0, z1] (bornes comprises, ordre libre) ;
 * pur, testable sans GPU.
 */
export function cutawayInstances(centers: readonly { x: number; z: number }[], z0: number, z1: number): readonly number[] {
  const lo = Math.min(z0, z1), hi = Math.max(z0, z1);
  const out: number[] = [];
  centers.forEach((c, i) => { if (c.x < 0 && c.z >= lo && c.z <= hi) out.push(i); });
  return out;
}

/**
 * Part d'un intervalle [a, b] qui reste côté sud de la coupe (z < lo) : l'intervalle entier s'il est tout entier au sud, `null` s'il n'en
 * reste rien. La caméra regarde depuis le nord (z croissant) : le nord de l'étendue est ce qui la sépare du logement, il part avec la coupe,
 * le sud n'est qu'un moignon de façade derrière lui qui reste debout. Pur.
 */
export function clipSpan(a: number, b: number, lo: number, hi: number): readonly [number, number] | null {
  const l = Math.min(lo, hi), h = Math.max(lo, hi);
  if (b <= l) return [a, b];
  if (a >= h) return null;
  return a < l ? [a, l] : null;
}

/** Ce que la coupe pilote hors des instances : la porte de rue, les nacelles et les lampes de bureau (sources réelles). */
export interface CutawayTargets {
  readonly nacelles: ReadonlyMap<string, Object3D>;
  readonly lights: readonly Light[];
  /** Les ampoules émissives des lampes : visibles seulement coupe ouverte. */
  readonly bulbs: readonly Object3D[];
  readonly intensityCd: number;
}

/** La coupe de l'immeuble 9 : `set(true)` ouvre, `set(false)` referme et rend la rue telle qu'elle était. */
export interface Cutaway { set(on: boolean): void }

interface Cut { readonly mesh: InstancedMesh; readonly ids: readonly number[]; readonly saved: Float32Array; readonly clip: boolean }

/**
 * Prépare la coupe : à appeler après les façades et les lampadaires. Au palier `core` (sans lampes ni logement meublé), la façade est coupée
 * quand même : le premier plan du J1 ne cadre pas une façade fermée en attendant la charge différée [revue finale M-2].
 */
export function buildCutaway(root: Object3D, k: Kit, t: CutawayTargets): Cutaway {
  const flat = k.d.layout.places.logement;
  const z0 = flat.z.v, z1 = flat.zEnd!.v;
  const m = new Matrix4(), p = new Vector3(), q = new Quaternion(), s = new Vector3();
  const cuts: Cut[] = [];
  // corps touchés par l'étendue, par côté, avec le moignon qu'il en reste : source unique de la règle des corps ET des fenêtres
  const touched: { side: number; a: number; b: number; keep: readonly [number, number] | null }[] = [];
  const bodies = root.getObjectByName('facade.body') as InstancedMesh | undefined;
  for (let i = 0; bodies !== undefined && i < bodies.count; i++) {
    bodies.getMatrixAt(i, m); m.decompose(p, q, s);
    const a = p.z - s.z / 2, b = p.z + s.z / 2;
    if (b > Math.min(z0, z1) && a < Math.max(z0, z1)) touched.push({ side: Math.sign(p.x), a, b, keep: clipSpan(a, b, z0, z1) });
  }
  for (const name of CUT_MESHES) {
    const mesh = root.getObjectByName(name) as InstancedMesh | undefined;
    if (mesh === undefined) continue;
    const clip = name === 'facade.body';
    const ids: number[] = [];
    if (clip) {   // un corps de façade qui touche l'étendue est rogné : l'intervalle [z - L/2, z + L/2] recoupe [z0, z1]
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m); m.decompose(p, q, s);
        if (p.z + s.z / 2 > Math.min(z0, z1) && p.z - s.z / 2 < Math.max(z0, z1)) ids.push(i);
      }
    } else if (name.startsWith('facade.windows')) {   // fenêtre d'un corps touché : elle part si elle n'est pas toute dans le moignon qui reste
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m); m.decompose(p, q, s);
        const body = touched.find((b) => b.side === Math.sign(p.x) && p.z >= b.a && p.z <= b.b);
        if (body !== undefined && (body.keep === null || p.z + s.z / 2 > body.keep[1] + 1e-9)) ids.push(i);
      }
    } else {
      const centers = Array.from({ length: mesh.count }, (_, i) => { mesh.getMatrixAt(i, m); m.decompose(p, q, s); return { x: p.x, z: p.z }; });
      ids.push(...cutawayInstances(centers, z0, z1));
    }
    const saved = new Float32Array(ids.length * 16);
    ids.forEach((id, j) => { mesh.getMatrixAt(id, m); m.toArray(saved, j * 16); });
    if (ids.length > 0) cuts.push({ mesh, ids, saved, clip });
  }
  const door = root.getObjectByName('logement.door');
  const inRange = [...t.nacelles].filter(([id]) => { const z = Number(id.slice(1)); return z >= Math.min(z0, z1) && z <= Math.max(z0, z1); }).map(([, o]) => o);
  return {
    set(on) {
      for (const c of cuts) {
        c.ids.forEach((id, j) => {
          m.fromArray(c.saved, j * 16);
          if (on) {
            m.decompose(p, q, s);
            const keep = c.clip ? clipSpan(p.z - s.z / 2, p.z + s.z / 2, z0, z1) : null;
            if (keep === null) s.set(0, 0, 0);
            else { p.z = (keep[0] + keep[1]) / 2; s.z = keep[1] - keep[0]; }
            m.compose(p, q, s);
          }
          c.mesh.setMatrixAt(id, m);
        });
        c.mesh.instanceMatrix.needsUpdate = true;
      }
      if (door !== undefined) door.visible = !on;
      for (const n of inRange) n.visible = !on;
      for (const b of t.bulbs) b.visible = on;
      for (const l of t.lights) { l.visible = on; l.intensity = on ? t.intensityCd : 0; }
    },
  };
}
