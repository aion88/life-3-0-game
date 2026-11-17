// @vitest-environment happy-dom
/**
 * Montage de la rue guidée [rue guidée T14] : routage de l'écran, temps rendus (carte, ligne, choix, marche, droit, relevé, fin de démo),
 * caméra et coupe, aucune touche de marche. Aucun GPU ni réseau : tout passe par la couture `deps` (`tests/support/street_screen.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreetScreen, routeOf } from '../../../src/street/screen';
import { mountGuidedStreet, shotKindOf, cutawayFor } from '../../../src/street/guidedRuntime';
import { placeSpot } from '../../../src/street/guided/actors';
import type { StreetRuntime } from '../../../src/street/runtime';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';
import { SCENE } from '../../support/street_walk';
import type { Beat } from '../../../src/street/guided/director';
import type { SceneSpec } from '../../../src/data/schema/guided';
import type { ActRecord, DayIndex } from '../../../src/shared/types/street';
import { readFileSync } from 'node:fs';
import { availableOptions } from '../../../src/engine/moments/choices';
import { ctxW10 } from '../../support/street';

const q = (s: string): HTMLElement => { const e = document.body.querySelector<HTMLElement>(s); if (e === null) throw new Error(`absent : ${s}`); return e; };
const qa = (s: string): HTMLElement[] => [...document.body.querySelectorAll<HTMLElement>(s)];
const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise((r) => { setTimeout(r, 0); }); };
const keyDown = (code: string, key = code === 'Space' ? ' ' : code): void => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true })); };
const keyUp = (code: string): void => { window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); };

// le jus du bracelet se prépare par `juiceFor` (appelé par `reactToConfirm`) : on compte ses appels, comportement réel inchangé
const juice = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../../src/street/ui/juice', async (orig) => {
  const real = await orig<typeof import('../../../src/street/ui/juice')>();
  return { ...real, juiceFor: (...a: Parameters<typeof real.juiceFor>) => { juice.calls++; return real.juiceFor(...a); } };
});

let host: HTMLElement;
// sans `animate`, l'animateur de l'interface résout tout de suite : la bulle se ferme dans le tour, la ligne de droit passe ensuite [Z-3]
const animate = Element.prototype.animate;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); (Element.prototype as { animate?: unknown }).animate = undefined; });
afterEach(() => { host.remove(); document.body.replaceChildren(); Element.prototype.animate = animate; });

interface Guided { readonly rt: StreetRuntime; readonly app: ReturnType<typeof fakeApp>; readonly deps: ReturnType<typeof testDeps>; readonly cutaway: boolean[] }
async function mountGuided(answers: Record<string, string> = {}, acts: readonly ActRecord[] = [], demoAfter?: DayIndex): Promise<Guided> {
  const app = fakeApp(acts, demoAfter === undefined ? { guided: true } : { guided: true, demoAfter });
  if (Object.keys(answers).length > 0) app.save.update({ answers } as never);
  const deps = testDeps({ sink: app.save });
  const rt = await mountGuidedStreet(app.ctx, app.run, host, deps);
  await flush();                                          // le quartier meublé (palier différé) remplace celui de base : on espionne le dernier
  const cutaway: boolean[] = [];
  const d = rt.district(); const orig = d.setCutaway.bind(d);
  d.setCutaway = (on: boolean) => { cutaway.push(on); orig(on); };
  deps.frames.step(16);
  return { rt, app, deps, cutaway };
}
const street = (): HTMLElement => q('[data-ui="street"]');
const beat = (): string => street().dataset['beat'] ?? '';

/** Un pas de partie : choix -> première option (désigner, puis confirmer s'il y a un prix) ; sinon Continuer, sinon Passer ; puis une image. */
async function stepGame(g: Guided): Promise<void> {
  const b = beat();
  if (b === 'choice') {
    q('[data-ui="destinations"] [data-option]').click();
    const ok = document.body.querySelector<HTMLElement>('[data-ui="confirm"]');
    if (ok !== null) ok.click();
  } else if (document.body.querySelector('[data-ui="continue"]') !== null) q('[data-ui="continue"]').click();
  else if (document.body.querySelector('[data-ui="skip"]') !== null) q('[data-ui="skip"]').click();
  if (q('[data-ui="root"]').dataset['sequencing'] === 'true') keyDown('Escape');   // une séquence jouée se passe
  g.deps.frames.step(16);
  await flush();
}
async function playUntilBeat(g: Guided, kind: string, max = 400): Promise<void> {
  for (let i = 0; i < max && beat() !== kind; i++) await stepGame(g);
  expect(beat()).toBe(kind);
}

describe('rue guidée : montage', () => {
  it('test_no_walk_keys_are_listened', async () => {
    const g = await mountGuided();
    const at = placeSpot(SCENE, 'unit.9-D');
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) keyDown(k);
    for (let i = 0; i < 63; i++) g.deps.frames.step(16);
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) keyUp(k);
    expect(g.rt.player()).toEqual(at);
    g.rt.dispose();
  });

  it('test_space_advances_beat', async () => {
    const g = await mountGuided();
    const b0 = beat(); const minute0 = street().dataset['minute'];
    expect(b0).toBe('card');
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    g.deps.frames.step(16);
    expect(beat()).not.toBe(b0);
    expect(street().dataset['minute']).toBe(minute0);
    g.rt.dispose();
  });

  it('test_cutaway_on_indoors_off_in_street', async () => {
    const g = await mountGuided();
    expect(g.cutaway.at(-1)).toBe(true);                         // réveil au logement
    await playUntilBeat(g, 'line');
    for (let i = 0; i < 50 && street().dataset['scene'] !== 'j1.roux'; i++) await stepGame(g);
    expect(street().dataset['scene']).toBe('j1.roux');
    expect(Math.abs(g.rt.player().x)).toBeGreaterThan(SCENE.layout.halfWidthM.v);   // le palier, dans l'immeuble [revue T14 #2]
    expect(g.cutaway.at(-1)).toBe(true);                         // scène d'intérieur : la façade est ouverte
    for (let i = 0; i < 400 && Math.abs(g.rt.player().x) > SCENE.layout.halfWidthM.v; i++) await stepGame(g);
    g.deps.frames.step(16);
    expect(Math.abs(g.rt.player().x)).toBeLessThanOrEqual(SCENE.layout.halfWidthM.v);
    expect(g.cutaway.at(-1)).toBe(false);                        // dans la rue : fermée
    g.rt.dispose();
  });

  it('test_player_wakes_inside_9D_home', async () => {
    const g = await mountGuided();
    expect(Math.abs(g.rt.player().x)).toBeGreaterThan(SCENE.layout.halfWidthM.v);   // dans l'immeuble, pas sur le trottoir [revue T14 #2]
    expect(g.rt.player()).toEqual(placeSpot(SCENE, 'unit.9-D'));
    g.rt.dispose();
  });

  it('test_canvas_pointerdown_advances_past_a_line', async () => {
    const g = await mountGuided();
    await playUntilBeat(g, 'line');
    const said = q('[data-ui="root"]').textContent;
    const canvas = host.querySelector<HTMLElement>(':scope > [data-ui="street"] > div:first-child') ?? host.firstElementChild as HTMLElement;
    canvas.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    g.deps.frames.step(16); await flush();
    expect(beat() !== 'line' || q('[data-ui="root"]').textContent !== said).toBe(true);
    g.rt.dispose();
  });

  it('test_space_on_night_advances', async () => {
    const g = await mountGuided();
    await playUntilBeat(g, 'night', 2000);
    const day = street().dataset['day'];
    keyDown('Space'); g.deps.frames.step(16); await flush();
    expect(beat() !== 'night' || street().dataset['day'] !== day).toBe(true);
    g.rt.dispose();
  });

  it('test_unmount_mid_sequence_applies_the_act_and_leaves_nothing', async () => {
    const g = await mountGuided();
    const root = (): HTMLElement => q('[data-ui="root"]');
    for (let i = 0; i < 2000 && root().dataset['sequencing'] !== 'true'; i++) {
      if (beat() === 'choice') { q('[data-ui="destinations"] [data-option]').click(); document.body.querySelector<HTMLElement>('[data-ui="confirm"]')?.click(); }
      else if (document.body.querySelector('[data-ui="continue"]') !== null) q('[data-ui="continue"]').click();
      else if (document.body.querySelector('[data-ui="skip"]') !== null) q('[data-ui="skip"]').click();
      g.deps.frames.step(16); await flush();
    }
    expect(root().dataset['sequencing']).toBe('true');
    const before = g.app.save.load().data.acts.length;
    expect(() => { g.rt.dispose(); }).not.toThrow();
    expect(g.deps.frames.pending()).toBe(0);
    expect(host.childElementCount).toBe(0);
    expect(g.app.save.load().data.acts.length).toBeGreaterThan(before);   // l'acte de la séquence est appliqué, pas perdu
  });

  it('test_carnet_shows_a_right_only_after_its_beat', async () => {
    const g = await mountGuided();
    expect(document.body.querySelector('[data-ui="carnet"]')).toBeNull();   // rien avant le premier temps `right` [revue T14 #3]
    await playUntilBeat(g, 'right');
    expect(document.body.querySelector('[data-ui="carnet"] [data-right]')).toBeNull();   // jamais deux fois pendant le temps
    await stepGame(g);
    expect(qa('[data-ui="carnet"] [data-right]').length).toBe(1);
    g.rt.dispose();
  });

  it('test_walk_moves_the_body_at_walk_speed_and_arrives', async () => {
    const g = await mountGuided();
    await playUntilBeat(g, 'walk');
    g.deps.frames.step(16);
    const p0 = g.rt.player();
    g.deps.frames.step(50);                            // un pas de 50 ms (plafond `maxDtMs`) : 1,6 m/s x 0,05 s
    const p1 = g.rt.player();
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeCloseTo((SCENE.walk.speedMps.v * SCENE.walk.maxDtMs.v) / 1000, 6);
    for (let i = 0; i < 2000 && beat() === 'walk'; i++) g.deps.frames.step(50);
    expect(beat()).not.toBe('walk');
    g.rt.dispose();
  });

  it('test_skip_visible_at_walk_start', async () => {
    const g = await mountGuided();
    await playUntilBeat(g, 'walk');
    expect(q('[data-ui="skip"]').hidden).toBe(false);
    expect(document.body.querySelector('[data-ui="continue"]')).toBeNull();
    g.rt.dispose();
  });

  it('test_continue_hidden_while_destinations_open', async () => {
    const g = await mountGuided();
    await playUntilBeat(g, 'choice');
    expect(qa('[data-ui="destinations"] [data-option]').length).toBeGreaterThan(0);
    expect(document.body.querySelector('[data-ui="continue"]')).toBeNull();
    const scene = street().dataset['scene'];
    keyDown('Space'); g.deps.frames.step(16);
    expect(beat()).toBe('choice');
    expect(street().dataset['scene']).toBe(scene);
    g.rt.dispose();
  });

  it('test_right_beat_shows_three_parts', async () => {
    const g = await mountGuided();
    await playUntilBeat(g, 'right');
    expect(q('[data-ui="right-source"]').textContent).toMatch(/^Déclaration universelle des droits de l.homme/u);
    expect(q('[data-ui="right-quote"]').textContent).toMatch(/^« .+ »$/u);
    g.rt.dispose();
  });

  it('test_recap_reads_saved_answers', async () => {
    const g = await mountGuided({ Q11: 'C' });
    await playUntilBeat(g, 'recap');
    expect(q('[data-ui="recap"]')).toBeTruthy();
    expect(q('[data-ui="recap-2026"] [data-chain="A"]').textContent).toContain(g.app.ctx.i18n.t('w10.chain.A.link.C'));
    g.rt.dispose();
  });

  it('test_demo_end_offers_new_game_only', async () => {
    const g = await mountGuided({}, [], 2);   // w10 finit au J7 (`endOfDemo: null`, T13) : la fin de démo se joue sur un w10 partiel, après le J2
    await playUntilBeat(g, 'demoEnd', 2000);
    const t = (k: string): string => g.app.ctx.i18n.t(k);
    expect(q('[data-ui="demo-end"]').textContent).toContain(t('w10.demo.title'));
    expect(q('[data-ui="demo-end"]').textContent).toContain(t('w10.demo.line'));
    expect(qa('[data-ui="demo-end"] button').map((b) => b.textContent)).toEqual([t('resume.new')]);
    expect(g.app.save.load().data.acts.length).toBeGreaterThan(0);
    q('[data-ui="demo-end"] button').click();
    expect(g.app.save.load().data.acts).toEqual([]);
    expect(g.app.navigate).toHaveBeenCalledWith('lang', undefined);
    g.rt.dispose();
  });

  it('test_arrested_run_shows_final_bilan_not_demo_end', async () => {
    // partie arrêtée la nuit 4 (fixture e2e) : la rue rend la main au bilan final existant, jamais à la carte de fin de démo
    const acts = JSON.parse(readFileSync(`${process.cwd()}/tests/e2e-street/arrested-night4.json`, 'utf8')) as ActRecord[];
    const g = await mountGuided({}, acts);
    expect(beat()).toBe('end');   // T4 (plan J3-J7) : une partie finie est un temps `end`, plus une fin de démo
    expect(g.app.navigate).toHaveBeenCalledWith('bilan', expect.objectContaining({ input: expect.anything() }));
    expect(document.body.querySelector('[data-ui="demo-end"]')).toBeNull();
    g.rt.dispose();
  });

  it('test_resume_mid_day_keeps_rights_already_said_in_carnet', async () => {
    const g = await mountGuided();
    await playUntilBeat(g, 'right');
    await stepGame(g);
    for (let i = 0; i < 50 && g.app.save.load().data.acts.length === 0; i++) await stepGame(g);   // un acte du jour : la reprise rejoue J1
    expect(qa('[data-ui="carnet"] [data-right]')).toHaveLength(1);
    const acts = g.app.save.load().data.acts;
    expect(acts.length).toBeGreaterThan(0);
    g.rt.dispose(); document.body.replaceChildren(); host = document.body.appendChild(document.createElement('div'));
    const again = await mountGuided({}, acts);
    expect(again.app.save.load().data.acts.length).toBe(acts.length);
    expect(qa('[data-ui="carnet"] [data-right]')).toHaveLength(1);   // reprise en cours de J1 : le droit déjà dit reste [revue finale I-1]
    again.rt.dispose();
  });

  it('test_resume_mid_day_shows_the_day_objective', async () => {
    // une reprise en cours de J1 ne repasse pas par la carte du jour : la ligne d'objectif s'affiche quand même
    const acts = [
      { day: 1, minute: 420, kind: 'choice', id: 'j1.phone', option: 'take' },
      { day: 1, minute: 421, kind: 'choice', id: 'j1.component', option: 'leave' },
    ] as ActRecord[];
    const g = await mountGuided({}, acts);
    expect(beat()).not.toBe('card');
    expect(q('[data-ui="objective"]').textContent).toContain(g.app.ctx.i18n.t('w10.goal.1'));
    g.rt.dispose();
  });

  async function playUntilScene(g: Guided, sceneId: string, max = 600): Promise<void> {
    for (let i = 0; i < max && !(beat() === 'choice' && street().dataset['scene'] === sceneId); i++) await stepGame(g);
    expect(`${beat()} ${street().dataset['scene']}`).toBe(`choice ${sceneId}`);
  }
  const shownOptions = (): string[] => qa('[data-ui="destinations"] [data-option]').map((o) => o.dataset['option'] ?? '');

  it('test_checkpoint_shows_all_seven_ways_including_courtesy_and_refuse', async () => {
    const g = await mountGuided();
    await playUntilScene(g, 'j1.checkpoint');
    // toutes les voies ouvertes de `checkpoint.j1` (`availableOptions`), dans l'ordre des données : aucune coupée à l'écran [revue finale I-2]
    const st = g.rt.driver.state();
    const open = availableOptions({ ...st.street, clock: st.live.clock }, ctxW10(), 'checkpoint.j1');
    expect(open).toEqual(expect.arrayContaining(['courtesy', 'refuse']));
    expect(open.at(-1)).toBe('refuse');                       // la 7e voie des données, au-delà de la 3e et de la 6e
    expect(shownOptions()).toEqual([...open]);
    g.rt.dispose();
  });

  it('test_j2_component_shows_its_fourth_option_leave_visible', { timeout: 30000 }, async () => {
    const g = await mountGuided();
    await playUntilScene(g, 'j2.wake', 2000);   // l'étape j2.wake présente le choix j2.component
    const st = g.rt.driver.state();
    const open = availableOptions({ ...st.street, clock: st.live.clock }, ctxW10(), 'j2.component');
    expect(open).toContain('leaveVisible');
    expect(shownOptions()).toEqual([...open]);
    g.rt.dispose();
  });

  it('test_refused_narrative_choice_does_not_stay_designated', async () => {
    const g = await mountGuided();
    await playUntilScene(g, 'j1.roux');
    const act = { day: 1, minute: 0, kind: 'scene', id: 'j1.roux', option: 'laugh' } as ActRecord;
    const spy = vi.spyOn(g.rt.driver, 'scene').mockReturnValue({ ok: false, rejected: { act, reason: 'choiceClosed' } });
    juice.calls = 0;
    q('[data-ui="destinations"] [data-option="laugh"]').click();
    spy.mockRestore();
    expect(juice.calls).toBe(0);   // le décompte animé ne se prépare qu'après l'acte accepté par le moteur [revue N-3]
    expect(q('[data-ui="refusal"]')).toBeTruthy();
    expect(document.body.querySelector('[data-ui="destinations"] [aria-pressed="true"]')).toBeNull();   // refus : la désignation est relâchée [revue finale M-4]
    expect(beat()).toBe('choice');
    g.rt.dispose();
  });

  it('test_narrative_choice_that_spends_words_plays_the_bracelet_coins', async () => {
    const g = await mountGuided();
    await playUntilScene(g, 'j1.roux');
    const coins: Node[] = [];
    const mo = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) if (n instanceof HTMLElement && n.classList.contains('c-coin')) coins.push(n); });
    mo.observe(document.body, { childList: true, subtree: true });
    q('[data-ui="destinations"] [data-option="laugh"]').click();   // 8 mots : le décompte animé, comme un choix à prix [revue finale M-3]
    await flush(); mo.disconnect();
    expect(coins.length).toBeGreaterThan(0);
    g.rt.dispose();
  });

  it('test_unmount_leaves_nothing_and_removes_listeners', async () => {
    const add = vi.spyOn(window, 'addEventListener'); const rem = vi.spyOn(window, 'removeEventListener');
    const g = await mountGuided();
    g.rt.dispose();
    expect(g.deps.frames.pending()).toBe(0);
    expect(host.childElementCount).toBe(0);
    expect(rem.mock.calls.map((c) => c[0]).sort()).toEqual(add.mock.calls.map((c) => c[0]).sort());
    add.mockRestore(); rem.mockRestore();
  });
});

describe('rue guidée : routage et plans', () => {
  it('test_screen_routes_guided_when_world_has_guided', async () => {
    const loaded: string[] = [];
    const fake = { driver: undefined as never, player: () => ({ x: 0, z: 0 }), district: () => undefined as never, dispose: () => undefined };
    const app = fakeApp([], { guided: true });
    const screen = createStreetScreen(app.ctx, app.payload, testDeps({
      sink: app.save,
      loadRuntime: async () => { loaded.push('runtime'); return { mountStreet: () => Promise.resolve(fake) } as never; },
      loadGuided: async () => { loaded.push('guided'); return { mountGuidedStreet: () => Promise.resolve(fake) } as never; },
    }));
    await screen.mount(host);
    expect(loaded).toEqual(['guided']);
    screen.unmount();
  });

  it('test_screen_routes_free_when_world_has_no_guided', async () => {
    const loaded: string[] = [];
    const fake = { driver: undefined as never, player: () => ({ x: 0, z: 0 }), district: () => undefined as never, dispose: () => undefined };
    const app = fakeApp();
    const screen = createStreetScreen(app.ctx, app.payload, testDeps({
      sink: app.save,
      loadRuntime: async () => { loaded.push('runtime'); return { mountStreet: () => Promise.resolve(fake) } as never; },
      loadGuided: async () => { loaded.push('guided'); return { mountGuidedStreet: () => Promise.resolve(fake) } as never; },
    }));
    await screen.mount(host);
    expect(loaded).toEqual(['runtime']);
    screen.unmount();
  });

  it('test_free_walk_flag_ignored_in_production_build', () => {
    expect(routeOf({ capture: false, search: '?rue=libre', guided: true })).toBe('guided');
    expect(routeOf({ capture: true, search: '?rue=libre', guided: true })).toBe('free');
    expect(routeOf({ capture: true, search: '?step', guided: true })).toBe('guided');
    expect(routeOf({ capture: false, search: '', guided: false })).toBe('free');
  });

  it('test_shot_kind_follows_the_beat', () => {
    const spec = (o: Partial<SceneSpec>): SceneSpec => ({ id: 's', day: 1, stage: 'x', place: 'p', anchorMinute: 0, costMin: 0, late: null, actor: null, beats: [], ask: { kind: 'none', next: 'night' }, transit: [], waitKind: 'none', ...o });
    const actor = { id: 'a', bodyId: 'b', nameKey: 'n', actionKey: 'k', clip: 'idle' as const };
    const line = (lit: string | null): Beat => ({ kind: 'line', voice: 'narrator', key: 'k', speaker: null, lit });
    expect(shotKindOf({ kind: 'walk', from: 'a', to: 'b' }, null, 'home')).toBe('street');
    expect(shotKindOf({ kind: 'wait', label: 'queue', fromMinute: 0, untilMinute: 1 }, null, 'home')).toBe('queue');
    expect(shotKindOf({ kind: 'card', day: 1, goalKey: 'g' }, null, 'home')).toBe('home');
    expect(shotKindOf(line(null), spec({ place: 'home' }), 'home')).toBe('home');
    expect(shotKindOf(line('phone'), spec({ place: 'home' }), 'home')).toBe('desk');
    expect(shotKindOf(line(null), spec({ actor }), 'home')).toBe('talk');
    expect(shotKindOf(line(null), spec({ actor, waitKind: 'queue' }), 'home')).toBe('queue');
    expect(['home', 'desk', 'street', 'talk', 'queue'].filter((k) => cutawayFor(k as never))).toEqual(['home', 'desk']);
    expect(cutawayFor('talk', true)).toBe(true);   // scène jouée dans l'immeuble (le palier) : la façade ne la cache pas
  });
});
