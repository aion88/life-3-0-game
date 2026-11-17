/**
 * Optique de la rue, pure [art bible §D.2, §C.2 ; TV-02a-render] : zone nette, profondeur effective donnée au flou, liseré chromatique.
 * Cause du flou du texte et du mur de télés : le nœud `dof` de Three.js flouté DÈS qu'un pixel n'est pas exactement dans le plan net
 * (`smoothstep(0, portée, |écart|)`, aucune zone morte). Le plan net est PERPENDICULAIRE à l'axe de la caméra ; un mur vu de biais
 * s'étend de plus de 1 m de part et d'autre de lui, donc sa moitié proche tombait hors de la portée de 0,75 m et était floue.
 */

/**
 * Demi-zone nette, en mètres : N c s² / f² (la moitié de la zone nette `2 N c s² / f²` de l'art bible §D.2).
 * `focalMm` et `circleMm` en millimètres, `fNumber` sans unité, `focusM` en mètres.
 */
export function sharpHalfZoneM(focalMm: number, fNumber: number, focusM: number, circleMm: number): number {
  return (fNumber * circleMm * focusM * focusM * 1000) / (focalMm * focalMm);
}

/** Optique d'un mode : focale (mm, plein format), ouverture, cercle de confusion (mm). */
export interface Optics { readonly focalMm: number; readonly fNumber: number; readonly circleMm: number }

/** Demi-zone nette d'un mode à la distance de mise au point `focusM`. */
export function dofZoneHalfM(o: Optics, focusM: number): number {
  return sharpHalfZoneM(o.focalMm, o.fNumber, focusM, o.circleMm);
}

/**
 * Profondeur vue par le flou : le plan net est épaissi de `halfM` de chaque côté. Dedans, tout est à `focus` (aucun flou) ; au-delà, l'écart
 * compte à partir du bord de la zone. Se donne au nœud `dof` à la place de la profondeur de scène.
 */
export function effectiveDepth(depth: number, focus: number, halfM: number): number {
  const d = depth - focus;
  const beyond = Math.max(Math.abs(d) - halfM, 0);
  return focus + Math.sign(d) * beyond;
}

/**
 * Écart rouge-bleu, en pixels, au bord gauche ou droit de l'image pour le nœud `chromaticAberration` de Three.js r186 (`scale` 1,1) :
 * chaque canal est décalé de `offset x (scale x 0,02 x force +- force x |offset| x 0,01)`, soit à `offset` 0,5 (bord) deux fois ce décalage.
 */
export function chromaticEdgeSeparationPx(strength: number, widthPx: number, scale = 1.1): number {
  const offset = 0.5;
  const perChannel = offset * (scale * 0.02 * strength + strength * offset * 0.01);
  return 2 * perChannel * widthPx;
}

/**
 * Cercle de confusion normalisé 0 à 1 d'un point à `depth`, comme le nœud `dof` de Three.js le calcule avec la zone nette (`effectiveDepth`) :
 * `smoothstep(0, rampM, max(|depth - focus| - halfM, 0))`. 0 : net, 1 : flou total.
 */
export function blurAt(depth: number, focus: number, halfM: number, rampM: number): number {
  const x = Math.min(Math.max(Math.max(Math.abs(depth - focus) - halfM, 0) / rampM, 0), 1);
  return x * x * (3 - 2 * x);
}
