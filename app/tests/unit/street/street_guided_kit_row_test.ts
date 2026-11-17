// @vitest-environment happy-dom
/**
 * Rangée du kit pendant l'accueil de la rue guidée [retour Cynthia 2026-11-08 (c) : « Quand j'arrive, je ne vois plus les artefacts, téléphone,
 * etc. », suggestion : les mettre « sur le côté ou au-dessus du texte qui raconte »]. Le bureau 3D ne porte aucun objet du kit (`furniture.ts` :
 * un bloc et une radio) ; l'accueil de la rue libre montrait la rangée d'objets (`welcome.ts`), la rue guidée ne l'a jamais montée.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountGuidedStreet } from '../../../src/street/guidedRuntime';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';
import onboardingRaw from '../../../src/street/data/w10.onboarding.json';

const q = (s: string): HTMLElement => { const e = document.body.querySelector<HTMLElement>(s); if (e === null) throw new Error(`absent : ${s}`); return e; };
const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise((r) => { setTimeout(r, 0); }); };
const KIT = onboardingRaw.welcome.kit;

let host: HTMLElement;
const animate = Element.prototype.animate;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); (Element.prototype as { animate?: unknown }).animate = undefined; });
afterEach(() => { host.remove(); document.body.replaceChildren(); Element.prototype.animate = animate; });

const lit = (): string => q('[data-ui="root"]').dataset['welcomeLit'] ?? '';
const beat = (): string => q('[data-ui="street"]').dataset['beat'] ?? '';
const row = (): HTMLElement | null => document.body.querySelector<HTMLElement>('[data-ui="root"] [data-ui="welcome-kit"]');

describe('rue guidée : rangée du kit à l accueil', () => {
  it('test_guided_welcome_line_shows_the_kit_row_with_its_object_lit_then_leaves', async () => {
    const app = fakeApp([], { guided: true });
    const deps = testDeps({ sink: app.save });
    const rt = await mountGuidedStreet(app.ctx, app.run, host, deps);
    await flush(); deps.frames.step(16);
    expect(row()).toBeNull();                                         // la carte du jour : pas de rangée
    const seen: string[] = [];
    for (let i = 0; i < 40 && beat() !== 'choice'; i++) {
      q('[data-ui="continue"]').click(); deps.frames.step(16); await flush();
      if (beat() !== 'line' || lit() === '') continue;
      const r = row();
      expect(r, `ligne qui allume ${lit()}`).not.toBeNull();
      expect([...r!.querySelectorAll<HTMLElement>('[data-kit]')].map((c) => c.dataset['kit'])).toEqual(KIT);
      expect([...r!.querySelectorAll<HTMLElement>('[data-lit="true"]')].map((c) => c.dataset['kit'])).toEqual([lit()]);
      expect(r!.closest('[data-zone="centre"]')).not.toBeNull();    // au centre, au-dessus de la réplique ; Z-gauche reste à la narration
      seen.push(lit());
    }
    expect(seen).toEqual(expect.arrayContaining(['phone', 'bracelet', 'component']));
    expect(beat()).toBe('choice');
    expect(row()).toBeNull();                                         // la ligne quittée, la rangée part avec elle
    rt.dispose();
  });
});
