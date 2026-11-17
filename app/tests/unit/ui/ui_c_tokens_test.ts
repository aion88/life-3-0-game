/** Interface C : jetons, formes, typographie, mouvements et jus en données avec provenance [plan UI-C T1, spec C §1, §2, §4]. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import themeRaw from '../../../src/data/ui/theme.json';
import timingRaw from '../../../src/data/ui/timing.json';
import pinned from '../../fixtures/ui/ui_supposed.json';
import { DataLoadError } from '../../../src/data/load';
import { parseTheme, parseTiming, PALETTE_TOKENS, type PaletteToken } from '../../../src/data/schema/ui';
import { loadUi } from '../../../src/data/ui/load';
import { contrastRatio } from '../../../src/ui/color';
import { applyTheme } from '../../../src/ui/theme';
import { supposedPaths } from '../../support/street_helpers';

const ui = () => loadUi();
const pal = (t: PaletteToken): string => ui().theme.palette[t].v;

/** Élément minimal : seul `style.setProperty` sert à `applyTheme`. */
function fakeEl(): { el: HTMLElement; vars: Map<string, string> } {
  const vars = new Map<string, string>();
  const el = { style: { setProperty: (k: string, v: string) => void vars.set(k, v) } } as unknown as HTMLElement;
  return { el, vars };
}

const SPEC_HEX: Record<PaletteToken, string> = {
  encre: '#231942', encreDouce: '#3D3460', creme: '#FFF7EC', blanc: '#FFFFFF', lavande: '#E6DCF5', lavandeClaire: '#EFE4F7',
  lavandeTrait: '#8A7FB0', rose: '#FF5FA2', roseFonce: '#B5175A', ciel: '#45C4F5', soleil: '#FFD23F', menthe: '#2EDC9B', grisAcier: '#46515E',
};

/** Les sections nouvelles dont chaque feuille doit porter sa provenance. */
const NEW_SECTIONS = ['palette', 'shadows', 'type', 'minTextPx', 'minLineHeight', 'textPairs', 'forbiddenPairs', 'shape', 'questionnaire', 'street'] as const;

function isSourcedNode(n: unknown): n is { v: unknown; src: string; status: string } {
  return typeof n === 'object' && n !== null && 'v' in n && 'status' in n && 'src' in n;
}
/** Feuilles atteintes sans passer par une enveloppe `Sourced` : chemins fautifs. */
function bareLeaves(n: unknown, p: string, out: string[]): string[] {
  if (isSourcedNode(n)) { if (typeof n.src !== 'string' || n.src === '') out.push(`${p} (src vide)`); return out; }
  if (typeof n === 'object' && n !== null) { for (const [k, v] of Object.entries(n)) bareLeaves(v, `${p}.${k}`, out); return out; }
  out.push(p);
  return out;
}

/** Fautes de la règle « une lavande n'est jamais un contour, lavandeTrait n'est jamais un texte » sur un texte CSS. */
export function lavenderMisuse(css: string): string[] {
  const bad: string[] = [];
  // seuls les blocs de déclarations (sans accolade imbriquée) sont lus : :hover, ::before et @media n'avalent rien
  for (const block of css.matchAll(/\{([^{}]*)\}/g)) {
    for (const m of (block[1] ?? '').matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]*)/g)) {
      const prop = m[1] ?? '';
      const val = m[2] ?? '';
      const contour = /^(border|outline|box-shadow)/.test(prop);
      if (contour && /--c-lavande(?!-trait)\b|--c-lavande-claire/.test(val)) bad.push(`${prop}: ${val.trim()}`);
      if (prop === 'color' && /--c-lavande-trait/.test(val)) bad.push(`${prop}: ${val.trim()}`);
    }
  }
  return bad;
}

function cssFiles(): string[] {
  const out: string[] = [];
  for (const dir of ['src/ui', 'src/street/ui']) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.css')) out.push(join(dir, f));
  }
  return out;
}

describe('interface C : jetons', () => {
  it('test_palette_has_exactly_the_thirteen_spec_tokens', () => {
    const { palette } = ui().theme;
    expect(Object.keys(palette).sort()).toEqual([...PALETTE_TOKENS].sort());
    expect(PALETTE_TOKENS).toHaveLength(13);
    for (const t of PALETTE_TOKENS) expect(palette[t].v.toUpperCase()).toBe(SPEC_HEX[t]);
    expect(palette.lavandeTrait.v).toBe('#8A7FB0');
    expect(Object.values(ui().theme.shadows).map((s) => s.v)).toEqual(['#C23A78', '#1E8FBF', '#D9A800', '#1FA875', 'rgba(35,25,66,.55)']);
    expect(Object.keys(ui().theme.shadows)).toEqual(['rose', 'ciel', 'soleil', 'menthe', 'encre']);
  });

  it('test_every_new_value_is_sourced', () => {
    const theme = ui().theme as unknown as Record<string, unknown>;
    for (const k of NEW_SECTIONS) expect(bareLeaves(theme[k], k, []), k).toEqual([]);
    const timing = ui().timing as unknown as Record<string, unknown>;
    for (const k of ['easings', 'motion', 'juice']) expect(bareLeaves(timing[k], k, []), k).toEqual([]);
    // un supposed sans owner est refusé par le schéma
    const noOwner = structuredClone(themeRaw) as unknown as { palette: { encre: { status: string; owner?: string } } };
    noOwner.palette.encre.status = 'supposed';
    delete noOwner.palette.encre.owner;
    expect(() => parseTheme(noOwner)).toThrow(DataLoadError);
    const noSrc = structuredClone(timingRaw) as unknown as { juice: { maxCoins: { src: string } } };
    noSrc.juice.maxCoins.src = '';
    expect(() => parseTiming(noSrc)).toThrow(DataLoadError);
  });

  it('test_every_supposed_ui_value_is_pinned', () => {
    const found = [
      ...supposedPaths(themeRaw).map((p) => ({ ...p, path: `theme.${p.path}` })),
      ...supposedPaths(timingRaw).map((p) => ({ ...p, path: `timing.${p.path}` })),
    ];
    expect(found.length).toBeGreaterThan(0);
    for (const p of found) {
      expect(pinned.some((b) => b.path === p.path && b.owner === p.owner && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.reason.length > 0), p.path).toBe(true);
    }
    for (const b of pinned) expect(found.some((p) => p.path === b.path), `entrée périmée ${b.path}`).toBe(true);
  });

  it('test_permitted_text_pairs_reach_4_5', () => {
    const { textPairs } = ui().theme;
    const expected: Record<string, number> = {
      'encre/creme': 15.33, 'encre/blanc': 16.29, 'encreDouce/creme': 10.64, 'encre/lavande': 12.35, 'encre/rose': 5.75,
      'encre/ciel': 8.12, 'encre/soleil': 11.28, 'encre/menthe': 9.17, 'roseFonce/creme': 6.11, 'blanc/grisAcier': 8.08, 'encre/lavandeClaire': 13.27,
    };
    for (const { fg, bg } of textPairs.v) expect(contrastRatio(pal(fg), pal(bg)), `${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const [k, x] of Object.entries(expected)) {
      const [fg, bg] = k.split('/') as [PaletteToken, PaletteToken];
      expect(textPairs.v.some((p) => p.fg === fg && p.bg === bg), `${k} permis`).toBe(true);
      expect(contrastRatio(pal(fg), pal(bg)), k).toBeCloseTo(x, 1);
    }
    for (const k of ['blanc/encre', 'creme/encre', 'soleil/encre', 'encreDouce/blanc']) {
      const [fg, bg] = k.split('/') as [PaletteToken, PaletteToken];
      expect(textPairs.v.some((p) => p.fg === fg && p.bg === bg), `${k} permis`).toBe(true);
    }
  });

  it('test_forbidden_pairs_are_below_4_5_and_never_permitted', () => {
    const { forbiddenPairs, textPairs } = ui().theme;
    const expected: Record<string, number> = { 'blanc/rose': 2.83, 'blanc/ciel': 2.01, 'rose/creme': 2.67, 'lavandeTrait/creme': 3.44, 'lavandeTrait/blanc': 3.66 };
    for (const { fg, bg } of forbiddenPairs.v) {
      expect(contrastRatio(pal(fg), pal(bg)), `${fg}/${bg}`).toBeLessThan(4.5);
      expect(textPairs.v.some((p) => p.fg === fg && p.bg === bg), `${fg}/${bg} permis à tort`).toBe(false);
    }
    for (const [k, x] of Object.entries(expected)) {
      const [fg, bg] = k.split('/') as [PaletteToken, PaletteToken];
      expect(forbiddenPairs.v.some((p) => p.fg === fg && p.bg === bg), `${k} interdit`).toBe(true);
      expect(contrastRatio(pal(fg), pal(bg)), k).toBeCloseTo(x, 1);
    }
    expect(textPairs.v.some((p) => p.fg === 'lavandeTrait')).toBe(false);
    // le schéma refuse le recouvrement
    const bad = structuredClone(themeRaw) as unknown as { forbiddenPairs: { v: { fg: string; bg: string }[] } };
    bad.forbiddenPairs.v.push({ fg: 'encre', bg: 'creme' });
    expect(() => parseTheme(bad)).toThrow(DataLoadError);
  });

  it('test_non_text_indicators_reach_3_to_1', () => {
    // anneau de focus double (encre puis crème) : pour chaque fond, l'un des deux anneaux atteint 3:1
    for (const bg of PALETTE_TOKENS) {
      const best = Math.max(contrastRatio(pal('encre'), pal(bg)), contrastRatio(pal('creme'), pal(bg)));
      expect(best, `anneau sur ${bg}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(pal('lavandeTrait'), pal('creme'))).toBeCloseTo(3.44, 1);
    expect(contrastRatio(pal('lavandeTrait'), pal('blanc'))).toBeCloseTo(3.66, 1);
    expect(contrastRatio(pal('lavandeTrait'), pal('creme'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(pal('lavandeTrait'), pal('blanc'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(pal('lavande'), pal('creme'))).toBeLessThan(3);   // D4 : la lavande de fond ne peut pas être un contour
  });

  it('test_lavender_backgrounds_never_carry_a_contour', () => {
    expect(lavenderMisuse('a{border:4px solid var(--c-lavande)}')).toHaveLength(1);
    expect(lavenderMisuse('a{outline: 2px solid var(--c-lavande-claire)}')).toHaveLength(1);
    expect(lavenderMisuse('a{box-shadow: 0 0 0 3px var(--c-lavande)}')).toHaveLength(1);
    expect(lavenderMisuse('a{color: var(--c-lavande-trait)}')).toHaveLength(1);
    expect(lavenderMisuse('a:hover{border:4px solid var(--c-lavande)}')).toHaveLength(1);
    expect(lavenderMisuse('a:focus-visible::before{outline:2px solid var(--c-lavande-claire)}')).toHaveLength(1);
    expect(lavenderMisuse('@media (min-width: 1px){a{border:4px solid var(--c-lavande)}}')).toHaveLength(1);
    expect(lavenderMisuse('@media (min-width: 1px){a:hover{color: var(--c-lavande-trait)}}')).toHaveLength(1);
    expect(lavenderMisuse('@media (min-width: 1px){a:hover{background: var(--c-lavande)}}')).toEqual([]);
    expect(lavenderMisuse('a{background: var(--c-lavande);border:3px solid var(--c-lavande-trait)}')).toEqual([]);
    for (const f of cssFiles()) expect(lavenderMisuse(readFileSync(f, 'utf8')), f).toEqual([]);
  });

  it('test_type_sizes_respect_floor', () => {
    const { type, minTextPx, minLineHeight } = ui().theme;
    expect(minTextPx.v).toBe(18);
    expect(minLineHeight.v).toBe(1.25);
    expect(Object.keys(type)).toHaveLength(24);
    for (const [role, s] of Object.entries(type)) {
      expect(s.v.px, role).toBeGreaterThanOrEqual(minTextPx.v);
      expect(s.v.lineHeight, role).toBeGreaterThanOrEqual(minLineHeight.v);
    }
    expect(type.worldClear.v).toMatchObject({ family: 'text', weight: 500, px: 23 });
    expect(type.redirectLine.v).toMatchObject({ family: 'text', weight: 500, px: 23 });
    expect(type.kitLabel.v.px).toBe(18);
    expect(type.kitState.v).toMatchObject({ family: 'text', weight: 500, px: 18 });
    expect(type.streetOption.v).toMatchObject({ family: 'display', weight: 500, px: 22 });
    expect(type.braceletNumber.v.px).toBe(64);
  });

  it('test_type_sizes_are_clamped_with_18px_floor', () => {
    const { el, vars } = fakeEl();
    applyTheme(el);
    expect(vars.get('--t-street-option-size')).toBe('clamp(18px, calc(22 * 100vw / 1920), 22px)');
    for (const [role, s] of Object.entries(ui().theme.type)) {
      const name = role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const size = vars.get(`--t-${name}-size`);
      expect(size, role).toBe(`clamp(18px, calc(${s.v.px} * 100vw / 1920), ${s.v.px}px)`);
      expect(size, role).toMatch(/^clamp\(18px,/);
    }
  });

  it('test_motion_rows_match_spec_table', () => {
    const { motion, easings, juice } = ui().timing;
    expect(easings.pop.v).toBe('cubic-bezier(.34, 1.56, .64, 1)');
    expect(easings.sortie.v).toBe('cubic-bezier(.22, 1, .36, 1)');
    expect(easings.rentree.v).toBe('cubic-bezier(.55, 0, 1, .45)');
    const row = (id: keyof typeof motion): [number, string, number, number] => [motion[id].v.ms, motion[id].v.easing, motion[id].v.delayMs, motion[id].v.staggerMs];
    expect(Object.keys(motion)).toHaveLength(18);
    expect(row('designate')).toEqual([180, 'pop', 0, 0]);
    expect(row('undesignate')).toEqual([120, 'sortie', 0, 0]);
    expect(row('confirmPress')).toEqual([80, 'sortie', 0, 0]);
    expect(row('confirmRelease')).toEqual([120, 'sortie', 0, 0]);
    expect(row('fadeOthers')).toEqual([300, 'sortie', 0, 0]);
    expect(row('costReveal')).toEqual([200, 'sortie', 0, 0]);
    expect(row('bubbleIn')).toEqual([220, 'pop', 0, 0]);
    expect(row('bubbleOut')).toEqual([140, 'rentree', 0, 0]);
    expect(row('optionsIn')).toEqual([240, 'pop', 0, 60]);
    expect(row('priceReveal')).toEqual([200, 'sortie', 150, 0]);
    expect(row('coin')).toEqual([420, 'sortie', 0, 35]);
    expect(row('shutter')).toEqual([90, 'sortie', 0, 0]);
    expect(row('braceletSettle')).toEqual([200, 'pop', 0, 0]);
    expect(motion.confetti.v.ms).toBe(1200);
    expect(row('message')).toEqual([260, 'pop', 0, 0]);
    expect(motion.refusalShake.v.ms).toBe(160);
    expect(row('pageChange')).toEqual([240, 'sortie', 0, 0]);
    expect(row('cardIn')).toEqual([180, 'pop', 0, 0]);
    expect(juice.maxCoins.v).toBe(12);
    expect(juice.confettiPieces.v).toBe(40);
    expect(juice.reducedMaxMs.v).toBe(120);
    for (const m of Object.values(motion)) expect(Object.keys(easings)).toContain(m.v.easing);
  });

  it('test_static_rotations_within_3_degrees', () => {
    const { shape, questionnaire, street } = ui().theme;
    const max = shape.maxStaticRotationDeg.v;
    expect(max).toBe(3);
    const rot = [...Object.entries(questionnaire), ...Object.entries(street)].filter(([k]) => k.endsWith('Deg'));
    expect(rot.length).toBeGreaterThanOrEqual(3);
    for (const [k, d] of rot) expect(Math.abs(d.v as number), k).toBeLessThanOrEqual(max);
    expect(questionnaire).toMatchObject({ cardMaxWidthPx: { v: 1180 }, eyeDiscPx: { v: 64 }, designatedScale: { v: 1.025 }, optionBorderPx: { v: 2 }, optionDotRingPx: { v: 2 }, dotPx: { v: 30 }, dotRingPx: { v: 2 } });
    expect(street).toMatchObject({ optionRestWidthPx: { v: 432 }, optionDesignatedWidthPx: { v: 480 }, designatedRimPx: { v: 3 }, eyePx: { v: 64 }, pupilPx: { v: 27 }, coinPx: { v: 22 }, personMarginPx: { v: 24 } });
    expect(shape).toMatchObject({ cardMain: { v: 48 }, cardSecondary: { v: 30 }, pill: { v: 999 }, bubble: { v: 46 }, border: { v: 2 } });
  });

  it('test_apply_theme_sets_palette_motion_and_type_variables', () => {
    const { el, vars } = fakeEl();
    applyTheme(el);
    expect(vars.get('--c-encre')).toBe('#231942');
    expect(vars.get('--c-lavande-trait')).toBe('#8A7FB0');
    expect(vars.get('--c-base')).toBe('#2B3138');   // jetons du mur de CRT conservés
    expect(vars.get('--sh-rose')).toBe('#C23A78');
    expect(vars.get('--s-card-main')).toBe('48px');
    expect(vars.get('--m-designate-ms')).toBe('180ms');
    expect(vars.get('--m-designate-easing')).toBe('cubic-bezier(.34, 1.56, .64, 1)');
    expect(vars.get('--t-street-option-weight')).toBe('500');
    expect(vars.get('--t-street-option-lh')).toBe('1.25');
    expect(vars.get('--t-body-lh')).toBe('1.5');
    expect(vars.get('--font-ui')).toBe(ui().theme.fontUi);
    expect(vars.get('--font-display')).toBe(ui().theme.fontDisplay);
    expect(vars.get('--font-text')).toBe(ui().theme.fontText);
  });

  it('test_font_families_follow_the_t2_interface', () => {
    const { theme } = ui();
    expect(theme.fontDisplay).toBe('"Montserrat C", "Helvetica Neue", Helvetica, Arial, sans-serif');
    expect(theme.fontText).toBe('"Inter C", "Helvetica Neue", Helvetica, Arial, sans-serif');
    const { el, vars } = fakeEl();
    applyTheme(el);
    expect(vars.get('--font-display')).toBe(theme.fontDisplay);
    expect(vars.get('--font-text')).toBe(theme.fontText);
    for (const role of Object.keys(theme.type)) {
      const name = role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      expect(vars.get(`--t-${name}-family`), role).toMatch(/^var\(--font-(display|text)\)$/);
    }
    expect(vars.get('--t-street-option-family')).toBe('var(--font-display)');
    expect(vars.get('--t-body-family')).toBe('var(--font-text)');
  });

  it('test_type_weights_follow_spec_c_2_montserrat_inter', () => {
    for (const [role, s] of Object.entries(ui().theme.type)) {
      const { family, weight, px } = s.v;
      if (family === 'display') expect(weight, role).toBe(px >= 76 || role === 'worldName' || role === 'braceletNumber' ? 600 : 500);   // nom du monde : 72 px au plus mais 600 [spec §3.4, amendement 2026-11-02]
      else expect([400, 500], role).toContain(weight);
    }
    expect(ui().theme.type.braceletNumber.v).toMatchObject({ family: 'display', weight: 600, px: 64 });   // Montserrat a tnum (mesuré sur le paquet)
  });

  it('test_line_heights_other_than_body_are_supposed_by_art_director', () => {
    for (const [role, s] of Object.entries(ui().theme.type)) {
      if (role === 'body') { expect(s.status).toBe('sourced'); continue; }
      expect(s.status, role).toBe('supposed');
      expect(s.owner, role).toBe('art-director');
    }
  });

// Literal color coverage now lives in ui_no_literal_color_test.ts.

  it('test_existing_colors_block_unchanged', () => {
    expect(ui().theme.colors).toEqual({
      base: '#2B3138', mid: '#4A5560', light: '#8C97A0', sodium: '#E8A33D', crtCyan: '#009EFF', crtMagenta: '#FF0D8C', crtPale: '#618CFF',
      panelBg: '#14181D', panelText: '#E3E8EC', band: '#000000',
    });
    expect(ui().theme.fontUi).toBe(ui().theme.fontText);
    expect(ui().timing.speeds).toEqual([1, 2, 4]);
  });
});
