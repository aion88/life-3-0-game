/** Lampadaires au sodium : mâts, bras et têtes instanciés, six par côté [plan 02a T6 ; bible w10 §5.1 n°1]. */
import { AdditiveBlending, Color, DataTexture, InstancedMesh, LinearFilter, MeshBasicNodeMaterial, Object3D, PlaneGeometry, RGBAFormat, SpotLight, Sprite, SpriteNodeMaterial, UnsignedByteType, type Texture } from 'three/webgpu';
import { lampPositions } from '../../../engine/view/layout';
import { lampHeadPositions, nearestLamps, poolProfile, spotAim } from '../lampLight';
import { group, instances, type Inst, type Kit } from './kit';

/** Mât de 7 m, bras vers la chaussée, tête sodium. Les têtes sont des sources émissives comptées dans les 2 % de la rue (T2). */
export interface LampLights {
  /** Allume (`level` 0 à 1) ; `viewer` : point du sol que l'on regarde, les sources réelles vont aux lampadaires les plus proches. */
  apply(level: number, viewer: { readonly x: number; readonly z: number }): void;
}

const POOL_TEXTURE_PX = 64;

/** Profil radial de la flaque (blanc, alpha = `poolProfile`) : texture de données, aucun canevas (la scène se construit aussi sous Vitest). */
function poolTexture(k: Kit): Texture {
  const data = new Uint8Array(POOL_TEXTURE_PX * POOL_TEXTURE_PX * 4);
  for (let y = 0; y < POOL_TEXTURE_PX; y++) for (let x = 0; x < POOL_TEXTURE_PX; x++) {
    const dx = ((x + 0.5) / POOL_TEXTURE_PX - 0.5) * 2, dy = ((y + 0.5) / POOL_TEXTURE_PX - 0.5) * 2;
    const i = (y * POOL_TEXTURE_PX + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(255 * poolProfile(Math.sqrt(dx * dx + dy * dy)));
  }
  const t = k.bag.texture(new DataTexture(data, POOL_TEXTURE_PX, POOL_TEXTURE_PX, RGBAFormat, UnsignedByteType));
  t.magFilter = t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

export function buildLamps(root: Object3D, k: Kit): LampLights {
  const { build, lamps, layout } = k.d;
  const mastX = layout.halfWidthM.v - 0.4;
  const r = build.mastRadiusM.v;
  const mast = lamps.mastM.v;
  const arm = build.lampArmM.v;
  const hl = build.lampHeadLengthM.v, hh = build.lampHeadHeightM.v, hw = build.lampHeadWidthM.v;
  const RIM_M = 0.03;   // épaisseur de la lentille, qui déborde en liseré sur les faces latérales [art-director]
  const g = group(root, 'lamps');
  const masts: Inst[] = [];
  const arms: typeof masts = [];
  const bodies: typeof masts = [];
  const lenses: typeof masts = [];
  for (const l of lampPositions(k.d)) {
    const side = l.side === 'east' ? 1 : -1;
    masts.push({ p: [side * mastX, mast / 2, l.z], s: [r * 2, mast, r * 2] });
    arms.push({ p: [side * (mastX - arm / 2), mast, l.z], s: [arm, 0.08, 0.08] });
    bodies.push({ p: [side * (mastX - arm), mast - 0.1 + RIM_M / 2, l.z], s: [hl, hh - RIM_M, hw] });
    lenses.push({ p: [side * (mastX - arm), mast - 0.1 - hh / 2 + RIM_M / 2, l.z], s: [hl, RIM_M, hw] });
  }
  const steel = k.solid(build.palette.shadow.v, 0.5);
  instances(g, k, 'lamp.masts', steel, masts);
  instances(g, k, 'lamp.arms', steel, arms);
  instances(g, k, 'lamp.heads.body', k.solid(build.palette.barrierBlack.v, 0.9), bodies);   // corps noir mat : seule la lentille (face inférieure et liseré) est émissive
  instances(g, k, 'lamp.heads', k.glow(build.palette.sodium.v, build.lampLensGain.v, true), lenses);
  k.otherEmissives.push(g.getObjectByName('lamp.heads')!);

  // lumière : une flaque simulée par lampadaire (un seul appel de dessin) et `realCount` sources réelles près de la vue [TV-02a-render]
  const L = k.d.lamps.light;
  const heads3 = lampHeadPositions(k.d);
  const sodium = new Color(build.palette.sodium.v);
  const poolMat = k.bag.material(new MeshBasicNodeMaterial({ map: poolTexture(k), color: sodium, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  const poolGeo = k.bag.geometry(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const diameter = 2 * L.poolRadiusM.v;
  const pools: Inst[] = heads3.map((h) => ({ p: [h.x, 0.11, h.z], s: [diameter, 1, diameter] }));   // au-dessus du trottoir (0,1 m) et de la chaussée
  const poolMesh = k.bag.instanced(new InstancedMesh(poolGeo, poolMat, pools.length));
  poolMesh.name = 'lamp.pools';
  poolMesh.renderOrder = 1;
  const dummy = new Object3D();
  pools.forEach((it, i) => { dummy.position.set(...it.p); dummy.scale.set(...it.s); dummy.updateMatrix(); poolMesh.setMatrixAt(i, dummy.matrix); });
  poolMesh.instanceMatrix.needsUpdate = true;
  g.add(poolMesh);
  const lights = Array.from({ length: L.realCount.v }, (_, i) => {
    // cône vers le bas (lampe de rue à coupure) : un point éclairait la façade sur toute sa hauteur [art-director, captures lampadaires]
    const l = new SpotLight(sodium, 0, L.distanceM.v, (L.angleDeg.v * Math.PI) / 180, L.penumbra.v, L.decay.v);
    l.name = `lamp.light.${i}`;
    g.add(l, l.target);
    return l;
  });
  // halo additif face caméra sur chaque tête : le bloom est réservé aux écrans [test T13], le halo rend la source lisible même au bord du cadre
  const glowMat = k.bag.material(new SpriteNodeMaterial({ map: poolTexture(k), color: sodium, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  const glows = heads3.map((h, i) => {
    const sp = new Sprite(glowMat);
    sp.name = `lamp.glow.${i}`;
    sp.position.set(h.x, h.y + 0.1, h.z);   // sous la tête : au niveau de la lentille
    sp.scale.setScalar(2 * L.glowRadiusM.v);
    g.add(sp);
    return sp;
  });
  return {
    apply(level, viewer) {
      poolMat.opacity = L.poolOpacity.v * level;
      poolMesh.visible = level > 0;
      glowMat.opacity = L.glowOpacity.v * level;
      for (const sp of glows) sp.visible = level > 0;
      const near = nearestLamps(heads3, viewer, lights.length);
      lights.forEach((l, i) => {
        const h = heads3[near[i] ?? 0]!;
        l.position.set(h.x, h.y, h.z);
        const a = spotAim(h.x > 0 ? 'east' : 'west', L.tiltDeg.v);
        l.target.position.set(h.x + a[0] * 10, h.y + a[1] * 10, h.z + a[2] * 10);
        l.target.updateMatrixWorld();
        l.intensity = near[i] === undefined ? 0 : L.intensityCd.v * level;
      });
    },
  };
}
