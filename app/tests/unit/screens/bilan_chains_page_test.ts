// @vitest-environment happy-dom
/**
 * Page « Les chaînes de ta semaine » du bilan [plan rue guidée J3-J7, T7] : après le dossier, seulement pour un monde vécu à `guided` avec au
 * moins un maillon franchi ; la ligne d'arrestation nomme la nuit.
 */
import { describe, expect, it } from 'vitest';
import { ARREST_N2_ACTS, ARREST_NO_CHAIN_ACTS, arrestInputWithActs, chainsI18n, FIX_ENDING, inputOf, mountBilan, openPage, pageOrder, w10With } from '../../support/bilan_chains';

const t = chainsI18n();
const q = (root: HTMLElement, s: string): HTMLElement => { const e = root.querySelector<HTMLElement>(s); if (e === null) throw new Error(`absent : ${s}`); return e; };

describe('page des chaînes du bilan', () => {
  it('test_chains_page_after_dossier', async () => {
    const root = await mountBilan(inputOf(ARREST_N2_ACTS, 'earlyEnd'));
    const order = pageOrder(root);
    expect(order).toEqual(expect.arrayContaining(['dossier', 'chains']));
    expect(order.indexOf('chains')).toBe(order.indexOf('dossier') + 1);
  });

  it('test_chains_page_title_and_chain_titles', async () => {
    const root = await mountBilan(inputOf(ARREST_N2_ACTS, 'earlyEnd'));
    openPage(root, 'chains');
    const page = q(root, '[data-ui="bilan-chains"]');
    expect(root.querySelector('[data-page-title]')!.textContent).toBe(t.t('bilan.chains.title'));
    expect([...page.querySelectorAll<HTMLElement>('[data-chain]')].map((e) => e.dataset['chain'])).toEqual(['A', 'B', 'E']);
    expect(page.textContent).toContain(t.t('w10.chain.A.title'));
    expect(page.textContent).not.toMatch(/\.absent/);
  });

  it('test_arrest_line_names_the_night', async () => {
    const root = await mountBilan(inputOf(ARREST_N2_ACTS, 'earlyEnd'), { ending: FIX_ENDING });
    openPage(root, 'chains');
    const line = q(root, '[data-ui="bilan-chains-arrested"]');
    expect(q(root, '[data-ui="bilan-chains"]').textContent).toContain(t.t('w10.day.2.date'));
    expect(line.textContent).toBe(t.t(FIX_ENDING.arrestedNightKey, { jour: t.t('w10.day.2.date') }));
  });

  it('test_week_end_has_no_arrest_line', async () => {
    const root = await mountBilan(inputOf(ARREST_N2_ACTS, 'weekEnd'), { ending: FIX_ENDING });
    openPage(root, 'chains');
    expect(root.querySelector('[data-ui="bilan-chains-arrested"]')).toBeNull();
  });

  it('test_world_without_guided_has_no_chains_page', async () => {
    const root = await mountBilan(inputOf(ARREST_N2_ACTS, 'earlyEnd'), { world: w10With(null) });
    expect(pageOrder(root)).not.toContain('chains');
  });

  it('test_no_opened_chain_has_no_chains_page', async () => {
    const root = await mountBilan(arrestInputWithActs(ARREST_NO_CHAIN_ACTS, 'weekEnd'), { ending: FIX_ENDING });
    expect(pageOrder(root)).toEqual(['sheet', 'dossier', 'others', 'traceback', 'rights']);
  });

  it('test_arrested_without_chain_still_reads_the_arrest_line', async () => {
    const root = await mountBilan(arrestInputWithActs(ARREST_NO_CHAIN_ACTS, 'earlyEnd'), { ending: FIX_ENDING });
    expect(pageOrder(root)).toContain('chains');
    openPage(root, 'chains');
    expect(q(root, '[data-ui="bilan-chains-arrested"]').textContent).toBe(t.t(FIX_ENDING.arrestedNightKey, { jour: t.t('w10.day.2.date') }));
    expect(root.querySelectorAll('[data-ui="bilan-chains"] [data-chain]')).toHaveLength(0);
  });

  it('test_arrested_without_chain_nor_ending_has_no_chains_page', async () => {
    const root = await mountBilan(arrestInputWithActs(ARREST_NO_CHAIN_ACTS, 'earlyEnd'), { ending: null });   // w10 a sa fin depuis T13 : on la retire
    expect(pageOrder(root)).not.toContain('chains');
  });
});
