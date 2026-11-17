/**
 * Plancher de lumière des personnages [art bible §E.1 : « le spike l'émet à 30 % de l'albédo » ; TV-02a-render].
 * Les corps MPFB sont des matériaux standard éclairés ; sans ce plancher, visage et silhouette tombent dans le noir dès que la lumière de la
 * scène baisse. L'émission suit l'albédo (sa carte s'il en a une) : le visage garde ses traits. Idempotent : les clones d'un corps partagent
 * leurs matériaux. Ne touche pas au canal de bloom (seuls les écrans l'écrivent, art bible §E.1) ni aux masques de mesure.
 */
import { Color, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';

const isStandard = (m: Material): m is MeshStandardMaterial => (m as MeshStandardMaterial).isMeshStandardMaterial === true;

/** Pose l'émission `gain` x albédo sur chaque matériau standard sous `root`. */
export function applyLightFloor(root: Object3D, gain: number): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh !== true) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!isStandard(m)) continue;
      if (m.map !== null) { m.emissiveMap = m.map; m.emissive = new Color(gain, gain, gain); }
      else m.emissive = m.color.clone().multiplyScalar(gain);
      m.emissiveIntensity = 1;
      m.needsUpdate = true;
    }
  });
}
