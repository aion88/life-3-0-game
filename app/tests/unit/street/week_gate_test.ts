// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreetScreen, usesWeek3d } from '../../../src/street/screen';
import { WEEK_3D_READY } from '../../../src/worlds/week/weekRelease';
import { fakeApp } from '../../support/street_screen';
import type { RunResult } from '../../../src/shared/types';

let root: HTMLElement;
beforeEach(() => { window.history.replaceState({}, '', '/'); root = document.body.appendChild(document.createElement('div')); });
afterEach(() => root.remove());

function w10Run() {
  const app = fakeApp();
  window.history.replaceState({}, '', '/');
  const run = { ...app.payload.run, outcome: { ...app.payload.run.outcome, kind: 'arrival', computedWorld: 'w10' } } as RunResult;
  return { app, run };
}

describe('porte de la semaine 1984 en 3D', () => {
  it('test_week_gate_release_flag_is_closed_in_this_pass', () => {
    expect(WEEK_3D_READY).toBe(false);
  });

  it('test_week_gate_closed_flag_selects_the_short_episode_for_w10_only', () => {
    expect(usesWeek3d('w10')).toBe(false);
    expect(usesWeek3d('w10', false)).toBe(false);
    expect(usesWeek3d('w10', true)).toBe(true);
    expect(usesWeek3d('w03', true)).toBe(false);
  });

  it('test_week_gate_closed_w10_mounts_the_situations_and_never_loads_the_week', async () => {
    const { app, run } = w10Run();
    const dispose = vi.fn();
    const mountSituations = vi.fn(async () => dispose);
    const loadWeek = vi.fn();
    const screen = createStreetScreen(app.ctx, { run }, { loadSituations: async () => ({ mountSituations }), loadWeek });
    await screen.mount(root);
    expect(mountSituations).toHaveBeenCalledOnce();
    expect(loadWeek).not.toHaveBeenCalled();
    screen.unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('test_week_gate_open_w10_mounts_the_week_and_disposes_it_on_unmount', async () => {
    const { app, run } = w10Run();
    const disposeWeek = vi.fn();
    const mountWeekEpisode = vi.fn(async () => disposeWeek);
    const mountEpisode = vi.fn(async () => ({ dispose: vi.fn() }));
    const screen = createStreetScreen(app.ctx, { run }, { weekReady: true, loadWeek: async () => ({ mountWeekEpisode }), loadEpisode: async () => ({ mountEpisode }) });
    await screen.mount(root);
    expect(mountWeekEpisode).toHaveBeenCalledOnce();
    expect(mountEpisode).not.toHaveBeenCalled();
    screen.unmount();
    expect(disposeWeek).toHaveBeenCalledOnce();
  });
});
