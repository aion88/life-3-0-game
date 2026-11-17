// @vitest-environment happy-dom
/**
 * Rue guidée, passage du checkpoint JOUÉ sans le passer [retour Cynthia 2026-11-08 (a) : « il reste bloqué contre la barrière, la caméra bouge
 * dans le mur et il finit par contourner la barrière »]. Les autres tests de montage passent chaque séquence (Échap) : le saut pose la joueuse
 * sur la cible, de l'autre côté du bras, et la marche suivante part de là. Ici la séquence se joue image par image, comme dans le navigateur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountGuidedStreet } from '../../../src/street/guidedRuntime';
import { placeSpot } from '../../../src/street/guided/actors';
import { barrierArmSolid } from '../../../src/engine/view/walk';
import type { StreetRuntime } from '../../../src/street/runtime';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';
import { SCENE } from '../../support/street_walk';
import sequencesRaw from '../../../src/street/data/w10.sequences.json';

const q = (s: string): HTMLElement => { const e = document.body.querySelector<HTMLElement>(s); if (e === null) throw new Error(`absent : ${s}`); return e; };
const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise((r) => { setTimeout(r, 0); }); };

vi.mock('../../../src/street/ui/juice', async (orig) => orig());

let host: HTMLElement;
const animate = Element.prototype.animate;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); (Element.prototype as { animate?: unknown }).animate = undefined; });
afterEach(() => { host.remove(); document.body.replaceChildren(); Element.prototype.animate = animate; });

interface Guided { readonly rt: StreetRuntime; readonly deps: ReturnType<typeof testDeps> }
async function mountGuided(): Promise<Guided> {
  const app = fakeApp([], { guided: true });
  const deps = testDeps({ sink: app.save });
  const rt = await mountGuidedStreet(app.ctx, app.run, host, deps);
  await flush();
  deps.frames.step(16);
  return { rt, deps };
}
const street = (): HTMLElement => q('[data-ui="street"]');
const beat = (): string => street().dataset['beat'] ?? '';
const sequencing = (): boolean => q('[data-ui="root"]').dataset['sequencing'] === 'true';

/** Jusqu'au choix du checkpoint du J1 : première option, Continuer, Passer (les marches d'avant ne sont pas l'objet du test). */
async function playUntilCheckpoint(g: Guided): Promise<void> {
  for (let i = 0; i < 600 && !(beat() === 'choice' && street().dataset['scene'] === 'j1.checkpoint'); i++) {
    if (beat() === 'choice') { q('[data-ui="destinations"] [data-option]').click(); document.body.querySelector<HTMLElement>('[data-ui="confirm"]')?.click(); }
    else if (document.body.querySelector('[data-ui="continue"]') !== null) q('[data-ui="continue"]').click();
    else if (document.body.querySelector('[data-ui="skip"]') !== null) q('[data-ui="skip"]').click();
    if (sequencing()) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    g.deps.frames.step(16);
    await flush();
  }
  expect(`${beat()} ${street().dataset['scene']}`).toBe('choice j1.checkpoint');
}
/** Désigne puis confirme une voie du checkpoint ; la séquence jouée commence. */
async function take(option: string): Promise<void> {
  q(`[data-ui="destinations"] [data-option="${option}"]`).click();
  await flush();
  q('[data-ui="confirm"]').click();
  await flush();
}

const anchors = sequencesRaw.anchors as unknown as Record<string, { v: { x: number; z: number } }>;
const through = anchors['anchor.cp.through']!.v;
const armBox = barrierArmSolid(SCENE);
if (armBox.kind !== 'box') throw new Error('bras de barrière : une boîte attendue');
const arm = armBox;
const STEP = SCENE.walk.maxDtMs.v;

describe('rue guidée : la barrière du checkpoint, séquence jouée', () => {
  for (const option of ['comply', 'courtesy']) {
    it(`test_guided_checkpoint_${option}_played_crosses_under_the_lifted_arm`, async () => {
      const g = await mountGuided();
      await playUntilCheckpoint(g);
      await take(option);
      expect(sequencing()).toBe(true);
      for (let i = 0; i < 1000 && sequencing(); i++) { g.deps.frames.step(STEP); await flush(); }   // aucune touche : la séquence se joue jusqu'au bout
      expect(sequencing()).toBe(false);
      // la joueuse a passé le bras levé, au point `anchor.cp.through`, au sud du bras ; jamais restée devant lui
      const p = g.rt.player();
      expect(p.z).toBeLessThan(arm.min.z);
      expect(Math.hypot(p.x - through.x, p.z - through.z)).toBeLessThan(0.1);
      g.rt.dispose();
    });
  }

  it('test_guided_walk_after_checkpoint_reaches_registre_without_sliding_along_solids', async () => {
    const g = await mountGuided();
    await playUntilCheckpoint(g);
    await take('comply');
    for (let i = 0; i < 1000 && sequencing(); i++) { g.deps.frames.step(STEP); await flush(); }
    for (let i = 0; i < 200 && beat() !== 'walk'; i++) {   // lignes et attente d'après la séquence, avant la marche : Continuer ou Passer
      if (document.body.querySelector('[data-ui="continue"]') !== null) q('[data-ui="continue"]').click();
      else if (document.body.querySelector('[data-ui="skip"]') !== null) q('[data-ui="skip"]').click();
      g.deps.frames.step(16); await flush();
    }
    expect(beat()).toBe('walk');
    const from = g.rt.player(), to = placeSpot(SCENE, 'place.registre');
    const straightS = Math.hypot(to.x - from.x, to.z - from.z) / SCENE.walk.speedMps.v;
    let frames = 0;
    for (; frames < 4000 && beat() === 'walk'; frames++) { g.deps.frames.step(STEP); await flush(); }
    expect(beat()).not.toBe('walk');
    // une marche qui glisse le long du bras puis du mur de télés dure plusieurs secondes de plus que la ligne droite ; 10 % de marge
    expect((frames * STEP) / 1000).toBeLessThanOrEqual(straightS * 1.1 + 0.2);
    g.rt.dispose();
  }, 60_000);
});
