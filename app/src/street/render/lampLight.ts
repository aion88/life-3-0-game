/**
 * Lumière des lampadaires, pure [TV-02a-render]. Cause du défaut « tête allumée, aucune lumière » : les têtes n'étaient que des maillages
 * émissifs (`MeshBasicNodeMaterial`), la scène ne portait aucune source réelle en dehors de l'hémisphère et du soleil, donc ni la chaussée
 * ni les corps ne recevaient rien. Douze sources réelles coûteraient à chaque fragment : on en garde `realCount` près de la vue, et chaque
 * lampadaire a sa flaque simulée (décal additif, un seul appel de dessin).
 */
import { lampPositions } from '../../engine/view/layout';
import type { SceneData } from '../../engine/view/sceneSchema';

export interface Pos3 { readonly x: number; readonly y: number; readonly z: number }

/** Écart vertical entre la tête émissive et la source : la lumière part de sous la tête, pas de son centre. */
const BELOW_HEAD_M = 0.15;

/** Position de la source de chaque lampadaire : sous la tête, dont le centre est à `mastM - 0,1`, à `mastX - lampArmM` du bord [`scene/lamps.ts`]. */
export function lampHeadPositions(d: SceneData): readonly Pos3[] {
  const mastX = d.layout.halfWidthM.v - 0.4;
  return lampPositions(d).map((l) => ({ x: (l.side === 'east' ? 1 : -1) * (mastX - d.build.lampArmM.v), y: d.lamps.mastM.v - 0.1 - BELOW_HEAD_M, z: l.z }));
}

/**
 * Indices des `k` lampadaires les plus proches de `viewer` (distance au sol), du plus proche au plus loin ; à égalité l'indice le plus petit
 * (aucune oscillation d'une image à l'autre). `k` au-delà du nombre de lampadaires : tous.
 */
export function nearestLamps(heads: readonly Pos3[], viewer: { readonly x: number; readonly z: number }, k: number): readonly number[] {
  return heads
    .map((h, i) => ({ i, d: (h.x - viewer.x) * (h.x - viewer.x) + (h.z - viewer.z) * (h.z - viewer.z) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, Math.max(0, k))
    .map((e) => e.i);
}

/** Profil de la flaque, `t` = distance au centre / rayon : 1 sous le lampadaire, 0 au bord et au-delà (lissé, sans arête). */
export function poolProfile(t: number): number {
  if (t >= 1) return 0;
  const u = 1 - t * t;
  return u * u;
}

/** Direction (unitaire) du cône d'un lampadaire : vers le bas, inclinée de `tiltDeg` vers l'axe de la chaussée (x = 0). */
export function spotAim(side: 'east' | 'west', tiltDeg: number): readonly [number, number, number] {
  const t = (tiltDeg * Math.PI) / 180;
  return [(side === 'east' ? -1 : 1) * Math.sin(t), -Math.cos(t), 0];
}

/**
 * Hauteur jusqu'où le cône éclaire la façade qui fait face à la tête : le bord extérieur du cône est à `angleDeg - tiltDeg` de la verticale
 * (l'inclinaison l'éloigne du mur), il touche le mur à `headY - écart / tan(bord)`. En dessous, le mur est éclairé ; au-dessus, il ne l'est pas.
 */
export function wallLitHeightM(d: SceneData): number {
  const head = lampHeadPositions(d)[0]!;
  const gap = d.layout.halfWidthM.v - Math.abs(head.x);
  const edge = ((d.lamps.light.angleDeg.v - d.lamps.light.tiltDeg.v) * Math.PI) / 180;
  return edge <= 0 ? 0 : Math.max(0, head.y - gap / Math.tan(edge));
}
