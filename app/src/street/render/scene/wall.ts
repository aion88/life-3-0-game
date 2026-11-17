/**
 * Mur d'écrans du checkpoint : seize téléviseurs CRT en grille 4 x 4, un seul orange, et le compteur [plan 02a T6 ; bible w10 §5.2 c].
 * C'est la source de signature du checkpoint sous l'exemption de l'art bible §B.1. Seuls ces écrans écrivent le canal de bloom.
 */
import { Color, ExtrudeGeometry, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, Shape, SRGBColorSpace } from 'three/webgpu';
import { color, float, fract, mix, screenCoordinate, step } from 'three/tsl';
import { wallCells, type WallTint } from '../../../engine/view/layout';
import { screenBloomMrt } from '../pipeline';
import { group, part, type Kit } from './kit';
import type { TextSurface, TextSurfaceFactory } from './textSurface';

/** Ce que le mur rend à la scène : ses écrans, son compteur, son rectangle. */
export interface WallBuild {
  readonly screens: readonly Object3D[]; readonly counter: TextSurface; readonly centerX: number; readonly heightM: number;
  /** Une télé (`wall.face`) prend la teinte orange : le visage de la joueuse pendant une séquence ; faux la rend à sa teinte. */
  setFace(on: boolean): void;
}

/**
 * Matériau d'un écran : couleur de la teinte (HSL lue en sRGB, comme les RGB de la bible), lignes de balayage en nœud TSL sur les
 * coordonnées d'écran (jamais une texture, nettes à toute distance), canal de bloom.
 */
function screenMaterial(k: Kit, tint: WallTint): MeshBasicNodeMaterial {
  const w = k.d.checkpoint.wall;
  const t = w.tints[tint].v;
  const c = new Color().setHSL(t.h / 360, t.s, t.l, SRGBColorSpace).multiplyScalar(w.look.glow.v);
  const m = k.bag.material(new MeshBasicNodeMaterial());
  const line = step(0.5, fract(screenCoordinate.y.div(w.look.scanlinePitchPx.v)));
  m.colorNode = color(c).mul(mix(float(1).sub(w.look.scanlineDepth.v), float(1), line));
  m.mrtNode = screenBloomMrt();
  m.name = `crt.${tint}`;
  return m;
}

/** Construit le mur, centré sur `centerX`, face avant au plan `frontZ`, et son compteur au-dessus. */
export function buildWall(parent: Object3D, k: Kit, centerX: number, frontZ: number, makeText: TextSurfaceFactory): WallBuild {
  const w = k.d.checkpoint.wall;
  const g = group(parent, 'wall');
  const tvW = w.tvWidthM.v, tvH = w.tvHeightM.v, depth = w.tvDepthM.v, frame = w.frameM.v, recess = w.recessM.v, plinth = w.plinthM.v;
  const dark = k.solid(k.d.build.palette.shadow.v, 0.6);

  part(g, k.box, k.solid(k.d.build.palette.mid.v, 0.8), 'wall.plinth', [w.widthM, plinth, depth], [centerX, plinth / 2, frontZ - depth / 2]);

  const cells = wallCells(k.d);
  const bodies = k.bag.instanced(new InstancedMesh(k.box, dark, cells.length));
  bodies.name = 'wall.tv.body';
  const ringShape = new Shape();
  ringShape.moveTo(-tvW / 2, -tvH / 2); ringShape.lineTo(tvW / 2, -tvH / 2); ringShape.lineTo(tvW / 2, tvH / 2); ringShape.lineTo(-tvW / 2, tvH / 2); ringShape.closePath();
  const hole = new Shape().moveTo(-tvW / 2 + frame, -tvH / 2 + frame);
  hole.lineTo(-tvW / 2 + frame, tvH / 2 - frame); hole.lineTo(tvW / 2 - frame, tvH / 2 - frame); hole.lineTo(tvW / 2 - frame, -tvH / 2 + frame); hole.closePath();
  ringShape.holes.push(hole);
  const ringGeo = k.bag.geometry(new ExtrudeGeometry(ringShape, { depth: recess, bevelEnabled: false }));
  const rings = k.bag.instanced(new InstancedMesh(ringGeo, k.solid(k.d.build.palette.mid.v, 0.5), cells.length));
  rings.name = 'wall.tv.frame';

  const planeGeo = k.bag.geometry(new PlaneGeometry(tvW - 2 * frame, tvH - 2 * frame));
  const mats = new Map<WallTint, MeshBasicNodeMaterial>();
  const screens: Object3D[] = [];
  const dummy = new Object3D();
  cells.forEach((cell, i) => {
    const x = centerX - w.widthM / 2 + (cell.col - 0.5) * tvW;
    const y = plinth + (w.rows.v - cell.row + 0.5) * tvH;
    dummy.position.set(x, y, frontZ - recess - (depth - recess) / 2); dummy.scale.set(tvW, tvH, depth - recess); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y, frontZ - recess); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); rings.setMatrixAt(i, dummy.matrix);
    let m = mats.get(cell.tint);
    if (m === undefined) { m = screenMaterial(k, cell.tint); mats.set(cell.tint, m); }
    const s = new Mesh(planeGeo, m);
    s.name = `screen.${cell.row}.${cell.col}`;
    s.position.set(x, y, frontZ - recess + 0.002);
    s.userData = { row: cell.row, col: cell.col, tint: cell.tint, hue: w.tints[cell.tint].v.h };
    g.add(s);
    screens.push(s);
  });
  bodies.instanceMatrix.needsUpdate = true; rings.instanceMatrix.needsUpdate = true;
  g.add(bodies, rings);

  const heightM = w.heightM;
  const counter = makeText({ widthM: w.widthM, heightM: k.d.build.counterPanelHeightM.v, bag: k.bag });
  counter.object.name = 'wallCounter';
  counter.object.position.set(centerX, heightM + k.d.build.counterPanelHeightM.v / 2 + 0.05, frontZ + 0.01);
  g.add(counter.object);
  const faceMesh = screens.find((o) => o.userData['row'] === w.face.row && o.userData['col'] === w.face.col) as Mesh | undefined;
  const orange = mats.get('orange');
  const faceBase = faceMesh?.material;
  return {
    screens, counter, centerX, heightM,
    setFace(on) { if (faceMesh !== undefined && orange !== undefined && faceBase !== undefined) faceMesh.material = on ? orange : faceBase; },
  };
}
