/**
 * Placement des éléments d'interface hors de la personne parlée [plan UI-C T8 ; spec C §3.2 ; I-3]. Fonctions pures, en pixels écran.
 * La zone interdite est le rectangle de la personne gonflé d'une marge ; la caméra ne bouge jamais. Aucun réglage n'est écrit ici :
 * la marge vient de `theme.street.personMarginPx`, mise à l'échelle de la largeur de la fenêtre.
 */
export interface ScreenRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface Size { readonly w: number; readonly h: number }
export interface Point { readonly x: number; readonly y: number }
export type BubbleSide = 'right' | 'left' | 'above';
export interface BubblePlacement { readonly rect: ScreenRect; readonly side: BubbleSide; readonly tail: Point }
/** Cadre où la bulle doit tenir : la fenêtre (`x`, `y` nuls) ou la zone que l'interface lui laisse (Z-centre, hors des bandes) [zones UX §2]. */
export type Bounds = Size & { readonly x?: number; readonly y?: number };
export interface PanelPlacement { readonly rect: ScreenRect; readonly side: 'right' | 'left' }

export const inflate = (r: ScreenRect, m: number): ScreenRect => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

/** Recouvrement des intérieurs : deux rectangles qui se touchent par un bord ne se recouvrent pas. */
export const intersects = (a: ScreenRect, b: ScreenRect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Marge (px) à la largeur de fenêtre donnée, `referenceW` étant la largeur de référence du thème : 24 à 1920, 12 à 960. */
export const scaledMargin = (basePx: number, viewportW: number, referenceW: number): number => (basePx * viewportW) / referenceW;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));
const fits = (r: ScreenRect, v: Bounds): boolean => r.x >= (v.x ?? 0) && r.y >= (v.y ?? 0) && r.x + r.w <= (v.x ?? 0) + v.w && r.y + r.h <= (v.y ?? 0) + v.h;

/**
 * Bulle essayée à droite, puis à gauche, puis au-dessus de la personne ; `null` si aucune ne tient dans la fenêtre.
 * La queue part du bord tourné vers la personne et dépasse de la moitié de la marge : elle la désigne sans la toucher.
 */
export function placeBubble(person: ScreenRect, size: Size, view: Bounds, margin: number, headShare: number): BubblePlacement | null {
  const zone = inflate(person, margin);
  const headY = person.y + person.h * headShare;   // la pointe vise la tête : `theme.street.headShare`
  const rowY = clamp(person.y, view.y ?? 0, (view.y ?? 0) + view.h - size.h);
  const candidates: { side: BubbleSide; rect: ScreenRect }[] = [
    { side: 'right', rect: { x: person.x + person.w + margin, y: rowY, w: size.w, h: size.h } },
    { side: 'left', rect: { x: person.x - margin - size.w, y: rowY, w: size.w, h: size.h } },
    { side: 'above', rect: { x: clamp(person.x + person.w / 2 - size.w / 2, view.x ?? 0, (view.x ?? 0) + view.w - size.w), y: person.y - margin - size.h, w: size.w, h: size.h } },
  ];
  for (const c of candidates) {
    if (!fits(c.rect, view) || intersects(zone, c.rect)) continue;
    const r = c.rect;
    const tail: Point = c.side === 'right' ? { x: r.x - margin / 2, y: clamp(headY, r.y, r.y + r.h) }
      : c.side === 'left' ? { x: r.x + r.w + margin / 2, y: clamp(headY, r.y, r.y + r.h) }
        : { x: clamp(person.x + person.w / 2, r.x, r.x + r.w), y: r.y + r.h + margin / 2 };
    return { rect: r, side: c.side, tail };
  }
  return null;
}

/**
 * Panneau d'options : en bas à droite, ou en bas à gauche si la zone interdite le coupe. `pad` : retrait des bords ; `bottomInset` : bande basse.
 * Sans personne, il reste à droite. Si les deux côtés coupent la zone, il reste du côté qui la recouvre le moins.
 */
export function placePanel(person: ScreenRect | null, size: Size, view: Size, margin: number, pad: number, bottomInset: number): PanelPlacement {
  const y = view.h - bottomInset - pad - size.h;
  const right: ScreenRect = { x: view.w - pad - size.w, y, w: size.w, h: size.h };
  const left: ScreenRect = { x: pad, y, w: size.w, h: size.h };
  if (person === null) return { side: 'right', rect: right };
  const zone = inflate(person, margin);
  if (!intersects(zone, right)) return { side: 'right', rect: right };
  if (!intersects(zone, left)) return { side: 'left', rect: left };
  const overlap = (a: ScreenRect): number => Math.max(0, Math.min(a.x + a.w, zone.x + zone.w) - Math.max(a.x, zone.x)) * Math.max(0, Math.min(a.y + a.h, zone.y + zone.h) - Math.max(a.y, zone.y));
  return overlap(left) < overlap(right) ? { side: 'left', rect: left } : { side: 'right', rect: right };
}
