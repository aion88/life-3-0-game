/** Polices du parcours public « Chambre noire » : Instrument Serif (titres) et Atkinson Hyperlegible Next (tout le reste), vendorisées, OFL 1.1, budget 200 000 octets, plus l'héritage Montserrat et Inter de l'ancien parcours. Fredoka et Nunito sorties. */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import { loadUi } from '../../../src/data/ui/load';

interface LockEntry { file: string; bytes: number; sha256: string; package: string; version: string; licenceSource: string; licenceCommit: string }
const FONTS = 'public/fonts';
const BUDGET = 200_000;
const VARIABLE_MAX = 60_000;   // au-delà, les statiques [spec C §2]

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|css)$/.test(n) ? [p] : [];
  });
}
const lock = (): LockEntry[] => (JSON.parse(readFileSync(`${FONTS}/fonts.lock.json`, 'utf8')) as { files: LockEntry[] }).files;
const shipped = (): string[] => readdirSync(FONTS).filter((n) => n.endsWith('.woff2')).sort();
const css = (): string => readFileSync('src/ui/fonts.css', 'utf8');
const faces = (): string[] => css().match(/@font-face\s*{[^}]*}/g) ?? [];

/** Plages `unicode.json` du sous-ensemble latin de Fontsource, lues du paquet installé : la source de vérité de la couverture. */
function latinRanges(pkg: string): [number, number][] {
  const raw = (JSON.parse(readFileSync(`node_modules/${pkg}/unicode.json`, 'utf8')) as { latin: string }).latin;
  return raw.split(',').map((r) => {
    const [a, b] = r.replace(/U\+/g, '').split('-');
    return [parseInt(a!, 16), parseInt(b ?? a!, 16)];
  });
}

describe('polices de l\'interface C', () => {
  it('test_fonts_lock_lists_every_shipped_woff2', () => {
    const entries = lock();
    expect(entries.map((e) => e.file).sort()).toEqual(shipped());
    for (const e of entries) {
      const buf = readFileSync(join(FONTS, e.file));
      expect(e.bytes, e.file).toBe(buf.length);
      expect(e.sha256, e.file).toBe(createHash('sha256').update(buf).digest('hex'));
      for (const k of ['package', 'version', 'licenceSource', 'licenceCommit'] as const) expect(e[k], `${e.file} ${k}`).toMatch(/\S/);
      expect(e.licenceCommit, e.file).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('test_font_budget_120000_bytes', () => {
    const total = lock().reduce((a, e) => a + e.bytes, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(BUDGET);
  });

  /** Famille livrée en variable (axe wght) si son fichier latin tient en 60 000 octets, sinon en statiques [spec C §2]. */
  const RULES = [
    { fam: 'montserrat', pkg: '@fontsource-variable/montserrat', css: 'Montserrat C', statics: [500, 600], range: '500 600' },
    { fam: 'inter', pkg: '@fontsource-variable/inter', css: 'Inter C', statics: [400, 500], range: '400 500' },
  ] as const;

  for (const r of RULES) {
    it(`test_${r.fam}_variable_or_statics_rule`, () => {
      const variable = statSync(`node_modules/${r.pkg}/files/${r.fam}-latin-wght-normal.woff2`).size;
      const names = shipped().filter((n) => n.startsWith(r.fam));
      if (variable > VARIABLE_MAX) expect(names).toEqual(r.statics.map((w) => `${r.fam}-latin-${w}-normal.woff2`));
      else expect(names).toEqual([`${r.fam}-latin-wght-normal.woff2`]);
    });

    it(`test_${r.fam}_ships_only_spec_weights`, () => {
      const mine = faces().filter((f) => f.includes(`"${r.css}"`));
      if (shipped().includes(`${r.fam}-latin-wght-normal.woff2`)) {
        expect(mine).toHaveLength(1);
        expect(mine[0]).toMatch(new RegExp(`font-weight:\\s*${r.range}\\s*;`));
      } else {
        expect(mine.map((f) => Number(/font-weight:\s*(\d+)\s*;/.exec(f)![1])).sort()).toEqual([...r.statics]);
      }
    });
  }

  it('test_font_faces_are_same_origin_swap', () => {
    expect(faces().length).toBeGreaterThan(0);
    expect(css()).not.toMatch(/https?:|\/\//);
    for (const f of faces()) {
      expect(f).toMatch(/font-display:\s*swap\s*;/);
      const urls = [...f.matchAll(/url\(([^)]*)\)/g)].map((m) => m[1]!.replace(/['"]/g, ''));
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) {
        expect(u.startsWith('/fonts/'), u).toBe(true);
        expect(existsSync(join('public', u)), u).toBe(true);
      }
    }
  });

  it('test_licences_present_and_ofl_1_1', () => {
    for (const [file, owner] of [['LICENSE-Montserrat.txt', 'The Montserrat Project Authors'], ['LICENSE-Inter.txt', 'The Inter Project Authors'], ['LICENSE-InstrumentSerif.txt', 'The Instrument Serif Project Authors'], ['LICENSE-AtkinsonHyperlegibleNext.txt', 'The Atkinson Hyperlegible Next Project Authors']] as const) {
      const txt = readFileSync(join(FONTS, file), 'utf8');
      expect(txt, file).toContain('SIL Open Font License, Version 1.1');
      expect(txt, file).toContain(owner);
    }
    expect(existsSync(`${FONTS}/LICENSE-Fredoka.txt`)).toBe(false);
    expect(existsSync(`${FONTS}/LICENSE-Nunito.txt`)).toBe(false);
  });

  it('test_theme_font_stacks_name_the_vendored_families', () => {
    const { theme } = loadUi();
    expect(theme.fontDisplay).toBe('"Montserrat C", "Helvetica Neue", Helvetica, Arial, sans-serif');
    expect(theme.fontText).toBe('"Inter C", "Helvetica Neue", Helvetica, Arial, sans-serif');
    expect(theme.fontUi).toBe(theme.fontText);
    expect(css()).toContain('font-family: "Montserrat C"');
    expect(css()).toContain('font-family: "Inter C"');
  });

  it('test_strings_covered_by_latin_subset', () => {
    for (const pkg of ['@fontsource-variable/montserrat', '@fontsource-variable/inter']) {
      const ranges = latinRanges(pkg);
      const covered = (cp: number): boolean => ranges.some(([a, b]) => cp >= a && cp <= b);
      const missing = new Set<string>();
      for (const [lang, table] of [['fr', fr], ['en', en]] as const) {
        for (const [k, v] of Object.entries(table as Record<string, string>)) {
          for (const ch of v) if (!covered(ch.codePointAt(0)!)) missing.add(`${pkg} ${lang} ${k} U+${ch.codePointAt(0)!.toString(16).toUpperCase()} ${ch}`);
        }
      }
      expect([...missing]).toEqual([]);
      for (const ch of ['Œ', 'œ', '«', '»', ' ', ' ']) expect(covered(ch.codePointAt(0)!), `${pkg} U+${ch.codePointAt(0)!.toString(16)}`).toBe(true);
    }
  });

  /** Chambre noire : deux familles seulement, Instrument Serif en 400 (droit et italique), Atkinson en variable 200 à 800, latin et latin-ext, aucune graisse hors plage (font-synthesis: none). */
  it('test_chambre_noire_families_and_weights', () => {
    const serif = faces().filter((f) => f.includes('"Instrument Serif"'));
    expect(serif).toHaveLength(4);
    for (const f of serif) expect(f).toMatch(/font-weight:\s*400\s*;/);
    expect(serif.filter((f) => /font-style:\s*italic/.test(f))).toHaveLength(2);
    const sans = faces().filter((f) => f.includes('"Atkinson Hyperlegible Next"'));
    expect(sans).toHaveLength(2);
    for (const f of sans) expect(f).toMatch(/font-weight:\s*200 800\s*;/);
    const tokens = readFileSync('src/ui/tokens.css', 'utf8');
    expect(tokens).toMatch(/--titre:\s*"Instrument Serif"/);
    expect(tokens).toMatch(/--corps:\s*"Atkinson Hyperlegible Next"/);
    expect(readFileSync('src/worlds/situations/situationPlayer.css', 'utf8')).toContain('font-synthesis:none');
  });

  it('test_public_css_uses_only_the_two_token_families', () => {
    for (const file of ['src/worlds/situations/situationPlayer.css', 'src/worlds/pieces.css']) {
      const bad = [...readFileSync(file, 'utf8').matchAll(/font(?:-family)?\s*:\s*([^;}]*)/g)].map((m) => m[1]!).filter((v) => /["']|monospace|serif|system-ui|Montserrat|Inter\b/i.test(v.replace(/var\([^)]*\)/g, '')));
      expect(bad, file).toEqual([]);
    }
  });

  it('test_strings_covered_by_chambre_noire_latin_subset', () => {
    for (const fam of ['Atkinson Hyperlegible Next', 'Instrument Serif']) {
      const face = faces().find((f) => f.includes(`"${fam}"`) && !/latin-ext/.test(/url\(([^)]*)\)/.exec(f)![1]!))!;
      const raw = /unicode-range:\s*([^;]*);/.exec(face)![1]!;
      const ranges = raw.split(',').map((r): [number, number] => { const [a, b] = r.replace(/U\+/g, '').trim().split('-'); return [parseInt(a!, 16), parseInt(b ?? a!, 16)]; });
      const covered = (cp: number): boolean => ranges.some(([a, b]) => cp >= a && cp <= b);
      const missing = new Set<string>();
      for (const [lang, table] of [['fr', fr], ['en', en]] as const) for (const [k, v] of Object.entries(table as Record<string, string>)) for (const ch of v) if (!covered(ch.codePointAt(0)!)) missing.add(`${fam} ${lang} ${k} U+${ch.codePointAt(0)!.toString(16).toUpperCase()} ${ch}`);
      expect([...missing]).toEqual([]);
      for (const ch of ['Œ', 'œ', '«', '»']) expect(covered(ch.codePointAt(0)!), `${fam} U+${ch.codePointAt(0)!.toString(16)}`).toBe(true);
    }
  });

  it('test_only_vendored_css_imported_by_font_ts', () => {
    const imports = sources('src').flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/import\s+['"]([^'"]*fonts?\.css)['"]/g)].map((m) => `${f} ${m[1]!}`));
    expect(imports).toEqual(['src/ui/font.ts ./fonts.css']);
    const hits = sources('src').flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/['"](@fontsource[^'"]*)['"]/g)].map((m) => `${f} ${m[1]!}`));
    expect(hits).toEqual([]);
  });

  it('test_no_fredoka_nunito_left', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((n) => /fredoka|nunito/i.test(n))).toEqual([]);
    expect(Object.keys(pkg.dependencies ?? {}).filter((n) => n.startsWith('@fontsource'))).toEqual([]);
    const hits = sources('src').filter((f) => /fredoka|nunito/i.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
    expect(readFileSync('src/data/ui/theme.json', 'utf8')).not.toMatch(/fredoka|nunito/i);
  });
});
