/** Checkpoint : guérite, barrière, mur d'écrans [plan 02a T6 ; bible w10 §5.2 a à c]. Arche, tourniquet et câbles : hors de cette tranche. */
import type { Mesh, Object3D } from 'three/webgpu';
import { group, instances, part, type Kit } from './kit';
import { buildWall, type WallBuild } from './wall';
import type { TextSurfaceFactory } from './textSurface';

/** Épaisseur du toit de la guérite et débords [bible w10 §5.2 a : 2,8 par 2,6 m, 0,12 m]. */
const ROOF = { w: 2.8, d: 2.6, t: 0.12 } as const;
/** Nombre de bandes grises et noires du bras [bible w10 §5.2 b]. */
const BANDS = 9;

/** Ce que les séquences jouées commandent au poste : la fente de la guérite et le bras de la barrière [GDD sequences-jouees §0.1]. */
export interface CheckpointRig {
  /** Fente de la guérite : au repos, allumée (plein feu), ou rouge (objet trouvé). */
  setSlit(state: 'idle' | 'lit' | 'red'): void;
  /** Bras de la barrière : 0 baissé, 1 levé (rotation autour du poteau, côté est). */
  setArm(t: number): void;
}

/** Construit le checkpoint dans un groupe `place.checkpoint` ; rend le groupe, le mur et le pilotage du poste. */
export function buildCheckpoint(root: Object3D, k: Kit, makeText: TextSurfaceFactory): { place: Object3D; wall: WallBuild; frontZ: number; rig: CheckpointRig } {
  const { checkpoint: c, build } = k.d;
  const z = k.d.interactions['wall']!.at.v.z;   // égal à `checkpoint.z` du moteur : `parseScene` le vérifie
  const place = group(root, 'place.checkpoint');
  const b = c.booth;
  const bx = c.boothX.v;
  const frontZ = z + b.depthM.v / 2;
  const steel = k.solid(build.palette.shadow.v, 0.45);

  part(place, k.box, steel, 'booth', [b.widthM.v, b.heightM.v, b.depthM.v], [bx, b.heightM.v / 2, z]);
  part(place, k.box, steel, 'booth.roof', [ROOF.w, ROOF.t, ROOF.d], [bx, b.heightM.v + ROOF.t / 2, z]);
  const slitMats = {
    idle: k.glow(build.palette.slit.v, build.lampGain.v, true),
    lit: k.glow(build.palette.slit.v, build.lampGain.v * b.slitLitGain.v, true),
    red: k.glow(build.palette.red.v, build.beaconGain.v),
  };
  const slit = part(place, k.box, slitMats.idle, 'booth.slit', [b.slitWidthM.v, b.slitHeightM.v, 0.02], [bx, b.slitCenterM.v, frontZ + 0.011]);
  k.otherEmissives.push(slit);

  // Barrière : poteau côté trottoir est, bras de 6,4 m vers l'ouest, devant la guérite et le mur.
  const r = c.barrier;
  const postX = c.barrierPostX.v;
  part(place, k.box, steel, 'barrier.post', [r.postM.v, r.postHeightM.v, r.postM.v], [postX, r.postHeightM.v / 2, frontZ + r.postM.v * 2]);
  const armY = r.postHeightM.v - r.armThicknessM.v / 2;
  const armZ = frontZ + r.postM.v * 2;
  const bandLen = c.barrierM.v / BANDS;
  const grey: { p: [number, number, number]; s: [number, number, number] }[] = [];
  const black: typeof grey = [];
  // le bras et sa lampe de bout pivotent ensemble autour du poteau (axe z) : à l'état baissé, les positions du monde sont celles d'avant le pivot
  const arm = group(place, 'barrier.arm');
  arm.position.set(postX, armY, armZ);
  for (let i = 0; i < BANDS; i++) {
    (i % 2 === 0 ? grey : black).push({ p: [-(i + 0.5) * bandLen, 0, 0], s: [bandLen, r.armThicknessM.v, r.armThicknessM.v] });
  }
  instances(arm, k, 'barrier.arm.grey', k.solid(build.palette.haze.v, 0.5), grey);
  instances(arm, k, 'barrier.arm.black', k.solid(build.palette.barrierBlack.v, 0.5), black);
  // lampe de barrière : un boîtier noir mat du diamètre de la bible (§5.2 b) et une petite source rouge sur sa face tournée vers la rue (+z). La sphère rouge
  // entière, non éclairée, devenait un disque pêche plat devant le mur d'écrans (le bloom des écrans lui rend du vert et du bleu) [TV-02a-render]
  const red = k.glow(build.palette.red.v, build.beaconGain.v);
  const housingMat = k.solid(build.palette.barrierBlack.v, 0.6);
  const lamp = (parent: Object3D, name: string, diameterM: number, x: number, y: number, z: number): Mesh => {
    part(parent, k.sphere, housingMat, `barrier.lamp.housing.${name}`, [diameterM / 2, diameterM / 2, diameterM / 2], [x, y, z]);
    const b = diameterM * r.bulbRatio.v / 2;
    return part(parent, k.sphere, red, `barrier.lamp.${name}`, [b, b, b], [x, y, z + diameterM * 0.4]);
  };
  const tip = lamp(arm, 'tip', r.lampM.v, -c.barrierM.v, 0, 0);
  const top = lamp(place, 'post', r.postLampM.v, postX, r.postHeightM.v + r.postLampM.v / 2, armZ);
  k.otherEmissives.push(tip, top);

  // Mur : contre la face gauche (ouest) de la guérite, centré sur le cliquable du mur.
  const wallCenterX = bx - b.widthM.v / 2 - c.wall.widthM / 2;
  const wall = buildWall(place, k, wallCenterX, frontZ, makeText);
  const rig: CheckpointRig = {
    setSlit(state) { slit.material = slitMats[state]; },
    setArm(t) { arm.rotation.z = -(Math.min(Math.max(t, 0), 1) * r.liftDeg.v * Math.PI) / 180; },   // le bras part vers l'ouest (-x) : -z le lève
  };
  return { place, wall, frontZ, rig };
}
