/**
 * Zones d'écran de la rue : modes, largeurs réservées et politique de repli [design/ui/2026-11-02-zones-ecran-ux.md §1-§3].
 * Fonctions pures : les contrôles de calcul de l'UX (§2, 1280 et 960) sont rejoués à partir des jetons, jamais recopiés.
 */
import { describe, expect, it } from 'vitest';
import zonesRaw from '../../../src/data/ui/zones.json';
import { parseZones } from '../../../src/data/schema/zones';
import { loadUi } from '../../../src/data/ui/load';
import { usefulCrop } from '../../../src/engine/view/caps';
import { LETTERBOX_ASPECT } from '../../../src/street/render/pipeline';
import { zoneLayout, zoneMode, zonePolicy, zoneUnion, wholeLinesHeight, rightLineWaits, rightLargePx } from '../../../src/street/ui/zones';

const T = parseZones(zonesRaw);
const REM = 16;                                         // taille de base du document (aucune règle ne la change)
const street = loadUi().theme.street;
const RIGHT_LARGE = rightLargePx(street);
const band = (w: number, h: number): number => usefulCrop(w, h, LETTERBOX_ASPECT).y;
const TOP = 112;                                        // hauteur du bandeau haut : une entrée du calcul, mesurée au runtime

describe('zones : jetons', () => {
  it('test_zone_tokens_parse_and_every_value_is_sourced', () => {
    for (const [k, s] of Object.entries(T)) expect(s.status, k).toBe('sourced');
    expect(() => parseZones({ ...zonesRaw, extra: { v: 1, src: 'x', status: 'sourced' } })).toThrow();
  });
});

describe('zones : modes mesurés sur la largeur de U', () => {
  it('test_mode_thresholds_follow_the_tokens', () => {
    expect(zoneMode(T.largeMinPx.v, T)).toBe('large');
    expect(zoneMode(T.largeMinPx.v - 1, T)).toBe('medium');
    expect(zoneMode(T.mediumMinPx.v, T)).toBe('medium');
    expect(zoneMode(T.mediumMinPx.v - 1, T)).toBe('small');
  });
  it('test_three_reference_sizes_give_one_mode_each', () => {
    expect([1920, 1280, 960].map((w) => zoneMode(w, T))).toEqual(['large', 'medium', 'small']);
  });
});

describe('zones : largeurs réservées (§2)', () => {
  for (const [w, h] of [[1920, 1080], [1280, 720], [960, 540]] as const) {
    it(`test_layout_${w}x${h}_columns_are_disjoint_and_inside_U_minus_m`, () => {
      const b = band(w, h);
      const L = zoneLayout({ w, h, bandPx: b, remPx: REM, topPx: TOP, rightLargePx: RIGHT_LARGE, mirrored: false }, T);
      const m = T.marginRem.v * REM;
      for (const [n, r] of Object.entries({ top: L.top, left: L.left, centre: L.centre, right: L.right })) {
        expect(r.x, n).toBeGreaterThanOrEqual(m); expect(r.x + r.w, n).toBeLessThanOrEqual(w - m);
        expect(r.y, n).toBeGreaterThanOrEqual(b + m); expect(r.y + r.h, n).toBeLessThanOrEqual(h - b - m);
        expect(r.w, n).toBeGreaterThan(0); expect(r.h, n).toBeGreaterThan(0);
      }
      expect(L.left.x + L.left.w + m).toBeLessThanOrEqual(L.centre.x);
      expect(L.centre.x + L.centre.w + m).toBeLessThanOrEqual(L.right.x);
      expect(L.left.y).toBeGreaterThanOrEqual(L.top.y + L.top.h + m);
    });
  }
  it('test_medium_1280_matches_the_ux_control_calculation', () => {
    const L = zoneLayout({ w: 1280, h: 720, bandPx: band(1280, 720), remPx: REM, topPx: TOP, rightLargePx: RIGHT_LARGE, mirrored: false }, T);
    expect(L.mode).toBe('medium');
    expect(L.left.w).toBeCloseTo(T.leftMediumShare.v * 1280, 5);                         // 307 px
    expect(L.right.w).toBeCloseTo(Math.min(RIGHT_LARGE, T.rightMediumShare.v * 1280), 5);  // 589 px
  });
  it('test_small_960_matches_the_ux_control_calculation', () => {
    const L = zoneLayout({ w: 960, h: 540, bandPx: band(960, 540), remPx: REM, topPx: TOP, rightLargePx: RIGHT_LARGE, mirrored: false }, T);
    expect(L.mode).toBe('small');
    expect(L.left.w).toBe(T.leftSmallRem.v * REM);                                      // 224 px
    expect(L.right.w).toBeCloseTo(Math.min(RIGHT_LARGE, T.rightSmallShare.v * 960), 5);   // 384 px
  });
  it('test_large_right_zone_is_the_designated_option_plus_its_rim', () => {
    expect(RIGHT_LARGE).toBe(street.optionDesignatedWidthPx.v + 4 * street.designatedRimPx.v);
    const L = zoneLayout({ w: 1920, h: 1080, bandPx: band(1920, 1080), remPx: REM, topPx: TOP, rightLargePx: RIGHT_LARGE, mirrored: false }, T);
    expect(L.right.w).toBe(RIGHT_LARGE); expect(L.left.w).toBe(T.leftLargeRem.v * REM);
  });
  it('test_mirrored_swaps_left_and_right_columns', () => {
    const i = { w: 1280, h: 720, bandPx: band(1280, 720), remPx: REM, topPx: TOP, rightLargePx: RIGHT_LARGE };
    const a = zoneLayout({ ...i, mirrored: false }, T), b = zoneLayout({ ...i, mirrored: true }, T);
    expect(b.right.x).toBe(a.left.x); expect(b.right.w).toBe(a.right.w);
    expect(b.left.x + b.left.w).toBe(a.right.x + a.right.w); expect(b.left.w).toBe(a.left.w);
  });
});

describe('zones : priorités et replis (§3)', () => {
  const base = { cardOpen: false, bubbleOpen: false, groups: 0, mode: null };
  it('test_card_folds_the_carnet_in_every_mode', () => {
    for (const mode of ['large', 'medium', 'small'] as const) expect(zonePolicy(mode, { ...base, cardOpen: true }, T).carnetFolded, mode).toBe(true);
    expect(zonePolicy('large', base, T).carnetFolded).toBe(false);
    expect(zonePolicy('medium', base, T).carnetFolded).toBe(false);
  });
  it('test_small_always_folds_the_carnet_and_never_shows_the_help', () => {
    expect(zonePolicy('small', base, T)).toMatchObject({ carnetFolded: true, help: false });
  });
  it('test_narration_waits_for_the_bubble_and_in_small_for_the_card', () => {
    for (const mode of ['large', 'medium', 'small'] as const) expect(zonePolicy(mode, { ...base, bubbleOpen: true }, T).narration, mode).toBe('wait');
    expect(zonePolicy('small', { ...base, cardOpen: true }, T).narration).toBe('wait');
    expect(zonePolicy('large', { ...base, cardOpen: true }, T).narration).toBe('full');
    expect(zonePolicy('medium', base, T).narration).toBe('full');   // §7.2 : jamais réduite à une ligne
    expect(zonePolicy('medium', { ...base, cardOpen: true }, T).narration).toBe('full');   // elle n'attend la fiche que si elle ne tient pas (mesuré, Z-16)
    expect(zonePolicy('large', base, T).narration).toBe('full');
  });
  it('test_medium_help_leaves_with_a_card_a_bubble_or_more_than_two_groups', () => {
    const max = T.mediumHelpMaxGroups.v;
    expect(zonePolicy('medium', { ...base, groups: max }, T).help).toBe(true);
    expect(zonePolicy('medium', { ...base, groups: max + 1 }, T).help).toBe(false);
    expect(zonePolicy('medium', { ...base, cardOpen: true }, T).help).toBe(false);
    expect(zonePolicy('medium', { ...base, bubbleOpen: true }, T).help).toBe(false);
    expect(zonePolicy('large', { cardOpen: true, bubbleOpen: true, groups: 6, mode: null }, T).help).toBe(true);
  });

  it('test_zones_union_covers_left_and_centre_in_either_order', () => {
    // le repli de la bulle : Z-gauche et Z-centre ensemble, jamais Z-droite (les options passent avant) [zones UX §3]
    const a = { x: 16, y: 154, w: 224, h: 232 }, b = { x: 272, y: 154, w: 288, h: 232 };
    expect(zoneUnion(a, b)).toEqual({ x: 16, y: 154, w: 544, h: 232 });
    expect(zoneUnion(b, a)).toEqual(zoneUnion(a, b));
  });

  it('test_zones_right_line_waits_for_the_bubble_and_in_small_for_the_card', () => {   // Z-3, Z-10
    expect(rightLineWaits({ ...base, bubbleOpen: true })).toBe(true);
    expect(rightLineWaits({ ...base, cardOpen: true, mode: 'small' })).toBe(true);
    expect(rightLineWaits({ ...base, cardOpen: true, mode: 'medium' })).toBe(false);
    expect(rightLineWaits({ ...base, cardOpen: true, mode: null })).toBe(false);   // sans mise en page, le mode est inconnu : rien n'attend la fiche
    expect(rightLineWaits(base)).toBe(false);
  });

  it('test_zones_whole_lines_height_needs_at_least_two_lines', () => {   // §7.1.2 : n au moins 2
    expect(wholeLinesHeight([30, 60, 90], 50, 0, 2)).toBeNull();
    expect(wholeLinesHeight([30, 60, 90], 70, 0, 2)).toBe(60);
  });

  it('test_zones_whole_lines_height_stops_under_a_whole_line', () => {
    // lignes de 30 px, 16 px de remplissage dessous : 100 px visibles laissent voir 2 lignes entières (60 + 16), jamais la 3e tranchée
    expect(wholeLinesHeight([30, 60, 90, 120], 100, 16)).toBe(76);
    expect(wholeLinesHeight([30, 60], 100, 16)).toBeNull();          // tout tient
    expect(wholeLinesHeight([30, 60], 20, 0)).toBeNull();            // pas même une ligne : rien à plafonner
    expect(wholeLinesHeight([], 100, 0)).toBeNull();
  });

  it('test_zones_whole_lines_height_pads_only_under_the_line_that_carries_the_padding', () => {
    // ligne de droit : la moitié haute porte 24 px de remplissage sous sa dernière ligne (bas à 105), la moitié basse n'en porte pas (lignes à 188, 215, 242).
    // 212 px visibles : la ligne à 188 tient sans remplissage, celle à 215 est tranchée ; l'ancienne formule collait 24 px à toutes et rendait 212 (215 vu à 18 / 21 px).
    const bottoms = [24, 51, 78, 105, 188, 215, 242], gaps = [0, 0, 0, 24, 0, 0, 0];
    expect(wholeLinesHeight(bottoms, 212, 24, 2, gaps)).toBe(188);
    expect(wholeLinesHeight(bottoms, 212, 24, 2)).toBe(188 + 24);   // sans `gaps`, le comportement d'origine (un remplissage pour tous) reste
  });
});
