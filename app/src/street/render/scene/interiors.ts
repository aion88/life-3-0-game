/**
 * Intérieurs du palier `deferred` : le logement et le Registre, un simple volume meublé de mobilier maison [plan 02a T6].
 * Leur portée exacte est un point ouvert (level-designer) : sans eux, entrer dans le lieu joue l'activité depuis le seuil.
 * Le logement est découpé en quatre (9-A à 9-D, `cutaway.units`), chacun meublé et éclairé par sa lampe de bureau : une vraie source,
 * éteinte tant que la coupe est fermée [spec rue guidée §4.5].
 * Chaque volume est derrière le plan de façade (|x| > demi-largeur) ; c'est T13 qui décide de ce qu'on en voit.
 */
import { Color, DataTexture, MeshStandardNodeMaterial, PlaneGeometry, PointLight, RepeatWrapping, RGBAFormat, SRGBColorSpace, type Object3D } from 'three/webgpu';
import { desk, bed, shelf, table } from './furniture';
import { group, part, type Kit } from './kit';

/** Small deterministic woven/wood surfaces, also usable by the non-DOM scene tests. */
function surface(k: Kit, kind: 'parquet' | 'rug' | 'paper'): MeshStandardNodeMaterial {
  const pixels = new Uint8Array(256 * 256 * 4);
  const palette = kind === 'parquet' ? [[114, 86, 61], [133, 101, 70], [93, 72, 55]]
    : kind === 'rug' ? [[43, 66, 67], [176, 145, 103], [133, 72, 56]] : [[174, 164, 139], [147, 143, 120], [187, 167, 125]];
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    let tone = 0;
    if (kind === 'parquet') tone = (Math.floor(y / 32) + Math.floor((x + Math.floor(y / 32) % 2 * 64) / 128)) % 2;
    else if (kind === 'rug') {
      const edge = Math.min(x, y, 255 - x, 255 - y);
      tone = edge < 8 ? 0 : edge < 13 ? 1 : edge < 20 ? 2 : edge < 25 ? 1 : (Math.floor(x / 32) + Math.floor(y / 32)) % 2;
    } else {
      const dx = Math.abs(x % 64 - 32), dy = Math.abs(y % 64 - 32);
      tone = Math.abs(dx + dy - 28) < 2 ? 2 : dx + dy < 26 ? 1 : 0;
    }
    const base = palette[tone]!, wear = ((x * 17 + y * 31) % 13) - 6;
    const seam = kind === 'parquet' && (y % 32 < 1 || (x + Math.floor(y / 32) % 2 * 64) % 128 < 1) ? -24 : 0;
    const weave = kind === 'rug' && (x % 3 === 0 || y % 3 === 0) ? -8 : 0;
    const at = (y * 256 + x) * 4;
    for (let c = 0; c < 3; c++) pixels[at + c] = base[c]! + wear + seam + weave;
    pixels[at + 3] = 255;
  }
  const map = k.bag.texture(new DataTexture(pixels, 256, 256, RGBAFormat));
  map.colorSpace = SRGBColorSpace; map.wrapS = map.wrapT = RepeatWrapping; map.anisotropy = 4; map.needsUpdate = true;
  if (kind === 'parquet') map.repeat.set(3, 3);
  if (kind === 'paper') map.repeat.set(2, 3);
  return k.bag.material(new MeshStandardNodeMaterial({ map, roughness: kind === 'parquet' ? .72 : .96 }));
}

/** Profondeur et hauteur d'un volume intérieur, cosmétiques. */
const ROOM = { depth: 5, height: 2.8 } as const;

function room(k: Kit, parent: Object3D, name: string, z0: number, z1: number, cuts: readonly number[] = [], cutHeight: number = ROOM.height): Object3D {
  const g = group(parent, name);
  const half = k.d.layout.halfWidthM.v;
  const zc = (z0 + z1) / 2;
  const len = Math.abs(z0 - z1);
  const xc = -(half + ROOM.depth / 2);   // côté ouest, derrière la façade
  const wall = k.solid(k.d.build.palette.haze.v, 0.9);
  part(g, k.box, k.solid(k.d.build.palette.mid.v, 0.8), `${name}.floor`, [ROOM.depth, 0.05, len], [xc, 0.025, zc]);
  part(g, k.box, wall, `${name}.back`, [0.1, ROOM.height, len], [xc - ROOM.depth / 2, ROOM.height / 2, zc]);
  for (const z of [z0, ...cuts, z1]) part(g, k.box, wall, `${name}.side.${z}`, [ROOM.depth, cutHeight, 0.1], [xc, cutHeight / 2, z]);   // cloisons : basses dans le logement (vue de maison de poupée)
  return g;
}

/** Les lampes de bureau des logements : sources réelles, éteintes et masquées tant que la coupe est fermée (`cutaway.ts` les allume). */
export interface InteriorLights { readonly lights: readonly PointLight[]; readonly bulbs: readonly Object3D[] }

/** Position des meubles dans un logement de 2,5 m de large (z) et 5 m de profondeur (x), cosmétique : (décalage x depuis le centre, décalage z). */
const SPOT = { bed: [-1.5, 0], shelf: [-2.25, 0], table: [0.3, -0.6], desk: [1.8, 0] } as const;
const FURNITURE = { bed, shelf, table, desk } as const;
/** Décalage z de la lampe sur le plateau du bureau, du côté opposé à la radio. */
const LAMP_DZ = -0.5;

/** Ajoute `interior.logement` (quatre logements) et `interior.registre` à `root` ; rend les lampes de bureau. */
export function buildInteriors(root: Object3D, k: Kit): InteriorLights {
  const p = k.d.layout.places;
  const half = k.d.layout.halfWidthM.v;
  const xc = -(half + ROOM.depth / 2);
  const { units, lamp } = k.d.cutaway;
  const flat = room(k, root, 'interior.logement', p.logement.z.v, p.logement.zEnd!.v, units.slice(0, -1).map((u) => u.zEnd.v), k.d.cutaway.partitionM.v);
  // Replace the continuous rear wall with authored wall bays, including a real window opening.
  flat.getObjectByName('interior.logement.back')!.visible = false;
  const sodium = new Color(k.d.build.palette.interior.v);
  const bulbMat = k.glow(k.d.build.palette.interior.v, k.d.build.litWindowGain.v, true);
  const lights: PointLight[] = [];
  const bulbs: Object3D[] = [];
  const parquet = surface(k, 'parquet'), rug = surface(k, 'rug'), wallpaper = surface(k, 'paper');
  const textilePlane = k.bag.geometry(new PlaneGeometry(1, 1));
  const walnut = k.solid('#483d32', .68), fadedGreen = k.solid('#52635b', .88), oldBrass = k.solid('#ad9362', .48);
  let from = p.logement.z.v;
  for (const u of units) {
    const zc = (from + u.zEnd.v) / 2;
    const width = Math.abs(from - u.zEnd.v);
    from = u.zEnd.v;
    const g = group(flat, `unit.${u.id}`);
    // Domestic geometry survives beneath a regimented street: worn parquet, old mouldings,
    // one heirloom textile rather than institutional paving throughout the family home.
    part(g, k.box, parquet, `unit.${u.id}.parquet`, [4.88, .012, width - .12], [xc, .057, zc]);
    part(g, k.box, fadedGreen, `unit.${u.id}.dado`, [.025, .8, width - .12], [xc - 2.435, .46, zc]);
    for (const y of [.12, .88]) part(g, k.box, walnut, `unit.${u.id}.moulding.${y}`, [.05, .035, width - .12], [xc - 2.41, y, zc]);
    if (u.occupied) {
      const textile = part(g, textilePlane, rug, `unit.${u.id}.woven-rug`, [2.45, Math.min(1.65, width - .25), 1], [xc + .35, .071, zc]);
      textile.rotation.x = -Math.PI / 2;
    }
    for (const f of u.furniture) FURNITURE[f](k, g, `unit.${u.id}.${f}`, [xc + SPOT[f][0], 0, zc + SPOT[f][1]]);
    const rear = xc - 2.5, plaster = k.solid('#8b958b', .92);
    if (u.id !== '9-B') part(g, k.box, plaster, `unit.${u.id}.rear`, [.1, 2.8, width], [rear, 1.4, zc]);
    if (u.id === '9-B') {
      // Replace the prototype's solid furniture blocks in this witness scene.
      const shelfBody = g.getObjectByName('unit.9-B.shelf')!; shelfBody.visible = false;
      const cabinetZ = zc + .72;
      for (const z of [-.36, .36]) part(g, k.box, walnut, 'marlene.bookcase.upright', [.28, 1.85, .035], [rear + .22, .96, cabinetZ + z]);
      for (let level = 0; level < 5; level++) {
        const y = .15 + level * .38;
        part(g, k.box, walnut, 'marlene.bookcase.shelf', [.3, .03, .76], [rear + .22, y, cabinetZ]);
        for (let book = 0; book < 5; book++) part(g, k.box, k.solid(['#9c7656','#415f59','#b1a383'][book % 3]!), 'marlene.book', [.17, .22 + (book % 2) * .06, .045], [rear + .22, y + .14, cabinetZ - .25 + book * .09]);
      }
      const deskBody = g.getObjectByName('unit.9-B.desk');
      if (deskBody) {
        deskBody.getObjectByName('unit.9-B.desk.desk')!.visible = false;
        part(deskBody, k.box, walnut, 'marlene.console.top', [.8, .055, 2.4], [0, 1, 0]);
        for (const x of [-.33, .33]) for (const z of [-1.1, 1.1]) part(deskBody, k.box, walnut, 'marlene.console.leg', [.045, 1, .045], [x, .5, z]);
      }
      const dining = g.getObjectByName('unit.9-B.table');
      if (dining) {
        // Keep the rear chair and its backrest inside the 2.5 m apartment bay.
        dining.position.z += .25;
        dining.getObjectByName('unit.9-B.table.chair')!.visible = false;
        for (const z of [-.62, .65]) {
          part(dining, k.box, walnut, 'marlene.chair.seat', [.4, .045, .4], [0, .45, z]);
          part(dining, k.box, fadedGreen, 'marlene.chair.back', [.4, .36, .04], [0, .77, z + Math.sign(z) * .18]);
          for (const x of [-.16,.16]) for (const dz of [-.16,.16]) part(dining, k.box, walnut, 'marlene.chair.leg', [.035,.44,.035], [x,.22,z+dz]);
        }
      }
      const wz = zc - .42, aperture = 1.05;
      part(g, k.box, plaster, 'marlene.window.sill-wall', [.1, 1.1, width], [rear, .55, zc]);
      part(g, k.box, plaster, 'marlene.window.lintel-wall', [.1, .35, width], [rear, 2.625, zc]);
      for (const [a, b] of [[zc - width / 2, wz - aperture / 2], [wz + aperture / 2, zc + width / 2]]) {
        if (b! > a!) part(g, k.box, wallpaper, 'marlene.window.side-wall', [.1, 1.35, b! - a!], [rear, 1.775, (a! + b!) / 2]);
      }
      const window = group(g, 'marlene.window'); window.position.set(rear + .08, 1.77, wz);
      for (const dz of [-.55, 0, .55]) part(window, k.box, walnut, 'marlene.window.mullion', [.12, 1.4, .045], [0, 0, dz]);
      for (const y of [-.7, .7]) part(window, k.box, walnut, 'marlene.window.rail', [.12, .055, 1.16], [0, y, 0]);
      part(window, k.box, oldBrass, 'marlene.window.handle', [.09, .1, .018], [.08, -.15, .08]);
      part(window, k.box, plaster, 'marlene.window.sill', [.36, .06, 1.25], [.08, -.71, 0]);
      const curtain = k.solid('#a78361', .98);
      for (const side of [-1, 1]) for (let fold = 0; fold < 4; fold++) part(window, k.cylinder, curtain, 'marlene.curtain.fold', [.07, 1.8, .07], [.16, -.08, side * (.63 + fold * .045)]);
      // A deep, inhabited courtyard continues beyond the opening instead of a sky-coloured void.
      const court = group(flat, 'marlene.courtyard');
      part(court, k.box, k.solid('#505b58'), 'courtyard.paving', [8, .12, 14], [rear - 4, -.12, zc]);
      const masonry = k.solid('#626e68'), night = k.solid('#263d46'), lit = k.glow('#e5b67b', .8);
      for (const [bx, bz, depth, length] of [[rear - 7, zc, 1, 14], [rear - 4, zc - 6.8, 6, .35]]) {
        part(court, k.box, masonry, 'courtyard.neighbour', [depth!, 8, length!], [bx!, 3, bz!]);
      }
      for (let row = 0; row < 3; row++) for (let col = -3; col <= 3; col++) {
        part(court, k.box, (row + col) % 3 === 0 ? lit : night, 'courtyard.window', [.03, 1.1, .8], [rear - 6.47, row * 2 + .8, zc + col * 1.7]);
        part(court, k.box, walnut, 'courtyard.window.sill', [.18, .08, .94], [rear - 6.4, row * 2 + .22, zc + col * 1.7]);
      }
      part(court, k.cylinder, oldBrass, 'courtyard.drainpipe', [.07, 8, .07], [rear - 6.35, 3, zc + 2.7]);
      for (let i = 0; i < 5; i++) part(court, k.box, k.solid(i % 2 ? '#8d9b91' : '#b7a48a'), 'courtyard.laundry', [.025, .65, .4], [rear - 3, 2.5, zc - 1 + i * .55]);

      // Her old geometric wallpaper and fan ornament make the room personal without
      // turning the authoritarian world into Soraya's brighter contemporary apartment.

      const fan = group(g, 'marlene.heirloom-fan');
      fan.position.set(xc - 2.39, 1.58, zc + .55);
      part(fan, k.box, walnut, 'marlene.frame', [.045, .83, .62], [0, .12, 0]);
      part(fan, k.box, fadedGreen, 'marlene.frame.paper', [.015, .75, .54], [.03, .12, 0]);
      for (let i = -3; i <= 3; i++) {
        const a = i * .24, len = .32;
        const ray = part(fan, k.box, oldBrass, `marlene.fan.${i}`, [.012, len, .009], [.044, -.12 + Math.cos(a) * len / 2, Math.sin(a) * len / 2]);
        ray.rotation.x = a;
      }
      // A linen runner fits below the existing dinnerView dish anchors (which remain unchanged).
      part(g, k.box, rug, 'marlene.table-runner', [.29, .004, .66], [xc + SPOT.table[0] + .26, .783, zc + SPOT.table[1]]);
      // Dinner at Marlène's: visible table settings, not a street conversation.
      const plate = k.solid('#efe3cc', 0.5);
      for (const [i, dz] of [-0.22, 0.0, 0.22].entries()) part(g, k.sphere, plate, `marlene.plate.${i}`, [0.2, 0.015, 0.18], [xc + SPOT.table[0], 0.795, zc + SPOT.table[1] + dz]);
      part(g, k.box, k.solid('#bf8059'), 'marlene.basil.pot', [0.15, 0.18, 0.15], [xc + SPOT.table[0] + 0.4, 0.87, zc + SPOT.table[1]]);
      part(g, k.sphere, k.solid('#588552'), 'marlene.basil.leaves', [0.24, 0.28, 0.24], [xc + SPOT.table[0] + 0.4, 1.08, zc + SPOT.table[1]]);
    }
    if (!u.occupied) continue;
    const at: readonly [number, number, number] = [xc + SPOT.desk[0], lamp.heightM.v, zc + SPOT.desk[1] + LAMP_DZ];
    const bulb = part(g, k.sphere, bulbMat, `interior.lamp.${u.id}.bulb`, [0.07, 0.07, 0.07], at);
    bulb.visible = false;   // cachée tant que la coupe est fermée
    k.otherEmissives.push(bulb);
    bulbs.push(bulb);
    const light = new PointLight(sodium, 0, lamp.distanceM.v, lamp.decay.v);
    light.name = `unit.${u.id}.lamp.light`;
    light.position.set(...at);
    light.visible = false;   // éteinte tant que la coupe est fermée : pas de source réelle de plus pour un logement qu'on ne voit pas
    g.add(light);
    lights.push(light);
  }
  const reg = room(k, root, 'interior.registre', p.registre.z.v, p.registre.zEnd!.v);
  const zr = (p.registre.z.v + p.registre.zEnd!.v) / 2;
  // The Registre repeats severe stepped geometry, in institutional stone and dark trim.
  const regStone = k.solid('#8d9187', .88), regDark = k.solid('#344844', .82);
  for (const offset of [-2.8, 0, 2.8]) {
    part(reg, k.box, regDark, `registre.panel.${offset}`, [.045, 2.4, 1.35], [xc - 2.43, 1.3, zr + offset]);
    for (let i = 0; i < 3; i++) part(reg, k.box, regStone, `registre.step.${offset}.${i}`, [.035, 1.65 + i * .18, .26], [xc - 2.39, .95 + i * .09, zr + offset + (i - 1) * .32]);
  }
  desk(k, reg, 'interior.registre.desk', [xc + 1.5, 0, zr]);
  shelf(k, reg, 'interior.registre.shelf', [xc - ROOM.depth / 2 + 0.3, 0, zr - 2]);
  table(k, reg, 'interior.registre.table', [xc - 0.5, 0, zr + 2]);
  return { lights, bulbs };
}
