// @vitest-environment happy-dom
/**
 * Reprise d'une sauvegarde que le metteur en scène ne sait pas rejouer [revue finale M-1] : une partie de la marche libre (playtests d'avant
 * T14) dont un transit est refusé. La rue ne lève pas d'erreur de chargement à chaque reprise : elle offre la Nouvelle partie (un transit posé avant la faute peut déjà être enregistré).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';
import type { ActRecord } from '../../../src/shared/types/street';

const broken = vi.hoisted(() => ({ on: false }));
vi.mock('../../../src/street/guided/director', async (orig) => {
  const real = await orig<typeof import('../../../src/street/guided/director')>();
  return {
    ...real,
    createDirector: (...a: Parameters<typeof real.createDirector>) => {
      if (broken.on) throw new Error('director : transit enter registre refusé (registreClosed)');
      return real.createDirector(...a);
    },
  };
});
const { mountGuidedStreet } = await import('../../../src/street/guidedRuntime');

let host: HTMLElement;
const animate = Element.prototype.animate;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); (Element.prototype as { animate?: unknown }).animate = undefined; });
afterEach(() => { broken.on = false; host.remove(); document.body.replaceChildren(); Element.prototype.animate = animate; vi.restoreAllMocks(); });

const freeWalk: readonly ActRecord[] = [
  { day: 1, minute: 432, kind: 'exit', id: 'home', option: null },
  { day: 1, minute: 470, kind: 'enter', id: 'registre', option: null },
];

describe('rue guidée : reprise impossible', () => {
  it('test_unreplayable_free_walk_save_offers_new_game_instead_of_crashing', async () => {
    broken.on = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = fakeApp(freeWalk, { guided: true });
    const before = app.save.load().data.acts;
    const deps = testDeps({ sink: app.save });
    const rt = await mountGuidedStreet(app.ctx, app.run, host, deps);
    const card = document.body.querySelector<HTMLElement>('[data-ui="demo-end"]');
    expect(card).not.toBeNull();
    expect([...card!.querySelectorAll('button')].map((b) => b.textContent)).toEqual([app.ctx.i18n.t('resume.new')]);
    expect(err).toHaveBeenCalled();                          // la faute est nommée en console, pas avalée
    expect(host.querySelector('[data-ui="loading"]')).toBeNull();   // aucune image ne viendra : l'indicateur de chargement part [revue N-2]
    expect(app.save.load().data.acts).toEqual(before);       // la reprise elle-même n'écrit rien (ici : le metteur en scène lève avant tout transit)
    card!.querySelector<HTMLElement>('button')!.click();
    expect(app.save.load().data.acts).toEqual([]);
    expect(app.navigate).toHaveBeenCalledWith('lang', undefined);
    rt.dispose();
    expect(host.childElementCount).toBe(0);
    expect(deps.frames.pending()).toBe(0);
  });
});
