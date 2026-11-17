/** Mobilier maison : des boîtes, rien d'importé [plan 02a T6]. Dimensions en mètres, cosmétiques, jamais lues par le jeu. */
import type { Object3D } from 'three/webgpu';
import { group, part, type Kit } from './kit';

type V3 = readonly [number, number, number];

/** Lit : sommier et matelas. */
export function bed(k: Kit, parent: Object3D, name: string, at: V3): Object3D {
  const g = group(parent, name); g.position.set(...at);
  part(g, k.box, k.solid(k.d.build.palette.mid.v), `${name}.frame`, [1, 0.3, 2], [0, 0.15, 0]);
  part(g, k.box, k.solid(k.d.build.palette.haze.v), `${name}.mattress`, [0.95, 0.2, 1.9], [0, 0.4, 0]);
  return g;
}

/** Table et sa chaise. */
export function table(k: Kit, parent: Object3D, name: string, at: V3): Object3D {
  const g = group(parent, name); g.position.set(...at);
  part(g, k.box, k.solid(k.d.build.palette.mid.v), `${name}.top`, [1.2, 0.06, 0.7], [0, 0.75, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, k.box, k.solid(k.d.build.palette.mid.v), `${name}.leg.${sx}.${sz}`, [0.06, 0.72, 0.06], [sx * 0.55, 0.36, sz * 0.3]);
  part(g, k.box, k.solid(k.d.build.palette.mid.v), `${name}.chair`, [0.4, 0.45, 0.4], [0, 0.225, 0.7]);
  return g;
}

/** Étagère. */
export function shelf(k: Kit, parent: Object3D, name: string, at: V3): Object3D {
  const g = group(parent, name); g.position.set(...at);
  part(g, k.box, k.solid(k.d.build.palette.mid.v), name, [0.3, 1.8, 1.2], [0, 0.9, 0]);
  return g;
}

/** Bureau à guichet du Registre et poste de radio posé dessus. */
export function desk(k: Kit, parent: Object3D, name: string, at: V3): Object3D {
  const g = group(parent, name); g.position.set(...at);
  part(g, k.box, k.solid(k.d.build.palette.mid.v), `${name}.desk`, [0.8, 1.0, 2.4], [0, 0.5, 0]);
  part(g, k.box, k.solid(k.d.build.palette.haze.v), `${name}.radio`, [0.25, 0.2, 0.35], [0, 1.1, 0.6]);
  return g;
}
