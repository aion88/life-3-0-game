/** Layered planting and connected garden circulation; one metre is one scene unit. */
import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three';

type V3 = readonly [number, number, number];
export function buildLandscape(layout: string, publicSpace: boolean): { group: Group; dispose(): void } {
  const group = new Group(); group.name = `landscape.${layout}.${publicSpace ? 'public' : 'landmark'}`;
  if (!(['garden', 'conservatory'].includes(layout) || (publicSpace && ['oracle', 'school'].includes(layout)))) return { group, dispose() {} };
  const box = new BoxGeometry(), sphere = new SphereGeometry(1, 10, 7), cylinder = new CylinderGeometry(1, 1, 1, 10);
  const geometries: BufferGeometry[] = [box, sphere, cylinder];
  const colors = ['#b6aa86', '#645e45', '#576d48', '#87935c', '#384e42', '#b6ad72', '#9b7255', '#d7b27d'];
  const materials = colors.map(color => new MeshStandardMaterial({ color, roughness: .94 }));
  const batches = new Map<string, { geometry: BufferGeometry; color: number; matrices: Matrix4[] }>();
  const q = new Quaternion(), p = new Vector3(), s = new Vector3();
  const add = (geometry: BufferGeometry, color: number, at: V3, size: V3): void => {
    const key = `${geometry.uuid}:${color}`;
    let batch = batches.get(key);
    if (!batch) { batch = { geometry, color, matrices: [] }; batches.set(key, batch); }
    batch.matrices.push(new Matrix4().compose(p.set(...at), q, s.set(...size)));
  };
  const slab = (x: number, z: number, w: number, d: number, color = 0, top = .025): void => add(box, color, [x, top - .035, z], [w, .07, d]);
  // Beds have a visible edge and soil; foliage begins at the actual soil height.
  const bed = (x: number, z: number, w: number, d: number, raised = .18, lush = false): void => {
    add(box, 0, [x, raised / 2, z], [w, raised, d]);
    add(box, 1, [x, raised + .012, z], [w - .16, .025, d - .16]);
    const cols = Math.max(1, Math.floor(w / .8)), rows = Math.max(1, Math.floor(d / .85));
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const px = x - w / 2 + (col + .5) * w / cols, pz = z - d / 2 + (row + .5) * d / rows;
      const h = (lush ? .42 : .22) + .12 * ((row + col * 3) % 3);
      add(sphere, 2 + ((row + col) % 3), [px, raised + h * .58, pz], [.43, h, .42]);
      if ((row + col) % 3 === 0) add(sphere, 5, [px + .12, raised + h * 1.4, pz], [.09, .06, .09]);
    }
  };
  const tree = (x: number, z: number, h: number, color = 2): void => {
    add(cylinder, 6, [x, h * .34, z], [.11, h * .68, .11]);
    // Overlapping asymmetrical crowns keep the canopy leafy rather than balloon-shaped.
    for (let crown = 0; crown < 6; crown++) {
      const angle = crown * 2.4, spread = crown === 0 ? 0 : h * .16;
      const cx = x + Math.cos(angle) * spread, cz = z + Math.sin(angle) * spread;
      const cy = h * (.69 + .045 * (crown % 3));
      add(sphere, crown % 3 === 0 ? color : crown % 2 ? 3 : 2, [cx, cy, cz], [h * .19, h * (.17 + .015 * (crown % 2)), h * .18]);
    }
  };
  const backdrop = (z: number, left: number, right: number, height = 4.4): void => {
    for (let x = left; x <= right; x += 3.2) tree(x, z - .6 * Math.sin(x), height + .5 * Math.cos(x), x % 2 ? 4 : 2);
  };
  if (layout === 'oracle') {
    // A formal garden: two garden rooms flank the existing central processional walk.
    slab(3, 5.9, 18, 2.2); slab(3, -11.7, 18, 1.8);
    for (const x of [-4.8, 10.8]) {
      slab(x, -2.8, 1.4, 17.6);
      bed(x < 0 ? -1.5 : 7.5, -6.2, 3.5, 5.8, .22);
      slab(x < 0 ? -1 : 8, .1, 4.5, 3.1);
      bed(x < 0 ? -2.5 : 8.5, 3.9, 3, 1.2, .18);
      bed(x < 0 ? -7 : 13, -2.6, 2, 17, .28, true);
    }
    backdrop(-15, -12, 17, 4.5);
    for (const x of [-7, 13]) tree(x, 6.5, 4.1);
  } else if (layout === 'school') {
    // Productive orchard: reachable raised growing beds and an open shared forecourt.
    slab(3, 1.3, 15, 2.2); slab(3, -7, 15, 1.7);
    for (const x of [-4, 9]) slab(x, -2.8, 1.5, 9.8);
    for (const x of [-2, 1, 4, 7]) bed(x, -4, 2.25, 2.75, .73);
    for (const x of [-6.5, 12]) {
      bed(x, -3, 2.5, 11, .22, true);
      for (const z of [-7, -2, 3]) tree(x, z, 3.6);
    }
    bed(-2, 5, 4, 1.4); bed(9, 5, 2.5, 1.4);
    backdrop(-14.5, -12, 18, 4.2);
  } else if (layout === 'garden' && publicSpace) {
    // Near-bank towpath joins the bridge; planting stays entirely out of the water (z -14..0).
    slab(3, 4.4, 31, 2.7); slab(3, 1.7, 5, 2.8, 0, .12);
    for (const x of [-7, 12]) {
      bed(x, 1.25, 8, 1.6, .15, true);
      bed(x, 7.4, 7, 2.5, .15, true);
      tree(x - 2, 8.2, 4.2); tree(x + 2, 8, 3.6);
    }
    slab(3, -15.5, 32, 2); slab(3, -12.5, 5, 3.1, 0, .05);
    for (const x of [-11, -6, 12, 17]) tree(x, -16.7, 4.5);
    // Low reeds mark the bank without forming a screen across the actors.
    for (const x of [-12, -10, -8, -6, 8, 10, 12, 14, 16]) for (let i = 0; i < 3; i++) {
      add(cylinder, 5, [x + i * .18, .34 + i * .05, .3], [.025, .65 + i * .1, .025]);
    }
  } else if (layout === 'garden') {
    // Square surrounds the existing circular fountain, with open radial entrances.
    slab(4, 3.6, 15, 2); slab(4, -7.5, 15, 1.3);
    slab(-1.6, -2, 1.4, 12); slab(9.6, -2, 1.4, 12);
    for (const x of [-4.5, 12.5]) {
      bed(x, -2, 3.5, 6.8, .2, true);
      tree(x, -4.5, 4.2); tree(x, .3, 3.8);
    }
    bed(1, 6.4, 4, 1.6); bed(10.5, 6.4, 3, 1.6);
    backdrop(-15.5, -3, 19, 4.6);
  } else if (publicSpace) {
    // Meadow masses flank, never cover, the existing timber boardwalk.
    for (const x of [-7.8, 12.8]) {
      bed(x, -4, 4, 17, .09, true);
      for (const z of [-11, -5, 2]) tree(x, z, 3.8 + (z + 11) * .025);
    }
    slab(6.5, 1.6, 5, 2.7, 6, .08);
    bed(8, 4, 4.5, 1.3, .15, true);
    for (const x of [-4, 9]) for (const z of [-9, -4]) {
      // Fill existing round raised planters with low layered underplanting.
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        add(sphere, i % 2 ? 3 : 4, [x + Math.cos(a) * 1.25, .65, z + Math.sin(a) * 1.25], [.45, .3, .45]);
      }
    }
    backdrop(-23, -23, 24, 5.3);
  } else {
    // Conservatory aisles remain open; deep planted borders make the glass room inhabited.
    for (const x of [-1.6, 9.6]) {
      bed(x, -2.5, 3, 11.5, .24, true);
      for (const z of [-6.5, -.5, 2.5]) tree(x, z, 3.5);
    }
    slab(4, -8.9, 15, 1.1); slab(4, 6.4, 15, 1.6);
    slab(7, 4.5, 3, 2.2);
    bed(-1.5, 7.5, 4, 1); bed(10, 7.5, 3, 1);
    backdrop(-17, -15, 23, 5.6);
  }
  // Shared geometry/material batches keep dense foliage to a few draw calls.
  const instances: InstancedMesh[] = [];
  for (const batch of batches.values()) {
    const mesh = new InstancedMesh(batch.geometry, materials[batch.color], batch.matrices.length);
    batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); instances.push(mesh);
  }
  return { group, dispose() { instances.forEach(mesh => mesh.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); group.clear(); } };
}
