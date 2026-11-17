/** Façades de béton instanciées par type : corps, fenêtres éteintes, fenêtres allumées [plan 02a T6 ; bible w10 §5.1 n°2]. */
import type { Object3D } from 'three/webgpu';
import { layoutFacades } from '../../../engine/view/layout';
import { worldSeedOf } from '../../../shared/types/world';
import { group, instances, type Inst, type Kit } from './kit';

/** Graine des façades : celle du monde plus 17 [bible w10 §5.1 n°2]. */
export const FACADE_SEED_OFFSET = 17;

/** Construit les façades des deux côtés. */
export function buildFacades(root: Object3D, k: Kit): void {
  const { build, layout } = k.d;
  const half = layout.halfWidthM.v;
  const H = build.storeyHeightM.v;
  const pitch = build.windowPitchM.v;
  const g = group(root, 'facades');
  const bodies: Inst[] = [];
  const dark: typeof bodies = [];
  const lit: typeof bodies = [];
  for (const f of layoutFacades(k.d, worldSeedOf('w10') + FACADE_SEED_OFFSET)) {
    const side = f.side === 'east' ? 1 : -1;
    const w = f.z1 - f.z0;
    bodies.push({ p: [side * (half + build.facadeDepthM.v / 2), (f.storeys * H) / 2, (f.z0 + f.z1) / 2], s: [build.facadeDepthM.v, f.storeys * H, w] });
    const cols = Math.floor(w / pitch);
    const margin = (w - cols * pitch) / 2;
    for (let s = 0; s < f.storeys; s++) {
      for (let c = 0; c < cols; c++) {
        const win = { p: [side * (half + 0.02), s * H + build.windowCenterM.v, f.z0 + margin + (c + 0.5) * pitch] as const, s: [0.06, build.windowHeightM.v, build.windowWidthM.v] as const };
        (f.litMask[s * cols + c] ? lit : dark).push(win);
      }
    }
  }
  instances(g, k, 'facade.body', k.solid(build.palette.mid.v, 0.9), bodies);
  instances(g, k, 'facade.windows.dark', k.solid(build.palette.shadow.v, 0.2), dark);
  instances(g, k, 'facade.windows.lit', k.glow(build.palette.interior.v, build.litWindowGain.v, true), lit);
  if (lit.length > 0) k.otherEmissives.push(g.getObjectByName('facade.windows.lit')!);
}
