/** Sol, trottoirs, lumière d'ambiance et nacelles de contrôle [plan 02a T6 ; bible w10 §5.0]. */
import { Color, DirectionalLight, HemisphereLight, SRGBColorSpace, type Object3D } from 'three/webgpu';
import type { LightRig } from '../lighting';
import type { Kit } from './kit';
import { group, part } from './kit';

/** Les deux lumières de la scène (hémisphère et soleil) : posées à chaque image par `setLight` selon l'état de lumière [TV-02a-render]. */
export interface SceneLights { apply(rig: LightRig): void }

/** Distance du soleil au centre de la scène, en mètres : la direction compte, pas la distance (lumière directionnelle). */
const SUN_DISTANCE_M = 50;

/** Chaussée mouillée, deux trottoirs et les lumières d'état (hémisphère + soleil, à régler par `SceneLights.apply`). */
export function buildGround(root: Object3D, k: Kit): SceneLights {
  const { layout, build } = k.d;
  // le sol se prolonge de la portée du brouillard de chaque côté : au bout de la rue la chaussée se fond dans l'horizon au lieu de s'arrêter net [ciel-jour-spec §4.4]
  const len = layout.zMax.v - layout.zMin.v + 2 * k.d.sky.fogFarM.v;
  const zc = (layout.zMax.v + layout.zMin.v) / 2;
  const half = layout.halfWidthM.v;
  const sw = build.sidewalkM.v;
  const g = group(root, 'ground');
  part(g, k.box, k.solid(build.palette.shadow.v, build.asphaltRoughness.v), 'road', [2 * (half - sw), 0.1, len], [0, -0.05, zc]);
  for (const side of [1, -1]) {
    part(g, k.box, k.solid(build.palette.mid.v, 0.7), `sidewalk.${side > 0 ? 'east' : 'west'}`, [sw, 0.15, len], [side * (half - sw / 2), 0.075 - 0.05, zc]);
  }
  const hemi = new HemisphereLight(new Color(build.palette.haze.v), new Color(build.palette.shadow.v), 0);
  hemi.name = 'ambient';
  const sun = new DirectionalLight(0xffffff, 0);
  sun.name = 'sun';
  root.add(hemi, sun, sun.target);
  return {
    apply(rig) {
      hemi.color.setRGB(...rig.sky, SRGBColorSpace);
      hemi.groundColor.setRGB(...rig.ground, SRGBColorSpace);
      hemi.intensity = rig.hemiIntensity;
      sun.color.setRGB(...rig.sunColor, SRGBColorSpace);
      sun.intensity = rig.sunIntensity;
      sun.position.set(rig.sunDir[0] * SUN_DISTANCE_M, rig.sunDir[1] * SUN_DISTANCE_M, rig.sunDir[2] * SUN_DISTANCE_M);
    },
  };
}

/** Une nacelle par `d.nacelles`, au z du moteur (l'identifiant `n<z>` le porte), orientée sur son axe de repos. */
export function buildNacelles(root: Object3D, k: Kit): ReadonlyMap<string, Object3D> {
  const out = new Map<string, Object3D>();
  const parent = group(root, 'nacelles');
  for (const n of k.d.nacelles) {
    const z = Number(n.id.slice(1));
    const g = group(parent, n.id);
    g.position.set(n.x.v, k.d.build.nacelleHeightM.v, z);
    const a = n.restAim.v;
    part(g, k.box, k.solid(k.d.build.palette.mid.v, 0.5), `${n.id}.housing`, [0.3, 0.3, 0.4], [0, 0, 0]);
    part(g, k.sphere, k.solid(k.d.build.palette.shadow.v, 0.3), `${n.id}.head`, [0.12, 0.12, 0.12], [0, 0, 0.25]);
    g.lookAt(g.position.x + a.x, g.position.y + a.y, g.position.z + a.z);
    out.set(n.id, g);
  }
  return out;
}
