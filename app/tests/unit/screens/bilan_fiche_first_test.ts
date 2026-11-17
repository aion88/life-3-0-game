// @vitest-environment happy-dom
/**
 * Fin d'une semaine guidée : le bilan s'ouvre sur la fiche C (« Ta semaine »), jamais sur une page de texte seul [retours Cynthia
 * 2026-11-08 ; spec C §3.4 ; maquette `production/qa/evidence/ui/2026-11-02-directions/c/bilan.png`]. Première page = `sheet`, avec la rangée
 * des jours en pastilles rondes (une par jour vécu), les sept cartes du kit et la carte encre « Ce qui a tenu, ce qui a coûté ».
 */
import { describe, expect, it } from 'vitest';
import { replay } from '../../../src/engine/moments/replay';
import { toBilanInput } from '../../../src/engine/moments/bilan';
import type { BilanInput } from '../../../src/shared/types/bilan';
import { ACTS_FULL_WEEK_FIXTURE, ARREST_N2_ACTS, chainsI18n, inputOf, mountBilan } from '../../support/bilan_chains';
import { ctxW10 } from '../../support/street';

const t = chainsI18n();

/** Entrée du bilan d'une semaine guidée jouée jusqu'au bout (metteur en scène, premières options), telle que `finishDay` la rend. */
function fullWeekInput(): BilanInput {
  const ctx = ctxW10();
  const r = replay(ACTS_FULL_WEEK_FIXTURE, ctx);
  return toBilanInput(r.state, r.week, ctx);
}

/** Ce que la joueuse voit en arrivant, sans cliquer un onglet. */
function firstScreen(root: HTMLElement): { page: string | undefined; title: string | null; pills: number; round: number; kit: number; fate: string | null } {
  const page = root.querySelector<HTMLElement>('[data-testid="bilan-page"]')!;
  return {
    page: page.dataset['page'],
    title: page.querySelector('[data-page-title]')?.textContent ?? null,
    pills: page.querySelectorAll('[data-testid="bilan-days-row"] [data-day-pill]').length,
    round: page.querySelectorAll('[data-day-pill].c-day-pill > .c-day-pill__core').length,
    kit: page.querySelectorAll('[data-testid="bilan-kit-row"] [data-kit-card]').length,
    fate: page.querySelector('[data-testid="bilan-fate"] .c-fate-eyebrow')?.textContent ?? null,
  };
}

describe('bilan : la fiche C en première page à la fin d\'une semaine guidée', () => {
  it('test_bilan_week_end_opens_on_sheet_with_round_days_kit_and_fate', async () => {
    const input = fullWeekInput();
    expect(input.entry).toBe('weekEnd');
    const s = firstScreen(await mountBilan(input));
    expect(s.page).toBe('sheet');
    expect(s.title).toBe(t.t('bilan.sheet.title'));
    expect(s.pills).toBe(7);
    expect(s.round).toBe(7);
    expect(s.kit).toBe(7);
    expect(s.fate).toBe(t.t('bilan.sheet.fate'));
  });

  it('test_bilan_arrested_opens_on_sheet_not_chains', async () => {
    const s = firstScreen(await mountBilan(inputOf(ARREST_N2_ACTS, 'earlyEnd')));
    expect(s.page).toBe('sheet');
    expect(s.pills).toBeGreaterThan(0);
    expect(s.pills).toBe(s.round);
    expect(s.kit).toBe(7);
    expect(s.fate).toBe(t.t('bilan.sheet.fate'));
  });
});
