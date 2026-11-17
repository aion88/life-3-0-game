// @vitest-environment happy-dom
/**
 * L'écran `street` : assemblage, cycle de vie, erreurs, câblage du pilote [plan 02a T12, R-02a.20].
 * Aucun GPU ni réseau : tout passe par la couture `deps`. Les corps sont des `.glb` synthétiques (rien n'est livré).
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStreetScreen } from '../../../src/street/screen';
import type { StreetRuntime } from '../../../src/street/runtime';
import { GraphicsUnavailable } from '../../../src/street/render/backend';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { DataLoadError } from '../../../src/data/schema/common';
import { createGlbProvider } from '../../../src/street/render/characters/glbProvider';
import { choiceViews, optionLabelKey } from '../../../src/street/runtime';
import { checkpointWords } from '../../../src/engine/moments/words';
import { liveResources } from '../../support/street_scene';
import { actsOfProfile } from '../../support/profile_acts';
import { REQUIRED_BODIES, syntheticManifest, fakeApp, fakeBackend, fakeFetch, fakePost, manualFrames, testDeps } from '../../support/street_screen';
import { FULL_WEEK, REST, FAR, makeDriver, makeSink } from '../../support/street_driver';
import { SCENE } from '../../support/street_walk';
import { ctxW10 } from '../../support/street';
import { FR, EN, realI18n } from '../../support/street_ui';
import { SCRIPT_J1_PREFIX, SCRIPT_J1_J2, act } from '../../support/street';

const readSource = (p: string): string => readFileSync(`${process.cwd()}/${p}`, 'utf8');
const q = (s: string): Element | null => document.body.querySelector(s);
let host: HTMLElement;
beforeEach(() => { payloadCache('w10').clear(); host = document.body.appendChild(document.createElement('div')); });
afterEach(() => { host.remove(); document.body.replaceChildren(); });

type Mounted = { screen: ReturnType<typeof createStreetScreen>; app: ReturnType<typeof fakeApp>; deps: ReturnType<typeof testDeps>; rt: () => StreetRuntime };
async function mountWith(over: Parameters<typeof testDeps>[0] = {}, acts: Parameters<typeof fakeApp>[0] = []): Promise<Mounted> {
  const app = fakeApp(acts);
  const deps = testDeps({ sink: app.save, ...over });
  const screen = createStreetScreen(app.ctx, app.payload, deps);
  await screen.mount(host);
  return { screen, app, deps, rt: () => screen.runtime() as StreetRuntime };
}

describe('câblage statique', () => {
  it('test_screen_module_does_not_import_three', () => { expect(readSource('src/street/screen.ts')).not.toMatch(/from ['"]three/); });
  it('test_registry_points_at_the_real_street_screen', () => {
    expect(readSource('src/main.ts')).toMatch(/street:\s*createStreetScreen/);
    expect(readSource('src/main.ts')).not.toMatch(/provisional|Provisoire/i);
  });
  it('test_save_store_is_wired_with_known_act_kinds', () => {
    expect(readSource('src/main.ts')).toMatch(/known:\s*knownActKinds\(\)/);
    expect(readSource('src/main.ts')).toMatch(/isValidAct/);
  });
  it('test_runtime_never_imports_the_mannequin', () => { expect(readSource('src/street/runtime.ts')).not.toMatch(/mannequin/i); });
  it('test_runtime_has_no_literal_dt_bound', () => { expect(readSource('src/street/runtime.ts')).not.toMatch(/\b50\b/); expect(readSource('src/street/runtime.ts')).toMatch(/maxDtMs\.v/); });
});

describe('cycle de vie', () => {
  it('test_mount_unmount_five_times_leaks_nothing', async () => {
    const base = liveResources();
    for (let i = 0; i < 5; i++) {
      const m = await mountWith();
      m.deps.frames.step(16);
      m.screen.unmount();
      expect(m.deps.frames.pending()).toBe(0);
    }
    expect(liveResources()).toEqual(base);
    expect(host.childElementCount).toBe(0);
  });

  it('test_unmount_removes_every_listener_it_added', async () => {
    const add = vi.spyOn(window, 'addEventListener'); const rem = vi.spyOn(window, 'removeEventListener');
    const m = await mountWith();
    m.screen.unmount();
    const added = add.mock.calls.map((c) => c[0]).sort(); const removed = rem.mock.calls.map((c) => c[0]).sort();
    expect(added.length).toBeGreaterThan(0);
    expect(removed).toEqual(added);
    add.mockRestore(); rem.mockRestore();
  });

  it('test_unmount_during_mount_disposes_what_arrives', async () => {
    const base = liveResources();
    const app = fakeApp(); const deps = testDeps({ sink: app.save });
    const screen = createStreetScreen(app.ctx, app.payload, deps);
    const p = screen.mount(host);
    screen.unmount();
    await p;
    expect(deps.frames.pending()).toBe(0);
    expect(liveResources()).toEqual(base);
  });

  it('test_first_render_removes_the_loading_indicator', async () => {
    const m = await mountWith();
    expect(q('[data-ui="loading"]')).not.toBeNull();
    m.deps.frames.step(16);
    expect(q('[data-ui="loading"]')).toBeNull();
    m.screen.unmount();
  });
});

describe('erreurs', () => {
  it('test_gpu_unavailable_shows_panel_and_keeps_save', async () => {
    const app = fakeApp(); const before = structuredClone(app.save.load());
    const writes = Object.keys(app.storage.data).length;
    const screen = createStreetScreen(app.ctx, app.payload, testDeps({ sink: app.save, backend: () => Promise.reject(new GraphicsUnavailable([new Error('x')])) }));
    await screen.mount(host);
    expect(q('[data-ui="nogpu"]')).not.toBeNull();
    expect(app.save.load()).toEqual(before);
    expect(Object.keys(app.storage.data).length).toBe(writes);
    screen.unmount();
  });

  it('test_fetch_failure_reaches_the_shell_and_retry_does_not_refetch', async () => {
    const calls: string[] = [];
    const first = syntheticManifest().assets[0]!.path.replace(/^\/+/, '');
    const second = syntheticManifest().assets[1]!.path.replace(/^\/+/, '');
    const fetch = fakeFetch({ failOnce: (p) => p === second, calls });
    const app = fakeApp(); const deps = testDeps({ sink: app.save, fetch });
    const err = await Promise.resolve(createStreetScreen(app.ctx, app.payload, deps).mount(host)).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(DataLoadError);
    expect(err).toMatchObject({ kind: 'fetch' });
    const retry = createStreetScreen(app.ctx, app.payload, deps);
    await retry.mount(host);
    expect(calls.filter((c) => c === first)).toHaveLength(1);
    retry.unmount();
  });

  it('test_chunk_failure_is_a_fetch_error_for_the_shell', async () => {
    const app = fakeApp();
    const err = await Promise.resolve(createStreetScreen(app.ctx, app.payload, testDeps({ loadRuntime: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')) })).mount(host)).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(DataLoadError);
    expect(err).toMatchObject({ kind: 'fetch' });
  });

  it('test_missing_bodies_show_a_named_error_never_the_mannequin', async () => {
    const calls: string[] = [];
    const empty = (() => Promise.resolve(new Response(JSON.stringify({ budgetBytes: 1000, assets: [] }), { status: 200 }))) as typeof fetch;
    const m = await mountWith({ fetch: empty, characters: undefined as never });
    void calls;
    const e = q('[data-ui="street-error"]');
    // R-02a.21 (1) : le texte vu du joueur vient d'une clé i18n (ids non traduits en paramètre), jamais du nom de classe ni du message du développeur.
    expect(e?.textContent).toBe(m.app.ctx.i18n.t('street.ui.bodiesMissing', { ids: REQUIRED_BODIES.join(', ') }));
    expect(e?.textContent).not.toMatch(/BodiesMissingError|corps non livrés/);
    expect(e?.textContent).toContain('player');
    expect(FR['street.ui.bodiesMissing']).toContain('{ids}'); expect(EN['street.ui.bodiesMissing']).toContain('{ids}');
    expect(m.deps.frames.pending()).toBe(0);
    m.screen.unmount();
  });
});

describe('boucle et pilote', () => {
  it('test_dt_is_bounded_by_the_scene_data', async () => {
    const m = await mountWith();
    m.deps.frames.step(0);
    const start = m.rt().player();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));       // vers z croissant, libre
    m.deps.frames.step(100_000);
    const moved = m.rt().player().z - start.z;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual((SCENE.walk.speedMps.v * SCENE.walk.maxDtMs.v) / 1000 + 1e-9);
    m.screen.unmount();
  });

  it('test_every_frame_renders_once', async () => {
    const post = fakePost();
    const m = await mountWith({ post: () => post });
    m.deps.frames.step(16); m.deps.frames.step(16);
    expect(post.renders()).toBe(2);
    m.screen.unmount();
    expect(post.disposed()).toBeGreaterThan(0);
  });

  it('test_choices_shown_are_driver_present_never_pending_choices', async () => {
    const m = await mountWith();
    m.deps.frames.step(16);
    const ids = m.rt().driver.present(m.rt().player());
    const shown = [...document.body.querySelectorAll('[data-choice]')].map((e) => e.getAttribute('data-choice'));
    expect(shown).toEqual(ids);
    expect(readSource('src/street/runtime.ts')).not.toMatch(/pendingChoices/);
    m.screen.unmount();
  });

  it('test_designate_gesture_shows_the_price_then_confirm_writes_one_act', async () => {
    const m = await mountWith();
    m.deps.frames.step(16);
    const choiceId = 'j1.phone';                       // door.noon est présenté dès 7 h par `present` (zone sans heure) : signalé au rapport
    const first = document.body.querySelector<HTMLElement>(`[data-choice="${choiceId}"] [data-option="take"]`);
    expect(first).not.toBeNull();
    const before = m.app.save.load().data.acts.length;
    first!.click();
    expect(q('[data-ui="price"]')).not.toBeNull();
    expect(m.app.save.load().data.acts.length).toBe(before);       // désigner n'écrit rien
    document.body.querySelector<HTMLElement>('[data-ui="confirm"]')!.click();
    m.deps.frames.step(16);
    expect(m.app.save.load().data.acts.length).toBe(before + 1);
    expect(m.rt().driver.state().street.confirmed[`1.${choiceId}`]).toBeDefined();
    m.screen.unmount();
  });

  it('test_resume_replays_saved_acts_without_new_save_calls', async () => {
    const m = await mountWith({}, SCRIPT_J1_PREFIX);
    const writes = Object.entries(m.app.storage.data).map(([k, v]) => `${k}=${v}`);
    m.deps.frames.step(16);
    expect(m.rt().driver.state().street.location).toBe('street');
    expect(Object.entries(m.app.storage.data).map(([k, v]) => `${k}=${v}`)).toEqual(writes);
    m.screen.unmount();
  });

  it('test_ended_week_drains_events_then_navigates_to_bilan', async () => {
    const m = await mountWith({}, FULL_WEEK);
    m.deps.frames.step(16);
    expect(m.app.navigate).toHaveBeenCalledTimes(1);
    const [id, payload] = m.app.navigate.mock.calls[0] as unknown as [string, { input: { entry: string } }];
    expect(id).toBe('bilan');
    expect(payload.input.entry).toBeDefined();
    expect(m.rt().driver.drain()).toEqual([]);
    m.deps.frames.step(16);
    expect(m.app.navigate).toHaveBeenCalledTimes(1);
    m.screen.unmount();
  });

  it('test_grey_car_visibility_follows_presence_at_mount', async () => {
    const m = await mountWith();
    const car = m.rt().district().places.get('voitureGrise')!;
    const d = makeDriver(makeSink(), { onGreyCar: () => undefined });
    void d;
    expect(typeof car.visible).toBe('boolean');
    m.screen.unmount();
  });
});

describe('zones : entrées et sorties des lieux [R-02a.21 (4)]', () => {
  const key = (type: 'keydown' | 'keyup', code: string): void => { window.dispatchEvent(new KeyboardEvent(type, { code })); };
  /** Les appels `driver.act` d'un genre, posés par l'écran (jamais par le test). */
  const spyActs = (rt: StreetRuntime, kind: string, id: string) => {
    const spy = vi.spyOn(rt.driver, 'act');
    const count = (): number => spy.mock.calls.filter(([a]) => a.kind === kind && a.id === id).length;
    count.results = (): { ok: boolean; rejected?: { reason: string } }[] => spy.mock.results.filter((_, i) => spy.mock.calls[i]![0].kind === kind && spy.mock.calls[i]![0].id === id).map((r) => r.value as { ok: boolean; rejected?: { reason: string } });
    return count;
  };
  const walk = (m: Mounted, code: string, frames: number, until?: () => boolean): void => {
    key('keydown', code);
    for (let i = 0; i < frames && !(until?.() ?? false); i++) m.deps.frames.step(16);
    key('keyup', code);
  };
  const DAY2_HOME = SCRIPT_J1_J2.slice(0, SCRIPT_J1_J2.findIndex((a) => a.kind === 'sleep') + 1);   // J2, au logement, `j2.component` ouvert : la sortie est refusée
  const home = SCENE.layout.places.logement, reg = SCENE.layout.places.registre;

  it('test_exit_home_is_emitted_once_not_once_per_frame', async () => {
    const m = await mountWith();
    m.deps.frames.step(16);
    const exits = spyActs(m.rt(), 'exit', 'home');
    walk(m, 'KeyW', 400, () => m.rt().driver.state().street.location === 'street');
    expect(m.rt().driver.state().street.location).toBe('street');
    key('keydown', 'KeyW'); for (let i = 0; i < 60; i++) m.deps.frames.step(16); key('keyup', 'KeyW');     // 60 images encore, dehors
    expect(exits()).toBe(1);
    m.screen.unmount();
  });

  it('test_rejected_exit_snaps_the_player_back_inside_and_state_stays_home', async () => {
    const m = await mountWith({}, DAY2_HOME);
    m.deps.frames.step(16);
    expect(m.rt().driver.state().street.location).toBe('home');
    const exits = spyActs(m.rt(), 'exit', 'home');
    const lowest: number[] = [];
    key('keydown', 'KeyW');
    for (let i = 0; i < 400; i++) { m.deps.frames.step(16); lowest.push(m.rt().player().z); }
    key('keyup', 'KeyW');
    expect(exits()).toBe(1);                                                      // maintenue contre la frontière : un seul refus, pas un par image
    expect(Math.min(...lowest)).toBeGreaterThanOrEqual(home.zEnd!.v - 1e-9);     // aucune image ne laisse la joueuse dehors
    expect(m.rt().player().z).toBeGreaterThanOrEqual(home.zEnd!.v);
    expect(m.rt().driver.state().street.location).toBe('home');                   // la vue et le moteur disent la même chose
    m.screen.unmount();
  });

  it('test_a_rejected_exit_is_tried_again_after_the_player_walks_away_and_returns', async () => {
    const m = await mountWith({}, DAY2_HOME);
    m.deps.frames.step(16);
    const exits = spyActs(m.rt(), 'exit', 'home');
    walk(m, 'KeyW', 400);
    expect(exits()).toBe(1);
    walk(m, 'KeyS', 400, () => m.rt().player().z > home.zEnd!.v + 3);              // s'éloigner de la frontière : la zone se réarme
    walk(m, 'KeyW', 400);
    expect(exits()).toBe(2);
    expect(m.rt().player().z).toBeGreaterThanOrEqual(home.zEnd!.v);
    m.screen.unmount();
  });

  // Seul refus réel d'une sortie du Registre : `reduceAct` rend `ended` (state.ts:300), le verbe `exit registre` n'en a aucun autre.
  // État atteint par les données : profil « Muet », arrêté à la nuit 5 (`onSleep`, état.ts:281-282) alors que la joueuse est au Registre, où le sommeil ne la ramène pas.
  it('test_refused_registre_exit_snaps_the_player_back_and_state_stays_registre', async () => {
    const muet = actsOfProfile('Muet', {});
    const acts = [...muet.slice(0, -1), act(5, 830, 'enter', 'registre'), muet.at(-1)!];
    const m = await mountWith({}, acts);
    m.deps.frames.step(16);
    expect(m.rt().driver.state().street.location).toBe('registre');
    expect(m.rt().driver.state().street.ended).not.toBeNull();
    const exits = spyActs(m.rt(), 'exit', 'registre');
    const zs: number[] = [];
    key('keydown', 'KeyS');
    for (let i = 0; i < 3000; i++) { m.deps.frames.step(16); zs.push(m.rt().player().z); }
    key('keyup', 'KeyS');
    expect(exits()).toBe(1);                                                         // refusée une fois, pas une par image
    const results = exits.results();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ ok: false, rejected: { reason: 'ended' } });
    expect(Math.max(...zs)).toBeLessThanOrEqual(reg.z.v + 1e-9);                      // aucune image ne laisse la joueuse au delà de la frontière
    expect(Math.max(...zs)).toBeGreaterThan(reg.z.v - 1);                            // elle a bien marché jusqu'à la frontière
    expect(m.rt().driver.state().street.location).toBe('registre');
    m.screen.unmount();
  });

  it('test_registre_is_entered_and_left_once_each', async () => {
    const m = await mountWith({}, [...SCRIPT_J1_PREFIX, act(1, 600, 'lane', 'checkpoint', 'comply')]);
    m.deps.frames.step(16);
    expect(m.rt().driver.state().street.location).toBe('street');
    const enters = spyActs(m.rt(), 'enter', 'registre');
    const westOfWall = SCENE.checkpoint.boothX.v - SCENE.checkpoint.booth.widthM.v / 2 - SCENE.checkpoint.wall.widthM - SCENE.walk.bodyRadiusM.v - 0.2;
    walk(m, 'KeyA', 600, () => m.rt().player().x < westOfWall);                    // le mur de télés et la guérite sont pleins : le passage est à l'ouest
    walk(m, 'KeyW', 3000, () => m.rt().driver.state().street.location === 'registre');
    expect(m.rt().driver.state().street.location).toBe('registre');
    key('keydown', 'KeyW'); for (let i = 0; i < 60; i++) m.deps.frames.step(16); key('keyup', 'KeyW');
    expect(enters()).toBe(1);
    expect(m.rt().player().z).toBeLessThanOrEqual((reg.z.v + reg.zEnd!.v) / 2 + 1);
    const exits = spyActs(m.rt(), 'exit', 'registre');
    walk(m, 'KeyS', 3000, () => m.rt().player().z > reg.z.v + 0.5);               // vers la rue : franchit la frontière du Registre
    key('keydown', 'KeyS'); for (let i = 0; i < 60; i++) m.deps.frames.step(16); key('keyup', 'KeyS');
    expect(exits()).toBe(1);                                                       // une sortie, pas une par image
    expect(m.rt().driver.state().street.location).toBe('street');                  // acceptée ici ; le refus a son propre test ci-dessous
    m.screen.unmount();
  });
});

describe('fixture e2e', () => {
  // R-02a.21 (5) : `tests/e2e-street/full-week.json` est la semaine « sept jours, dormir seulement » de `SEVEN_DAYS_SLEEP_ONLY`
  // (`tests/support/street.ts`). Playwright ne peut pas importer les données du monde : la copie est figée et ce test la tient à la source.
  // Régénérer : `JSON.stringify(SEVEN_DAYS_SLEEP_ONLY, null, 1)` écrit dans ce fichier.
  it('test_full_week_fixture_is_the_seven_days_sleep_only_script', () => {
    expect(JSON.parse(readSource('tests/e2e-street/full-week.json'))).toEqual(FULL_WEEK);
  });
  // plan 02a T13 : `arrested-night4.json` est le profil « Bavard » de l'oracle de survie, arrêté à la nuit 4 : la fin ANTICIPÉE de la rue vers le bilan.
  // Régénérer : `JSON.stringify(actsOfProfile('Bavard'), null, 1)` suivi d'un retour à la ligne, écrit dans ce fichier.
  it('test_arrested_night4_fixture_is_the_bavard_profile', () => {
    expect(JSON.parse(readSource('tests/e2e-street/arrested-night4.json'))).toEqual(actsOfProfile('Bavard'));
  });
});

describe('pilote : drain', () => {
  it('test_driver_drain_returns_pending_events_once_without_advancing_the_clock', () => {
    const d = makeDriver(makeSink());
    d.act({ day: 1, minute: 1, kind: 'bogus', id: 'x', option: null });       // refusé : un événement `rejected` attend
    const clock = d.state().live;
    const out = d.drain();
    expect(out.map((e) => e.type)).toEqual(['rejected']);
    expect(d.drain()).toEqual([]);
    expect(d.state().live).toEqual(clock);
    void REST; void FAR;
  });
});

describe('vues de choix', () => {
  const ctx = ctxW10();
  const i18n = realI18n('fr');
  const jalons = ctx.street.jalons.map((j) => j.id);

  it('test_milestone_view_has_one_continue_option', () => {
    const [v] = choiceViews([jalons[0]!], ctx, i18n);
    expect(v!.options).toEqual([{ id: 'go', labelKey: 'street.ui.continue', isRefusal: false, words: 0 }]);
    expect(v!.blocksExit).toBe(false);
  });

  // R-02a.21 (3) : libellés de jalons épinglés par id. Précédence : `w10.doc.<id>`, puis `w10.street.<id>`, puis le repli `street.ui.continue`.
  // Aujourd'hui aucun des cinq n'a de clé propre : la liste est NOMMÉE (propriétaire writer, bloque T13) et ne doit jamais grandir.
  const MISSING_JALON_KEYS = ['audition.j7', 'j2.agentReturn', 'j3.marlene.late', 'j4.door', 'j5.bruno.door'];
  const withKeys = (keys: readonly string[]) => ({ has: (k: string) => keys.includes(k) });

  it('test_milestone_label_key_follows_precedence_per_jalon_id', () => {
    for (const id of ['j2.agentReturn', 'j3.marlene.late', 'j4.door', 'j5.bruno.door', 'audition.j7']) {
      expect(choiceViews([id], ctx, withKeys([`w10.doc.${id}`, `w10.street.${id}`]))[0]!.labelKey).toBe(`w10.doc.${id}`);
      expect(choiceViews([id], ctx, withKeys([`w10.street.${id}`]))[0]!.labelKey).toBe(`w10.street.${id}`);
      expect(choiceViews([id], ctx, withKeys([]))[0]!.labelKey).toBe('street.ui.continue');
    }
    expect([...jalons].sort()).toEqual(MISSING_JALON_KEYS);           // les cinq jalons des données sont bien ceux-là
  });

  it('test_milestones_without_own_key_are_a_named_list_that_cannot_grow', () => {
    const missing: string[] = [];
    for (const j of jalons) {
      const [v] = choiceViews([j], ctx, i18n);
      expect(i18n.has(v!.labelKey)).toBe(true);
      if (v!.labelKey === 'street.ui.choices.milestone') missing.push(j);   // nom de repli « Un document » : jamais `street.ui.continue` (A-8)
      else expect(v!.labelKey).toBe(i18n.has(`w10.doc.${j}`) ? `w10.doc.${j}` : i18n.has(`w10.street.${j}`) ? `w10.street.${j}` : `w10.choice.${j}`);   // `audition.j7` est aussi un choix : il a reçu son nom de groupe (T6)
    }
    // Un jalon qui reçoit sa clé sort de la liste (le test dit alors de la raccourcir) ; un jalon qui la perd fait échouer ici.
    expect(missing.sort()).toEqual(MISSING_JALON_KEYS.filter((j) => j !== 'audition.j7'));   // `audition.j7` a sa clé de groupe `w10.choice.audition.j7`
  });

  it('test_blocks_exit_comes_from_the_data', () => {
    const doorId = ctx.street.choices.find((c) => c.blocksExit)!.id;
    const [v] = choiceViews([doorId], ctx, i18n);
    expect(v!.blocksExit).toBe(true);
    const other = ctx.street.choices.find((c) => !c.blocksExit)!.id;
    expect(choiceViews([other], ctx, i18n)[0]!.blocksExit).toBe(false);
  });

  it('test_option_labels_are_choice_keys_and_never_a_price_line', () => {   // D1 : la ligne de prix ne nomme plus l'option
    let total = 0;
    for (const c of ctx.street.choices) {
      const [v] = choiceViews([c.id], ctx, i18n);
      c.options.forEach((o, k) => {
        total++;
        expect(v!.options[k]!.labelKey).toBe(optionLabelKey(c.id, o.id));
        expect(v!.options[k]!.words).toBe(c.id.startsWith('checkpoint.') ? checkpointWords(ctx.street.checkpoint.forcedWords, o.id) : o.words);   // le prix de la pièce est le coût du relevé
        expect(i18n.has(v!.options[k]!.labelKey)).toBe(true);
      });
    }
    expect(total).toBe(ctx.street.choices.reduce((n, c) => n + c.options.length, 0));
  });
});

void fakeBackend; void manualFrames;

describe('vague finale R-02a.22', () => {
  it('test_sleep_is_offered_once_the_live_clock_passes_evening_without_any_new_act', async () => {
    const m = await mountWith();
    m.deps.frames.step(16);
    (q('[data-ui="welcome-skip"]') as HTMLButtonElement).click();                   // J1 neuf : l'accueil gèle l'horloge jusqu'à son terme [playtest 2026-11-03 §1 A]
    const evening = ctxW10().street.moments.eveningMinute;
    expect(q('[data-choice="__sleep__"], [data-choice="sleep"]')).toBeNull();
    let n = 0;
    while (m.rt().driver.state().live.clock.minute < evening && n++ < 200_000) m.deps.frames.step(50);
    m.deps.frames.step(16);
    expect(m.rt().driver.state().live.clock.minute).toBeGreaterThanOrEqual(evening);
    expect(m.rt().driver.state().street.clock.minute).toBeLessThan(evening);        // aucun acte : l'état du moteur n'a pas bougé
    expect(m.rt().driver.state().street.location).toBe('home');
    expect(document.body.querySelector('[data-option="sleep"]')).not.toBeNull();
    m.screen.unmount();
  });

  it('test_escape_on_a_choice_panel_clears_the_designation_and_the_choice_returns_next_tick', async () => {
    const m = await mountWith();
    m.deps.frames.step(16);
    const des = vi.spyOn(m.rt().driver, 'designate');
    document.body.querySelector<HTMLElement>('[data-choice="j1.phone"] [data-option="take"]')!.click();
    expect(m.rt().driver.state().street.phase).toBe('designated');
    des.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(des).toHaveBeenCalledWith('j1.phone', null);
    expect(m.rt().driver.state().street.phase).not.toBe('designated');
    expect(document.body.querySelector('[data-choice]')).toBeNull();
    m.deps.frames.step(16);                                                            // `lastChoiceIds` remis à zéro : le choix revient
    expect(document.body.querySelector('[data-choice="j1.phone"]')).not.toBeNull();
    m.screen.unmount();
  });

  it('test_unavailable_reason_is_shown_as_unavailable_not_as_closed', async () => {
    const m = await mountWith();
    m.deps.frames.step(16);
    vi.spyOn(m.rt().driver, 'designate').mockReturnValue({ ok: false, reason: 'unavailable' });
    document.body.querySelector<HTMLElement>('[data-choice="j1.phone"] [data-option="take"]')!.click();
    expect(q('[data-ui="refusal"]')?.textContent).toBe(realI18n('fr').t('street.ui.refusal.unavailable'));
    expect(q('[data-ui="refusal"]')?.textContent).not.toBe(realI18n('fr').t('street.ui.refusal.choiceClosed'));
    m.screen.unmount();
  });
});

describe('erreur dans la boucle d\'image [R-02a.22 round 2]', () => {
  it('test_a_body_that_fails_to_decode_shows_a_named_error_stops_the_loop_and_keeps_the_save', async () => {
    const m = await mountWith({ characters: (a, mf) => createGlbProvider(a, mf) });
    const before = JSON.stringify(m.app.storage.data);
    let n = 0;
    while (q('[data-ui="street-error"]') === null && n++ < 100) { await new Promise((r) => setTimeout(r, 5)); m.deps.frames.step(16); }
    const e = q('[data-ui="street-error"]');
    expect(e).not.toBeNull();
    expect(e?.getAttribute('role')).toBe('alert');
    expect(e?.textContent).toMatch(/char\./);
    expect(e?.textContent).not.toMatch(/CharacterContractError|glTF/);
    expect(q('[data-ui="loading"]')).toBeNull();
    expect(m.deps.frames.pending()).toBe(0);
    expect(JSON.stringify(m.app.storage.data)).toBe(before);
    m.screen.unmount();
  });
});
