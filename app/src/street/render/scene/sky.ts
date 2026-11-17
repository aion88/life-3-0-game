/**
 * Dôme de ciel : dégradé à trois arrêts + halo solaire, sans texture, un seul appel de dessin [ciel-jour-spec §2, TV-02a-render].
 * Sphère centrée sur la caméra, dessinée avant tout, sans profondeur ni brouillard : elle remplace l'aplat de fond. Les mêmes constantes que
 * `render/sky.ts` (règle pure testée). Aucun écriture du canal de bloom : seuls les écrans l'écrivent, donc pas de bloom sur le ciel.
 */
import { BackSide, Color, Mesh, MeshBasicNodeMaterial, SRGBColorSpace, SphereGeometry, Vector3, type Object3D } from 'three/webgpu';
import { clamp, dot, float, max, mix, positionLocal, smoothstep, uniform, acos } from 'three/tsl';
import type { LightRig } from '../lighting';
import { MID_SIN } from '../sky';
import type { Kit } from './kit';

export interface SkyDome {
  /** Pose les arrêts, le halo et la direction du soleil de l'état de lumière, et centre le dôme sur `eye`. */
  apply(rig: LightRig, eye: { readonly x: number; readonly y: number; readonly z: number }): void;
}

export function buildSky(root: Object3D, k: Kit, radiusM: number): SkyDome {
  const zenith = uniform(new Color());
  const mid = uniform(new Color());
  const horizon = uniform(new Color());
  const halo = uniform(new Color());
  const haloRad = uniform(0);
  const sun = uniform(new Vector3(0, 1, 0));

  const dir = positionLocal.normalize();
  const e = max(dir.y, 0);
  const low = mix(horizon, mid, smoothstep(float(0), float(MID_SIN), e));
  const gradient = mix(low, zenith, smoothstep(float(MID_SIN), float(1), e));
  const angle = acos(clamp(dot(dir, sun), -1, 1));
  const lobe = float(1).sub(smoothstep(float(0), max(haloRad, float(1e-4)), angle));
  const mat = k.bag.material(new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false }));
  mat.colorNode = mix(gradient, halo, lobe.mul(lobe));

  const dome = new Mesh(k.bag.geometry(new SphereGeometry(1, 32, 16)), mat);
  dome.name = 'sky.dome';
  dome.scale.setScalar(radiusM);
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  root.add(dome);

  return {
    apply(rig, eye) {
      (zenith.value as Color).setRGB(...rig.skyZenith, SRGBColorSpace);
      (mid.value as Color).setRGB(...rig.skyMid, SRGBColorSpace);
      (horizon.value as Color).setRGB(...rig.skyHorizon, SRGBColorSpace);
      (halo.value as Color).setRGB(...rig.sunHalo, SRGBColorSpace);
      haloRad.value = (rig.sunHaloRadiusDeg * Math.PI) / 180;
      (sun.value as Vector3).set(...rig.sunDir);
      dome.position.set(eye.x, eye.y, eye.z);
    },
  };
}
