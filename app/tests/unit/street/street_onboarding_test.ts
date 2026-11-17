// @vitest-environment happy-dom
/**
 * Accueil du J1, ligne d'objectif, relevé du soir en scène, horloge à 12 s par heure
 * [design/gdd/2026-11-03-playtest-enjeu-onboarding.md §1 A et §3 A ; bible w10 §6, §8.1, §8.2].
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountUi } from '../../../src/street/ui';
import type { UiHandle } from '../../../src/street/ui';
import { createInstantAnimator } from '../../../src/ui/motion';
import { firstSightDue, objectiveKey, parseOnboarding, welcomeDue, welcomeKit } from '../../../src/street/onboarding';
import onboardingRaw from '../../../src/street/data/w10.onboarding.json';
import { eveningLines } from '../../../src/engine/moments/evening';
import { ruleFor } from '../../../src/i18n/i18n';
import type { StringMeta } from '../../../src/i18n/i18n';
import metaJson from '../../../src/data/strings/meta.json';
import { checkPlayerString } from '../../../src/validate/numbers';
import { PROVISIONAL } from '../../../src/validate/provisional';
import { ctxW10 } from '../../support/street';
import { EN, FR, realI18n } from '../../support/street_ui';
import { createStreetScreen } from '../../../src/street/screen';
import { payloadCache } from '../../../src/street/load/worldPayload';
import { fakeApp, testDeps } from '../../support/street_screen';

const ctx = ctxW10();
const meta = metaJson as StringMeta;
const ob = parseOnboarding(onboardingRaw, ctx.street);
const q = (s: string): HTMLElement | null => document.body.querySelector(s);
let ui: UiHandle;
const mount = (lang: 'fr' | 'en' = 'fr', reducedMotion = false): UiHandle =>
  (ui = mountUi(document.body.appendChild(document.createElement('div')), realI18n(lang), { animator: createInstantAnimator(), reducedMotion }));
beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { ui?.dispose(); });

/** Toutes les clés de joueur que ce lot écrit. */
const ownKeys = (): string[] => Object.keys(FR).filter((k) => /^(w10\.welcome|w10\.goal|w10\.evening\.scene|street\.ui\.welcome|street\.ui\.objective)\b/.test(k));

describe('données de l\'accueil', () => {
  it('test_onboarding_welcome_follows_the_kit_order_and_ends_on_the_goal', () => {
    // Arrange / Act
    const lit = ob.welcome.lines.map((l) => l.lit);
    // Assert : bracelet, carte, téléphone, carnet, composant (bible §6), fiche et reçu muets, le but du jour en dernier
    expect(welcomeKit(ob)).toEqual(['bracelet', 'sectorCard', 'phone', 'permitBook', 'component']);
    expect(lit.slice(1, 6)).toEqual(['bracelet', 'sectorCard', 'phone', 'permitBook', 'component']);
    expect(lit).not.toContain('classSheet'); expect(lit).not.toContain('machineReceipt');
    expect(ob.welcome.lines.at(-1)!.key).toBe('w10.welcome.goal');
    expect(ob.welcome.lines.find((l) => l.lit === 'component')!.voice).toBe('narrator');
    expect(ob.welcome.lines.filter((l) => l.voice === 'narrator')).toHaveLength(1);
  });

  it('test_onboarding_every_day_has_an_objective_and_a_fixed_rendezvous_open_that_day', () => {
    // Assert : sept jours, chaque rendez-vous est une micro-situation M1 à M5 ouverte ce jour-là dans w10.json
    expect(ob.objectives.map((o) => o.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const o of ob.objectives) {
      expect(FR[objectiveKey(o.day)], `fr ${o.day}`).toBeTruthy(); expect(EN[objectiveKey(o.day)], `en ${o.day}`).toBeTruthy();
      if (o.rendezVous === null) continue;
      expect(o.rendezVous).toMatch(/^m[1-5]\./);
      expect(ctx.street.choices.find((c) => c.id === o.rendezVous)!.days, `${o.rendezVous} le J${o.day}`).toContain(o.day);
    }
    expect(ob.objectives.filter((o) => o.rendezVous === null).map((o) => o.day)).toEqual([7]);
  });

  it('test_onboarding_parse_rejects_an_unknown_rendezvous_or_a_closed_day', () => {
    const bad = (patch: (r: typeof onboardingRaw) => void): (() => void) => () => { const r = structuredClone(onboardingRaw); patch(r); parseOnboarding(r, ctx.street); };
    expect(bad((r) => { r.objectives[0]!.rendezVous = 'm9.nope'; })).toThrow(/m9\.nope/);
    expect(bad((r) => { r.objectives[1]!.rendezVous = 'm5.yusuf'; })).toThrow(/m5\.yusuf/);   // Yusuf n'est ouvert que le J1
    expect(bad((r) => { r.objectives.pop(); })).toThrow(/7/);
    expect(bad((r) => { r.firstSight[0]!.choiceId = 'nope'; })).toThrow(/nope/);
    expect(bad((r) => { r.welcome.lines[1]!.lit = 'classSheet'; })).toThrow(/classSheet/);   // un objet allumé est un objet présenté
  });

  it('test_onboarding_strings_exist_in_both_languages_pass_the_number_rules_and_have_no_em_dash', () => {
    const keys = ownKeys();
    expect(keys.length).toBeGreaterThan(25);
    for (const k of keys) {
      for (const [lang, table] of [['fr', FR], ['en', EN]] as const) {
        const s = table[k]; expect(s, `${lang} ${k}`).toBeTruthy();
        expect(s, `${lang} ${k}`).not.toMatch(/[—–]/);
        expect(checkPlayerString(s!, lang, ruleFor(meta, k), ctx.world.forbiddenWords), `${lang} ${k}`).toEqual([]);
      }
    }
    for (const l of [...ob.welcome.lines, ...ob.firstSight]) expect(FR[l.key], l.key).toBeTruthy();
  });

  it('test_onboarding_strings_are_registered_provisional_for_the_writer', () => {
    const prefixes = PROVISIONAL.filter((e) => e.kind === 'strings' && e.owner === 'writer').map((e) => (e as { prefix: string }).prefix);
    for (const p of ['w10.welcome', 'w10.goal', 'w10.evening.scene']) expect(prefixes).toContain(p);
  });

  it('test_onboarding_welcome_is_due_only_on_a_fresh_day_one', () => {
    expect(welcomeDue(ob, 1, 0)).toBe(true);
    expect(welcomeDue(ob, 1, 1)).toBe(false);
    expect(welcomeDue(ob, 2, 0)).toBe(false);
  });

  it('test_onboarding_letter_line_is_due_at_its_first_appearance_only', () => {
    expect(firstSightDue(ob, ['checkpoint.j1'], [], new Set())).toBeNull();
    expect(firstSightDue(ob, ['m3.letter'], [], new Set())!.key).toBe('w10.welcome.letter');
    expect(firstSightDue(ob, ['m3.letter'], [], new Set(['m3.letter']))).toBeNull();              // déjà vue dans la séance
    expect(firstSightDue(ob, ['m3.letter'], [{ id: 'm3.letter' }], new Set())).toBeNull();       // déjà jouée (reprise)
  });

  it('test_clock_runs_twelve_seconds_per_hour', () => {
    expect(ctx.street.clock.msPerHour).toBe(12_000);   // design §4.4, borne haute validée (120 à 180 s par jour)
  });
});

describe('accueil à l\'écran', () => {
  it('test_welcome_phone_vibrates_then_each_object_lights_during_its_line', () => {
    // Arrange
    mount();
    const done = vi.fn();
    // Act
    ui.showWelcome({ lines: ob.welcome.lines, kit: welcomeKit(ob), vibrate: true }, done);
    // Assert : la première ligne fait vibrer le téléphone
    const w = q('[data-ui="welcome"]')!;
    expect(w.textContent).toContain(FR['w10.welcome.hello']);
    expect(q('[data-kit="phone"]')!.dataset['vibrate']).toBe('true');
    const seen: (string | null)[] = [];
    for (let i = 0; i < ob.welcome.lines.length; i++) {
      const line = ob.welcome.lines[i]!;
      expect(q('[data-ui="welcome-line"]')!.textContent).toBe(FR[line.key]);
      expect(q('[data-ui="welcome-line"]')!.dataset['voice']).toBe(line.voice);
      const lit = [...document.querySelectorAll<HTMLElement>('[data-kit][data-lit="true"]')].map((e) => e.dataset['kit']!);
      seen.push(lit[0] ?? null);
      expect(lit.length).toBeLessThanOrEqual(1);
      if (i < ob.welcome.lines.length - 1) (q('[data-ui="welcome-next"]') as HTMLButtonElement).click();
    }
    expect(seen).toEqual(ob.welcome.lines.map((l) => l.lit));
    expect(q('[data-kit="phone"]')!.dataset['vibrate']).toBeUndefined();   // ne vibre qu'à l'appel
    expect(done).not.toHaveBeenCalled();
    (q('[data-ui="welcome-next"]') as HTMLButtonElement).click();
    expect(done).toHaveBeenCalledTimes(1);
    expect(q('[data-ui="welcome"]')).toBeNull();
  });

  it('test_welcome_bracelet_line_lights_the_real_bracelet', () => {
    mount(); ui.setBracelet(60);
    ui.showWelcome({ lines: ob.welcome.lines, kit: welcomeKit(ob), vibrate: true }, () => undefined);
    (q('[data-ui="welcome-next"]') as HTMLButtonElement).click();
    expect(q('[data-ui="root"]')!.dataset['welcomeLit']).toBe('bracelet');
    (q('[data-ui="welcome-skip"]') as HTMLButtonElement).click();
    expect(q('[data-ui="root"]')!.dataset['welcomeLit']).toBeUndefined();
  });

  it('test_welcome_is_skipped_in_one_click', () => {
    mount();
    const done = vi.fn();
    ui.showWelcome({ lines: ob.welcome.lines, kit: welcomeKit(ob), vibrate: true }, done);
    (q('[data-ui="welcome-skip"]') as HTMLButtonElement).click();
    expect(done).toHaveBeenCalledTimes(1);
    expect(q('[data-ui="welcome"]')).toBeNull();
  });

  it('test_welcome_texts_come_from_keys_and_follow_the_language', () => {
    mount();
    ui.showWelcome({ lines: ob.welcome.lines, kit: welcomeKit(ob), vibrate: true }, () => undefined);
    expect(q('[data-kit="component"]')!.textContent).toBe(FR['w10.welcome.kit.component']);
    expect(q('[data-ui="welcome-skip"]')!.textContent).toBe(FR['street.ui.welcome.skip']);
    expect(q('[data-ui="welcome"]')!.getAttribute('aria-label')).toBe(FR['street.ui.welcome.label']);
  });

  it('test_welcome_single_line_has_no_skip_and_closes_on_next', () => {
    mount();
    const done = vi.fn();
    const letter = ob.firstSight[0]!;
    ui.showWelcome({ lines: [letter], kit: ['letter'], vibrate: false }, done);
    expect(q('[data-ui="welcome-skip"]')).toBeNull();
    expect(q('[data-kit="letter"]')!.dataset['lit']).toBe('true');
    (q('[data-ui="welcome-next"]') as HTMLButtonElement).click();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('test_objective_line_sits_in_the_left_zone_and_reads_the_day_key', () => {
    mount();
    ui.showObjective(3);
    const o = q('[data-ui="objective"]')!;
    expect(o.closest('[data-zone="left"]')).not.toBeNull();
    expect(o.textContent).toContain(FR['w10.goal.3']);
    ui.showObjective(null);
    expect(q('[data-ui="objective"]')).toBeNull();
  });
});

describe('relevé du soir en scène', () => {
  it('test_evening_scene_has_a_title_lines_message_and_narrator_line', () => {
    mount();
    ui.showEvening(eveningLines(1, [], ctx), 'thanks', 1);
    const scene = q('[data-ui="evening-scene"]')!;
    expect(scene.querySelector('[data-ui="evening-title"]')!.textContent).toBe(FR['w10.evening.scene.title']);
    expect(scene.querySelectorAll('[data-ui="evening"] li')).toHaveLength(6);
    expect(scene.querySelector('[data-ui="evening-narration"]')!.textContent).toBe(FR['w10.evening.scene.thanks']);
    ui.showEvening([], null);
    expect(q('[data-ui="evening-scene"]')).toBeNull();
  });

  it('test_evening_hook_fires_once_per_opening_with_the_scene_to_extend', () => {
    // Arrange : le point d'accroche où la barre Dossier se consolide
    mount();
    const seen: { day: number | null; palier: string | null; scene: boolean }[] = [];
    const off = ui.onEvening((e) => { seen.push({ day: e.day, palier: e.palier, scene: e.scene.isConnected && e.scene.dataset['ui'] === 'evening-scene' }); });
    // Act
    ui.showEvening(eveningLines(2, [], ctx), 'patience', 2);
    ui.showEvening([], null);
    off();
    ui.showEvening(eveningLines(3, [], ctx), 'thanks', 3);
    // Assert
    expect(seen).toEqual([{ day: 2, palier: 'patience', scene: true }]);
  });
});

describe('runtime : accueil du J1', () => {
  it('test_runtime_fresh_day_one_shows_welcome_freezes_clock_then_shows_objective', async () => {
    payloadCache('w10').clear();
    const host = document.body.appendChild(document.createElement('div'));
    const app = fakeApp([]);
    const deps = testDeps({ sink: app.save });
    const screen = createStreetScreen(app.ctx, app.payload, deps);
    await screen.mount(host);
    const rt = screen.runtime() as unknown as { driver: { state(): { live: { clock: { minute: number } } } } };
    deps.frames.step(16);
    expect(q('[data-ui="welcome"]')).not.toBeNull();
    expect(q('[data-ui="objective"]')).toBeNull();
    const m0 = rt.driver.state().live.clock.minute;
    for (let i = 0; i < 100; i++) deps.frames.step(50);          // 5 s réelles
    expect(rt.driver.state().live.clock.minute, 'horloge gelée pendant l\'accueil').toBe(m0);
    (q('[data-ui="welcome-skip"]') as HTMLButtonElement).click();
    for (let i = 0; i < 240; i++) deps.frames.step(50);          // 12 s réelles : une heure de jeu
    expect(rt.driver.state().live.clock.minute).toBe(m0 + 60);
    expect(q('[data-ui="objective"]')!.textContent).toContain(FR['w10.goal.1']);
    screen.unmount(); host.remove();
  });

  it('test_runtime_resumed_day_shows_no_welcome_but_the_objective', async () => {
    payloadCache('w10').clear();
    const host = document.body.appendChild(document.createElement('div'));
    const app = fakeApp([{ day: 1, minute: 420, kind: 'choice', id: 'j1.phone', option: 'take' }]);
    const deps = testDeps({ sink: app.save });
    const screen = createStreetScreen(app.ctx, app.payload, deps);
    await screen.mount(host);
    deps.frames.step(16);
    expect(q('[data-kit="phone"]'), 'pas d\'accueil du J1 à la reprise').toBeNull();
    expect(q('[data-ui="objective"]')!.textContent).toContain(FR['w10.goal.1']);
    const m0 = (screen.runtime() as unknown as { driver: { state(): { live: { clock: { minute: number } } } } }).driver.state().live.clock.minute;
    for (let i = 0; i < 240; i++) deps.frames.step(50);
    expect((screen.runtime() as unknown as { driver: { state(): { live: { clock: { minute: number } } } } }).driver.state().live.clock.minute, 'une ligne de première apparition n\'arrête pas l\'horloge').toBeGreaterThan(m0);
    screen.unmount(); host.remove();
  });
});

describe('runtime : ligne de première apparition', () => {
  it('test_runtime_letter_line_closes_when_the_evening_scene_opens', async () => {
    payloadCache('w10').clear();
    const host = document.body.appendChild(document.createElement('div'));
    const app = fakeApp([{ day: 1, minute: 420, kind: 'choice', id: 'j1.phone', option: 'take' }]);
    const deps = testDeps({ sink: app.save });
    const screen = createStreetScreen(app.ctx, app.payload, deps);
    await screen.mount(host);
    const rt = screen.runtime() as unknown as { driver: { state(): { live: { clock: { minute: number } } } }; player(): { x: number; z: number } };
    deps.frames.step(16);
    expect(q('[data-kit="letter"]'), 'au logement, la lettre n\'est pas là : elle est au banc [playtest 2026-11-03]').toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));   // vers le banc de Théodore, à l'ouest (x -6, z +34)
    for (let i = 0; i < 200 && rt.player().x > -4.2; i++) deps.frames.step(50);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    deps.frames.step(16);
    expect(q('[data-kit="letter"]'), 'devant le banc, la lettre est présentée le J1 : sa ligne passe').not.toBeNull();
    let n = 0;
    while (rt.driver.state().live.clock.minute < ctx.street.moments.eveningMinute && n++ < 200_000) deps.frames.step(50);
    deps.frames.step(16);
    expect(q('[data-ui="evening-scene"]')).not.toBeNull();
    expect(q('[data-ui="welcome"]'), 'le soir ferme la ligne restée ouverte').toBeNull();
    screen.unmount(); host.remove();
  });
});
