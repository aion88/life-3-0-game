// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { langScreen } from '../../../src/screens/lang';
import { createContactLink } from '../../../src/screens/feedback';
import type { SaveData } from '../../../src/save/save';
import { fakeCtx, mountScreen } from '../../support/screens';
import { realI18n } from '../../support/street_ui';

const button = (root: HTMLElement, lang: string): HTMLButtonElement => {
  const b = root.querySelector<HTMLButtonElement>(`button[data-lang="${lang}"]`);
  if (!b) throw new Error(`bouton ${lang} absent`);
  return b;
};

beforeEach(() => history.replaceState(null, '', '?episode=semaine'));

describe('écran lang', () => {
  it('test_lang_screen_shows_two_choices_in_their_own_language', async () => {
    const ctx = fakeCtx();
    const { root } = await mountScreen(langScreen, ctx, undefined);
    const fr = button(root, 'fr');
    const en = button(root, 'en');
    expect(root.querySelectorAll('button')).toHaveLength(2);
    expect(fr.textContent).toBe(realI18n('fr').t('lang.fr'));
    expect(en.textContent).toBe(realI18n('en').t('lang.en'));
    expect(fr.lang).toBe('fr');
    expect(en.lang).toBe('en');
  });

  it('test_home_contact_uses_the_same_mail_subject_as_the_game_ends', async () => {
    history.replaceState(null, '', '/');
    const ctx = fakeCtx();
    const { root } = await mountScreen(langScreen, ctx, undefined);
    const home = root.querySelector<HTMLAnchorElement>('a[data-ui=contact]');
    expect(home, 'lien Contact de l\u2019accueil').not.toBeNull();
    const end = createContactLink(ctx.i18n, 'x');
    expect(home!.getAttribute('href')).toBe(end.getAttribute('href'));
    expect(home!.textContent).toBe(end.textContent);
  });

  it('test_lang_choice_sets_save_lang_and_i18n', async () => {
    const ctx = fakeCtx();
    const { root } = await mountScreen(langScreen, ctx, undefined);
    button(root, 'en').click();
    expect(ctx.i18n.lang()).toBe('en');
    expect(ctx.save.load().data.lang).toBe('en');
    button(root, 'fr').click();
    expect(ctx.i18n.lang()).toBe('fr');
    expect(ctx.save.load().data.lang).toBe('fr');
  });

  it('test_lang_choice_navigates_to_warning', async () => {
    const ctx = fakeCtx();
    const { root } = await mountScreen(langScreen, ctx, undefined);
    button(root, 'en').click();
    expect(ctx.navigate).toHaveBeenCalledTimes(1);
    expect(ctx.navigate).toHaveBeenCalledWith('warning', undefined);
  });

  // Reprise [demande Cynthia 2026-11-03] : une partie en cours ouvre « Continuer » et « Nouvelle partie » au lieu des langues.
  const inProgress = (phase: 'questionnaire' | 'street' = 'street') => {
    const ctx = fakeCtx();
    const answers = Object.fromEntries(ctx.core.questionnaire.questions.map((q) => [q.key, 'A']));
    ctx.save.update({ lang: 'fr', phase, answers: (phase === 'street' ? answers : {}) as SaveData['answers'] });
    return ctx;
  };
  const ui = (root: HTMLElement, name: string): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>(`[data-ui="resume-${name}"]`);

  it('test_lang_screen_with_saved_game_shows_continue_and_new_game_only', async () => {
    const ctx = inProgress();
    const { root } = await mountScreen(langScreen, ctx, undefined);
    expect(ui(root, 'continue')?.textContent).toBe(realI18n('fr').t('resume.continue'));
    expect(ui(root, 'new')?.textContent).toBe(realI18n('fr').t('resume.new'));
    expect(root.querySelector('[data-lang]')).toBeNull();
  });

  it('test_lang_screen_new_save_with_lang_only_shows_languages', async () => {
    const ctx = fakeCtx();
    ctx.save.update({ lang: 'en' });
    const { root } = await mountScreen(langScreen, ctx, undefined);
    expect(ui(root, 'continue')).toBeNull();
    expect(root.querySelectorAll('button[data-lang]')).toHaveLength(2);
  });

  it('test_continue_resumes_where_the_save_says', async () => {
    const ctx = inProgress('street');
    const { root } = await mountScreen(langScreen, ctx, undefined);
    ui(root, 'continue')!.click();
    expect(ctx.navigate).toHaveBeenCalledWith('fastforward', { answers: ctx.save.load().data.answers });
    const q = inProgress('questionnaire');
    const m = await mountScreen(langScreen, q, undefined);
    ui(m.root, 'continue')!.click();
    expect(q.navigate).toHaveBeenCalledWith('questionnaire', undefined);
  });

  it('test_new_game_asks_one_confirmation_then_erases_and_shows_languages', async () => {
    const ctx = inProgress();
    const { root } = await mountScreen(langScreen, ctx, undefined);
    ui(root, 'new')!.click();
    expect(ctx.save.load().data.phase).toBe('street');            // un clic ne suffit pas : rien n'est effacé
    expect(ui(root, 'confirm')?.textContent).toBe(realI18n('fr').t('resume.confirm'));
    expect(ui(root, 'cancel')?.textContent).toBe(realI18n('fr').t('resume.cancel'));
    ui(root, 'confirm')!.click();
    const d = ctx.save.load().data;
    expect([d.phase, d.lang, d.acts.length, Object.keys(d.answers).length]).toEqual(['new', null, 0, 0]);
    expect(root.querySelectorAll('button[data-lang]')).toHaveLength(2);
    expect(ui(root, 'continue')).toBeNull();
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('test_new_game_cancel_keeps_the_save', async () => {
    const ctx = inProgress();
    const { root } = await mountScreen(langScreen, ctx, undefined);
    ui(root, 'new')!.click();
    ui(root, 'cancel')!.click();
    expect(ctx.save.load().data.phase).toBe('street');
    expect(ui(root, 'continue')).not.toBeNull();
    expect(ui(root, 'confirm')).toBeNull();
  });

  it('unmount retire le cadre', async () => {
    const ctx = fakeCtx();
    const { screen, root } = await mountScreen(langScreen, ctx, undefined);
    screen.unmount();
    expect(root.querySelector('button')).toBeNull();
  });
});


describe('short story, two languages', () => {
  it('offers a French and an English start at the default URL', async () => {
    history.replaceState(null, '', '/');
    const ctx = fakeCtx({ i18n: realI18n('en') });
    const { root } = await mountScreen(langScreen, ctx, undefined);
    expect(root.querySelectorAll('[data-lang]')).toHaveLength(2);
    expect(root.textContent).toContain('Twelve possible futures');
    button(root, 'fr').click();
    expect(ctx.i18n.lang()).toBe('fr');
    expect(ctx.save.load().data.lang).toBe('fr');
    expect(ctx.navigate).toHaveBeenCalledWith('warning', undefined);
  });
  it('starts in English when the English button is chosen', async () => {
    history.replaceState(null, '', '/');
    const ctx = fakeCtx({ i18n: realI18n('fr') });
    const { root } = await mountScreen(langScreen, ctx, undefined);
    button(root, 'en').click();
    expect(ctx.i18n.lang()).toBe('en');
    expect(ctx.save.load().data.lang).toBe('en');
    expect(ctx.navigate).toHaveBeenCalledWith('warning', undefined);
  });
  it('keeps an English save in English on resume, answers and progress untouched', async () => {
    history.replaceState(null, '', '/');
    const ctx = fakeCtx({ i18n: realI18n('fr') });
    ctx.save.update({lang:'en', phase:'questionnaire', answers:{[ctx.core.questionnaire.questions[0]!.key]:'A'}});
    const before = ctx.save.load().data;
    await mountScreen(langScreen, ctx, undefined);
    expect(ctx.i18n.lang()).toBe('en');
    expect(ctx.save.load().data.answers).toEqual(before.answers);
    expect(ctx.save.load().data.phase).toBe(before.phase);
  });
});
