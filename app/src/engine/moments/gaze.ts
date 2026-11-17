/**
 * Nacelles et regards [plan 02b T6 ; bible w10 §5.0, §7.1, §7.3 ; GDD 05 3.7 écran 5].
 * Pur et entier : le cône se teste sans trigonométrie, par produits scalaires au carré. Tous les seuils viennent de `street.gaze`.
 * Le plancher (3) et le plafond (5) de regards par jour relèvent de `closeNight`, pas d'ici.
 */
import type { Palier } from '../../survival';
import type { StreetData } from '../../data/schema/street';
import type { Vec2 } from './types';

/** Une nacelle dont la visée est déjà résolue par la scène (plan 02a). */
export interface GazeNacelle { readonly id: string; readonly pos: Vec2; readonly aim: Vec2 }
export interface GazeInput { readonly dtMs: number; readonly player: Vec2; readonly nacelles: readonly GazeNacelle[]; readonly rangeM: number }
/** `inside` : ms cumulées dans le cône par nacelle ; `counted` : le regard de l'entrée en cours est déjà compté. */
export interface GazeTracker { readonly inside: Readonly<Record<string, number>>; readonly counted: Readonly<Record<string, boolean>> }

export const EMPTY_GAZE: GazeTracker = { inside: {}, counted: {} };

/** Portée lue du palier de la dernière nuit : `rangeWideM` pour les paliers listés, `rangeM` sinon. */
export function gazeRange(palier: Palier, street: StreetData): number {
  const g = street.gaze;
  return g.widePaliers.includes(palier) ? g.rangeWideM : g.rangeM;
}

/** Le joueur est-il dans le cône à portée ? Signe exigé : `dot > 0` ET `dot² × 1000 ≥ cos2Milli × |v|² × |aim|²` [R-02b.21]. */
function inCone(n: GazeNacelle, player: Vec2, rangeM: number, cos2Milli: number): boolean {
  const vx = player.x - n.pos.x; const vz = player.z - n.pos.z;
  const d2 = vx * vx + vz * vz;
  if (d2 > rangeM * rangeM) return false;
  const dot = vx * n.aim.x + vz * n.aim.z;
  if (dot <= 0) return false;
  return dot * dot * 1000 >= cos2Milli * d2 * (n.aim.x * n.aim.x + n.aim.z * n.aim.z);
}

/** Avance d'un pas. Un regard = présence continue STRICTEMENT plus longue que `holdMs`, un seul par entrée ; sortir remet à zéro. */
export function stepGaze(tracker: GazeTracker, input: GazeInput, street: StreetData): { readonly tracker: GazeTracker; readonly glanced: string | null } {
  const { holdMs, cos2Milli } = street.gaze;
  const inside: Record<string, number> = { ...tracker.inside };
  const counted: Record<string, boolean> = { ...tracker.counted };
  let glanced: string | null = null;
  for (const n of input.nacelles) {
    if (!inCone(n, input.player, input.rangeM, cos2Milli)) { inside[n.id] = 0; counted[n.id] = false; continue; }
    inside[n.id] = (inside[n.id] ?? 0) + Math.trunc(input.dtMs);   // entier comme `advance`
    if (inside[n.id]! > holdMs && !counted[n.id]) { counted[n.id] = true; glanced ??= n.id; }
  }
  return { tracker: { inside, counted }, glanced };
}
