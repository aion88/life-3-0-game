import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import headlinesRaw from '../../../src/data/headlines.json';
import { DataLoadError } from '../../../src/data/schema/common';
import { parseHeadlines, type HeadlineSet } from '../../../src/data/schema/headlines';
import enStrings from '../../../src/data/strings/en.json';
import frStrings from '../../../src/data/strings/fr.json';
import { arrivalOutcome } from '../../../src/fastforward/arrival';
import { fireHeadlines, scheduleHeadlines } from '../../../src/fastforward/headlines';
import { simulateFastForward } from '../../../src/fastforward/simulate';
import { pushOf } from '../../../src/questionnaire';
import { runSeed } from '../../../src/shared/seed';
import type { HeadlineFire, RunResult } from '../../../src/shared/types/run';
import { ans } from '../../support/answers';

const core = loadCore();
const Q = core.questionnaire;
const E = core.engine;
const H = parseHeadlines(headlinesRaw);
const ffOf = (line: string) => simulateFastForward(pushOf(Q, ans(line)), E);
const fired = (line: string, id: string) => fireHeadlines(ffOf(line), ans(line), H).find((f) => f.id === id)?.firedAtStep ?? null;

/** RunResult minimal local à ce fichier : T5 ne dépend pas de runFastForward (T6) [errata T5, B8]. */
function asRun(line: string, fires?: readonly HeadlineFire[]): RunResult {
  const answers = ans(line);
  const ff = ffOf(line);
  return {
    answers,
    push: pushOf(Q, answers),
    seed: runSeed(answers),
    trajectory: ff.trajectory,
    outcome: ff.extinction ? { kind: 'extinction', ...ff.extinction } : arrivalOutcome(ff.atChoice, core),
    headlines: fires ?? fireHeadlines(ff, answers, H),
    softened: false,
  };
}

const perYear = (shown: readonly { year: number }[]) => {
  const n = new Map<number, number>();
  for (const s of shown) n.set(s.year, (n.get(s.year) ?? 0) + 1);
  return Math.max(0, ...n.values());
};

/** Table forgée : deux titres toujours vrais (aiPower >= 0), priorités 1 et 2. */
function forgedTwoAtStep1(): HeadlineSet {
  const always = [{ kind: 'state', all: [{ var: 'aiPower', cmp: '>=', threshold: 0 }] }];
  const mk = (id: string, priority: number) => ({ id, priority, scope: 'all', when: always, alwaysShown: false, variant: null });
  return parseHeadlines({ ...headlinesRaw, headlines: [mk('forged.a', 1), mk('forged.b', 2)] });
}

function withVar(raw: typeof headlinesRaw, name: string): unknown {
  const copy = structuredClone(raw) as { headlines: { when: { kind: string; all?: { var: string }[] }[] }[] };
  const target = copy.headlines.flatMap((h) => h.when).find((c) => c.kind === 'state' && c.all !== undefined);
  target!.all![0]!.var = name;
  return copy;
}

const headlineStrings = (): string[] =>
  [frStrings, enStrings].flatMap((t) => Object.entries(t).filter(([k]) => k.startsWith('ff.')).map(([, s]) => s as string));

describe('titres du journal [plan 01 T5]', () => {
  it('test_year_delta_reads_step_minus_12', () => {
    expect(fired('CBCCBDBACCD', 'traj.m02')).toBe(12); // aiPower +15,5 en 2027 (45,5 contre 30) [rejoué: lead-programmer, conditions sur la trajectoire de l'oracle]
  });
  it('test_w07_titles_fire_at_replayed_steps', () => { // [rejoué: lead-programmer, conditions sur la trajectoire de l'oracle]
    expect(['w07.ministeres', 'w07.decisions', 'w07.ordres', 'traj.m09', 'traj.m13'].map((id) => fired('CBCCBDBACCD', id)))
      .toEqual([13, 25, 37, 57, 60]);
  });
  it('test_extinction_scope_absent_from_arrival', () => {
    expect(fireHeadlines(ffOf('ACBACBACAAD'), ans('ACBACBACAAD'), H).some((f) => f.id.startsWith('w07.'))).toBe(false);
  });
  it('test_max_two_per_year_model13_always', () => {
    const shown = scheduleHeadlines(asRun('CBCCBDBACCD'), H, E);
    expect(perYear(shown)).toBeLessThanOrEqual(2);
    expect(shown.map((s) => s.id)).toContain('traj.m13');
  });
  it('test_fire_step_distinct_from_shown_time', () => {
    const forged = forgedTwoAtStep1();
    const ff = ffOf('ACBACBACAAD');
    const run = asRun('ACBACBACAAD', fireHeadlines(ff, ans('ACBACBACAAD'), forged));
    const shown = scheduleHeadlines(run, forged, E);
    expect(shown.map((s) => [s.firedAtStep, s.year])).toEqual([[1, 2027], [1, 2027]]);
    expect(shown[1]!.shownAtSec - shown[0]!.shownAtSec).toBeCloseTo(4, 9);
  });
  it('test_f15_no_key_letter_variable_or_percent', () => {
    expect(headlineStrings().length).toBeGreaterThan(0);
    for (const s of headlineStrings()) expect(s).not.toMatch(/\bQ\d{2,3}\b|\b[A-D]\)|aiPower|abundance|freedom|surveillance|unrest|%/);
  });
  it('test_unknown_variable_refused', () => {
    expect(() => parseHeadlines(withVar(headlinesRaw, 'misalignmentDebt'))).toThrow(DataLoadError);
  });
  it('test_variant_tables_same_length_fr_en', () => { // [GDD 02 §3.7] : le même indice désigne la même entité
    for (const kind of ['region', 'n', 'capital'] as const) {
      const count = (t: Record<string, string>) => Object.keys(t).filter((k) => new RegExp(`^ff\\.var\\.${kind}\\.\\d+$`).test(k)).length;
      expect(count(frStrings)).toBe(H.variantSizes[kind]);
      expect(count(enStrings)).toBe(H.variantSizes[kind]);
    }
  });
});
