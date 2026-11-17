/**
 * Visée des nacelles [plan 02a T10 ; plan 02b T6 ; bible w10 §7.1]. Pur : ni DOM, ni horloge, ni hasard.
 * `aimOf` choisit la cible, `aimVector` en tire l'axe que le moteur (`stepGaze`) compare au joueur.
 */
import type { Vec2 } from '../moments/types';

/** Une cible possible d'une nacelle : un passant ou le joueur. */
export interface AimTarget { readonly id: string; readonly pos: Vec2 }

const distSq = (a: Vec2, b: Vec2): number => (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);

/** La cible à portée la plus proche (distance euclidienne), à égalité l'identifiant le plus petit ; `null` sans cible. */
export function aimOf(nacelle: AimTarget, targets: readonly AimTarget[], rangeM: number): AimTarget | null {
  let best: AimTarget | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = distSq(nacelle.pos, t.pos);
    if (d > rangeM * rangeM) continue;
    if (d < bestD || (d === bestD && best !== null && t.id < best.id)) { best = t; bestD = d; }
  }
  return best;
}

/** Axe de visée normalisé de la nacelle vers la cible ; `restAim` sans cible (ou cible confondue avec la nacelle). */
export function aimVector(nacellePos: Vec2, target: AimTarget | null, restAim: Vec2): Vec2 {
  if (target === null) return restAim;
  const dx = target.pos.x - nacellePos.x;
  const dz = target.pos.z - nacellePos.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  return len === 0 ? restAim : { x: dx / len, z: dz / len };
}
