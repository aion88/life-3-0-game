/** Plan, lignes d'arrivée et cible de reprise de l'écran fast-forward : pur, sans DOM [plan 03 T5 ; GDD 02 §3.7 à §3.10, F16, F17]. */
import { describe, expect, it } from 'vitest';
import { loadUi } from '../../../src/data/ui/load';
import { timelineSeconds, yearOfStep } from '../../../src/fastforward';
import { STEPS_PER_YEAR, screenSecondsOfStep } from '../../../src/fastforward/timeline';
import { arrivalLines, firstStepOfYear, planFastForward, redirectLine, resumeTarget, stepAtSec, yearAtSec } from '../../../src/screens/fastforward';
import { WORLD_VARS } from '../../../src/shared/types/world';
import { loadFastForwardData } from '../../../src/screens/data';
import { core, H, LINES, runLine, shownOf } from '../../support/screens_ff';
import { saveWith } from '../../support/street_screen';

const timing = loadUi().timing;
const planOf = (line: string, softened = false) => {
  const run = runLine(line, softened);
  return { run, plan: planFastForward(run, shownOf(run), timing, core.engine, H) };
};

describe('chargeur de données', () => {
  it('test_loader_returns_validated_headlines_and_causes_once', () => {
    const a = loadFastForwardData();
    expect(a.headlines.headlines.length).toBeGreaterThan(0);
    expect(a.causes).toBeDefined();
    expect(loadFastForwardData()).toBe(a);
  });
});

describe('cadence (team-lead 2026-11-03, révisable par Cynthia)', () => {
  it('test_ff_duration_token_is_sourced_to_team_lead_and_gives_2s_per_front', () => {
    const tok = timing.fastForward.toChoiceSec;
    expect(tok.status).toBe('sourced');
    expect(tok.src).toContain('team-lead 2026-11-03, révisable par Cynthia');
    const { plan } = planOf(LINES.w10);
    expect(plan.pace.mainSecPerYear).toBeCloseTo(2, 9);   // une une par année : 2 s pour lire le gros titre
    expect(plan.fronts.map(f => f.year)).toEqual([2027, 2028, 2029, 2030]);
    expect(plan.stepsEndSec).toBeCloseTo(8, 9);
  });

  it('test_ff_reaches_2030_in_the_token_seconds_and_extinction_keeps_half_rate', () => {
    const { plan } = planOf(LINES.w10);
    expect(plan.stepsEndSec).toBeCloseTo(timing.fastForward.toChoiceSec.v, 9);
    expect(plan.pace.extinctionSecPerYear).toBeCloseTo(plan.pace.mainSecPerYear / 2, 9);
  });
});

describe('plan', () => {
  it('test_plan_total_seconds_matches_timeline_seconds_at_the_screen_pace', () => {
    const T = timing.fastForward.toChoiceSec.v;
    const ext = (r: number): number => T + ((r - 48) * T) / 8 / STEPS_PER_YEAR;   // 7/14 du rythme principal, T/4 s par année
    for (const [line, total] of [[LINES.w10, T + 5], [LINES.w07, ext(60) + 15], [LINES.w12, ext(70) + 15]] as const) {
      const { run, plan } = planOf(line);
      expect(plan.totalSec).toBeCloseTo(timelineSeconds(run, core.engine, plan.pace), 9);
      expect(plan.totalSec).toBeCloseTo(total, 9);
    }
  });

  it('test_plan_splits_steps_hold_and_silence', () => {
    const T = timing.fastForward.toChoiceSec.v;
    const w10 = planOf(LINES.w10).plan;
    expect([w10.stepsEndSec, w10.holdSec, w10.silenceSec]).toEqual([T, 5, 0]);
    const w07 = planOf(LINES.w07).plan;
    expect(w07.stepsEndSec).toBeCloseTo(T + (12 * T) / 8 / STEPS_PER_YEAR, 9);
    expect([w07.holdSec, w07.silenceSec]).toEqual([0, 15]);
  });

  it('test_year_counter_follows_year_of_step', () => {
    const { plan } = planOf(LINES.w12);
    for (const [step, year] of [[39, 2030], [48, 2030], [60, 2031], [70, 2032]] as const) {
      const sec = screenSecondsOfStep(step, core.engine, true, plan.pace);
      expect(stepAtSec(plan, sec)).toBe(step);
      expect(yearAtSec(plan, sec)).toBe(year);
      expect(yearOfStep(step)).toBe(year);
    }
  });

  it('test_step_never_exceeds_the_last_step_of_the_run', () => {
    const arrival = planOf(LINES.w10).plan;
    expect(stepAtSec(arrival, 1000)).toBe(48);
    expect(stepAtSec(arrival, 0)).toBe(0);
    const ext = planOf(LINES.w07).plan;
    expect(stepAtSec(ext, 1000)).toBe(60);
  });

  it('test_headlines_are_the_scheduled_ones_in_order_dated_by_their_firing_year', () => {
    const run = runLine(LINES.w07);
    const shown = shownOf(run);
    const plan = planFastForward(run, shown, timing, core.engine, H);
    expect(plan.headlines.map((h) => [h.id, h.year])).toEqual(shown.map((h) => [h.id, h.year]));
    expect(plan.headlines.map((h) => h.key)).toEqual(shown.map((h) => `ff.${h.id}`));
    expect(plan.headlines.length).toBeLessThanOrEqual(shown.length);
  });

  it('test_every_planned_headline_key_exists_in_both_languages', async () => {
    const fr = (await import('../../../src/data/strings/fr.json')).default as Record<string, string>;
    const en = (await import('../../../src/data/strings/en.json')).default as Record<string, string>;
    for (const h of H.headlines) { expect(fr[`ff.${h.id}`], h.id).toBeTypeOf('string'); expect(en[`ff.${h.id}`], h.id).toBeTypeOf('string'); }
    for (const kind of ['region', 'n', 'capital'] as const) {
      for (let i = 0; i < H.variantSizes[kind]; i++) { expect(fr[`ff.var.${kind}.${i}`]).toBeTypeOf('string'); expect(en[`ff.var.${kind}.${i}`]).toBeTypeOf('string'); }
    }
  });

  it('test_plan_headline_carries_variant_kind_from_the_data', () => {
    const { plan } = planOf(LINES.w07);
    for (const h of plan.headlines) expect(h.variantKind).toBe(H.headlines.find((x) => x.id === h.id)!.variant);
  });
});

describe('masque adouci', () => {
  it('test_softened_hides_rupture_year_and_last_rupture_headline', () => {
    const full = planOf(LINES.w07).plan;
    const soft = planOf(LINES.w07, true).plan;
    const ruptureIds = H.headlines.filter((h) => h.when.some((c) => c.kind === 'rupture')).map((h) => h.id);
    expect(full.headlines.some((h) => ruptureIds.includes(h.id))).toBe(true);
    expect(soft.headlines.some((h) => ruptureIds.includes(h.id))).toBe(false);
    expect(soft.headlines.length).toBe(full.headlines.length - 1);
    expect(soft.hiddenYear).toBe(2031);
    expect(full.hiddenYear).toBeNull();
  });

  it('test_softened_keeps_every_step_and_the_other_instants', () => {
    const full = planOf(LINES.w07).plan;
    const soft = planOf(LINES.w07, true).plan;
    expect(soft.stepSec).toEqual(full.stepSec);
    expect(soft.fronts.map((f) => f.shownAtSec)).toEqual(full.fronts.map((f) => f.shownAtSec));
  });

  it('test_softened_cuts_last_3s_of_w07_silence', () => {
    expect(planOf(LINES.w07).plan.silenceSec).toBe(15);
    const soft = planOf(LINES.w07, true).plan;
    expect(soft.silenceSec).toBe(12);
    expect(soft.totalSec).toBeCloseTo(planOf(LINES.w07).plan.totalSec - 3, 9);
  });

  it('test_softened_does_not_cut_w12_silence_or_change_an_arrival', () => {
    expect(planOf(LINES.w12, true).plan.silenceSec).toBe(15);
    const arr = planOf(LINES.w10, true).plan;
    expect(arr.totalSec).toBeCloseTo(timing.fastForward.toChoiceSec.v + 5, 9);
    expect(arr.hiddenYear).toBeNull();
  });
});

describe('unes annuelles', () => {
  const ALL = [LINES.w10, LINES.redirected, LINES.w07, LINES.w12];

  it('test_one_front_per_year_from_2027_to_the_last_step_year', () => {
    expect(planOf(LINES.w10).plan.fronts.map((f) => f.year)).toEqual([2027, 2028, 2029, 2030]);
    const w07 = planOf(LINES.w07);
    expect(w07.plan.fronts.map((f) => f.year)).toEqual([2027, 2028, 2029, 2030, 2031]);
  });

  it('test_front_shows_at_the_first_step_of_its_year', () => {
    for (const line of ALL) {
      const { plan } = planOf(line);
      for (const f of plan.fronts) {
        expect(f.shownAtSec).toBe(plan.stepSec[firstStepOfYear(f.year)]);
        expect(yearAtSec(plan, f.shownAtSec)).toBe(f.year);
      }
    }
  });

  const movesOf = (run: ReturnType<typeof runLine>, year: number, last: number): Map<string, string> => {
    const steps = run.trajectory.steps;
    const from = steps[firstStepOfYear(year) - 1]!;
    const to = steps[Math.min(firstStepOfYear(year) + 11, last)]!;
    return new Map(WORLD_VARS.filter((v) => to[v] !== from[v]).map((v) => [v, to[v] > from[v] ? 'up' : 'down']));
  };

  it('test_front_lead_is_the_first_headline_else_a_real_move_and_subs_are_the_second_headline_then_other_moves', () => {
    for (const line of ALL) {
      const { run, plan } = planOf(line);
      const last = plan.stepSec.length - 1;
      for (const f of plan.fronts) {
        const own = plan.headlines.filter((h) => h.year === f.year);
        const moves = movesOf(run, f.year, last);
        const [lead, ...subs] = f.lines;
        expect(f.source).toBe(own.length > 0 ? 'headlines' : 'movement');
        if (own.length > 0) expect(lead!.key).toBe(own[0]!.key);
        if (own.length > 1) expect(subs[0]!.key).toBe(own[1]!.key);
        const moveLines = [...(own.length > 0 ? [] : [lead!]), ...(own.length > 1 ? subs.slice(1) : subs)];
        for (const l of moveLines) {
          if (l.key === 'ff.une.still') { expect(moves.size).toBe(0); continue; }
          const [, , axis, dir] = l.key.split('.');
          expect(moves.get(axis!), `${line} ${f.year} ${l.key}`).toBe(dir);
        }
        const axes = f.lines.filter((l) => l.key.startsWith('ff.une.')).map((l) => l.key.split('.')[2]);
        expect(new Set(axes).size, `${line} ${f.year} : un axe deux fois sur la une`).toBe(axes.length);
        const room = (own.length > 1 ? 1 : 0) + moves.size - (own.length === 0 && moves.size > 0 ? 1 : 0);
        expect(subs.length, `${line} ${f.year}`).toBe(Math.min(3, room));
      }
    }
  });

  it('test_movement_lead_is_the_strongest_move_whose_axis_has_not_led_yet', () => {
    for (const line of ALL) {
      const { run, plan } = planOf(line);
      const steps = run.trajectory.steps;
      const last = plan.stepSec.length - 1;
      const led = new Set<string>();
      for (const f of plan.fronts.filter((x) => x.source === 'movement')) {
        const key = f.lines[0]!.key;
        if (key === 'ff.une.still') continue;
        const axis = key.split('.')[2] as (typeof WORLD_VARS)[number];
        const from = steps[firstStepOfYear(f.year) - 1]!;
        const to = steps[Math.min(firstStepOfYear(f.year) + 11, last)]!;
        const size = (v: (typeof WORLD_VARS)[number]): number => Math.abs(to[v] - from[v]);
        const fresh = WORLD_VARS.filter((v) => !led.has(v) && size(v) > 0);
        if (fresh.length > 0) {
          expect(led.has(axis), `${line} ${f.year}`).toBe(false);
          for (const v of fresh) expect(size(v)).toBeLessThanOrEqual(size(axis));
        }
        led.add(axis);
      }
    }
  });

  it('test_softened_front_of_rupture_year_loses_the_rupture_headline', () => {
    const full = planOf(LINES.w07).plan.fronts.at(-1)!;
    const soft = planOf(LINES.w07, true).plan.fronts.at(-1)!;
    expect(full.lines.map((l) => l.id)).toContain('traj.m13');
    expect(soft.lines.map((l) => l.id)).not.toContain('traj.m13');
  });

  it('test_every_movement_key_exists_in_both_languages_without_digits', async () => {
    const fr = (await import('../../../src/data/strings/fr.json')).default as Record<string, string>;
    const en = (await import('../../../src/data/strings/en.json')).default as Record<string, string>;
    const keys = ['ff.une.still', 'ff.une.masthead', 'ff.ui.next', ...WORLD_VARS.flatMap((v) => [`ff.une.${v}.up`, `ff.une.${v}.down`])];
    for (const k of keys) for (const table of [fr, en]) { expect(table[k], k).toBeTypeOf('string'); expect(table[k], k).not.toMatch(/\d/); }
  });
});

describe('lignes d\'arrivée', () => {
  it('test_arrival_lines_for_offsets', () => {
    const run = runLine(LINES.redirected);
    if (run.outcome.kind !== 'arrival') throw new Error('arrivée attendue');
    expect(run.outcome.offset.axes.map((a) => [a.var, a.signed])).toEqual([['surveillance', 58000], ['aiPower', -25000]]);
    expect(arrivalLines(run.outcome).map((l) => l.key)).toEqual([
      'ff.arrival.offset.surveillance.up', 'ff.arrival.offset.aiPower.down',
    ]);
  });

  it('test_arrival_lines_empty_when_no_offset', () => {
    const run = runLine(LINES.w10);
    if (run.outcome.kind !== 'arrival') throw new Error('arrivée attendue');
    expect(run.outcome.offset.axes).toEqual([]);
    expect(arrivalLines(run.outcome)).toEqual([]);
  });

  it('test_redirect_line_only_when_redirected_and_names_both_worlds', () => {
    const red = runLine(LINES.redirected).outcome;
    const plain = runLine(LINES.w10).outcome;
    if (red.kind !== 'arrival' || plain.kind !== 'arrival') throw new Error('arrivée attendue');
    expect(redirectLine(red)).toEqual({ key: 'redirect.arrival', worlds: { computed: red.computedWorld, lived: red.livedWorld } });
    expect(red.computedWorld).not.toBe(red.livedWorld);
    expect(redirectLine(plain)).toBeNull();
    expect(redirectLine(runLine(LINES.w07).outcome)).toBeNull();
  });
});

describe('reprise', () => {
  it('test_resume_target_by_phase', () => {
    const { save } = saveWith();
    for (const [phase, want] of [['fastforward', 'play'], ['street', 'street'], ['bilan', 'bilan'], ['questionnaire', 'play'], ['new', 'play']] as const) {
      save.update({ phase });
      expect(resumeTarget(save.load().data)).toBe(want);
    }
  });
});
