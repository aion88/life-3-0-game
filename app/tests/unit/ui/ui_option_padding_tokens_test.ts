/** Marge interne des options de rue en jetons, pas en px littéraux [retour de Cynthia 2026-11-02 ; plan UI-C T4]. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadUi } from '../../../src/data/ui/load';

const UI_CSS = readFileSync(join(__dirname, '../../../src/street/ui/ui.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const supposed = JSON.parse(readFileSync(join(__dirname, '../../fixtures/ui/ui_supposed.json'), 'utf8')) as { path: string; owner: string }[];

describe('marge interne des options de rue', () => {
  it('test_option_padding_comes_from_street_tokens_with_provenance', () => {
    const s = loadUi().theme.street;
    expect([s.optionPadYPx.v, s.optionPadStartPx.v, s.optionPadEndPx.v]).toEqual([15, 26, 18]);
    for (const k of ['optionPadYPx', 'optionPadStartPx', 'optionPadEndPx'] as const) {
      expect(s[k].status, k).toBe('supposed');
      expect(s[k].owner, k).toBe('art-director');
      expect(supposed.some((e) => e.path === `theme.street.${k}` && e.owner === 'art-director'), `${k} épinglé`).toBe(true);
    }
  });

  it('test_street_option_rule_has_no_literal_padding', () => {
    const rule = /\.c-street-option\s*\{([^}]*)\}/.exec(UI_CSS)?.[1] ?? '';
    const pad = /padding\s*:\s*([^;]*)/.exec(rule)?.[1] ?? '';
    expect(pad).toContain('var(--s-street-option-pad-');
    expect(pad).not.toMatch(/\d+(\.\d+)?px/);
  });
});
