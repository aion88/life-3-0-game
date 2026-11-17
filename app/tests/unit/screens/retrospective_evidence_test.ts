/** Annual evidence preserves actual news and distinguishes pushes from observed changes. */
import { describe, expect, it } from 'vitest';
import { loadUi } from '../../../src/data/ui/load';
import { planFastForward } from '../../../src/screens/fastforward';
import { retrospectiveYears } from '../../../src/screens/fastforward/retrospective';
import { core, H, LINES, runLine, shownOf } from '../../support/screens_ff';

describe('single-screen retrospective evidence', () => {
  it('uses exactly the selected headlines, without adding generic movement news', () => {
    for (const line of Object.values(LINES)) {
      const run = runLine(line); const plan = planFastForward(run, shownOf(run), loadUi().timing, core.engine, H);
      const years = retrospectiveYears(core, run, plan, H);
      expect(years.map(y => y.year)).toEqual(plan.fronts.map(f => f.year));
      expect(years.flatMap(y => y.news.map(h => h.id))).toEqual(plan.headlines.map(h => h.id));
      for (const year of years) expect(year.news.every(h => h.year === year.year)).toBe(true);
    }
  });
  it('quotes selected answers and their configured contribution on relevant axes', () => {
    const run = runLine(LINES.w10); const plan = planFastForward(run, shownOf(run), loadUi().timing, core.engine, H);
    const years = retrospectiveYears(core, run, plan, H);
    expect(years.some(y => y.selected !== null)).toBe(true);
    for (const year of years) {
      const chosen = year.selected; if (!chosen) continue;
      expect(chosen.answer).toBe(run.answers[chosen.question]);
      const answer = core.questionnaire.questions.find(q => q.key === chosen.question)!.answers.find(a => a.key === chosen.answer)!;
      for (const delta of chosen.deltas) {
        expect(year.axes).toContain(delta.axis);
        expect(delta.value).toBe(answer.push[delta.axis] / 1000);
      }
      for (const change of year.changes) expect(change.delta).toBeCloseTo(change.to - change.from, 8);
    }
  });
  it('different selected answers produce different annual evidence', () => {
    const evidence = (line: string) => {
      const run = runLine(line); const plan = planFastForward(run, shownOf(run), loadUi().timing, core.engine, H);
      return retrospectiveYears(core, run, plan, H).map(year => ({ news: year.news.map(h => h.id), changes: year.changes, selected: year.selected }));
    };
    expect(evidence(LINES.w10)).not.toEqual(evidence(LINES.redirected));
  });
  it('does not restore filtered rupture headlines in softened runs', () => {
    const run = runLine(LINES.w07, true); const plan = planFastForward(run, shownOf(run), loadUi().timing, core.engine, H);
    const years = retrospectiveYears(core, run, plan, H);
    expect(plan.hiddenYear).not.toBeNull();
    expect(years.flatMap(y => y.conditions).some(c => c.kind === 'rupture')).toBe(false);
    expect(years.flatMap(y => y.news).every(h => plan.headlines.some(kept => kept.id === h.id))).toBe(true);
  });
});
