/**
 * Cadrage du lecteur de situations : l'image est zoomée sur le personnage joueur pour qu'il occupe `TARGET` de la hauteur visible
 * (les plaques sont des plans larges : montrées en entier, le corps se perd dans la pièce). Calcul pur, sans DOM.
 * Le zoom agrandit le cadre de la vue (pas une transformation) : la vue se redessine à la bonne taille.
 */

/** Part de la hauteur visible que le corps doit occuper. */
export const TARGET = 0.62;
/** Zoom maximal (au-delà, les plaques deviennent floues). */
export const MAX_ZOOM = 1.9;
/** Mesuré sur 40 lieux : le corps rendu fait 1,08 à 1,10 fois la valeur `actorHeights` de la plaque. */
export const RENDERED_BODY = 1.09;
/** Marge minimale au-dessus de la tête et sous les pieds, en part de la hauteur visible. */
export const MARGIN = 0.06;

/** Position et taille du cadre (en pixels, dans la fenêtre de l'image), et zoom appliqué. */
export interface FrameBox { left: number; top: number; width: number; height: number; zoom: number }

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * @param stageWidth largeur visible de l'image, en pixels
 * @param stageHeight hauteur visible de l'image, en pixels
 * @param spot où se tiennent les pieds du joueur, en part de la plaque (`actorSpots[0]`)
 * @param height hauteur du corps en part de la plaque (`actorHeights[0]`)
 */
export function playerFrame(stageWidth: number, stageHeight: number, spot: readonly [number, number], height: number): FrameBox {
  const baseWidth = Math.max(stageWidth, stageHeight * 16 / 9); const baseHeight = baseWidth * 9 / 16;
  const body = height * RENDERED_BODY;
  const zoom = clamp(TARGET * stageHeight / (body * baseHeight), 1, MAX_ZOOM);
  const width = baseWidth * zoom; const frameHeight = baseHeight * zoom;
  const left = clamp(stageWidth / 2 - spot[0] * width, stageWidth - width, 0);
  let top = clamp(stageHeight / 2 - (spot[1] - body / 2) * frameHeight, stageHeight - frameHeight, 0);
  // Tête et pieds dans le cadre avec leur marge, sans jamais découvrir un bord vide.
  const feet = (): number => top + spot[1] * frameHeight; const head = (): number => feet() - body * frameHeight;
  if (head() < MARGIN * stageHeight) top = Math.min(0, top + (MARGIN * stageHeight - head()));
  // Le corps rendu dépasse `height` vers le bas (mesuré : tête à `spot - height`, semelles à `spot + body - height`).
  const sole = (): number => feet() + (body - height) * frameHeight;
  if (sole() > (1 - MARGIN) * stageHeight) top = Math.max(stageHeight - frameHeight, top - (sole() - (1 - MARGIN) * stageHeight));
  return { left, top, width, height: frameHeight, zoom };
}
