/**
 * Placement hors de la personne [plan UI-C T8 ; spec C §3.2 ; I-3] : fonctions pures, nombres choisis à la main.
 * Aucune réglage n'est lu ici sauf la marge de 24 px à 1920 px de large, qui est la donnée du thème.
 */
import { describe, expect, it } from 'vitest';
import { inflate, intersects, placeBubble, placePanel, scaledMargin } from '../../../src/street/ui/placement';
import type { ScreenRect } from '../../../src/street/ui/placement';
import { loadUi } from '../../../src/data/ui/load';

const VIEW = { w: 1920, h: 1080 };
const MARGIN = loadUi().theme.street.personMarginPx.v;
const REF = loadUi().theme.street.referenceWidthPx.v;
const HEAD = loadUi().theme.street.headShare.v;
const BUBBLE = { w: 640, h: 180 };
const inside = (r: ScreenRect, v: { w: number; h: number }): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= v.w && r.y + r.h <= v.h;

/** Grille de 20 rectangles de personne (5 colonnes × 4 rangées), tailles variées. */
const GRID: ScreenRect[] = [];
for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) GRID.push({ x: 120 + i * 360, y: 60 + j * 230, w: 140 + (i % 3) * 30, h: 200 + (j % 2) * 120 });

describe('placement des éléments hors de la personne', () => {
  it('test_inflate_and_intersects_are_exact', () => {
    expect(inflate({ x: 100, y: 100, w: 50, h: 40 }, 10)).toEqual({ x: 90, y: 90, w: 70, h: 60 });
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);   // bords qui se touchent : pas de recouvrement
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });

  it('test_bubble_never_intersects_inflated_person', () => {
    let placed = 0;
    for (const person of GRID) {
      const p = placeBubble(person, BUBBLE, VIEW, MARGIN, HEAD);
      if (p === null) continue;
      placed++;
      expect(intersects(inflate(person, MARGIN), p.rect)).toBe(false);
      expect(inside(p.rect, VIEW)).toBe(true);
    }
    expect(placed).toBeGreaterThanOrEqual(15);   // la grille laisse presque toujours une place : le test ne passe pas à vide
  });

  it('test_bubble_goes_right_first', () => {
    const p = placeBubble({ x: 200, y: 300, w: 150, h: 300 }, BUBBLE, VIEW, MARGIN, HEAD)!;
    expect(p.side).toBe('right');
    expect(p.rect.x).toBe(200 + 150 + MARGIN);
  });

  it('test_bubble_flips_left_when_right_is_blocked', () => {
    const person = { x: 1500, y: 300, w: 150, h: 300 };          // à droite il reste 1920 - 1650 - 24 = 246 px : trop étroit pour 640
    const p = placeBubble(person, BUBBLE, VIEW, MARGIN, HEAD)!;
    expect(p.side).toBe('left');
    expect(p.rect.x + p.rect.w).toBe(person.x - MARGIN);
  });

  it('test_bubble_goes_above_when_both_sides_are_blocked', () => {
    const person = { x: 700, y: 500, w: 500, h: 400 };            // 700 - 24 < 640 à gauche, 1920 - 1200 - 24 = 696 à droite : on rétrécit la scène
    const wide = { w: 800, h: 180 };
    const p = placeBubble(person, wide, VIEW, MARGIN, HEAD)!;
    expect(p.side).toBe('above');
    expect(p.rect.y + p.rect.h).toBe(person.y - MARGIN);
  });

  it('test_bubble_null_when_nowhere_fits', () => {
    expect(placeBubble({ x: 100, y: 20, w: 1700, h: 1000 }, BUBBLE, VIEW, MARGIN, HEAD)).toBeNull();
  });

  it('test_panel_moves_to_opposite_side_of_person', () => {
    const size = { w: 760, h: 500 };
    const pad = 16;
    const free = placePanel({ x: 300, y: 300, w: 150, h: 300 }, size, VIEW, MARGIN, pad, 0);
    expect(free.side).toBe('right');
    const blocked = placePanel({ x: 1300, y: 500, w: 150, h: 400 }, size, VIEW, MARGIN, pad, 0);   // la zone interdite coupe le coin bas droit
    expect(blocked.side).toBe('left');
    expect(intersects(inflate({ x: 1300, y: 500, w: 150, h: 400 }, MARGIN), blocked.rect)).toBe(false);
    expect(placePanel(null, size, VIEW, MARGIN, pad, 0).side).toBe('right');
  });

  it('test_panel_stays_above_the_bottom_band', () => {
    const p = placePanel(null, { w: 700, h: 300 }, VIEW, MARGIN, 16, 120);
    expect(p.rect.y + p.rect.h).toBe(VIEW.h - 120 - 16);
  });

  it('test_margin_scales_with_viewport_width', () => {
    expect(scaledMargin(MARGIN, 1920, REF)).toBe(24);
    expect(scaledMargin(MARGIN, 960, REF)).toBe(12);
  });

  it('test_tail_aims_at_the_head_share_of_the_person', () => {
    const person = { x: 200, y: 300, w: 150, h: 300 };
    const p = placeBubble(person, BUBBLE, VIEW, MARGIN, 0.5)!;
    expect(p.tail.y).toBe(Math.min(Math.max(300 + 150, p.rect.y), p.rect.y + p.rect.h));   // 0,5 : le milieu de la personne, borné à la bulle
    expect(placeBubble(person, BUBBLE, VIEW, MARGIN, 0.1)!.tail.y).not.toBe(p.tail.y);
  });

  it('test_bubble_stays_inside_bounds_outside_bands_and_edges', () => {
    // Z-centre de 1920 x 1080 : bandes 2,39:1 de 138 px, marge 16 px ; la bulle ne sort jamais de ce cadre [zones UX Z-1, revue T8 I-1 et I-2]
    const B = { x: 400, y: 154, w: 1120, h: 772 };
    const inB = (r: ScreenRect): boolean => r.x >= B.x && r.y >= B.y && r.x + r.w <= B.x + B.w && r.y + r.h <= B.y + B.h;
    let placed = 0;
    for (const person of GRID) {
      const p = placeBubble(person, BUBBLE, B, MARGIN, HEAD);
      if (p === null) continue;
      placed++;
      expect(inB(p.rect), JSON.stringify({ person, rect: p.rect })).toBe(true);
    }
    expect(placed).toBeGreaterThan(0);
    const high = placeBubble({ x: 700, y: 60, w: 150, h: 300 }, BUBBLE, B, MARGIN, HEAD)!;   // personne qui monte dans la bande du haut
    expect(high.rect.y).toBeGreaterThanOrEqual(B.y);
  });

  it('test_tail_points_at_person_without_touching', () => {
    for (const person of GRID) {
      const p = placeBubble(person, BUBBLE, VIEW, MARGIN, HEAD);
      if (p === null) continue;
      const t = p.tail;
      const touching = t.x >= person.x && t.x <= person.x + person.w && t.y >= person.y && t.y <= person.y + person.h;
      expect(touching).toBe(false);
      const d = p.side === 'right' ? p.rect.x - t.x : p.side === 'left' ? t.x - (p.rect.x + p.rect.w) : t.y - (p.rect.y + p.rect.h);
      expect(d).toBe(MARGIN / 2);                                      // la pointe dépasse de la moitié de la marge, vers la personne
      expect(t.x).toBeGreaterThanOrEqual(p.rect.x - MARGIN); expect(t.y).toBeGreaterThanOrEqual(p.rect.y - MARGIN);
    }
  });
});
