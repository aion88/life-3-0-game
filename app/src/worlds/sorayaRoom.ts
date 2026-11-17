/** Soraya's home: a photographic set with inhabited scale and an actual unlocked doorway.
 * Geometry stays independent of camera/post-processing so gameplay and gallery use the same room.
 */
import {
  BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, LatheGeometry,
  Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace,
  SphereGeometry, Vector2, type BufferGeometry, type Material, type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type V3 = readonly [number, number, number];
export function buildSorayaRoom(): { group: Group; dispose(): void } {
  const group = new Group(); group.name = 'soraya.home';
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  const geometryCache = new Map<string, BufferGeometry>();
  const texture = (kind: 'plaster' | 'linen' | 'wood' | 'rug'): CanvasTexture => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#e8e6df'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 18000; i++) {
      const x = (i * 73 + Math.floor(i / 512) * 13) % 512, y = (i * 157 + Math.floor(i / 73) * 19) % 512;
      const value = 205 + i % 40; c.fillStyle = `rgb(${value},${value},${value})`;
      c.fillRect(x, y, kind === 'wood' ? 1 : 2, kind === 'wood' ? 7 + i % 17 : 1);
    }
    if (kind === 'linen' || kind === 'rug') {
      for (let i = 0; i < 512; i += 4) {
        c.fillStyle = i % 8 ? '#e0ddd6' : '#f2f0e9'; c.fillRect(i, 0, 1, 512); c.fillRect(0, i, 512, 1);
      }
    }
    if (kind === 'wood') {
      for (let x = 0; x < 512; x += 128) { c.fillStyle = '#938775'; c.fillRect(x, 0, 2, 512); c.fillRect(x, (x / 128 % 2) * 256, 128, 2); }
    }
    const t = new CanvasTexture(canvas); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(kind === 'wood' ? 4 : 2, kind === 'wood' ? 5 : 2); t.anisotropy = 4; textures.add(t); return t;
  };
  const plasterMap = texture('plaster'), linenMap = texture('linen'), woodMap = texture('wood'), rugMap = texture('rug');
  const material = (color: string, roughness = .8, map?: Texture, metalness = 0): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({ color, roughness, metalness, ...(map ? { map, bumpMap: map, bumpScale: .018 } : {}) }); materials.add(m); return m;
  };
  const plaster = material('#e8dfc8', .94, plasterMap), teal = material('#24676a', .85, plasterMap);
  const terracotta = material('#af553b', .93, linenMap), oat = material('#dad1b8', .96, linenMap);
  const wood = material('#a8885c', .65, woodMap), darkWood = material('#4b3b2b', .58, woodMap);
  const brass = material('#b5a16b', .34, undefined, .6);
  const ivory = material('#f4ebd6', .36), stone = material('#b5b5a0', .88, plasterMap);
  const bookColors = ['#dfbc81', '#a44c37', '#4c747a', '#d2d0b8', '#464a49'].map(c => material(c));
  const cube = new BoxGeometry(1, 1, 1), sphere = new SphereGeometry(1, 20, 12), cylinder = new CylinderGeometry(1, 1, 1, 24);
  [cube, sphere, cylinder].forEach(g => geometries.add(g));
  const mesh = (geo: BufferGeometry, mat: Material, pos: V3, scale: V3 = [1, 1, 1], name?: string): Mesh => {
    const m = new Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.castShadow = m.receiveShadow = true; if (name) m.name = name; group.add(m); return m;
  };
  const block = (pos: V3, scale: V3, mat = plaster, name?: string): Mesh => mesh(cube, mat, pos, scale, name);
  const rounded = (pos: V3, size: V3, mat: Material, radius = .055, name?: string): Mesh => {
    const key = `${size.join(',')}:${radius}`;
    let g = geometryCache.get(key);
    if (!g) { g = new RoundedBoxGeometry(...size, 2, radius); geometries.add(g); geometryCache.set(key, g); }
    return mesh(g, mat, pos, [1, 1, 1], name);
  };
  const rod = (pos: V3, radius: number, height: number, mat: Material): Mesh => mesh(cylinder, mat, pos, [radius, height, radius]);
  // Author furniture in local coordinates, then calibrate it independently from the room.
  const furniture = (start: number, name: string, x: number, z: number, scale: number): void => {
    const own = new Group(); own.name = name; own.position.set(x, 0, z); own.scale.setScalar(scale);
    for (const item of group.children.slice(start)) { item.position.x -= x; item.position.z -= z; own.add(item); }
    group.add(own);
  };
  const vaseGeo = new LatheGeometry([new Vector2(.13, 0), new Vector2(.21, .03), new Vector2(.24, .2), new Vector2(.16, .38), new Vector2(.09, .45), new Vector2(.09, .48)], 24);
  geometries.add(vaseGeo);

  // Continuous floor avoids a stage floating in the void; room's threshold and skirting define its real bounds.
  const floorMap = woodMap.clone(); floorMap.repeat.set(40, 16); textures.add(floorMap);
  const floorWood = material('#a8885c', .74, floorMap);
  block([3.5, -.14, 4], [30, .25, 32], floorWood, 'home.floor');
  // Window aperture x[-2.4,3.5], y[1.05,3.65]. Door aperture x[6.3,8.25], y[0,3.1].
  block([-.1, .5, -4.4], [6.7, 1, .32], plaster);
  block([-.1, 4.05, -4.4], [6.7, .8, .32], plaster);
  block([-3, 2.3, -4.4], [.8, 2.6, .32], plaster);
  block([4.8, 2.2, -4.4], [3, 4.4, .32], plaster);
  block([9.45, 2.2, -4.4], [2.4, 4.4, .32], teal);
  block([7.27, 3.75, -4.4], [1.95, 1.3, .32], teal);
  block([-3.5, 2.2, 1.5], [.32, 4.4, 12], plaster, 'home.left-wall');
  block([10.65, 2.2, -2.6], [.32, 4.4, 3.6], teal, 'home.right-wall');
  // Only the back strip of ceiling is shown in the cutaway, leaving the camera and actors unobstructed.
  block([3.5, 4.5, -3.5], [14.3, .16, 2.1], plaster, 'home.ceiling-cutaway');
  block([-3.28, .1, 1.3], [.06, .2, 11.5], darkWood);
  block([-.1, .1, -4.19], [6.7, .2, .07], darkWood); block([4.8, .1, -4.19], [3, .2, .07], darkWood);
  block([9.45, .1, -4.19], [2.4, .2, .07], darkWood);
  // Slim gilded cornices emphasize the room's horizontal symmetry.
  for (const y of [4.05, 4.15]) block([3.5, y, -4.19], [14, .025, .035], brass);
  // Deep sill, muntins and slatted blinds: physically cast their stripes on the floor and bedding.
  block([.5, 1.03, -4.05], [6.35, .12, .7], stone, 'window.sill');
  for (const x of [-2.58, .5, 3.58]) block([x, 2.35, -4.25], [.09, 2.65, .15], darkWood);
  for (const y of [1.08, 3.66]) block([.5, y, -4.25], [6.25, .09, .15], darkWood);
  block([.5, 2.35, -4.25], [6.25, .055, .12], darkWood);
  const glazing = new MeshStandardMaterial({ color: '#bedbd6', transparent: true, opacity: .09, roughness: .2, metalness: 0, depthWrite: false }); materials.add(glazing);
  const pane = block([.5, 2.35, -4.32], [6.1, 2.5, .018], glazing, 'window.glazing'); pane.castShadow = false; pane.receiveShadow = false;
  for (let i = 0; i < 10; i++) {
    const slat = block([.5, 1.25 + i * .255, -4.12], [6.05, .045, .2], ivory, `window.blind.${i}`); slat.rotation.x = -.36;
  }
  for (const x of [-1.5, 2.5]) block([x, 2.4, -4.01], [.02, 2.7, .02], brass);
  // Exterior depth is visible through the openings, with a courtyard and a distant warm facade.
  block([1, -.2, -13], [32, .3, 16], stone);
  block([-1, 4.2, -17], [22, 8.4, .6], material('#d3ae8e', .9, plasterMap));
  const exteriorGlass = material('#597d81', .3);
  for (const x of [-8, -4, 0, 4, 8]) for (const y of [2.2, 5.6]) {
    block([x, y, -16.62], [1.6, 2.2, .07], exteriorGlass);
    block([x, y, -16.53], [.05, 2.2, .06], ivory);
  }
  // Folded curtains, held away from the aperture rather than hiding it with a flat rectangle.
  const curtainMaterial = material('#c68155', .96, linenMap); curtainMaterial.side = DoubleSide;
  for (const x of [-2.9, 3.92]) {
    const g = new PlaneGeometry(.88, 3.25, 24, 10); geometries.add(g);
    const attr = g.attributes['position']!;
    for (let i = 0; i < attr.count; i++) { const px = attr.getX(i), py = attr.getY(i); attr.setZ(i, Math.sin((px + .44) * 26) * .105 + Math.sin(py * 1.1) * .035); }
    g.computeVertexNormals(); mesh(g, curtainMaterial, [x, 2.05, -3.9], [1, 1, 1], 'window.linen-curtain');
  }
  // Real open door on a pivot, with a pull handle but no lock or access terminal.
  block([7.27, .035, -4.4], [2, .07, .65], brass, 'home.threshold');
  for (const x of [6.25, 8.3]) block([x, 1.57, -4.3], [.13, 3.14, .19], darkWood);
  block([7.27, 3.14, -4.3], [2.17, .13, .19], darkWood);
  const hinge = new Group(); hinge.position.set(8.25, 0, -4.25); hinge.rotation.y = -.98; group.add(hinge); hinge.name = 'home.door.unlocked';
  const door = rounded([0, 0, 0], [1.87, 3.04, .095], teal, .035); group.remove(door); door.position.set(-.935, 1.52, 0); hinge.add(door);
  const handle = rod([0, 0, 0], .035, .32, brass); group.remove(handle); handle.position.set(-1.62, 1.25, .1); hinge.add(handle);
  const bedStart = group.children.length;
  // Low upholstered bed/daybed, layered linen and a folded coverlet rather than monolithic cubes.
  for (const x of [-2.7, .7]) for (const z of [-1.6, .6]) rod([x, .18, z], .055, .36, darkWood);
  rounded([-1, .38, -.5], [3.9, .3, 2.65], darkWood, .07, 'home.bed-frame');
  rounded([-1, .66, -.5], [3.75, .32, 2.5], oat, .14, 'home.linen-mattress');
  rounded([-1, 1.15, -1.76], [3.9, 1.3, .22], terracotta, .07, 'home.upholstered-headboard');
  // Stepped silhouette, upholstered channels and restrained brass inlays.
  for (let i = 0; i < 9; i++) {
    const x = -2.7 + i * .425, height = 1.35 + (4 - Math.abs(4 - i)) * .105;
    rounded([x, .51 + height / 2, -1.61], [.39, height, .13], terracotta, .05);
    block([x, .53 + height, -1.53], [.39, .025, .025], brass);
  }
  for (const x of [-2.1, -.7]) { const pillow = rounded([x, .94, -1.15], [1.2, .23, .72], oat, .105); pillow.rotation.y = x < -1 ? -.07 : .1; }
  rounded([-.95, .88, .15], [3.68, .12, 1.1], terracotta, .04, 'home.folded-coverlet');
  furniture(bedStart, 'home.bed', -1, -.5, .78);
  // A single woven surface: square checks framed by broad Art Deco stripe bands.
  // Dedicated UVs keep the pattern continuous, independent of the rounded rug's sides.
  const rugCanvas = document.createElement('canvas'); rugCanvas.width = 1024; rugCanvas.height = 768;
  const rc = rugCanvas.getContext('2d')!;
  rc.fillStyle = '#234b4d'; rc.fillRect(0, 0, 1024, 768);
  for (const [inset, color] of [[12, '#d6b777'], [21, '#234b4d'], [33, '#eee0bd'], [47, '#a5523b'], [66, '#eee0bd'], [75, '#234b4d']] as const) {
    rc.fillStyle = color; rc.fillRect(inset, inset, 1024 - inset * 2, 768 - inset * 2);
  }
  const cell = 64, left = 128, top = 128;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 12; col++) {
    rc.fillStyle = (row + col) % 2 ? '#234b4d' : '#eee0bd';
    rc.fillRect(left + col * cell, top + row * cell, cell, cell);
  }
  // Fine weave, not extra geometry or a second overlapping surface.
  rc.fillStyle = 'rgba(255,244,214,.09)';
  for (let x = 0; x < 1024; x += 4) rc.fillRect(x, 0, 1, 768);
  rc.fillStyle = 'rgba(29,39,35,.09)';
  for (let y = 0; y < 768; y += 4) rc.fillRect(0, y, 1024, 1);
  const patternMap = new CanvasTexture(rugCanvas); patternMap.colorSpace = SRGBColorSpace; patternMap.anisotropy = 4; textures.add(patternMap);
  const rug = material('#ffffff', .98, patternMap); rug.bumpMap = rugMap; rug.bumpScale = .008;
  const border = material('#234b4d', .98, rugMap);
  rounded([3.7, .025, 3.4], [6.3, .035, 4.7], border, .035, 'home.rug');
  const rugSurface = new PlaneGeometry(6.26, 4.66); geometries.add(rugSurface);
  const woven = mesh(rugSurface, rug, [3.7, .047, 3.4], [1, 1, 1], 'home.rug.checks-and-stripes');
  woven.rotation.x = -Math.PI / 2; woven.castShadow = false;
  // Emptied bookshelf echoes the narrative: her books have already been packed.
  for (const x of [3.72, 5.75]) block([x, 1.6, -3.99], [.045, 3.05, .38], brass);
  for (let row = 0; row < 4; row++) {
    const y = .45 + row * .67; rounded([4.74, y, -3.97], [2.2, .055, .48], darkWood, .018);
    if (row === 1 || row === 3) mesh(vaseGeo, row === 1 ? ivory : terracotta, [4 + row * .25, y + .03, -3.95], [.7, .7, .7]);
  }
  const tableStart = group.children.length;
  // Round oak table, hand-thrown ceramics and a partly opened letter imply someone actually lives here.
  rod([8.6, .75, .35], .065, 1.4, brass); rod([8.6, .08, .35], .47, .12, darkWood);
  rod([8.6, 1.48, .35], 1.05, .09, wood).name = 'home.table-top';
  mesh(vaseGeo, terracotta, [8.1, 1.525, .2], [.75, .75, .75], 'home.ceramic-vase');
  rod([8.9, 1.62, .3], .11, .2, ivory); rod([8.9, 1.53, .3], .18, .025, ivory);
  block([8.7, 1.54, -.2], [.5, .008, .35], ivory).rotation.y = -.22;
  furniture(tableStart, 'home.dining-table', 8.6, .35, .72);
  // Seat at 46 cm and back below 1 m after the room's metre calibration.
  const chairStart = group.children.length;
  rounded([8.6, .59, 1.55], [.78, .14, .75], terracotta, .06, 'home.chair-seat');
  rounded([8.6, 1.05, 1.87], [.78, .65, .13], terracotta, .06, 'home.chair-back');
  for (const x of [8.33, 8.87]) for (const z of [1.3, 1.8]) rod([x, .26, z], .035, .52, brass);
  furniture(chairStart, 'home.dining-chair', 8.6, 1.55, 1);
  // Open moving carton, packed spines still visible; it does not obstruct the characters' entrance.
  const cardboard = material('#ad8b5b', .98, plasterMap);
  block([.6, .045, 1.65], [1.15, .06, .75], cardboard);
  for (const x of [.035, 1.165]) block([x, .28, 1.65], [.035, .5, .75], cardboard);
  for (const z of [1.29, 2.01]) block([.6, .28, z], [1.15, .5, .035], cardboard);
  for (let j = 0; j < 5; j++) block([.18 + j * .2, .32, 1.65], [.15, .48 + j % 2 * .07, .5], bookColors[j]!);
  const flap = block([.6, .52, 1.12], [1.15, .03, .34], cardboard); flap.rotation.x = -.32;
  const luggageStart = group.children.length;
  // Packed suitcase: tactile rounded leather, straps, handle, feet. Departure is still a decision.
  const luggage = material('#bd813e', .7, linenMap);
  rounded([2, .43, 1.2], [1.32, .82, .53], luggage, .085, 'home.soraya-suitcase');
  for (const x of [1.65, 2.35]) { block([x, .43, 1.479], [.075, .7, .025], darkWood); block([x, .5, 1.496], [.1, .1, .015], brass); }
  rounded([2, .88, 1.2], [.4, .1, .11], darkWood, .035);
  for (const x of [1.55, 2.45]) rod([x, .025, 1.2], .05, .05, darkWood);
  furniture(luggageStart, 'home.luggage', 2, 1.2, .8);
  // A quiet framed print and small plant soften the painted wall without filling every surface.
  rounded([9.45, 2.8, -4.18], [1.28, 1.65, .065], darkWood, .02);
  block([9.45, 2.8, -4.13], [1.14, 1.51, .016], oat);
  block([9.45, 2.8, -4.11], [1.08, 1.45, .01], teal);
  // Geometric fan print in a brass frame, echoing the headboard's stepped rhythm.
  for (const x of [8.85, 10.05]) block([x, 2.8, -4.08], [.025, 1.57, .025], brass);
  for (const y of [2.02, 3.58]) block([9.45, y, -4.08], [1.22, .025, .025], brass);
  for (let i = -4; i <= 4; i++) {
    const angle = i * .235, length = Math.min(.88, .46 / Math.max(.01, Math.abs(Math.sin(angle))));
    const ray = block([9.45 + Math.sin(angle) * length / 2, 2.35 + Math.cos(angle) * length / 2, -4.075], [.018, length, .012], brass);
    ray.rotation.z = -angle;
  }
  rod([9.45, 2.35, -4.055], .15, .018, terracotta).rotation.x = Math.PI / 2;
  mesh(vaseGeo, ivory, [-2.12, 1.1, -3.95], [1.1, 1.1, 1.1]);
  const leaf = material('#577564', .85);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4; const stem = rod([-2.12, 1.9, -3.95], .009, .95, leaf); stem.rotation.z = Math.sin(angle) * .32;
    const blade = mesh(sphere, leaf, [-2.12 + Math.sin(angle) * .26, 2.1 + i % 3 * .1, -3.95 + Math.cos(angle) * .14], [.13, .3, .025]); blade.rotation.z = -Math.sin(angle) * .6;
  }
  // One world unit is a metre. Original set drafting was oversized: 3.04 m door,
  // 4.5 m cornice. Keep the rug centre fixed while bringing the door to 2.13 m.
  group.scale.setScalar(.7); group.position.set(1.11, 0, 1.02);
  let disposed = false;
  return { group, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}
