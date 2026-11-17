/** Le Coffre de calcul, repère de la rue : bloc aveugle, bancs de toiture, cheminée, enceinte, portail [plan 02a T6 ; bible w10 §5.3]. */
import type { Object3D } from 'three/webgpu';
import { group, instances, part, type Inst, type Kit } from './kit';

/** Épaisseur du mur d'enceinte et du portail : non donnée par la bible, cosmétique. */
const WALL_T = 0.5;
const GATE_T = 0.2;
/** Longueur de la rampe devant le portail, en mètres de z. */
const RAMP_LEN = 4;

/** Construit `place.facadeCoffre` (bloc, toiture, cheminée) et `place.portail` (enceinte, portail, rampe, projecteurs). */
export function buildCoffre(root: Object3D, k: Kit): { facade: Object3D; portail: Object3D } {
  const { coffre: c, build, layout } = k.d;
  const zFace = layout.places.facadeCoffre.z.v;
  const zGate = layout.places.portail.z.v;
  const half = layout.halfWidthM.v;
  const H = c.heightM.v;
  const concrete = k.solid(build.palette.shadow.v, 0.9);

  const facade = group(root, 'place.facadeCoffre');
  part(facade, k.box, concrete, 'coffre.block', [c.widthM.v, H, c.depthM.v], [0, H / 2, zFace - c.depthM.v / 2]);
  const gap = c.widthM.v / (c.benchCount.v + 1);
  for (let i = 0; i < c.benchCount.v; i++) {
    part(facade, k.box, k.solid(build.palette.mid.v, 0.6), `coffre.bench.${i}`, [c.benchLengthM.v, c.benchHeightM.v, c.benchDepthM.v], [-c.widthM.v / 2 + gap * (i + 1), H + c.benchHeightM.v / 2, zFace - c.depthM.v / 2]);
  }
  const chimneyX = c.widthM.v / 2 - 8;   // en retrait du bord de toiture, non donné par la bible
  const r = c.chimneyRadiusM.v;
  part(facade, k.cylinder, concrete, 'coffre.chimney', [r, c.chimneyM.v, r], [chimneyX, H + c.chimneyM.v / 2, zFace - c.depthM.v / 2]);
  const beacon = part(facade, k.sphere, k.glow(build.palette.red.v, build.beaconGain.v), 'coffre.beacon', [r / 2, r / 2, r / 2], [chimneyX, H + c.chimneyM.v + r / 2, zFace - c.depthM.v / 2]);
  const strip = part(facade, k.box, k.glow(build.palette.led.v, build.ledGain.v), 'coffre.led', [c.widthM.v, 0.4, 0.2], [0, H - 1, zFace + 0.1]);
  k.otherEmissives.push(beacon, strip);

  const portail = group(root, 'place.portail');
  const steel = k.solid(build.palette.mid.v, 0.4);
  const gateW = c.portalWidthM.v;
  const sideW = half - gateW / 2;
  for (const side of [1, -1]) {
    part(portail, k.box, concrete, `enceinte.${side > 0 ? 'east' : 'west'}`, [sideW, c.enceinteM.v, WALL_T], [side * (gateW / 2 + sideW / 2), c.enceinteM.v / 2, zGate]);
  }
  part(portail, k.box, steel, 'portail.gate', [gateW, c.portalHeightM.v, GATE_T], [0, c.portalHeightM.v / 2, zGate]);
  part(portail, k.box, k.solid(build.palette.mid.v, 0.7), 'portail.ramp', [c.rampWidthM.v, 0.15, RAMP_LEN], [0, 0.075, zGate + RAMP_LEN / 2 + WALL_T / 2]);
  const n = Math.floor((2 * half) / c.projectorEveryM.v) + 1;
  const projectors: Inst[] = Array.from({ length: n }, (_, i) => ({ p: [(i - (n - 1) / 2) * c.projectorEveryM.v, c.enceinteM.v + 0.2, zGate + 0.4] as const, s: [0.5, 0.3, 0.3] as const }));
  instances(portail, k, 'portail.projectors', k.glow(build.palette.led.v, build.ledGain.v), projectors);
  const proj = portail.getObjectByName('portail.projectors');
  if (proj !== undefined) k.otherEmissives.push(proj);
  return { facade, portail };
}
