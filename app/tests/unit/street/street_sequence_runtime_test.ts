// @vitest-environment happy-dom
/**
 * Séquences jouées dans le runtime monté (sans GPU) : l'ordre de démontage en pleine séquence [rev-seq, 4]. Le démontage doit appliquer l'acte UNE fois,
 * tant que l'interface et le pilote vivent encore, puis tout libérer ; il ne doit jamais perdre l'acte en silence ni lever.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreetScreen } from '../../../src/street/screen';
import type { StreetRuntime } from '../../../src/street/runtime';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';
import { SCRIPT_J1_PREFIX } from '../../support/street';

let host: HTMLElement;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); });
afterEach(() => { host.remove(); document.body.replaceChildren(); vi.restoreAllMocks(); });

const key = (type: 'keydown' | 'keyup', code: string): void => { window.dispatchEvent(new KeyboardEvent(type, { code })); };
async function mountAtCheckpoint() {
  const app = fakeApp(SCRIPT_J1_PREFIX);
  const deps = testDeps({ sink: app.save });
  const screen = createStreetScreen(app.ctx, app.payload, deps);
  await screen.mount(host);
  const rt = (): StreetRuntime => screen.runtime() as StreetRuntime;
  deps.frames.step(16);
  key('keydown', 'KeyW');
  for (let i = 0; i < 3000 && rt().player().z > -4.8; i++) deps.frames.step(16);
  key('keyup', 'KeyW');
  deps.frames.step(16); deps.frames.step(16);
  const lanes = (): number => app.save.load().data.acts.filter((a) => a.kind === 'lane' && a.id === 'checkpoint').length;
  const press = (sel: string): void => { document.body.querySelector<HTMLElement>(sel)!.click(); };
  return { app, deps, screen, rt, lanes, press };
}

describe('séquence jouée : démontage', () => {
  it('test_unmount_mid_sequence_applies_the_act_once_while_the_ui_and_driver_are_alive_then_releases_everything', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const m = await mountAtCheckpoint();
    const before = m.lanes();
    m.press('[data-choice="checkpoint.j1"] [data-option="comply"]');
    m.press('[data-ui="confirm"]');
    for (let i = 0; i < 20; i++) m.deps.frames.step(16);                              // en pleine séquence : 0,3 s sur 6,5 s
    expect(document.body.querySelector('[data-sequencing="true"]'), 'la séquence joue').not.toBeNull();
    expect(m.lanes(), "pas d'acte avant la fin").toBe(before);
    m.screen.unmount();
    expect(m.lanes(), "le démontage applique l'acte, une fois").toBe(before + 1);
    expect(err, 'aucun échec journalisé').not.toHaveBeenCalled();
    expect(m.deps.frames.pending(), 'la boucle est arrêtée').toBe(0);
    expect(host.childElementCount, "l'écran est retiré").toBe(0);
  });

  it('test_unmount_without_a_sequence_writes_no_act', async () => {
    const m = await mountAtCheckpoint();
    const before = m.lanes();
    m.press('[data-choice="checkpoint.j1"] [data-option="comply"]');                  // désigné, pas confirmé
    m.screen.unmount();
    expect(m.lanes()).toBe(before);
  });

  it('test_a_failing_act_at_teardown_is_logged_not_swallowed_and_does_not_block_the_release', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const m = await mountAtCheckpoint();
    m.press('[data-choice="checkpoint.j1"] [data-option="comply"]');
    m.press('[data-ui="confirm"]');
    m.deps.frames.step(16);
    vi.spyOn(m.rt().driver, 'confirm').mockImplementation(() => { throw new Error('acte refusé'); });
    m.screen.unmount();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('séquence jouée'), expect.any(Error));
    expect(m.deps.frames.pending()).toBe(0);
    expect(host.childElementCount).toBe(0);
  });
});
