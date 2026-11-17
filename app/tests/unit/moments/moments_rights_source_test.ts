// @vitest-environment happy-dom
/**
 * Droits à source nommée : le texte, l'article et la citation officielle, après la phrase du monde [plan rue guidée T12 ; spec §7 ; bible w10 §4.5].
 * Les huit `w10.right.*` ne bougent pas (bilan final et B-V6 ont besoin de leurs deux moitiés).
 */
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lineHalves, rightParts } from '../../../src/engine/moments/rights';
import { RIGHT_IDS } from '../../../src/shared/types/street';
import { mountUi } from '../../../src/street/ui';
import type { UiHandle } from '../../../src/street/ui';
import { validateContent } from '../../../src/validate/content';
import { realInput } from '../../fixtures/data/factories';
import { FR, realI18n } from '../../support/street_ui';

const ARTICLE: Readonly<Record<string, number>> = { move: 13, leave: 13, stay: 13, speak: 19, read: 19, assemble: 20, privacy: 12, work: 23 };
const q = (s: string): Element => document.body.querySelector(s)!;
let ui: UiHandle;
beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

describe('droits à source nommée [plan rue guidée T12]', () => {
  it('test_every_right_names_text_and_article', () => {
    for (const r of RIGHT_IDS) {
      expect(FR[`rights.source.${r}`]).toMatch(/^Déclaration universelle des droits de l.homme \(ONU, 1948\), article \d+/u);
      expect(FR[`rights.source.${r}`]).toContain(`article ${ARTICLE[r]}, un texte qui existe toujours en 2026 :`);
    }
  });
  it('test_no_right_claims_binding_force', () => {
    for (const r of RIGHT_IDS) for (const k of [`rights.source.${r}`, `rights.quote.${r}`, `w10.right.${r}`]) expect(FR[k]).not.toMatch(/vigueur/iu);
  });
  it('test_quote_is_quoted_and_cites_research_file', () => {
    for (const r of RIGHT_IDS) expect(FR[`rights.quote.${r}`]).toMatch(/^« .+ »$/u);
    expect(existsSync('../research/2026-11-04-dudh-texte-officiel-fr.md')).toBe(true);
  });
  it('test_here_is_first_half_only', () => {
    for (const r of RIGHT_IDS) {
      const p = rightParts('w10', r, (k) => FR[k]!);
      expect(p.here).toBe(lineHalves(FR[`w10.right.${r}`]!).first);
      expect(p.here).not.toMatch(/2026/u);
      expect(p.source).toBe(FR[`rights.source.${r}`]); expect(p.quote).toBe(FR[`rights.quote.${r}`]);
    }
  });
  it('test_right_line_ui_shows_three_parts', () => {
    ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n('fr'));
    ui.showRightParts(rightParts('w10', 'move', (k) => FR[k]!));
    expect(q('[data-ui="right-here"]').textContent).toBe(lineHalves(FR['w10.right.move']!).first);
    expect(q('[data-ui="right-source"]').textContent).toBe(FR['rights.source.move']);
    expect(q('[data-ui="right-quote"]').textContent).toBe(FR['rights.quote.move']);
    ui.showRightParts(null);
    expect(document.querySelector('[data-ui="right-source"]')).toBeNull();
  });
  it('test_bilan_right_lines_untouched', () => {
    const r = validateContent(realInput());
    expect([...r.errors, ...r.warnings].filter((i) => i.code === 'GDD06-BV6-right')).toEqual([]);
  });
});
