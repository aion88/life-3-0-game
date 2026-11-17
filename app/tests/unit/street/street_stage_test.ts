// @vitest-environment happy-dom
/**
 * Le montage 3D commun [rue guidée T13] : monde, corps, moteur de rendu, quartier, chaînes de post-traitement, une image.
 * Aucun GPU ni réseau : la couture `RuntimeDeps` et un faux moteur de rendu.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMannequinProvider } from '../../../src/street/render/characters/mannequin';
import { GraphicsUnavailable } from '../../../src/street/render/backend';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { mountStage, BodiesMissingError, type Stage } from '../../../src/street/stage';
import { mountUi } from '../../../src/street/ui';
import type { RuntimeDeps } from '../../../src/street/runtime';
import type { CameraPose } from '../../../src/engine/view/camera';
import { fakeApp, fakeBackend, fakeFetch, fakePost, manualFrames, type FakePost } from '../../support/street_screen';

let host: HTMLElement;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); });
afterEach(() => { host.remove(); document.body.replaceChildren(); });

const WALK: CameraPose = { pos: [0, 1.6, 10], target: [0, 1.5, 0], fovDeg: 30, letterbox: false };

function setup(over: Partial<RuntimeDeps> = {}) {
  const app = fakeApp();
  const posts: FakePost[] = [];
  const backend = fakeBackend();
  const deps: RuntimeDeps = {
    fetch: fakeFetch(), backend: backend.make, post: () => { const p = fakePost(); posts.push(p); return p; },
    characters: () => createMannequinProvider(), sink: app.save, frames: manualFrames(), ...over,
  };
  const ui = mountUi(host, app.ctx.i18n);
  return { app, deps, posts, backend, ui };
}

describe('montage commun', () => {
  it('test_stage_renders_one_frame_with_fake_backend', async () => {
    const { app, deps, posts, backend, ui } = setup();
    const st = await mountStage(app.ctx, app.run, host, deps, ui, { interiors: 'core' }) as Stage;
    expect(st).not.toBe('noGpu');
    expect(st).not.toBeInstanceOf(BodiesMissingError);
    expect(posts).toHaveLength(2);                                  // une chaîne de marche, une d'observation
    expect(host.querySelector('[data-ui=loading]')).not.toBeNull();
    st.render(16, WALK, 8);
    expect(posts[0]!.renders()).toBe(1);
    expect(posts[1]!.renders()).toBe(0);
    expect(posts[0]!.setFocus).toHaveBeenCalledWith(8, expect.any(Number));
    expect(st.camera.position.z).toBe(10);                          // la pose donnée est posée sur la caméra
    expect(host.querySelector('[data-ui=loading]')).toBeNull();     // retiré à la première image
    st.dispose();
    expect(posts.every((p) => p.disposed() === 1)).toBe(true);
    expect(backend.disposed()).toBe(1);
  });

  it('test_stage_dispose_removes_canvas_host_and_loading', async () => {
    const { app, deps, ui } = setup();
    const st = await mountStage(app.ctx, app.run, host, deps, ui, { interiors: 'core' }) as Stage;
    expect(host.contains(st.canvasHost)).toBe(true);
    expect(host.querySelector('[data-ui="loading"]')).not.toBeNull();   // aucune image rendue : l'indicateur est encore là
    st.dispose();
    expect(host.contains(st.canvasHost)).toBe(false);
    expect(host.querySelector('[data-ui="loading"]')).toBeNull();
    expect(host.querySelector('canvas')).toBeNull();
    ui.dispose();
  });

  it('test_stage_letterbox_pose_picks_the_observation_chain', async () => {
    const { app, deps, posts, ui } = setup();
    const st = await mountStage(app.ctx, app.run, host, deps, ui, { interiors: 'core' }) as Stage;
    st.render(16, { ...WALK, letterbox: true }, 6);
    expect(posts[0]!.renders()).toBe(0);
    expect(posts[1]!.renders()).toBe(1);
    st.dispose();
  });

  it('test_stage_without_gpu_returns_no_gpu', async () => {
    const { app, deps, ui } = setup({ backend: () => Promise.reject(new GraphicsUnavailable([])) });
    expect(await mountStage(app.ctx, app.run, host, deps, ui, { interiors: 'core' })).toBe('noGpu');
  });

  it('test_stage_missing_bodies_are_returned_not_thrown', async () => {
    const { app, deps, ui } = setup();
    const empty = (() => Promise.resolve(new Response(JSON.stringify({ budgetBytes: 1000, assets: [] }), { status: 200 }))) as typeof fetch;
    const r = await mountStage(app.ctx, app.run, host, { ...deps, fetch: empty }, ui, { interiors: 'core' });
    expect(r).toBeInstanceOf(BodiesMissingError);
    expect((r as BodiesMissingError).missing).toContain('player');
    expect(host.querySelector('[data-ui=loading]')).toBeNull();
  });
});
