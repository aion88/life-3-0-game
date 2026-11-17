// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createShell, initialScreen, type AppContext, type ScreenFactory, type ScreenId, type ScreenRegistry } from '../../../src/app/shell';
import { initialPayload } from '../../../src/app/initial';
import { createErrorFactory } from '../../../src/app/errorScreen';
import { provisionalRun, stubScreens } from '../../../src/app/stubs';
import { DataLoadError, loadCore, type WorldLoader } from '../../../src/data/load';
import { createI18n } from '../../../src/i18n/i18n';
import { createSaveStore, type SaveData } from '../../../src/save/save';
import { answersOf, type AnswerKey, type QuestionKey } from '../../../src/shared/types';
import fr from '../../../src/data/strings/fr.json';
import en from '../../../src/data/strings/en.json';
import meta from '../../../src/data/strings/meta.json';
import type { StringMeta } from '../../../src/i18n/i18n';

const core = loadCore();
const q = core.questionnaire;
const i18n = createI18n({ fr, en }, meta as StringMeta, 'fr', { mode: 'dev', report: () => undefined });
const okWorlds: WorldLoader = { load: () => Promise.reject(new Error('inutilisé')), available: () => [] };
const failingWorlds: WorldLoader = {
  load: () => Promise.reject(new DataLoadError('fetch', 'worlds/w10.json', '', 'chunk absent')),
  available: () => [],
};
const baseCtx = (worlds: WorldLoader): Omit<AppContext, 'navigate'> => ({
  i18n, save: createSaveStore(null, core.contentHash, () => true), core, worlds,
});

let root: HTMLElement;
beforeEach(() => { root = document.createElement('div'); document.body.replaceChildren(root); });

function registry(over: { [K in ScreenId]?: ScreenFactory<K> }): ScreenRegistry {
  return { ...stubScreens(), error: createErrorFactory(), ...over } as ScreenRegistry;
}
const spy = (name: string, log: string[]): ScreenFactory<never> => () => ({
  mount() { log.push(`mount:${name}`); },
  unmount() { log.push(`unmount:${name}`); },
});
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function click(el: HTMLElement, testid: string): Promise<void> {
  el.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!.click();
  await flush();
}

describe('shell', () => {
  it('test_navigate_unmounts_previous_and_passes_payload', async () => {
    const log: string[] = [];
    const shell = createShell(root, baseCtx(okWorlds), registry({
      lang: spy('lang', log) as ScreenFactory<'lang'>, questionnaire: spy('questionnaire', log) as ScreenFactory<'questionnaire'>,
    }));
    await shell.navigate('lang', undefined);
    await shell.navigate('questionnaire', undefined);
    expect(log).toEqual(['mount:lang', 'unmount:lang', 'mount:questionnaire']);
    expect(shell.current()).toBe('questionnaire');
  });

  it('test_load_error_routes_to_error_screen_with_retry', async () => {
    const needsWorld: ScreenFactory<'street'> = (ctx) => ({
      async mount() { await ctx.worlds.load('w10'); },
      unmount() { /* rien */ },
    });
    const shell = createShell(root, baseCtx(failingWorlds), registry({ street: needsWorld }));
    await shell.navigate('street', { run: provisionalRun('arrival') });
    expect(shell.current()).toBe('error');
    expect(root.textContent).toContain(i18n.t('app.error.load'));
    expect(root.textContent).toContain(i18n.t('app.error.retry'));
  });

  it('test_second_failure_of_same_target_offers_reload', async () => {
    const needsWorld: ScreenFactory<'street'> = (ctx) => ({
      async mount() { await ctx.worlds.load('w10'); },
      unmount() { /* rien */ },
    });
    const shell = createShell(root, baseCtx(failingWorlds), registry({ street: needsWorld }));
    await shell.navigate('street', { run: provisionalRun('arrival') });
    await click(root, 'error-action');
    expect(shell.current()).toBe('error');
    expect(root.querySelector('[data-testid="error-action"]')!.textContent).toBe(i18n.t('app.error.reload'));
  });

  it('test_non_load_errors_are_not_swallowed', async () => {
    const boom: ScreenFactory<'street'> = () => ({ mount() { throw new Error('bug'); }, unmount() { /* rien */ } });
    const shell = createShell(root, baseCtx(okWorlds), registry({ street: boom }));
    await expect(shell.navigate('street', { run: provisionalRun('arrival') })).rejects.toThrow('bug');
  });

  it('test_causes_replay_opens_bilan_as_extinction', async () => {
    const seen: unknown[] = [];
    const capture: ScreenFactory<'bilan'> = (_ctx, payload) => { seen.push(payload); return { mount() { /* rien */ }, unmount() { /* rien */ } }; };
    const shell = createShell(root, baseCtx(okWorlds), registry({ bilan: capture }));
    await shell.navigate('causes', { run: provisionalRun('extinction') });
    await click(root, 'stub-next');
    expect(seen[0]).toMatchObject({ input: { entry: 'extinction', week: null, survival: null, acts: [] } });
  });

  it('test_stub_screens_never_write_the_save', async () => {
    const writes: string[] = [];
    const storage = { getItem: () => null, setItem: (k: string) => { writes.push(k); }, removeItem: () => undefined };
    const ctx = { ...baseCtx(okWorlds), save: createSaveStore(storage, core.contentHash, () => true) };
    const shell = createShell(root, ctx, registry({}));
    for (const id of ['lang', 'warning', 'questionnaire'] as const) { await shell.navigate(id, undefined); }
    await shell.navigate('sources', { from: 'bilan' });
    expect(writes).toEqual([]);
  });

  it('test_mark_stale_shows_notice_and_reload_button', async () => {
    const shell = createShell(root, baseCtx(okWorlds), registry({}));
    await shell.navigate('lang', undefined);
    shell.markStale();
    expect(root.textContent).toContain(i18n.t('app.staleTab'));
    expect(root.querySelector('[data-testid="stale-reload"]')!.textContent).toBe(i18n.t('app.reload'));
  });
});

describe('stale tab', () => {
  it('test_navigate_after_stale_is_ignored', async () => {
    const shell = createShell(root, baseCtx(okWorlds), registry({}));
    await shell.navigate('lang', undefined);
    shell.markStale();
    await shell.navigate('warning', undefined);
    expect(root.querySelector('[data-testid="stale-reload"]')).not.toBeNull();
    expect(shell.current()).toBeNull();
  });
});

describe('superseded mount', () => {
  it('test_superseded_mount_removed_from_root', async () => {
    const log: string[] = [];
    const connected: boolean[] = [];
    let release: () => void = () => undefined;
    const slow: ScreenFactory<'street'> = () => ({
      mount(el) { return new Promise<void>((r) => { release = () => { el.append(document.createTextNode('SLOW')); r(); }; }); },
      unmount() { log.push('unmount:slow'); },
    });
    const quick: ScreenFactory<'lang'> = () => ({
      mount(el) { connected.push(el.isConnected); el.append(document.createTextNode('QUICK')); },
      unmount() { log.push('unmount:quick'); },
    });
    const shell = createShell(root, baseCtx(okWorlds), registry({ street: slow, lang: quick }));
    const first = shell.navigate('street', { run: provisionalRun('arrival') });
    await shell.navigate('lang', undefined);
    release();
    await first;
    expect(root.textContent).toBe('QUICK');
    expect(shell.current()).toBe('lang');
    expect(root.children.length).toBe(1);
    expect(connected).toEqual([true]);
    expect(log).toEqual(['unmount:slow']);
  });
});

describe('initialScreen', () => {
  const complete = answersOf(Object.fromEntries(q.questions.map((x) => [x.key as string, 'A' as AnswerKey])));
  const partial = answersOf({ [q.questions[0]!.key as string]: 'B' });
  const mk = (phase: SaveData['phase'], answers: SaveData['answers']): SaveData => ({
    v: 1, rev: 0, contentHash: core.contentHash, lang: null, softened: null, phase, answers, acts: [],
  });
  it.each([
    ['new', {}, 'lang'],
    ['questionnaire', partial, 'questionnaire'],
    ['fastforward', complete, 'fastforward'],
    ['fastforward', partial, 'questionnaire'],
    ['street', complete, 'fastforward'],
    ['bilan', complete, 'fastforward'],
  ] as const)('test_initial_screen_%s_%#', (phase, answers, expected) => {
    expect(initialScreen(mk(phase, answers as Readonly<Partial<Record<QuestionKey, AnswerKey>>>), q)).toBe(expected);
  });

  it('test_resume_fastforward_receives_answers', () => {
    expect(initialPayload(mk('street', complete)).answers).toEqual(complete);
  });
});
