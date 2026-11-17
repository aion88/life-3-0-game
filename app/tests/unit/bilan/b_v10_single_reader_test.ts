/** B-V10 [GDD 06 §8.2 ; R-03.27] : `shownYears` est le seul lecteur de `ruptureYear` et `projectedExtinctionYear` hors `src/bilan`. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src/screens', 'src/ui'];
const FORBIDDEN = /\b(ruptureYear|projectedExtinctionYear)\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
/** Fichiers de `roots` qui nomment l'un des deux champs. */
export function offenders(roots: readonly string[]): string[] {
  return roots.flatMap(sources).filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')));
}

describe('B-V10, un seul lecteur [plan 03 T11, R-03.27]', () => {
  it('test_b_v10_no_screen_or_ui_source_reads_the_years_directly', () => {
    expect(ROOTS.flatMap(sources).length).toBeGreaterThan(0);       // le balayage voit bien des fichiers
    expect(offenders(ROOTS)).toEqual([]);
  });
});
