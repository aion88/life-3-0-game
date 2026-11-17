// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreetScreen } from '../../../src/street/screen';
import { SHORT_WORLDS } from '../../../src/worlds/routing';
import { fakeApp } from '../../support/street_screen';
import type { RunResult } from '../../../src/shared/types';

const publicApp = () => { const app = fakeApp(); window.history.replaceState({}, '', '/'); return app; };
let root: HTMLElement;
beforeEach(() => { window.history.replaceState({}, '', '/'); root = document.body.appendChild(document.createElement('div')); });
afterEach(() => root.remove());
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };

describe('public short-world routing', () => {
  it.each(SHORT_WORLDS)('opens %s in the situations, with its own world', async world => {
    const app = publicApp();
    const run = { ...app.payload.run, outcome: { ...app.payload.run.outcome, kind: 'arrival', computedWorld: world } } as RunResult;
    const dispose = vi.fn(); const mountSituations = vi.fn<(root: HTMLElement, search?: string, options?: { world?: string }) => Promise<() => void>>(async () => dispose); const mountEpisode = vi.fn(async () => ({ dispose })); const mountJourney = vi.fn(async () => ({ dispose }));
    const screen = createStreetScreen(app.ctx, { run }, { loadSituations: async () => ({ mountSituations }), loadEpisode: async () => ({ mountEpisode }), loadJourney: async () => ({ mountJourney }) });
    await screen.mount(root);
    expect(mountSituations).toHaveBeenCalledOnce(); expect(mountSituations.mock.calls[0]![2]).toMatchObject({ world });
    expect(mountEpisode).not.toHaveBeenCalled(); expect(mountJourney).not.toHaveBeenCalled();
    screen.unmount(); expect(dispose).toHaveBeenCalledOnce();
  });
  it.each(SHORT_WORLDS)('keeps the former journey of %s behind ?parcours=ancien', async world => {
    const app = publicApp(); window.history.replaceState({}, '', '/?parcours=ancien');
    const run = { ...app.payload.run, outcome: { ...app.payload.run.outcome, kind: 'arrival', computedWorld: world } } as RunResult;
    const dispose = vi.fn(); const mountEpisode = vi.fn(async () => ({ dispose })); const mountJourney = vi.fn(async () => ({ dispose }));
    const screen = createStreetScreen(app.ctx, { run }, { loadEpisode: async () => ({ mountEpisode }), loadJourney: async () => ({ mountJourney }) });
    await screen.mount(root);
    expect(mountEpisode).toHaveBeenCalledTimes(world === 'w10' ? 1 : 0);
    expect(mountJourney).toHaveBeenCalledTimes(world === 'w10' ? 0 : 1);
    screen.unmount(); expect(dispose).toHaveBeenCalledOnce();
  });
  it('does not mount an extinct trajectory as the 1984 fallback', async () => {
    const app = publicApp(); const loadEpisode = vi.fn();
    const run = { ...app.payload.run, outcome: { kind: 'extinction', world: 'w07' } } as RunResult;
    await expect(createStreetScreen(app.ctx, { run }, { loadEpisode }).mount(root)).rejects.toMatchObject({ kind: 'reference' });
    expect(loadEpisode).not.toHaveBeenCalled();
  });
  it('exposes a retriable short-runtime chunk failure without touching the saved game', async () => {
    const app = publicApp(); const saved = structuredClone(app.save.load());
    const screen = createStreetScreen(app.ctx, app.payload, { loadSituations: async () => { throw new TypeError('Chunk unavailable'); } });
    await expect(screen.mount(root)).rejects.toMatchObject({ kind: 'fetch' });
    expect(app.save.load()).toEqual(saved);
  });
  it('does not start a late-loaded runtime after the player has left the screen', async () => {
    const app = publicApp(); const mountSituations = vi.fn(async () => vi.fn());
    const chunk = deferred<{ mountSituations: typeof mountSituations }>();
    const screen = createStreetScreen(app.ctx, app.payload, { loadSituations: () => chunk.promise });
    const mounting = screen.mount(root); screen.unmount(); chunk.resolve({ mountSituations }); await mounting;
    expect(mountSituations).not.toHaveBeenCalled();
  });
  it('disposes a runtime which completes mounting after navigation', async () => {
    const app = publicApp(), dispose = vi.fn(); const result = deferred<typeof dispose>();
    const mountSituations = vi.fn(() => result.promise);
    const screen = createStreetScreen(app.ctx, app.payload, { loadSituations: async () => ({ mountSituations }) });
    const mounting = screen.mount(root);
    for (let tick = 0; tick < 5; tick++) await Promise.resolve();
    expect(mountSituations).toHaveBeenCalledOnce(); screen.unmount(); result.resolve(dispose); await mounting;
    expect(dispose).toHaveBeenCalledOnce();
  });
});
