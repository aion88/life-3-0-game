/** Mesures de pixels et plafonds de l'art bible [plan 02a T2 ; art bible §B.1, §G]. Valeurs calculées à la main. */
import { describe, expect, it } from 'vitest';
import { PROFILES, checkCaps, checkLuminance, hueShares, luminanceStats, maskShare, usefulCrop, yPrime } from '../../../src/engine/view/caps';
import type { Rgba } from '../../../src/engine/view/caps';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import golden from '../../fixtures/street/caps-golden.json';
import { ALL, black, black10x10, decodeRgba, image, maskWith, px } from '../../support/street_caps';
import type { Rgb } from '../../support/street_caps';

const crop100 = ALL(black10x10());
const colored = (img: Rgba): number => hueShares(img, ALL(img)).sectors.reduce((a, b) => a + b, 0);

describe('street_caps', () => {
  it('test_y_prime_weights', () => {   // Rec. 709 sur sRGB non linéarisé
    expect(yPrime(255, 255, 255)).toBeCloseTo(1, 9);
    expect(yPrime(255, 0, 0)).toBeCloseTo(0.2126, 9);
  });

  it.each([
    [[127, 0, 255], 'blue'], [[128, 0, 255], 'violet'],       // 60 x (4 + 127/255) = 269,88 ; 60 x (4 + 128/255) = 270,12
    [[254, 0, 255], 'violet'], [[255, 0, 255], 'magenta'],    // 299,76 ; 300 exact
    [[255, 0, 128], 'magenta'], [[255, 0, 127], 'other'],     // 329,88 ; 330,12
    [[0, 255, 255], 'blue'],                                   // 180 exact, borne basse incluse
  ])('test_hue_boundary_%j', (rgb, fam) => {
    const s = hueShares(image(px(rgb as Rgb, 100)), crop100);
    if (fam === 'other') {
      expect(s.blue + s.violet + s.magenta).toBe(0);
    } else {
      expect(s[fam as 'blue' | 'violet' | 'magenta']).toBe(1);
    }
  });

  it('test_value_and_saturation_thresholds_are_strict', () => {
    expect(colored(image(px([38, 0, 0], 100)))).toBe(0);    // V = 38/255 = 0,149 : exclu
    expect(colored(image(px([39, 0, 0], 100)))).toBe(1);    // V = 39/255 = 0,153 : inclus
    expect(colored(image(px([100, 75, 75], 100)))).toBe(0); // S = 25/100 = 0,25 : exclu
    expect(colored(image(px([100, 74, 74], 100)))).toBe(1); // S = 26/100
  });

  it.each([[5, 6, true], [6, 6, true], [7, 6, false], [6, 7, false]])('test_questionnaire_violet_%i_magenta_%i_ok_%s', (v, m, ok) => {   // 12 et 6 sur 100 passent, 13 ou 7 non
    const img = image(px([128, 0, 255], v), px([255, 0, 255], m), px([0, 0, 0], 100 - v - m));
    expect(checkCaps(img, black(img), ALL(img), PROFILES.questionnaire).ok).toBe(ok);
  });

  it.each([[2, true], [3, false]])('test_street_third_hue_%i_percent_ok_%s', (n, ok) => {   // 3 % fait échouer : le plafond est strict [art bible §B.1]
    const img = image(px([255, 0, 255], n), px([0, 0, 0], 100 - n));
    const r = checkCaps(img, black(img), ALL(img), PROFILES.street);
    expect(r.ok).toBe(ok);
    if (!ok) expect(r.findings.map(f => f.code)).toContain('thirdHue');
  });

  it('test_world_blue_grey_is_dominant_never_a_third_hue', () => {   // #46515E : H 211, S 0,26, V 0,37
    const img = image(px([0x46, 0x51, 0x5e], 100));
    const r = checkCaps(img, black(img), ALL(img), PROFILES.street);
    expect(r.findings.map(f => f.code)).not.toContain('thirdHue');
  });

  it('test_dominance_below_70_percent_fails', () => {
    const img = image(px([255, 0, 0], 31), px([0x46, 0x51, 0x5e], 69));   // 31 % hors dominante
    expect(checkCaps(img, black(img), ALL(img), PROFILES.street).findings.map(f => f.code)).toContain('dominant');
  });

  // Isolation de chaque plafond du questionnaire : un seul code à la fois.
  it('test_questionnaire_magenta_cap_alone', () => {   // magenta 7 % > 6 %, violet + magenta 7 % <= 12 %
    const img = image(px([255, 0, 255], 7), px([0, 0, 0], 93));
    expect(checkCaps(img, black(img), ALL(img), PROFILES.questionnaire).findings.map(f => f.code)).toEqual(['magenta']);
  });
  it('test_questionnaire_violet_magenta_cap_alone', () => {   // violet 13 %, magenta 0 %
    const img = image(px([128, 0, 255], 13), px([0, 0, 0], 87));
    expect(checkCaps(img, black(img), ALL(img), PROFILES.questionnaire).findings.map(f => f.code)).toEqual(['violetMagenta']);
  });

  // Bords de secteur : warm [15,50), blue [180,270), violet [270,300), magenta [300,330), troisième teinte par 30 degrés.
  // (252,210,0) : 60 x 210/252 = 50 au bord ; sans l'arrondi à 1e-9 le flottant peut tomber sous 50 et le ranger dans le sodium.
  it.each([
    [[200, 50, 0], 15, null, false],       // 15 exact : chaud, ni sodium ni troisième teinte
    [[200, 49, 0], 14.7, 0, false],        // sous 15 : troisième teinte, secteur 0
    [[255, 85, 0], 20, null, true],        // 20 : sodium
    [[200, 100, 0], 30, null, true],       // 30 : chaud, hors secteurs
    [[252, 210, 0], 50, 1, false],         // 50 exact : plus chaud ni sodium, secteur 1
    [[200, 200, 0], 60, 2, false],         // 60 : secteur 2
    [[200, 0, 100], 330, 11, false],       // 330 : secteur 11, pas magenta
    [[200, 0, 0], 0, 0, false],            // 0 : secteur 0
    [[200, 0, 1], 359.7, 11, false],       // juste avant le retour à 0
  ])('test_sector_edge_%j_h%d', (rgb, _h, sector, sodium) => {
    const s = hueShares(image(px(rgb as Rgb, 100)), crop100);
    expect(s.sectors.map((v, i) => (v === 1 ? i : -1)).filter(i => i >= 0)).toEqual(sector === null ? [] : [sector]);
    expect(s.sodium).toBe(sodium ? 1 : 0);
    expect(s.blue + s.violet).toBe(0);
    expect(s.magenta).toBe(0);
  });

  // Chaque plafond, côté en défaut et côté propre.
  const codes = (img: Rgba, m = black(img), p = PROFILES.street): string[] => checkCaps(img, m, ALL(img), p).findings.map(f => f.code);
  it.each([[9, ['accent']], [8, []]])('test_street_sodium_%i_percent_codes_%j', (n, expected) => {
    expect(codes(image(px([255, 85, 0], n), px([0, 0, 0], 100 - n)))).toEqual(expected);
  });
  // Peau : §B.1 la range dans la base (« comme la peau ») et la sort de la troisième teinte (« hors peau et chaud commun »). Un masque de peau
  // (blanc = matériau de peau) sort ces pixels du compte du sodium et des secteurs ; hors masque, la même teinte compte toujours.
  const SKIN: Rgb = [200, 140, 100];                                   // teinte 25° : dans le secteur sodium (20° à 50°)
  const skinWith = (n: number): Rgba => maskWith(n);                   // les n premiers pixels sont de la peau
  const codesSkin = (img: Rgba, skin: Rgba): string[] => checkCaps(img, black(img), ALL(img), PROFILES.street, skin).findings.map(f => f.code);
  it('test_skin_pixels_do_not_count_as_accent', () => {
    const img = image(px(SKIN, 10), px([0, 0, 0], 90));
    expect(codes(img)).toEqual(['accent']);                            // sans masque : 10 % de sodium
    expect(codesSkin(img, skinWith(10))).toEqual([]);                  // avec masque : de la peau
  });
  it('test_same_hue_outside_the_skin_mask_still_counts_as_accent', () => {
    const img = image(px(SKIN, 10), px([0, 0, 0], 90));
    expect(codesSkin(img, skinWith(1))).toEqual(['accent']);           // 9 % restent hors masque
  });
  it('test_skin_pixels_do_not_count_as_third_hue', () => {
    const img = image(px([200, 100, 100], 4), px([0, 0, 0], 96));      // teinte 0° : secteur 0° à 30°, 4 % >= 3 %
    expect(codes(img)).toEqual(['thirdHue']);
    expect(codesSkin(img, skinWith(4))).toEqual([]);
  });
  it.each([[8, ['emissive']], [7, []]])('test_street_emissive_%i_percent_codes_%j', (n, expected) => {
    const img = black10x10();
    expect(codes(img, maskWith(n))).toEqual(expected);
  });
  const lum = (...g: Rgb[][]): string[] => { const i = image(...g); return checkLuminance(luminanceStats(i, black(i), ALL(i))).findings.map(f => f.code); };
  it('test_luminance_dark_cap', () => {
    expect(lum(px([0, 0, 0], 61), px([128, 128, 128], 39))).toEqual(['dark']);
    expect(lum(px([0, 0, 0], 60), px([128, 128, 128], 40))).toEqual([]);
  });
  it('test_luminance_mean_low_and_high_alone', () => {
    expect(lum(px([20, 20, 20], 100))).toEqual(['meanY']);        // Y' 0,078 < 0,08
    expect(lum(px([30, 30, 30], 100))).toEqual([]);               // Y' 0,118
    expect(lum(px([200, 200, 200], 100))).toEqual(['meanY']);     // Y' 0,784 > 0,65
  });
  it('test_luminance_high_cap_clean_side_and_mask_exemption', () => {
    expect(lum(px([255, 255, 255], 5), px([128, 128, 128], 95))).toEqual([]);          // 5 % pile : toléré
    expect(lum(px([255, 255, 255], 6), px([128, 128, 128], 94))).toEqual(['high']);
    const img = image(px([255, 255, 255], 6), px([128, 128, 128], 94));
    expect(checkLuminance(luminanceStats(img, maskWith(6), ALL(img))).findings).toEqual([]);   // ces 6 % sont des sources
  });

  it('test_useful_crop_removes_letterbox', () => {   // 1920 / 2,39 = 803,3 ; (1080 - 803) / 2 = 138,5 arrondi bas
    expect(usefulCrop(1920, 1080, 2.39)).toEqual({ x: 0, y: 138, w: 1920, h: 803 });
  });

  it('test_wall_share_cap_on_the_checkpoint_profile', () => {
    const beauty = black10x10();
    const m10 = maskWith(10), m11 = maskWith(11);   // 10 % du crop en émissif (plaque A, AM-3)
    expect(maskShare(m10, ALL(beauty))).toBe(0.1);
    expect(checkCaps(beauty, m10, ALL(beauty), PROFILES.checkpoint).ok).toBe(true);
    expect(checkCaps(beauty, m11, ALL(beauty), PROFILES.checkpoint).findings.map(f => f.code)).toContain('emissive');
  });

  it('test_luminance_control_c7bis', () => {   // moyenne 0,08 à 0,65 ; au plus 5 % à 0,98 hors émissifs ; au plus 60 % sous 0,03
    const white = image(px([255, 255, 255], 100));
    expect(checkLuminance(luminanceStats(white, black(white), ALL(white))).findings.map(f => f.code)).toEqual(['meanY', 'high']);   // image blanche : jamais montrée
  });

  it('test_matches_the_python_reference_on_golden_images', () => {
    expect(golden.images).toHaveLength(4);
    for (const g of golden.images) {
      const s = hueShares(decodeRgba(g.rgba, g.width, g.height), { x: 0, y: 0, w: g.width, h: g.height });
      expect(s.violet).toBeCloseTo(g.violet, 12);
      expect(s.magenta).toBeCloseTo(g.magenta, 12);
      expect(s.blue).toBeCloseTo(g.blue, 12);
      expect(s.sodium).toBeCloseTo(g.sodium, 12);
      g.sectors.forEach((v, i) => { expect(s.sectors[i]).toBeCloseTo(v, 12); });
    }
  });

  /**
   * AM-2 ne change AUCUN plafond : l'amendement déplace la mesure (plaque sans interface), pas les seuils. Instantané écrit à la main, lu de
   * `src/engine/view/caps.ts` avant la tâche UI-C-T12 ; un plafond qui bouge doit faire échouer ce test, puis passer par l'art-director.
   */
  it('test_caps_profiles_unchanged_by_am2', () => {   // AM-3 (2026-11-05) relève les seules sources : rue 2 % -> 7 %, checkpoint 6 % -> 10 %
    expect(PROFILES).toEqual({
      street: { id: 'street', accentMax: 0.08, emissiveMax: 0.07, thirdHueMax: 0.03, thirdHueSkips: [], violetMagentaMax: null, magentaMax: null, dominantOrNeutralMin: 0.7 },
      checkpoint: { id: 'checkpoint', accentMax: 0.02, emissiveMax: 0.10, thirdHueMax: 0.03, thirdHueSkips: [], violetMagentaMax: null, magentaMax: null, dominantOrNeutralMin: 0.7 },
      questionnaire: { id: 'questionnaire', accentMax: 0.02, emissiveMax: 0.25, thirdHueMax: 0.03, thirdHueSkips: ['violet', 'magenta'], violetMagentaMax: 0.12, magentaMax: 0.06, dominantOrNeutralMin: 0.7 },
    });
    const sha = createHash('sha256').update(readFileSync(new URL('../../fixtures/street/caps-golden.json', import.meta.url))).digest('hex');
    expect(sha).toBe('69f4d62bcfd1a471d26325f74723562daba20d04971b349dc86cf8e95abecbc3');
  });
});
