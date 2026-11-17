import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../../src');

function sources(dir: string): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return []; }
  return entries.flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx|js|mjs)$/.test(e) ? [p] : [];
  });
}

describe('DOM sans Three.js', () => {
  it('test_no_three_import_in_ui_screens_bilan : aucun import de three sous ui, screens, bilan', () => {
    const offenders: string[] = [];
    for (const d of ['ui', 'screens', 'bilan']) {
      for (const f of sources(join(SRC, d))) {
        const text = readFileSync(f, 'utf8');
        if (/(from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]three(\/[^'"]*)?['"]/.test(text)) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('le balayage voit bien les fichiers de src/ui', () => {
    expect(sources(join(SRC, 'ui')).length).toBeGreaterThan(5);
  });
});
