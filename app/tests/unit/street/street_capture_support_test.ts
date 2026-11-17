import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { farthestChange, maxAbsDiff, meanAbsDiff, median, pngColorProfile } from '../../support/street_capture';
import type { Rgba } from '../../../src/engine/view/caps';

/** PNG minimal valide (1 x 1) avec les morceaux de couleur voulus : la signature, IHDR, ce qu'on demande, IDAT, IEND. */
function png(extra: readonly { type: string; data: Buffer }[]): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);   // CRC non vérifiée par l'analyseur
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    ...extra.map((e) => chunk(e.type, e.data)), chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const img = (rows: number[][], width: number): Rgba => ({ data: new Uint8ClampedArray(rows.flat()), width, height: rows.length });

describe('pngColorProfile', () => {
  it('test_png_without_colour_chunk_is_srgb_by_convention', () => {
    expect(pngColorProfile(png([]))).toBe('sRGB');
  });
  it('test_png_with_srgb_chunk_is_srgb', () => {
    expect(pngColorProfile(png([{ type: 'sRGB', data: Buffer.from([0]) }]))).toBe('sRGB');
  });
  it('test_png_with_icc_profile_named_display_p3_is_not_srgb', () => {
    const name = Buffer.concat([Buffer.from('Display P3\0', 'latin1'), Buffer.from([0]), deflateSync(Buffer.from('x'))]);
    expect(pngColorProfile(png([{ type: 'iCCP', data: name }]))).toBe('Display P3');
  });
  it('test_png_with_icc_profile_named_srgb_is_srgb', () => {
    const name = Buffer.concat([Buffer.from('sRGB IEC61966-2.1\0', 'latin1'), Buffer.from([0]), deflateSync(Buffer.from('x'))]);
    expect(pngColorProfile(png([{ type: 'iCCP', data: name }]))).toBe('sRGB');
  });
  it('test_png_with_only_a_gamma_chunk_that_is_not_srgb_is_reported', () => {
    const g = Buffer.alloc(4); g.writeUInt32BE(100000);   // gamma 1,0 : linéaire
    expect(pngColorProfile(png([{ type: 'gAMA', data: g }]))).toBe('gAMA 1');
  });
  it('test_not_a_png_throws', () => {
    expect(() => pngColorProfile(Buffer.from('nope'))).toThrow(/PNG/);
  });
});

describe('image differences', () => {
  const a = img([[10, 20, 30, 255, 0, 0, 0, 255]], 2);
  it('test_identical_images_have_zero_difference', () => {
    expect(maxAbsDiff(a, a)).toBe(0);
    expect(meanAbsDiff(a, a)).toBe(0);
  });
  it('test_max_is_per_channel_and_alpha_is_ignored', () => {
    const b = img([[10, 25, 30, 0, 0, 0, 0, 255]], 2);
    expect(maxAbsDiff(a, b)).toBe(5);
  });
  it('test_mean_is_over_the_rgb_channels_of_all_pixels', () => {
    const b = img([[13, 20, 30, 255, 0, 0, 3, 255]], 2);   // 3 + 3 sur 6 canaux
    expect(meanAbsDiff(a, b)).toBe(1);
  });
  it('test_different_sizes_throw', () => {
    expect(() => maxAbsDiff(a, img([[0, 0, 0, 255]], 1))).toThrow(/taille/);
  });
});

describe('median', () => {
  it('test_median_of_odd_and_even_lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('test_median_of_empty_list_throws', () => {
    expect(() => median([])).toThrow();
  });
});

describe('farthestChange', () => {
  // 7 x 1 : le masque est au pixel 0 ; les pixels 1 et 3 ont changé
  const w = 7;
  const mask = img([Array.from({ length: 7 }, (_, i) => (i === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255])).flat()], w);
  it('test_farthest_change_is_the_largest_chebyshev_distance_to_the_mask', () => {
    const before = img([Array.from({ length: 7 }, () => [5, 5, 5, 255]).flat()], w);
    const after = img([Array.from({ length: 7 }, (_, i) => (i === 1 || i === 3 ? [9, 5, 5, 255] : [5, 5, 5, 255])).flat()], w);
    expect(farthestChange(before, after, mask)).toEqual({ changed: 2, farthestPx: 3 });
  });
  it('test_min_level_ignores_changes_below_it', () => {
    const before = img([Array.from({ length: 7 }, () => [5, 5, 5, 255]).flat()], w);
    const after = img([Array.from({ length: 7 }, (_, i) => (i === 1 ? [6, 5, 5, 255] : i === 3 ? [9, 5, 5, 255] : [5, 5, 5, 255])).flat()], w);
    expect(farthestChange(before, after, mask, 3)).toEqual({ changed: 1, farthestPx: 3 });
    expect(farthestChange(before, after, mask, 1)).toEqual({ changed: 2, farthestPx: 3 });
  });
  it('test_no_change_gives_zero_and_no_distance', () => {
    const same = img([Array.from({ length: 7 }, () => [5, 5, 5, 255]).flat()], w);
    expect(farthestChange(same, same, mask)).toEqual({ changed: 0, farthestPx: 0 });
  });
});
