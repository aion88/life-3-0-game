// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountControlStationEpisode, type ControlStationDriver, type ControlStationOutcome } from '../../../src/worlds/controlStationEpisode';
import { CONTROL_STATION_CONTENT } from '../../../src/worlds/controlStationContent';

vi.mock('../../../src/worlds/controlStationView', () => ({ createControlStationView: vi.fn() }));
const deferred = () => {
  let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
let root: HTMLElement;
let dispose: (() => void) | undefined;
const click = (id: string): void => root.querySelector<HTMLButtonElement>(`[data-action=${id}]`)!.click();
const phase = (): string | undefined => root.querySelector<HTMLElement>('main')?.dataset['phase'];
const makeDriver = () => ({
  approach: vi.fn(async () => {}), requestGuarantee: vi.fn(async () => {}), authorize: vi.fn(async () => {}), goHome: vi.fn(async () => {}), pause: vi.fn(), skip: vi.fn(), dispose: vi.fn(),
});
beforeEach(() => { root = document.createElement('div'); document.body.append(root); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
afterEach(() => { dispose?.(); dispose = undefined; root.remove(); vi.restoreAllMocks(); });

describe('embodied control-station orchestration', () => {
  it('keeps one viewport and waits for actual motion completion before offering a decision', async () => {
    const motion = deferred(), driver = makeDriver(); driver.approach.mockReturnValue(motion.promise);
    dispose = await mountControlStationEpisode(root, { createView: async () => driver });
    const viewport = root.querySelector('[data-testid=control-viewport]');
    const approach = root.querySelector<HTMLButtonElement>('[data-action=approach]')!;
    approach.click(); approach.click();
    expect(driver.approach).toHaveBeenCalledTimes(1); expect(phase()).toBe('approaching');
    expect(root.querySelector('[data-action=guarantor]')).toBeNull();
    motion.resolve(); await settle();
    expect(phase()).toBe('decision'); expect(root.querySelector('[data-testid=control-viewport]')).toBe(viewport);
    expect(root.querySelectorAll('[data-testid=control-actions] > button')).toHaveLength(2);
  });
  it('keeps actions with their object and automatically reads the pass after the travel intention', async () => {
    const motion = deferred(), driver = makeDriver(); driver.approach.mockReturnValue(motion.promise);
    dispose = await mountControlStationEpisode(root, { createView: async () => driver });
    const interaction = root.querySelector<HTMLElement>('.cs-interaction')!;
    const viewport = root.querySelector('[data-testid=control-viewport]');
    expect(interaction.dataset['kind']).toBe('phone');
    expect(interaction.querySelector('.cs-instrument')).not.toBeNull();
    expect(interaction.querySelector('.cs-dock [data-action=approach]')).not.toBeNull();
    click('approach');
    expect(interaction.dataset['kind']).toBe('reader');
    expect(interaction.querySelector('.cs-artifact')?.getAttribute('data-status')).toBe('pending');
    expect(root.querySelectorAll('[data-testid=control-actions] > button')).toHaveLength(1);
    expect(root.querySelector('[data-action=skip]')).not.toBeNull();
    motion.resolve(); await settle();
    expect(phase()).toBe('decision');
    expect(interaction.dataset['kind']).toBe('reader');
    expect(interaction.querySelector('.cs-artifact')?.getAttribute('data-status')).toBe('refused');
    expect(interaction.querySelector('.cs-dock [data-action=guarantor]')).not.toBeNull();
    click('guarantor'); await settle();
    expect(interaction.dataset['kind']).toBe('phone');
    expect(interaction.querySelector('.cs-artifacts')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('[data-testid=control-viewport]')).toBe(viewport);
    expect(driver.authorize).not.toHaveBeenCalled();
  });
  it('replays from the travel intention with a fresh renderer and without retaining the previous outcome', async () => {
    const driver = makeDriver(), nextDriver = makeDriver(), completed = vi.fn();
    const createView = vi.fn().mockResolvedValueOnce(driver).mockResolvedValueOnce(nextDriver);
    dispose = await mountControlStationEpisode(root, { createView, onComplete: completed });
    click('approach'); await settle(); click('return'); await settle();
    click('replay'); await settle();
    expect(driver.dispose).toHaveBeenCalledOnce(); expect(phase()).toBe('arrival');
    expect(nextDriver.approach).not.toHaveBeenCalled();
    click('approach'); await settle(); click('guarantor'); await settle();
    expect(nextDriver.authorize).not.toHaveBeenCalled();
    click('continue'); await settle();
    expect(completed).toHaveBeenCalledTimes(2);
    expect(completed).toHaveBeenLastCalledWith({ route: 'passed', guarantorAdded: true, restrictionRemains: true });
  });
  it('requires informed mother response to remain visible before the crossing intention and reports the exact result once', async () => {
    const driver = makeDriver(), completed = vi.fn<(outcome: ControlStationOutcome) => void>();
    const sent = deferred(); driver.requestGuarantee.mockReturnValue(sent.promise);
    dispose = await mountControlStationEpisode(root, { createView: async () => driver, onComplete: completed });
    click('approach'); await settle();
    const choice = root.querySelector<HTMLButtonElement>('[data-action=guarantor]')!; choice.click(); choice.click();
    expect(phase()).toBe('requesting'); expect(driver.requestGuarantee).toHaveBeenCalledTimes(1);
    sent.resolve(); await settle(); expect(phase()).toBe('accepted');
    expect(root.textContent).toContain('D’accord, je me porte garante. On t’attend.');
    expect(root.textContent).toContain('Maman · garante enregistrée pour ce trajet.'); expect(driver.authorize).not.toHaveBeenCalled();
    click('continue'); await settle(); expect(phase()).toBe('passed');
    expect(completed).toHaveBeenCalledExactlyOnceWith({ route: 'passed', guarantorAdded: true, restrictionRemains: true });
  });
  it('retreats without sending a guarantee and keeps the family reply in the same scene', async () => {
    const driver = makeDriver(), completed = vi.fn();
    dispose = await mountControlStationEpisode(root, { createView: async () => driver, onComplete: completed });
    click('approach'); await settle(); click('return'); await settle();
    expect(phase()).toBe('returned'); expect(driver.requestGuarantee).not.toHaveBeenCalled(); expect(driver.authorize).not.toHaveBeenCalled();
    expect(root.textContent).toContain('On te garde une part.');
    expect(completed).toHaveBeenCalledExactlyOnceWith({ route: 'returned', guarantorAdded: false, restrictionRemains: true });
  });
  it('passes only the current movement and preserves pause across visibility changes', async () => {
    const motion = deferred(), driver = makeDriver(); driver.approach.mockReturnValue(motion.promise); driver.skip.mockImplementation(() => motion.resolve());
    dispose = await mountControlStationEpisode(root, { createView: async () => driver });
    click('approach'); click('pause'); expect(driver.pause).toHaveBeenLastCalledWith(true);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
    expect(driver.pause).toHaveBeenLastCalledWith(true);
    click('skip'); await settle(); expect(phase()).toBe('decision'); expect(driver.requestGuarantee).not.toHaveBeenCalled();
    click('pause'); expect(driver.pause).toHaveBeenLastCalledWith(false);
  });
  it('ignores completion after disposal and does not write game storage', async () => {
    const motion = deferred(), driver = makeDriver(), completed = vi.fn(); driver.authorize.mockReturnValue(motion.promise);
    const saved = JSON.stringify(window.localStorage);
    dispose = await mountControlStationEpisode(root, { createView: async () => driver, onComplete: completed });
    click('approach'); await settle(); click('guarantor'); await settle(); click('continue'); dispose(); motion.resolve(); await settle();
    expect(root.children).toHaveLength(0); expect(completed).not.toHaveBeenCalled(); expect(driver.dispose).toHaveBeenCalledTimes(1); expect(JSON.stringify(window.localStorage)).toBe(saved);
  });
  it('disposes a renderer which finishes loading after page departure', async () => {
    let resolve!: (view: ControlStationDriver) => void; const pending = new Promise<ControlStationDriver>(yes => { resolve = yes; });
    const driver = makeDriver(); const mounting = mountControlStationEpisode(root, { createView: () => pending });
    window.dispatchEvent(new Event('pagehide')); resolve(driver); dispose = await mounting;
    expect(root.children).toHaveLength(0); expect(driver.dispose).toHaveBeenCalledOnce();
  });
  it('does not invent an outcome when the renderer action fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const driver = makeDriver(), completed = vi.fn(); driver.approach.mockRejectedValue(new Error('renderer action'));
    dispose = await mountControlStationEpisode(root, { createView: async () => driver, onComplete: completed });
    click('approach'); await settle(); expect(phase()).toBe('error'); expect(completed).not.toHaveBeenCalled(); expect(root.querySelector('[data-action=retry]')).not.toBeNull();
  });
});

describe('control-station words, dossier and reader record', () => {
  const { ledger, record } = CONTROL_STATION_CONTENT;
  const main = (): HTMLElement => root.querySelector<HTMLElement>('main')!;
  const START_WORDS = String(ledger.budget), START_DOSSIER = String(ledger.dossier);
  const AFTER_CONTEST = String(ledger.budget - record.rule.cost);
  const TRUE_LINE = 0;
  const reachDecision = async (driver: ReturnType<typeof makeDriver>, onComplete?: (outcome: ControlStationOutcome) => void): Promise<void> => {
    dispose = await mountControlStationEpisode(root, { createView: async () => driver, ...(onComplete ? { onComplete } : {}) });
    click('approach'); await settle();
  };
  it('test_control_hud_shows_words_and_dossier_from_arrival', async () => {
    dispose = await mountControlStationEpisode(root, { createView: async () => makeDriver() });
    const hud = root.querySelector<HTMLElement>('[data-testid=control-hud]')!;
    expect(hud.textContent).toContain(START_WORDS); expect(hud.textContent).toContain(START_DOSSIER);
    expect(main().dataset['words']).toBe(START_WORDS); expect(main().dataset['dossier']).toBe(START_DOSSIER);
    expect(root.querySelector('.cs-count')?.textContent).toContain(START_WORDS);
    expect(root.querySelector('dialog')).toBeNull();
  });
  it('test_control_record_founded_contest_spends_words_and_keeps_both_decisions', async () => {
    await reachDecision(makeDriver());
    expect(root.querySelectorAll('[data-action^=contest-]')).toHaveLength(record.lines.length);
    expect(root.querySelector('.cs-record-prompt')?.textContent).toContain(`${record.rule.cost} mots`);
    click(`contest-${record.rule.falseIndex}`);
    expect(main().dataset['words']).toBe(AFTER_CONTEST); expect(main().dataset['dossier']).toBe(START_DOSSIER);
    expect(main().dataset['contested']).toBe('founded');
    expect(root.querySelectorAll('[data-action^=contest-]')).toHaveLength(0);
    expect(root.querySelector('.cs-record-result')?.textContent).toBe(record.founded);
    expect(document.activeElement).toBe(root.querySelector('.cs-record-result'));
    expect(root.querySelector('[data-action=guarantor]')).not.toBeNull(); expect(root.querySelector('[data-action=return]')).not.toBeNull();
    expect(phase()).toBe('decision');
  });
  it('test_control_record_unfounded_contest_is_written_to_the_dossier', async () => {
    await reachDecision(makeDriver());
    click(`contest-${TRUE_LINE}`);
    expect(main().dataset['words']).toBe(AFTER_CONTEST);
    expect(main().dataset['dossier']).toBe(String(ledger.dossier + record.rule.penalty));
    expect(main().dataset['contested']).toBe('unfounded');
  });
  it('test_control_record_is_optional_and_return_keeps_all_words', async () => {
    await reachDecision(makeDriver());
    click('return'); await settle();
    expect(phase()).toBe('returned'); expect(main().dataset['words']).toBe(START_WORDS);
    expect(main().dataset['dossier']).toBe(String(ledger.dossier + ledger.abandoned.delta));
    expect(root.querySelector('.cs-traces')?.textContent).toContain(ledger.abandoned.label);
  });
  it('test_control_decision_prices_show_words_but_never_a_dossier_delta', async () => {
    await reachDecision(makeDriver());
    for (const action of ['guarantor', 'return']) {
      const cost = root.querySelector(`[data-action=${action}] .cs-action-cost`)!.textContent!;
      expect(cost).toContain(ledger.freeCost); expect(cost).not.toMatch(/[+−-]\s?\d/);
    }
  });
  it('test_control_stale_record_line_cannot_spend_words_after_the_decision', async () => {
    const motion = deferred(), driver = makeDriver(); driver.requestGuarantee.mockReturnValue(motion.promise);
    await reachDecision(driver);
    const stale = root.querySelector<HTMLButtonElement>(`[data-action=contest-${TRUE_LINE}]`)!;
    click('guarantor'); stale.click();
    expect(main().dataset['words']).toBe(START_WORDS); expect(main().dataset['contested']).toBe('none');
    motion.resolve(); await settle();
  });
  it('test_control_outcome_is_identical_with_or_without_contest_and_summary_counts_words', async () => {
    const complete = vi.fn<(outcome: ControlStationOutcome) => void>();
    await reachDecision(makeDriver(), complete);
    click(`contest-${record.rule.falseIndex}`); click('guarantor'); await settle(); click('continue'); await settle();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith({ route: 'passed', guarantorAdded: true, restrictionRemains: true });
    expect(root.querySelector('.cs-traces')?.textContent).toContain(`${AFTER_CONTEST} ${ledger.left} ${START_WORDS}`);
  });
  it('test_control_replay_resets_words_dossier_and_contest', async () => {
    await reachDecision(makeDriver());
    click(`contest-${TRUE_LINE}`); click('guarantor'); await settle(); click('continue'); await settle();
    expect(phase()).toBe('passed');
    expect(main().dataset['dossier']).toBe(String(ledger.dossier + record.rule.penalty + ledger.guarantor.delta));
    click('replay'); await settle();
    expect(phase()).toBe('arrival'); expect(main().dataset['words']).toBe(START_WORDS);
    expect(main().dataset['dossier']).toBe(START_DOSSIER); expect(main().dataset['contested']).toBe('none');
  });
});
