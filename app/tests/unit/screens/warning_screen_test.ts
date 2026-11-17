// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getDraft, resetDraft } from '../../../src/screens/draft';
import { warningScreen } from '../../../src/screens/warning';
import type { SavePhase } from '../../../src/save/save';
import { fakeCtx, mountScreen } from '../../support/screens';
import { realI18n, visibleTexts } from '../../support/street_ui';

const toggle = (root: HTMLElement): HTMLButtonElement => {
  const b = root.querySelector<HTMLButtonElement>('[data-ui="soft-toggle"]');
  if (!b) throw new Error('bascule absente');
  return b;
};
const cont = (root: HTMLElement): HTMLButtonElement => {
  const b = root.querySelector<HTMLButtonElement>('[data-testid="warning-continue"]');
  if (!b) throw new Error('bouton continuer absent');
  return b;
};

describe('écran warning', () => {
  it('test_warning_shows_content_warning_key_and_soft_toggle', async () => {
    const ctx = fakeCtx();
    const t = realI18n('fr');
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    const text = root.textContent ?? '';
    expect(text).toContain(t.t('warning.title'));
    expect(text).toContain(t.t('warning.body'));
    expect(text).toContain(t.t('warning.soft.label'));
    expect(text).toContain(t.t('warning.soft.hint'));
    expect(toggle(root).textContent).toContain(t.t('warning.soft.label'));
    expect(cont(root).textContent).toBe(t.t('warning.continue'));
  });

  it('test_soft_toggle_writes_save_softened_true_on_fresh_game', async () => {
    const ctx = fakeCtx();
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    toggle(root).click();
    expect(ctx.save.load().data.softened).toBe(true);
    expect(toggle(root).getAttribute('aria-pressed')).toBe('true');
  });

  it('test_soft_toggle_off_writes_false_on_fresh_game', async () => {
    const ctx = fakeCtx();
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    toggle(root).click();
    toggle(root).click();
    expect(ctx.save.load().data.softened).toBe(false);
  });

  it.each<SavePhase>(['fastforward', 'street', 'bilan'])('test_soft_toggle_in_replay_mode_writes_draft_not_save (%s)', async (phase) => {
    const ctx = fakeCtx();
    ctx.save.update({ phase, softened: false });
    const before = ctx.save.load().data;
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    toggle(root).click();
    expect(getDraft().softened).toBe(true);
    expect(ctx.save.load().data).toEqual(before);
    expect(ctx.save.load().data.softened).toBe(false);
  });

  it('replay: la bascule part de la préférence déjà sauvegardée', async () => {
    const ctx = fakeCtx();
    ctx.save.update({ phase: 'bilan', softened: true });
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    expect(toggle(root).getAttribute('aria-pressed')).toBe('true');
    expect(getDraft().softened).toBe(true);
  });

  it('test_draft_is_reset_on_new_warning_entry', async () => {
    const ctx = fakeCtx();
    ctx.save.update({ phase: 'street' });
    const first = await mountScreen(warningScreen, ctx, undefined);
    toggle(first.root).click();
    expect(getDraft().softened).toBe(true);
    first.screen.unmount();
    await mountScreen(warningScreen, ctx, undefined);
    expect(getDraft().softened).toBe(false);
  });

  it('resetDraft rend un brouillon vide', () => {
    resetDraft();
    expect(getDraft().softened).toBeNull();
  });

  it('test_warning_continue_writes_phase_questionnaire_on_fresh_game', async () => {
    const ctx = fakeCtx();
    expect(ctx.save.load().data.phase).toBe('new');
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    cont(root).click();
    expect(ctx.save.load().data.phase).toBe('questionnaire');
  });

  it('test_warning_continue_navigates_to_questionnaire', async () => {
    const ctx = fakeCtx();
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    cont(root).click();
    expect(ctx.navigate).toHaveBeenCalledWith('questionnaire', undefined);
  });

  it('test_new_game_after_replay_goes_through_warning: la sauvegarde reste intacte jusqu\'à Continuer', async () => {
    const ctx = fakeCtx();
    ctx.save.update({ phase: 'bilan', softened: false, lang: 'fr' });
    const before = ctx.save.load().data;
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    toggle(root).click();
    cont(root).click();
    expect(ctx.save.load().data).toEqual(before);
    expect(ctx.navigate).toHaveBeenCalledWith('questionnaire', undefined);
  });

  it.each(['fr', 'en'] as const)('test_warning_screen_has_no_number_or_code (%s)', async (lang) => {
    const ctx = fakeCtx({ i18n: realI18n(lang) });
    const { root } = await mountScreen(warningScreen, ctx, undefined);
    const texts = visibleTexts(root, '.play-flow');
    expect(root.querySelectorAll('.play-flow li')).toHaveLength(3); // Explicit numbered play stages are separate from warning prose.
    expect(texts.length).toBeGreaterThan(0);
    for (const s of texts) expect(s).not.toMatch(/[0-9]|\[!!|\b[a-z]+\.[a-z]+\.[a-z]+/i);
    const t = ctx.i18n;
    const allowed = ['warning.title', 'warning.body', 'warning.soft.label', 'warning.soft.hint', 'warning.continue'].map((k) => t.t(k));
    for (const s of texts) expect(allowed.some((a) => a.includes(s) || s.includes(a))).toBe(true);
  });
});
