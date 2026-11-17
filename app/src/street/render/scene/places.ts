/**
 * Lieux de la rue et volumes de clic [plan 02a T6 ; bible w10 §5.0]. Chaque lieu de la table « lieux par z » existe comme un groupe
 * nommé `place.<clé>` qui porte son accessoire visible ; chaque objet cliquable a un volume de clic invisible `hit.<id>`, posé à la
 * position de `interactions` (les personnes, `npc` et `passerby`, sont rendues par la foule et n'ont pas de volume ici) [R-02a.14 a].
 */
import { Mesh, MeshBasicNodeMaterial, type Object3D } from 'three/webgpu';
import { group, part, type Kit } from './kit';

type V3 = readonly [number, number, number];

/** Le volume de clic d'un objet : une boîte invisible, ancrée au sol, au `x` et `z` donnés. Le Raycaster ignore la visibilité. */
function hit(k: Kit, parent: Object3D, hitMat: MeshBasicNodeMaterial, id: string, x: number, z: number, size: V3): Mesh {
  const m = new Mesh(k.box, hitMat);
  m.name = `hit.${id}`;
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(x, size[1] / 2, z);
  m.visible = false;
  parent.add(m);
  return m;
}

/** Résultat : groupes des lieux, volumes de clic. */
export interface PlacesBuild { readonly places: Map<string, Object3D>; readonly hits: Map<string, Object3D> }

/** Construit les dix lieux de `layout.places` (le portail et la façade du Coffre sont posés par `coffre.ts` et passés en `known`). */
export function buildPlaces(root: Object3D, k: Kit, known: ReadonlyMap<string, Object3D>): PlacesBuild {
  const { build, layout, interactions: at } = k.d;
  const pal = build.palette;
  const places = new Map<string, Object3D>(known);
  const hits = new Map<string, Object3D>();
  const hitMat = k.bag.material(new MeshBasicNodeMaterial());
  hitMat.name = 'hit';
  const hw = build.hitWidthM.v, hh = build.hitHeightM.v;
  const half = layout.halfWidthM.v;
  const mid = k.solid(pal.mid.v, 0.7);
  const steel = k.solid(pal.shadow.v, 0.4);
  const mk = (key: string): Object3D => { const g = group(root, `place.${key}`); places.set(key, g); return g; };
  const pos = (id: string): { x: number; z: number } => at[id]!.at.v;
  const addHit = (id: string, parent: Object3D, size: V3 = [hw, hh, hw]): void => {
    const p = pos(id);
    hits.set(id, hit(k, parent, hitMat, id, p.x, p.z, size));
  };

  // Logement (9-C) : porte sur la façade ouest, fenêtre du 9-C visée par le clic.
  const logement = mk('logement');
  const lz = (layout.places.logement.z.v + layout.places.logement.zEnd!.v) / 2;
  part(logement, k.box, steel, 'logement.door', [0.2, 2.2, 1.2], [-(half - 0.1), 1.1, lz + 3]);
  addHit('window9c', logement);

  // Banc de Théodore.
  const banc = mk('banc');
  const b = pos('bench');
  part(banc, k.box, mid, 'banc.seat', [0.6, 0.45, 1.8], [b.x, 0.225, b.z]);
  part(banc, k.box, mid, 'banc.back', [0.12, 0.5, 1.8], [b.x - 0.3, 0.7, b.z]);
  addHit('bench', banc, [1, 1, 2]);

  // Biens agréés : devanture éclairée sur la façade est.
  const biens = mk('biensAgrees');
  const bz = (layout.places.biensAgrees.z.v + layout.places.biensAgrees.zEnd!.v) / 2;
  const shop = part(biens, k.box, k.glow(pal.interior.v, build.litWindowGain.v, true), 'biens.window', [0.05, 1.6, 5], [half - 0.05, 1.5, bz]);
  k.otherEmissives.push(shop);

  // Pylône : mât sombre sur l'axe côté est.
  const pylone = mk('pylone');
  const py = pos('pylon');
  part(pylone, k.box, steel, 'pylone.mast', [0.6, 6, 0.6], [py.x, 3, py.z]);
  addHit('pylon', pylone, [1.2, 6, 1.2]);

  // Cabine de scan : volume fermé, bandeau LED froid.
  const cabine = mk('cabine');
  const sc = pos('scanBooth');
  part(cabine, k.box, mid, 'cabine.body', [1.6, 2.6, 1.6], [sc.x, 1.3, sc.z]);
  k.otherEmissives.push(part(cabine, k.box, k.glow(pal.led.v, build.ledGain.v), 'cabine.led', [1.62, 0.12, 1.62], [sc.x, 2.5, sc.z]));
  addHit('scanBooth', cabine, [1.8, 2.6, 1.8]);

  // Étal de Nadia : comptoir et auvent.
  const etal = mk('etal');
  const st = pos('stall');
  part(etal, k.box, mid, 'etal.counter', [1.2, 1, 2.2], [st.x, 0.5, st.z]);
  part(etal, k.box, k.solid(pal.haze.v, 0.9), 'etal.awning', [1.6, 0.1, 2.6], [st.x, 2.4, st.z]);
  addHit('stall', etal, [1.6, 2.4, 2.6]);

  // Voiture grise : cache entier, le pilote la masque quand elle n'est pas là (`setVisible`).
  const car = mk('voitureGrise');
  const gc = pos('greyCar');
  const grey = k.solid(pal.haze.v, 0.4);
  part(car, k.box, grey, 'voiture.body', [1.8, 0.8, 4.2], [gc.x, 0.7, gc.z]);
  part(car, k.box, grey, 'voiture.cabin', [1.6, 0.6, 2.2], [gc.x, 1.4, gc.z]);
  addHit('greyCar', car, [1.9, 1.7, 4.3]);

  // Registre : guichet vitré à l'ouest, radio sur une étagère.
  const registre = mk('registre');
  const ct = pos('counter');
  const ra = pos('radio');
  part(registre, k.box, mid, 'registre.front', [0.3, 2.6, 12], [-(half - 0.15), 1.3, (layout.places.registre.z.v + layout.places.registre.zEnd!.v) / 2]);
  k.otherEmissives.push(part(registre, k.box, k.glow(pal.interior.v, build.litWindowGain.v, true), 'registre.window', [0.05, 1, 2], [-(half - 0.32), 1.5, ct.z]));
  part(registre, k.box, mid, 'registre.shelf', [0.5, 0.9, 0.5], [ra.x, 0.45, ra.z]);
  part(registre, k.box, k.solid(pal.haze.v, 0.5), 'registre.radio', [0.3, 0.25, 0.4], [ra.x, 1.02, ra.z]);
  addHit('counter', registre, [1, hh, 2]);
  addHit('radio', registre, [0.6, 1.3, 0.8]);

  // Affiches du Bulletin, sur la façade ouest.
  const bulletin = group(root, 'prop.bulletin');
  const bu = pos('bulletin');
  part(bulletin, k.box, k.solid(pal.haze.v, 0.9), 'bulletin.board', [0.05, 1.6, 2.4], [-(half - 0.05), 1.8, bu.z]);
  addHit('bulletin', bulletin, [1, 2.6, 2.6]);
  return { places, hits };
}

/** Volumes de clic de ce que d'autres modules ont construit : le mur et le portail du Coffre. */
export function addExternalHits(k: Kit, hits: Map<string, Object3D>, wall: { parent: Object3D; heightM: number; widthM: number; depthM: number }, gate: { parent: Object3D }): void {
  const hitMat = k.bag.material(new MeshBasicNodeMaterial());
  hitMat.name = 'hit';
  const w = k.d.interactions['wall']!.at.v;
  hits.set('wall', hit(k, wall.parent, hitMat, 'wall', w.x, w.z, [wall.widthM, wall.heightM, wall.depthM]));
  const v = k.d.interactions['vaultGate']!.at.v;
  hits.set('vaultGate', hit(k, gate.parent, hitMat, 'vaultGate', v.x, v.z, [k.d.coffre.portalWidthM.v, k.d.coffre.portalHeightM.v, 1]));
}
