/** I-1 : palette fermée. Aucun littéral de couleur dans les feuilles C ni dans le code des écrans C [plan UI-C T11 ; spec C §1, I-1]. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../../src');
const NAMED = /(?<![-\w])(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|silver|gold|navy|teal|lime|maroon|olive|aqua|fuchsia|brown|beige|ivory|lavender|transparent)(?![-\w])/i;
const LITERAL = /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklch)\(/i;

/** Hors périmètre : l'image partageable (canvas 2D) garde la palette d'origine tant que P-11 n'est pas tranché [spec C §3.4, P-11]. */
const P11 = new Set(['screens/bilan/shareImage.ts']);
const ls = (dir: string, ext: RegExp): string[] => readdirSync(join(SRC, dir)).filter((f) => ext.test(f)).map((f) => `${dir}/${f}`);
/** Chambre noire : les feuilles publiques migrées (lecteur de situations, pièces) ne lisent que les jetons de ui/tokens.css et ui/worlds.css (les seuls fichiers à porter des valeurs). */
const CSS = ['ui/c.css', ...ls('street/ui', /\.css$/), 'screens/sober.css', 'screens/bilan/bilan.css', 'worlds/situations/situationPlayer.css', 'worlds/pieces.css'];
const TS = [
  ...['lang', 'warning', 'sources', 'causes', 'questionnaire', 'bilan'].flatMap((d) => ls(`screens/${d}`, /\.ts$/)),
  'screens/sober.ts', ...ls('street/ui', /\.ts$/), ...ls('ui/components', /\.ts$/),
].filter((f) => !P11.has(f));
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('I-1 : aucun littéral de couleur [T11]', () => {
  it('test_css_and_screen_code_have_no_literal_color', () => {
    expect(CSS.length).toBeGreaterThanOrEqual(4);
    expect(TS.length).toBeGreaterThanOrEqual(20);
    const found: string[] = [];
    for (const f of CSS) {
      stripComments(readFileSync(join(SRC, f), 'utf8')).split('\n').forEach((line, i) => {
        // `transparent` seul est toléré dans le CSS : c'est l'absence de couleur (chevron en triangles de bordure), pas une couleur.
        const l = line.replace(/\btransparent\b/g, '');
        if (LITERAL.test(l) || NAMED.test(l.replace(/var\([^)]*\)/g, ''))) found.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
      });
    }
    for (const f of TS) {
      const code = stripComments(readFileSync(join(SRC, f), 'utf8'));
      code.split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
          const str = m[2]!;
          if (LITERAL.test(str) || /^(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|silver|gold|navy|teal|lime|maroon|olive|aqua|fuchsia|brown|beige|ivory|lavender)$/i.test(str.trim())) found.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
        }
        if (/\bcolors\.(base|mid|light|sodium|crt\w*|panel\w*|band)\b|\btheme\.colors\b/.test(line)) found.push(`${f}:${i + 1}: couleur héritée ${line.trim().slice(0, 80)}`);
      });
    }
    expect(found, found.join('\n')).toEqual([]);
  });
});
