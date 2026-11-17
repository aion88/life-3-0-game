// @vitest-environment happy-dom
/**
 * Écran fast-forward : pause, vitesse, auto, onglet caché, arrivée, silence, unes, masque adouci, reprise [plan 03 T5 ; GDD 02 §3.8, §3.9, F17].
 * Les instants viennent du plan (jeton `timing.fastForward.toChoiceSec`, Cynthia 2026-11-03), jamais d'un nombre de secondes écrit ici.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProductionWorldLoader } from '../../../src/data/load';
import { loadUi } from '../../../src/data/ui/load';
import { createFastForwardScreen, planFastForward } from '../../../src/screens/fastforward';
import { createInstantAnimator, type Animator } from '../../../src/ui/motion';
import type { AppContext } from '../../../src/app/shell';
import type { RunResult } from '../../../src/shared/types/run';
import { ans } from '../../support/answers';
import { actsOfProfile } from '../../support/profile_acts';
import { fakeCanvas2d, fakeCtx, mountScreen } from '../../support/screens';
import { H, LINES, advance, core, manualFrames, runLine, shownOf } from '../../support/screens_ff';
import { saveWith } from '../../support/street_screen';
import { pseudoI18n, realI18n, visibleTexts } from '../../support/street_ui';

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}
afterEach(() => { setHidden(false); vi.restoreAllMocks(); });

interface Opts { softened?: boolean; phase?: 'fastforward' | 'street' | 'bilan'; acts?: ReturnType<typeof actsOfProfile>; i18n?: AppContext['i18n']; reducedMotion?: boolean; animator?: Animator }

/** Instants du plan, en ms d'écran à ×1. */
function msOf(line: string, softened = false) {
  const run = runLine(line, softened);
  const plan = planFastForward(run, shownOf(run), loadUi().timing, core.engine, H);
  return { plan, steps: plan.stepsEndSec * 1000, total: plan.totalSec * 1000, front: (year: number): number => plan.fronts.find((f) => f.year === year)!.shownAtSec * 1000 };
}

async function setup(line: string, o: Opts = {}) {
  history.replaceState(null, '', '?episode=semaine');
  const frames = manualFrames();
  const rec = fakeCanvas2d();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(rec.ctx as never);
  const { save } = saveWith(o.acts ?? []);
  save.update({ answers: ans(line), softened: o.softened ?? false, phase: o.phase ?? 'fastforward', lang: 'fr' });
  const ctx = fakeCtx({ save, i18n: o.i18n ?? realI18n('fr'), worlds: createProductionWorldLoader(core.catalogue) });
  const factory = createFastForwardScreen({ frames, reducedMotion: o.reducedMotion ?? false, ...(o.animator ? { animator: o.animator } : {}) });
  const { screen, root } = await mountScreen(factory, ctx, { answers: ans(line) });
  const q = (id: string): HTMLElement | null => root.querySelector(`[data-testid="${id}"]`);
  const year = (): string => q('ff-year')?.textContent ?? '';
  const une = (): HTMLElement | null => root.querySelector('[data-testid="ff-une"]');
  const front = (): string => une()?.textContent ?? '';
  const navigations = (): unknown[][] => ctx.navigate.mock.calls as unknown[][];
  /** Avance de `realMs` par images de `frameMs` et rend la suite des unes vues (année et texte), sans doublon consécutif. */
  const watch = (realMs: number, frameMs = 50): string[] => {
    const seen: string[] = [];
    for (let left = realMs; left > 0; left -= frameMs) {
      advance(frames, Math.min(frameMs, left), frameMs);
      const u = une();
      const k = u === null ? '' : `${u.dataset['year']}|${u.textContent}`;
      if (k !== '' && seen.at(-1) !== k) seen.push(k);
    }
    return seen;
  };
  return { frames, rec, ctx, save, screen, root, q, year, une, front, watch, navigations };
}
const snapshot = (s: Awaited<ReturnType<typeof setup>>): string => JSON.stringify([s.year(), s.front(), s.q('ff-arrival') !== null]);

describe('onglet caché [F17]', () => {
  it('test_hidden_tab_does_not_skip_fronts', async () => {
    const { steps } = msOf(LINES.w07);
    const s = await setup(LINES.w07);
    advance(s.frames, steps * 0.3);
    const before = snapshot(s);
    setHidden(true);
    advance(s.frames, 200_000);
    expect(snapshot(s)).toBe(before);
    expect(s.navigations()).toHaveLength(0);
    setHidden(false);
    advance(s.frames, 50);
    const ref = await setup(LINES.w07);
    advance(ref.frames, steps * 0.3);
    expect(s.front()).toBe(ref.front());
    expect(ref.front()).not.toBe('');
  });
});

describe('la suite : clic ou Espace [team-lead 2026-11-03]', () => {
  const space = (): void => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); };

  it('test_space_jumps_to_the_next_front_then_to_arrival_then_to_the_street', async () => {
    const { plan } = msOf(LINES.w10);
    const s = await setup(LINES.w10);
    advance(s.frames, 100);
    const years: string[] = [];
    for (let i = 0; i < plan.fronts.length; i++) { space(); years.push(s.une()?.dataset['year'] ?? ''); }
    expect(years).toEqual(plan.fronts.map((f) => String(f.year)));
    space();
    expect(s.q('ff-arrival')).not.toBeNull();
    expect(s.navigations()).toHaveLength(0);
    space();
    expect(s.navigations().map((n) => n[0])).toEqual(['street']);
    expect(s.save.load().data.phase).toBe('street');
  });

  it('test_click_on_the_screen_jumps_like_space', async () => {
    const s = await setup(LINES.w10);
    advance(s.frames, 100);
    (s.root.querySelector('[data-ui="fastforward"]') as HTMLElement).click();
    expect(s.une()?.dataset['year']).toBe('2027');
    (s.root.querySelector('[data-ui="fastforward"]') as HTMLElement).click();
    expect(s.une()?.dataset['year']).toBe('2028');
  });

  it('test_skip_never_shortens_the_extinction_silence', async () => {
    const { total, steps } = msOf(LINES.w07);
    const s = await setup(LINES.w07);
    for (let i = 0; i < 20; i++) space();
    expect(s.q('ff-year')!.textContent).toBe('2031');
    advance(s.frames, total - steps - 100);
    expect(s.navigations()).toHaveLength(0);
    advance(s.frames, 200);
    expect(s.navigations().map((n) => n[0])).toEqual(['causes']);
  });

  it('test_skip_does_nothing_while_the_tab_is_hidden_and_after_unmount', async () => {
    const s = await setup(LINES.w10);
    setHidden(true);
    space();
    expect(s.une()).toBeNull();
    setHidden(false);
    s.screen.unmount();
    space();
    expect(s.navigations()).toHaveLength(0);
  });

  it('test_no_controls_left_on_the_screen', async () => {
    const s = await setup(LINES.w10);
    expect(s.root.querySelectorAll('button')).toHaveLength(0);
    for (const id of ['ff-pause', 'ff-speed', 'ff-mode', 'ff-continue']) expect(s.q(id)).toBeNull();
    expect(s.q('ff-next')!.textContent).toBe(realI18n('fr').t('ff.ui.next'));
  });
});

describe('durée (team-lead 2026-11-03, révisable par Cynthia : 2 s par une)', () => {
  it('test_ff_shows_each_front_2s_and_reaches_2030_arrival_at_8s_at_x1', async () => {
    const { plan, front } = msOf(LINES.w10);
    const years = [2027, 2028, 2029, 2030];
    expect(plan.fronts.map((f) => f.year)).toEqual(years);
    const s = await setup(LINES.w10);
    let now = 0;
    for (const y of years) {
      const until = y < 2030 ? front(y + 1) : plan.stepsEndSec * 1000;
      expect(until - front(y)).toBeCloseTo(y < 2030 ? 2_000 : 2_000 * 11 / 12, 6);   // 2 s par une ; 2030 sort au 1er pas de l'année et cède à l'arrivée au pas `choiceStep`
      advance(s.frames, front(y) + 50 - now); now = front(y) + 50;
      expect(s.une()?.getAttribute('data-year')).toBe(String(y));
      advance(s.frames, until - 100 - now); now = until - 100;
      expect(s.une()?.getAttribute('data-year')).toBe(String(y));   // toujours là juste avant la suivante
    }
    expect(plan.stepsEndSec).toBeCloseTo(8, 9);
    advance(s.frames, 200);
    expect(s.year()).toBe('2030');
    expect(s.q('ff-arrival')).not.toBeNull();
  });
});

describe('arrivée', () => {
  it('test_auto_mode_advances_without_gesture_when_not_redirected', async () => {
    const { total } = msOf(LINES.w10);
    const s = await setup(LINES.w10);
    advance(s.frames, total - 100);
    expect(s.navigations()).toHaveLength(0);
    advance(s.frames, 200);
    expect(s.navigations()).toHaveLength(1);
    expect(s.navigations()[0]![0]).toBe('street');
    expect((s.navigations()[0]![1] as { run: RunResult }).run).toEqual(runLine(LINES.w10));
    expect(s.save.load().data.phase).toBe('street');
  });

  it('test_not_redirected_arrival_hold_is_5000ms', async () => {
    const { steps } = msOf(LINES.w10);
    const s = await setup(LINES.w10);
    advance(s.frames, steps + 50);
    expect(s.q('ff-arrival')).not.toBeNull();
    advance(s.frames, 4_800);
    expect(s.navigations()).toHaveLength(0);
    advance(s.frames, 200);
    expect(s.navigations()).toHaveLength(1);
  });

  it('test_arrival_panel_replaces_the_2030_front', async () => {
    const { steps, front } = msOf(LINES.w10);
    const s = await setup(LINES.w10);
    advance(s.frames, front(2030) + 50);
    expect(s.une()?.dataset['year']).toBe('2030');
    advance(s.frames, steps - front(2030));
    expect(s.une()).toBeNull();
    expect(s.q('ff-arrival')).not.toBeNull();
  });

  it('test_arrival_shows_world_text_and_offset_lines', async () => {
    const { steps } = msOf(LINES.redirected);
    const s = await setup(LINES.redirected);
    advance(s.frames, steps + 500);
    const text = s.q('ff-arrival')!.textContent ?? '';
    const t = realI18n('fr');
    expect(text).toContain(t.t('ff.arrival.lead'));
    expect(text).toContain(t.t('world.w10.name'));
    expect(text).toContain(t.t('ff.arrival.offset.surveillance.up'));
    expect(text).toContain(t.t('ff.arrival.offset.aiPower.down'));
    expect(text.indexOf(t.t('ff.arrival.offset.surveillance.up'))).toBeLessThan(text.indexOf(t.t('ff.arrival.offset.aiPower.down')));
  });

  it('test_redirected_arrival_shows_d140_line', async () => {
    const { steps } = msOf(LINES.redirected);
    const s = await setup(LINES.redirected);
    advance(s.frames, steps + 500);
    const run = runLine(LINES.redirected);
    if (run.outcome.kind !== 'arrival') throw new Error('arrivée attendue');
    const t = realI18n('fr');
    expect(s.q('ff-arrival')!.textContent).toContain(t.t('redirect.arrival', {
      computed: t.t(`world.${run.outcome.computedWorld}.name`), lived: t.t(`world.${run.outcome.livedWorld}.name`),
    }));
    const plain = await setup(LINES.w10);
    advance(plain.frames, steps + 500);
    expect(plain.q('ff-arrival')!.textContent).not.toContain(t.t('redirect.arrival', { computed: 'x', lived: 'y' }).slice(0, 10));
  });

  it('test_redirected_arrival_in_auto_mode_continues_without_gesture', async () => {
    const { total } = msOf(LINES.redirected);
    const s = await setup(LINES.redirected);
    advance(s.frames, total + 100);
    expect(s.navigations().map((n) => n[0])).toEqual(['street']);
  });

});

describe('extinction et silence', () => {
  it('test_extinction_is_never_redirected_and_has_no_redirect_line', async () => {
    const s = await setup(LINES.w07);
    advance(s.frames, msOf(LINES.w07).steps + 3_000);
    const t = realI18n('fr');
    expect(s.root.textContent).not.toContain(t.t('redirect.arrival', { computed: 'x', lived: 'y' }).slice(0, 10));
    expect(s.q('ff-arrival')).toBeNull();
  });

  it('test_silence_closes_extinction_run_before_causes', async () => {
    const { total } = msOf(LINES.w07);
    const s = await setup(LINES.w07);
    advance(s.frames, total - 100);
    expect(s.navigations()).toHaveLength(0);
    advance(s.frames, 200);
    expect(s.navigations().map((n) => n[0])).toEqual(['causes']);
    expect((s.navigations()[0]![1] as { run: RunResult }).run).toEqual(runLine(LINES.w07));
    expect(s.save.load().data.phase).toBe('fastforward');
  });

  it('test_w12_extinction_ends_at_its_planned_total', async () => {
    const { total } = msOf(LINES.w12);
    const s = await setup(LINES.w12);
    advance(s.frames, total - 100);
    expect(s.navigations()).toHaveLength(0);
    advance(s.frames, 150);
    expect(s.navigations().map((n) => n[0])).toEqual(['causes']);
  });

});

describe('unes [Cynthia 2026-11-03 ; direction C, objet du régime]', () => {
  it('test_one_front_per_year_each_with_its_year_and_a_headline', async () => {
    const s = await setup(LINES.w10);
    const seen = s.watch(msOf(LINES.w10).steps - 50, 10);
    expect(seen.map((k) => k.split('|')[0])).toEqual(['2027', '2028', '2029', '2030']);
    const t = realI18n('fr');
    for (const k of seen) expect(k).toContain(t.t('causes.ui.edition'));
  });

  it('test_front_is_a_newspaper_front_page_masthead_date_title_image_and_subtitles', async () => {
    const { front } = msOf(LINES.w10);
    const s = await setup(LINES.w10);
    advance(s.frames, front(2027) + 50);
    const u = s.une()!;
    const t = realI18n('fr');
    expect(u.classList.contains('c-card')).toBe(true);
    expect(['a', 'b']).toContain(u.dataset['tilt']);
    expect(u.querySelector('.ff-une__name')!.textContent).toBe(t.t('ff.une.masthead'));
    expect(u.querySelector('.ff-une__date')!.textContent).toContain(t.t('causes.ui.edition'));
    expect(u.querySelector('.ff-une__date [data-ff="year"]')!.textContent).toBe('2027');
    expect(u.querySelector('h2.ff-une__lead')!.textContent).not.toBe('');
    const img = u.querySelector('.ff-une__img')!;
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.querySelector('img')).toBeNull();
    const subs = u.querySelectorAll('.ff-une__sub');
    expect(subs.length).toBeGreaterThanOrEqual(2);
    expect(subs.length).toBeLessThanOrEqual(3);
  });

  it('test_front_lines_are_the_plan_lines_of_the_year', async () => {
    const { plan, front } = msOf(LINES.w07);
    const s = await setup(LINES.w07);
    const t = realI18n('fr');
    let at = 0;
    for (const f of plan.fronts) {
      advance(s.frames, front(f.year) + 20 - at, 10);
      at = front(f.year) + 20;
      const ids = [...s.une()!.querySelectorAll('[data-line]')].map((e) => (e as HTMLElement).dataset['line']);
      expect(ids, String(f.year)).toEqual(f.lines.map((l) => l.id));
      for (const l of f.lines) if (l.variantKind === null) expect(s.front()).toContain(t.t(l.key));
    }
  });

  it('test_front_enters_with_card_in_motion_and_reduced_motion_is_a_fade_of_at_most_120ms', async () => {
    const full = createInstantAnimator();
    const a = await setup(LINES.w10, { animator: full });
    advance(a.frames, msOf(LINES.w10).front(2027) + 50);
    expect(full.played()).toHaveLength(1);
    expect(JSON.stringify(full.played()[0]!.spec.keyframes)).toContain('scale');
    const red = createInstantAnimator();
    const b = await setup(LINES.w10, { animator: red, reducedMotion: true });
    b.watch(msOf(LINES.w10).steps, 50);
    expect(red.played().length).toBe(4);
    for (const { spec } of red.played()) {
      expect(spec.options.duration).toBeLessThanOrEqual(loadUi().timing.juice.reducedMaxMs.v);
      expect(JSON.stringify(spec.keyframes)).not.toMatch(/transform|scale|rotate/);
    }
  });

  it('test_fronts_empty_four_seconds_after_the_last_front_on_an_extinction', async () => {
    const { front, plan } = msOf(LINES.w07);
    const last = plan.fronts.at(-1)!.year;
    const clear = Math.max(plan.stepsEndSec * 1000, front(last) + 4_000);
    const s = await setup(LINES.w07);
    advance(s.frames, clear - 100);
    expect(s.une()).not.toBeNull();
    advance(s.frames, 200);
    expect(s.une()).toBeNull();
    advance(s.frames, 5_000);
    expect(s.une()).toBeNull();
  });
});

describe('masque adouci [GDD 02 §3.10 ; GDD 06 B-V10]', () => {
  const sweep = async (softened: boolean): Promise<{ texts: string[]; fronts: string[] }> => {
    const s = await setup(LINES.w07, { softened });
    const texts: string[] = [];
    const fronts: string[] = [];
    for (let i = 0; i < 500; i++) {
      advance(s.frames, 50);
      texts.push(s.root.textContent ?? '');
      fronts.push(s.front());
    }
    return { texts, fronts };
  };

  it('test_softened_hides_the_rupture_headline', async () => {
    const full = await sweep(false);
    const soft = await sweep(true);
    expect(full.fronts.some((j) => j.includes('communications'))).toBe(true);
    expect(soft.fronts.some((j) => j.includes('communications'))).toBe(false);
  });

  it('test_b_v10_softened_year_string_absent_from_extinction_screen', async () => {
    const full = await sweep(false);
    const soft = await sweep(true);
    expect(full.texts.some((x) => x.includes('2031'))).toBe(true);
    expect(soft.texts.every((x) => !x.includes('2031'))).toBe(true);
    expect(soft.texts.some((x) => x.includes('2030'))).toBe(true);
  });

  it('test_softened_cuts_last_3s_of_w07_silence', async () => {
    const { total } = msOf(LINES.w07, true);
    const s = await setup(LINES.w07, { softened: true });
    advance(s.frames, total - 100);
    expect(s.navigations()).toHaveLength(0);
    advance(s.frames, 200);
    expect(s.navigations().map((n) => n[0])).toEqual(['causes']);
  });

  it('test_softened_keeps_the_steps_of_the_year_counter', async () => {
    const { steps } = msOf(LINES.w07);
    const full = await setup(LINES.w07);
    const soft = await setup(LINES.w07, { softened: true });
    advance(full.frames, steps * 0.6);
    advance(soft.frames, steps * 0.6);
    expect(soft.year()).toBe(full.year());
  });
});

describe('texte des unes', () => {
  it('test_no_number_text_in_fronts_beyond_year', async () => {
    for (const line of [LINES.w07, LINES.w10, LINES.redirected, LINES.w12]) {
      const s = await setup(line);
      let checked = 0;
      for (let i = 0; i < 200; i++) {
        advance(s.frames, 50);
        const u = s.une();
        if (u === null) continue;
        checked++;
        const own = [...u.querySelectorAll('[data-line]')].map((e) => e.textContent ?? '').join(' ');
        expect(own, own).not.toMatch(/\d/);
        expect(u.querySelector('[data-ff="year"]')?.textContent).toMatch(/^20\d\d$/);
      }
      expect(checked).toBeGreaterThan(0);
    }
  });

  it('test_variant_marks_are_filled_from_the_variant_tables', async () => {
    const s = await setup(LINES.w07);
    const seen = s.watch(msOf(LINES.w07).steps, 10);
    expect(seen.join(' ')).not.toMatch(/[{}]/);
  });
});

describe('rendu', () => {
  it('test_no_hardcoded_text_every_visible_text_goes_through_i18n', async () => {
    const { steps, front } = msOf(LINES.redirected);
    for (const at of [front(2028) + 50, steps + 500]) {
      const s = await setup(LINES.redirected, { i18n: pseudoI18n('fr') });
      advance(s.frames, at);
      const texts = visibleTexts(s.root, '[data-ff="year"]');
      expect(texts.length).toBeGreaterThan(3);
      for (const x of texts) expect(x, x).toContain('[!!');
    }
  });

  it('test_triptych_is_drawn_from_the_screen_clock_not_its_own_loop', async () => {
    const s = await setup(LINES.w10);
    expect(s.frames.pending()).toBe(1);
    advance(s.frames, 3_000);
    expect(s.rec.calls().length).toBeGreaterThan(0);
    expect(s.frames.pending()).toBe(1);
  });

  it('test_unmount_stops_the_loop_and_further_frames_do_nothing', async () => {
    const s = await setup(LINES.w10);
    advance(s.frames, 1_000);
    s.screen.unmount();
    expect(s.frames.pending()).toBe(0);
    s.frames.step(100_000);
    expect(s.navigations()).toHaveLength(0);
  });

});

describe('reprise [décision 6]', () => {
  it('test_resume_street_navigates_without_animation', async () => {
    const s = await setup(LINES.w10, { phase: 'street' });
    expect(s.navigations()).toHaveLength(1);
    expect(s.navigations()[0]![0]).toBe('street');
    expect((s.navigations()[0]![1] as { run: RunResult }).run).toEqual(runLine(LINES.w10));
    expect(s.frames.pending()).toBe(0);
    expect(s.q('ff-year')).toBeNull();
    expect(s.save.load().data.phase).toBe('street');
  });

  it('test_resume_bilan_rebuilds_input_and_navigates', async () => {
    const acts = actsOfProfile('Zéro nom', { audition: 'none' });
    const s = await setup(LINES.w10, { phase: 'bilan', acts });
    expect(s.navigations()).toHaveLength(1);
    const [id, payload] = s.navigations()[0]! as ['bilan', { input: { entry: string; week: unknown; acts: unknown[]; run: RunResult } }];
    expect(id).toBe('bilan');
    expect(payload.input.entry).toBe('weekEnd');
    expect(payload.input.week).not.toBeNull();
    expect(payload.input.acts).toEqual(acts);
    expect(payload.input.run).toEqual(runLine(LINES.w10));
    expect(s.frames.pending()).toBe(0);
  });

  it('test_resume_bilan_with_empty_acts_navigates_with_week_null_not_crash', async () => {
    const s = await setup(LINES.w10, { phase: 'bilan', acts: [] });
    const [id, payload] = s.navigations()[0]! as ['bilan', { input: { week: unknown; survival: unknown; acts: unknown[] } }];
    expect(id).toBe('bilan');
    expect(payload.input.week).toBeNull();
    expect(payload.input.survival).toBeNull();
    expect(payload.input.acts).toEqual([]);
  });

  it('test_resume_applies_the_saved_softened_flag_to_the_run', async () => {
    const s = await setup(LINES.w10, { phase: 'street', softened: true });
    expect((s.navigations()[0]![1] as { run: RunResult }).run.softened).toBe(true);
  });

  it('test_resume_fastforward_phase_plays_the_screen', async () => {
    const s = await setup(LINES.w10, { phase: 'fastforward' });
    expect(s.navigations()).toHaveLength(0);
    expect(s.q('ff-year')).not.toBeNull();
  });
});
