/** Cadrage du lecteur de situations : zoom sur le corps du joueur, sans bord vide, tête et pieds dans la fenêtre. */
import { describe, expect, it } from 'vitest';
import { MARGIN, MAX_ZOOM, RENDERED_BODY, TARGET, playerFrame } from '../../../src/worlds/situations/situationFrame';

const SPOT: [number, number] = [0.43, 0.89];
describe('cadrage sur le joueur', () => {
  it('test_playerFrame_aWideWindow_zoomsSoTheBodyTakesTheTargetShare', () => {
    const box = playerFrame(1100, 513, SPOT, 0.39);
    const body = 0.39 * RENDERED_BODY * box.height;
    expect(body / 513).toBeCloseTo(TARGET, 2);
    expect(box.zoom).toBeGreaterThan(1);
  });
  it('test_playerFrame_neverLeavesAnEmptyEdge', () => {
    for (const [w, h] of [[1100, 513], [361, 145], [1100, 301], [361, 243]] as const) for (const x of [0.05, 0.5, 0.95]) for (const y of [0.7, 0.9]) {
      const box = playerFrame(w, h, [x, y], 0.4);
      expect(box.left, `${w}x${h} left`).toBeLessThanOrEqual(0.0001); expect(box.left + box.width, `${w}x${h} right`).toBeGreaterThanOrEqual(w - 0.0001);
      expect(box.top, `${w}x${h} top`).toBeLessThanOrEqual(0.0001); expect(box.top + box.height, `${w}x${h} bottom`).toBeGreaterThanOrEqual(h - 0.0001);
    }
  });
  it('test_playerFrame_headAndFeetStayInsideWithTheirMargin', () => {
    for (const [w, h] of [[1100, 513], [361, 145], [361, 243]] as const) for (const height of [0.32, 0.39, 0.45]) {
      const box = playerFrame(w, h, SPOT, height); const feet = box.top + SPOT[1] * box.height; const head = feet - height * RENDERED_BODY * box.height;
      expect(head, `${w}x${h} h${height} head`).toBeGreaterThanOrEqual(MARGIN * h - 0.5); expect(feet, `${w}x${h} h${height} feet`).toBeLessThanOrEqual((1 - MARGIN) * h + 0.5);
    }
  });
  it('test_playerFrame_zoomIsCapped_andNeverBelowOne', () => {
    expect(playerFrame(1100, 513, SPOT, 0.05).zoom).toBe(MAX_ZOOM);
    expect(playerFrame(1100, 300, SPOT, 0.6).zoom).toBe(1);
  });
});
