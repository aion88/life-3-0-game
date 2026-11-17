// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as build from '../../../src/bilan/build';
import { bilanScreen } from '../../../src/screens/bilan';
import { mountScreen } from '../../support/screens';
import { realI18n, visibleTexts } from '../../support/street_ui';
import { bilanCtx, extinctionInput, REDIRECTED_RUN, w10WithShare, W10, weekEndOf } from '../../support/screens_bilan';

const t = realI18n('fr');
const nav = (root: HTMLElement): HTMLButtonElement[] => [...root.querySelectorAll<HTMLButtonElement>('[data-ui="page-nav"] button')];
const page = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('[data-testid="bilan-page"]')!;
const byId = (root: HTMLElement, id: string): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
const toggle = (root: HTMLElement): HTMLButtonElement => root.querySelector<HTMLButtonElement>('[data-ui="soft-toggle"]')!;
const goTo = (root: HTMLElement, id: string): void => {
  const i = nav(root).findIndex((b) => b.textContent === pageLabel(id));
  nav(root)[i]!.click();
};
const pageLabel = (id: string): string => t.t(`bilan.page.${id}.label`);   // un seul libellé par onglet [spec C §3.4]

afterEach(() => { vi.restoreAllMocks(); });

describe('écran bilan', () => {
  it('test_bilan_screen_renders_sheet_first_then_pages_by_nav', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    expect(page(root).dataset['page']).toBe('sheet');
    expect(page(root).textContent).toContain(t.t('bilan.sheet.title'));
    nav(root)[2]!.click();
    expect(page(root).dataset['page']).not.toBe('sheet');
  });

  it('test_each_piece_has_its_own_page', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    const seen: string[] = [];
    nav(root).forEach((b) => { b.click(); seen.push(page(root).dataset['page']!); });
    // « Zéro nom » franchit des maillons de w10 : la page des chaînes de la semaine suit le dossier [J3-J7 T7]
    expect(seen).toEqual(['sheet', 'dossier', 'chains', 'others', 'traceback', 'rights']);
  });

  it('test_every_page_carries_label_title_and_label', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    nav(root).forEach((b) => {
      b.click();
      const title = page(root).querySelector('[data-page-title]')!.textContent!;
      const label = page(root).querySelector('[data-page-label]')!.textContent!;
      expect(title).not.toBe('');
      expect(label).not.toBe('');
      expect(b.textContent).toBe(label);
      expect(b.textContent).not.toContain(' · ');
    });
  });

  it('test_page_labels_are_the_bilan_page_keys', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    const ids = ['sheet', 'dossier', 'chains', 'others', 'traceback', 'rights'];
    ids.forEach((id, i) => { expect(nav(root)[i]!.textContent!.endsWith(t.t(`bilan.page.${id}.label`))).toBe(true); });
  });

  it('test_bilan_screen_page_nav_has_no_number', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    for (const b of nav(root)) expect(b.textContent).not.toMatch(/\d/);
  });

  it('test_bilan_screen_has_sources_and_replay_buttons', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    expect(byId(root, 'bilan-sources')!.textContent).toBe(t.t('bilan.btn.sources'));
    expect(byId(root, 'bilan-replay')!.textContent).toBe(t.t('bilan.btn.replay'));
  });

  it('test_soft_toggle_on_bilan_rerenders_without_rebuilding_data', async () => {
    const spy = vi.spyOn(build, 'buildBilan');
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    toggle(root).click();
    toggle(root).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('test_soft_toggle_hides_rupture_year_and_extinction_year', async () => {
    const input = extinctionInput();
    const data = build.buildBilan(input, { core: bilanCtx().core, common: (await import('../../../src/data/bilanLoad')).loadBilanCommon(), lived: null, computedFile: null, has: () => true });
    const year = String(data.curve.ruptureYear);
    expect(data.curve.ruptureYear).not.toBeNull();
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input });
    nav(root)[0]!.click();
    const yearEl = (): HTMLElement => page(root).querySelector<HTMLElement>('[data-year]')!;
    expect(yearEl().textContent).toBe(year);
    toggle(root).click();
    expect(yearEl().textContent).not.toContain(year);          // B-V10 sur l'élément rendu
    expect(yearEl().textContent).toBe(t.t('bilan.curve.yearHidden'));
    toggle(root).click();
    expect(yearEl().textContent).toBe(year);
  });

  it('test_soft_toggle_hides_projected_extinction_year_on_arrival_curve', async () => {
    const input = weekEndOf();
    const common = (await import('../../../src/data/bilanLoad')).loadBilanCommon();
    const data = build.buildBilan(input, { core: bilanCtx().core, common, lived: W10, computedFile: null, has: () => true });
    const y = data.curve.projectedExtinctionYear;
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input });
    goTo(root, 'others');
    const line = y === null ? null : t.t('bilan.curve.extinctionYear', { year: y });
    if (line !== null) expect(page(root).textContent).toContain(line);
    toggle(root).click();
    if (line !== null) expect(page(root).textContent).not.toContain(line);
  });

  it('test_bilan_replay_goes_to_warning', async () => {
    const ctx = bilanCtx();
    const { root } = await mountScreen(bilanScreen, ctx, { input: weekEndOf() });
    byId(root, 'bilan-replay')!.click();
    expect(ctx.navigate).toHaveBeenCalledWith('warning', undefined);
  });

  it('test_bilan_atlas_button_opens_atlas_with_arrival_world_and_back_to_bilan', async () => {
    const ctx = bilanCtx();
    const input = weekEndOf();
    const { root } = await mountScreen(bilanScreen, ctx, { input });
    expect(root.querySelector('a[data-ui=contact]')).not.toBeNull();
    byId(root, 'bilan-atlas')!.click();
    const [id, payload] = ctx.navigate.mock.calls[0] as [string, { arrival?: string; back: { id: string; input: unknown } }];
    expect(id).toBe('atlas');
    expect(payload.back).toEqual({ id: 'bilan', input });
    expect(payload.arrival === undefined || /^w\d\d$/.test(payload.arrival)).toBe(true);
  });

  it('test_bilan_atlas_button_lights_the_extinction_world', async () => {
    const ctx = bilanCtx();
    const input = extinctionInput();
    const { root } = await mountScreen(bilanScreen, ctx, { input });
    byId(root, 'bilan-atlas')!.click();
    const [id, payload] = ctx.navigate.mock.calls[0] as [string, { arrival?: string; back: { id: string } }];
    expect(id).toBe('atlas');
    expect(input.run.outcome.kind).toBe('extinction');
    expect(payload.arrival).toBe((input.run.outcome as { world: string }).world);
    expect(payload.arrival).toMatch(/^w(07|12)$/);
    expect(payload.back.id).toBe('bilan');
  });

  it('test_bilan_sources_button_opens_sources_with_from_bilan', async () => {
    const ctx = bilanCtx();
    const input = weekEndOf();
    const { root } = await mountScreen(bilanScreen, ctx, { input });
    byId(root, 'bilan-sources')!.click();
    expect(ctx.navigate).toHaveBeenCalledWith('sources', { from: 'bilan', input });
    expect((ctx.navigate.mock.calls[0] as unknown[])[1]).toHaveProperty('input', input);   // R-03.28 : le même BilanInput
  });

  it('test_bilan_screen_sets_save_phase_bilan_on_open', async () => {
    const ctx = bilanCtx();
    expect(ctx.save.load().data.phase).not.toBe('bilan');
    await mountScreen(bilanScreen, ctx, { input: weekEndOf() });
    expect(ctx.save.load().data.phase).toBe('bilan');
  });

  it('test_redirected_bilan_shows_redirect_block', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf('Zéro nom', REDIRECTED_RUN) });
    const box = root.querySelector('[data-testid="bilan-world-redirect"]')!;   // la ligne vit dans le bloc du monde de la fiche [plan UI-C T10, P-2]
    expect(box.textContent).toBe(t.t('redirect.bilan', { computed: t.t('world.w03.name'), lived: t.t('world.w10.name') }));
  });

  it('test_not_redirected_has_no_redirect_block', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    expect(root.querySelector('[data-testid="bilan-world-redirect"]')).toBeNull();
  });

  it('test_computed_world_loaded_only_if_available', async () => {
    const ctx = bilanCtx();
    await mountScreen(bilanScreen, ctx, { input: weekEndOf('Zéro nom', REDIRECTED_RUN) });
    expect(ctx.loaded).toEqual(['w10']);        // w03 absent de available() : jamais chargé [R-03.18]
  });

  it('test_lived_world_missing_gives_no_sheet_page_and_does_not_crash', async () => {
    const ctx = bilanCtx(W10, { worlds: { available: () => [], load: () => Promise.reject(new Error('non')) } });
    const { root } = await mountScreen(bilanScreen, ctx, { input: weekEndOf() });
    expect(nav(root).map((b) => b.textContent!)).not.toContain(pageLabel('sheet'));
    expect(page(root).dataset['page']).toBe('others');
  });

  it('test_extinction_has_no_sheet_dossier_or_rights_pages', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: extinctionInput() });
    const seen: string[] = [];
    nav(root).forEach((b) => { b.click(); seen.push(page(root).dataset['page']!); });
    expect(seen).toEqual(['others', 'traceback']);
  });

  it('test_share_button_absent_when_format_null', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(w10WithShare(null)), { input: weekEndOf() });
    expect(byId(root, 'bilan-image')).toBeNull();
  });

  it('test_share_button_present_when_format_set', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(w10WithShare({ width: 1200, height: 630 })), { input: weekEndOf() });
    expect(byId(root, 'bilan-image')!.textContent).toBe(t.t('bilan.btn.image'));
  });

  it('test_share_button_absent_in_extinction', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(w10WithShare({ width: 1200, height: 630 })), { input: extinctionInput() });
    expect(byId(root, 'bilan-image')).toBeNull();
  });

  it('test_rendered_text_has_no_raw_key_or_placeholder', async () => {
    const { root } = await mountScreen(bilanScreen, bilanCtx(), { input: weekEndOf() });
    nav(root).forEach((b) => {
      b.click();
      for (const s of visibleTexts(page(root))) { expect(s).not.toMatch(/\{\w+\}|\[!!|^[a-z0-9]+\.[a-z0-9.]+$/i); }
    });
  });
});
