/** Authored furnishings and surface motifs, separate from each world's architecture. */
import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector2, type BufferGeometry, type Material, type Texture } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type V3 = readonly [number, number, number];
type Palette = readonly [string, string, string];
const palettes: Record<string, Palette> = {
  terraces: ['#e7ccac', '#403e59', '#c46c48'], oracle: ['#eee5cc', '#42797d', '#c6a361'],
  commons: ['#e5caa4', '#307776', '#b75e43'], wall: ['#849092', '#243e4a', '#b6803c'],
  garden: ['#f4ddba', '#a94d41', '#497e82'], vault: ['#b7b4a2', '#304e50', '#c78f39'],
  school: ['#e3c9b9', '#637e9f', '#b67967'], conservatory: ['#dfd8ae', '#386d59', '#b6a263'],
  hamlet: ['#c7b693', '#6b5648', '#a65635'],
};
export function buildInteriorArt(layout: string, work: boolean): { group: Group; dispose(): void } {
  const group = new Group(); group.name = `interior-art.${layout}.${work ? 'work' : 'home'}`;
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  const palette = palettes[layout] ?? palettes.hamlet!;
  const material = (color: string, metalness = 0, roughness = .82): MeshStandardMaterial => {
    const m = new MeshStandardMaterial({ color, metalness, roughness }); materials.add(m); return m;
  };
  const cream = material(palette[0]), ink = material(palette[1]), accent = material(palette[2]);
  const brass = material('#b9a06a', .65, .35), timber = material('#765b40'), porcelain = material('#e5dbc2', 0, .32);
  const cube = new BoxGeometry(1, 1, 1), cylinder = new CylinderGeometry(1, 1, 1, 24);
  geometries.add(cube); geometries.add(cylinder);
  const mesh = (geo: BufferGeometry, mat: Material, pos: V3, scale: V3 = [1, 1, 1]): Mesh => {
    const m = new Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.castShadow = m.receiveShadow = true; group.add(m); return m;
  };
  const box = (pos: V3, size: V3, mat: Material): Mesh => mesh(cube, mat, pos, size);
  const rod = (pos: V3, radius: number, height: number, mat: Material): Mesh => mesh(cylinder, mat, pos, [radius, height, radius]);
  const round = (pos: V3, size: V3, mat: Material, radius = .06): Mesh => {
    const geo = new RoundedBoxGeometry(...size, 2, radius); geometries.add(geo); return mesh(geo, mat, pos);
  };
  const pottery = new LatheGeometry([new Vector2(.12, 0), new Vector2(.22, .04), new Vector2(.24, .23), new Vector2(.12, .4), new Vector2(.1, .48)], 20); geometries.add(pottery);
  const vase = (x: number, y: number, z: number, mat: Material = accent): void => { mesh(pottery, mat, [x, y, z], [.72, .72, .72]); };
  const cup = (x: number, y: number, z: number): void => { rod([x, y + .09, z], .085, .18, porcelain); rod([x, y + .005, z], .15, .02, porcelain); };
  const cushion = (x: number, y: number, z: number, mat = accent): void => { round([x, y, z], [.6, .12, .5], mat, .055).rotation.y = -.12; };
  const book = (x: number, y: number, z: number, mat = ink): void => { round([x, y, z], [.42, .06, .6], mat, .012); box([x, y + .01, z + .302], [.37, .035, .008], cream); };
  const lamp = (x: number, y: number, z: number, industrial = false): void => {
    rod([x, y + .03, z], .22, .06, industrial ? ink : brass);
    rod([x, y + .38, z], .025, .7, industrial ? ink : brass);
    const geo = new CylinderGeometry(.24, .37, .35, industrial ? 8 : 28); geometries.add(geo);
    mesh(geo, industrial ? accent : cream, [x, y + .74, z]);
    rod([x, y + .57, z], .35, .025, industrial ? ink : brass);
  };
  const frame = (x: number, y: number, z: number, motif: 'fan' | 'circles' | 'grid'): void => {
    box([x, y, z], [1.65, 1.9, .07], timber); box([x, y, z + .045], [1.49, 1.74, .02], cream);
    if (motif === 'fan') for (let i = -4; i <= 4; i++) {
      const a = i * .24, len = Math.min(1.1, .64 / Math.max(.01, Math.abs(Math.sin(a))));
      box([x + Math.sin(a) * len / 2, y - .5 + Math.cos(a) * len / 2, z + .065], [.025, len, .012], accent).rotation.z = -a;
    } else if (motif === 'circles') {
      for (let i = 0; i < 3; i++) rod([x + (i - 1) * .35, y + (i % 2 ? .3 : -.2), z + .065], .28, .015, i % 2 ? accent : ink).rotation.x = Math.PI / 2;
    } else for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) box([x - .43 + col * .43, y - .5 + row * .5, z + .065], [.28, .3, .015], (row + col) % 2 ? accent : ink);
  };

  // One texture, no hundreds of tile meshes; large motifs remain legible at mobile scale.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = palette[0]; ctx.fillRect(0, 0, 1024, 768);
  ctx.strokeStyle = palette[1]; ctx.lineWidth = 14; ctx.strokeRect(24, 24, 976, 720);
  if (layout === 'terraces') {
    // Offset, architectural chevrons: luxurious but tightly regimented.
    ctx.lineWidth = work ? 16 : 30;
    for (let x = -512; x < 1536; x += 160) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x + 320, 384); ctx.lineTo(x, 708); ctx.stroke(); }
    ctx.strokeStyle = palette[2]; ctx.lineWidth = 5; ctx.strokeRect(52, 52, 920, 664);
  } else if (layout === 'oracle') {
    ctx.strokeStyle = palette[2]; ctx.lineWidth = 9;
    for (let radius = 100; radius < 355; radius += 60) { ctx.beginPath(); ctx.ellipse(512, 384, radius * 1.32, radius, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = palette[1]; ctx.beginPath(); ctx.arc(512, 384, 55, 0, Math.PI * 2); ctx.fill();
  } else if (layout === 'commons') {
    for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) {
      ctx.fillStyle = (row + col) % 3 ? palette[1] : palette[2]; ctx.beginPath();
      const x = 64 + col * 128, y = 64 + row * 128;
      ctx.moveTo(x, y - 38); ctx.lineTo(x + 38, y); ctx.lineTo(x, y + 38); ctx.lineTo(x - 38, y); ctx.closePath(); ctx.fill();
    }
  } else if (layout === 'wall' || layout === 'vault') {
    ctx.fillStyle = palette[1]; ctx.fillRect(0, 0, 1024, 768);
    ctx.strokeStyle = palette[0]; ctx.lineWidth = 3;
    for (let x = 0; x < 1024; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 768); ctx.stroke(); }
    for (let y = 0; y < 768; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
    ctx.fillStyle = palette[2]; ctx.fillRect(55, 45, 18, 678); ctx.fillRect(951, 45, 18, 678);
    if (work) for (let x = 80; x < 950; x += 70) { ctx.save(); ctx.translate(x, 680); ctx.rotate(-.5); ctx.fillRect(0, 0, 25, 80); ctx.restore(); }
  } else if (layout === 'garden') {
    for (let row = 0; row < 8; row++) for (let col = 0; col < 12; col++) {
      ctx.fillStyle = (row + col) % 2 ? palette[0] : palette[1]; ctx.fillRect(128 + col * 64, 128 + row * 64, 63, 63);
    }
    ctx.strokeStyle = palette[2]; ctx.lineWidth = 28; ctx.strokeRect(70, 70, 884, 628);
  } else if (layout === 'school') {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      ctx.fillStyle = (row + col) % 2 ? palette[1] : palette[2]; ctx.beginPath(); ctx.arc(176 + col * 224, 160 + row * 224, 76, (row + col) % 2 * Math.PI, ((row + col) % 2 + 1) * Math.PI); ctx.fill();
    }
  } else if (layout === 'conservatory') {
    ctx.strokeStyle = palette[1]; ctx.lineWidth = 11;
    for (let x = 90; x < 1000; x += 140) for (let y = 100; y < 750; y += 180) {
      ctx.beginPath(); ctx.ellipse(x, y, 39, 70, .5, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    for (let y = 55; y < 750; y += 86) { ctx.fillStyle = y % 172 < 100 ? palette[1] : palette[2]; ctx.fillRect(35, y, 954, 30); }
    ctx.strokeStyle = palette[0]; ctx.lineWidth = 5;
    for (let x = 70; x < 1000; x += 110) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 728); ctx.stroke(); }
  }
  if (!work && !['garden', 'oracle', 'conservatory', 'wall', 'vault'].includes(layout)) {
    ctx.fillStyle = 'rgba(250,240,210,.1)'; for (let y = 0; y < 768; y += 4) ctx.fillRect(0, y, 1024, 1);
  }
  const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 4; textures.add(map);
  const surfMat = material('#ffffff', 0, work ? .76 : .96); surfMat.map = map;
  const plane = new PlaneGeometry(6.3, 4.7); geometries.add(plane);
  // Conservatory has an existing raised central walk; set the mosaic above it.
  const surface = mesh(plane, surfMat, [3.7, layout === 'conservatory' ? .016 : layout === 'oracle' ? .085 : .035, 3.4]); surface.rotation.x = -Math.PI / 2; surface.castShadow = false;

  switch (layout) {
    case 'terraces':
      if (!work) { for (const x of [-1.9, -1, -.1]) cushion(x, .52, -1, ink); lamp(5.6, .76, -2); book(4.8, .79, -2); }
      else for (const x of [-1, 3, 7]) { cup(x + .7, .76, -1.7); book(x - .6, .79, -1.7, accent); }
      for (let i = 0; i < 5; i++) box([-4.22, 1 + i * .52, -.2], [.12, .05, 5.2 - i * .55], brass);
      break;
    case 'oracle':
      for (const x of [-1, 7]) { cushion(x - .35, .53, 0, cream); vase(x + .6, .47, -.18, brass); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box([3 + Math.cos(a) * .8, 1.64, -3 + Math.sin(a) * .8], [.035, .03, .15], cream).rotation.y = -a; }
      break;
    case 'commons':
      if (work) { for (const x of [-.5, 5.5]) { box([x, .8, -1], [.7, .08, .5], timber); rod([x + .2, .9, -1], .07, .12, ink); book(x + .8, .79, -.8, accent); } }
      else {
        vase(4.4, .76, -.8); cup(3.2, .76, -.5); cup(5.1, .76, -.6); for (const x of [3.3, 4.2, 5.1]) cushion(x, .53, 1, accent);
        // Inset doors and a stone worktop turn the solid kitchen volume into a usable cabinet.
        round([-2, .885, -2], [3.64, .07, .82], cream, .025);
        box([-2, .1, -1.625], [3.4, .13, .035], timber);
        for (let i = 0; i < 4; i++) {
          const x = -3.29 + i * .86;
          round([x, .47, -1.617], [.81, .66, .035], ink, .015);
          box([x + .27, .65, -1.577], [.035, .16, .045], brass);
        }
        round([-2.75, .94, -1.9], [.65, .04, .4], timber, .025).rotation.y = -.12;
        const bowlGeo = new LatheGeometry([new Vector2(.09, 0), new Vector2(.2, .035), new Vector2(.33, .22), new Vector2(.3, .24), new Vector2(.17, .07), new Vector2(.09, .045)], 28); geometries.add(bowlGeo);
        mesh(bowlGeo, porcelain, [-1.45, .92, -2], [.7, .7, .7]);
        vase(-.72, .92, -2.12, accent);
      }
      for (let i = 0; i < 7; i++) box([-4.61, 1.2 + i * .14, -.2], [.05, .035, 5.5], cream);
      break;
    case 'wall':
      lamp(6.8, .76, 0, true); book(5.5, .79, .1);
      if (!work) {
        round([-.7, .62, -2], [1.5, .08, 1.02], ink); for (let i = 0; i < 4; i++) box([-1.1 + i * .25, .666, -2], [.045, .012, 1], cream);
        round([-1.65, .67, -2], [.54, .18, .88], cream, .08);
        for (const x of [-1.9, -.1]) box([x, .22, -1.44], [.025, .34, .025], ink);
      }
      for (const x of [-3, 10]) { box([x, 1.9, -4.6], [.55, .8, .12], ink); for (let i = 0; i < 3; i++) box([x, 1.7 + i * .14, -4.51], [.35, .025, .03], accent); }
      break;
    case 'garden':
      for (const x of [-1, 4, 8]) { cup(x + .23, .8, -2); vase(x - .23, .8, -2, porcelain); }
      if (!work) for (const x of [-.6, .4, 6.4, 7.4]) cushion(x, .53, 0, accent);
      else for (let x = -2; x < 7; x += 1.5) {
        box([x, .5, -2.285], [.035, .88, .035], timber);
        box([x + .67, .76, -2.26], [.32, .035, .05], brass);
      }
      for (const x of [-3, 3, 9]) { box([x, 2.4, -4.88], [.055, 3.8, .04], brass); }
      break;
    case 'vault':
      if (!work) for (const x of [-1.8,1.3]) for (const y of [.59, 1.79]) { round([x-.25, y, -2], [1.5, .08, .95], ink); }
      else for (let i = 0; i < 5; i++) { box([-2 + i * 2.5, .65, -2.08], [1.3, .38, .025], cream); for (let j = 0; j < 3; j++) box([-2.4 + i * 2.5 + j * .25, .65, -2.055], [.08, .22, .015], ink); }
      lamp(7.7, .76, 0, true); cup(6.5, .76, 0);
      break;
    case 'school':
      if (!work) { for (let i = 0; i < 5; i++) cushion(3.1 + i * .95, .52, -1.7, i % 2 ? accent : cream); book(4.6, .79, .3); vase(5.6, .76, .3, ink); }
      else for (const x of [1, 5, 9]) { book(x - .4, .79, -.5); rod([x + .6, .86, -.5], .09, .2, accent); }
      if (!work) for (const x of [3.35, 5, 6.65]) {
        box([x, .24, -1.282], [1.55, .34, .035], ink);
        box([x, .32, -1.25], [.28, .035, .05], timber);
      }
      frame(-1.2, 3.15, -4.65, 'circles');
      break;
    case 'conservatory':
      if (!work) { for (const x of [1, 7]) { cushion(x - .35, .52, -2, ink); cushion(x + .35, .52, -2, accent); } vase(4, .76, 0, porcelain); cup(4.6, .76, 0); }
      else { book(3.3, .65, -5.6, ink); vase(2, .65, -5.6); }
      for (const x of [-3, 9]) { rod([x, .35, -.4], .42, .7, cream); for (let i = 0; i < 5; i++) rod([x + Math.sin(i * 2.4) * .14, 1.05, -.4 + Math.cos(i * 2.4) * .14], .025, 1.2, ink); }
      break;
    default:
      if (!work) { for (const x of [4.4, 5.2, 5.9]) cushion(x, .53, 1, accent); vase(4.8, .76, -.5, timber); cup(5.5, .76, -.5); }
      else { box([5.1, .94, -.9], [.38, .08, .18], timber); box([5.25, .99, -.9], [.14, .18, .25], ink); }
      for (let i = 0; i < 5; i++) rod([-2.8 + i % 2 * .27, .12 + Math.floor(i / 2) * .22, -1.8], .11, .65, timber).rotation.x = Math.PI / 2;
      frame(3, 2.55, -4.5, 'grid');
  }
  // Shared resources are owned exclusively by this layer and released once.
  let disposed = false;
  return { group, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}
