/** Aides de test de `street_caps_test.ts` : images RGBA opaques construites en code [plan 02a T2 ; R-02a.2]. */
import type { Crop, Rgba } from '../../src/engine/view/caps';

export type Rgb = [number, number, number];

export const px = (rgb: Rgb, n: number): Rgb[] => Array.from({ length: n }, () => rgb);

/** Tableau RGBA opaque, largeur 10 (ou `width` quand la hauteur n'est pas entière). */
export function rgba(pixels: readonly Rgb[], width = 10): Rgba {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((p, i) => { data.set([p[0], p[1], p[2], 255], i * 4); });
  return { data, width, height: Math.ceil(pixels.length / width) };
}

export const image = (...groups: Rgb[][]): Rgba => rgba(groups.flat());
export const ALL = (img: Rgba): Crop => ({ x: 0, y: 0, w: img.width, h: img.height });
export const black = (img: Rgba): Rgba => rgba(px([0, 0, 0], img.width * img.height), img.width);
export const black10x10 = (): Rgba => rgba(px([0, 0, 0], 100));
/** Masque 10 x 10 dont les `n` premiers pixels sont émissifs (blancs). */
export const maskWith = (n: number): Rgba => rgba([...px([255, 255, 255], n), ...px([0, 0, 0], 100 - n)]);

/** Décode une image du fixture d'or (RGBA en base64). */
export function decodeRgba(b64: string, width: number, height: number): Rgba {
  return { data: new Uint8ClampedArray(Buffer.from(b64, 'base64')), width, height };
}
