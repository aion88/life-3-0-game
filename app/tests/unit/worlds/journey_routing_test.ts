import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { parseHeadlines } from '../../../src/data/schema/headlines';
import headlines from '../../../src/data/headlines.json';
import { arrivalOutcome } from '../../../src/fastforward/arrival';
import { runFastForward } from '../../../src/fastforward/run';
import { SHORT_WORLDS, shortMode } from '../../../src/worlds/routing';
import { ans } from '../../support/answers';
import { contributions, alternative } from '../../../src/worlds/explain';
import type { WorldVector, QuestionKey } from '../../../src/shared/types';
const core = loadCore();
const h = parseHeadlines(headlines);

describe('computed destination becomes the lived short world', () => {
  it.each(SHORT_WORLDS)('%s never falls back to 1984', id => {
    const vector = core.catalogue.byId[id].vector as WorldVector;
    expect(arrivalOutcome(vector, { ...core, build: { ...core.build, streetWorlds: SHORT_WORLDS } })).toMatchObject({ computedWorld: id, livedWorld: id, redirected: false });
  });
  it('uses actual questionnaire result and preserves legacy routing and extinction', () => {
    const old = runFastForward(core, h, ans('AAAAAAAAAAA'), false);
    const next = runFastForward(core, h, ans('AAAAAAAAAAA'), false, SHORT_WORLDS);
    expect(next.trajectory).toEqual(old.trajectory);
    expect(next.outcome.kind).toBe('arrival');
    if (next.outcome.kind === 'arrival' && old.outcome.kind === 'arrival') {
      expect(next.outcome.livedWorld).toBe(next.outcome.computedWorld);
      expect(next.outcome.computedWorld).toBe(old.outcome.computedWorld);
      expect(old.outcome.livedWorld).toBe('w10');
    }
    expect(runFastForward(core, h, ans('CBCCBDBACCD'), false, SHORT_WORLDS).outcome).toEqual(runFastForward(core, h, ans('CBCCBDBACCD'), false).outcome);
  });
  it('explains recorded answers and computes rather than invents counterfactuals', () => {
    const answers = ans('AAAAAAAAAAA');
    for (const c of contributions(core, answers, ['freedom','surveillance'])) expect(c.answer).toBe(answers[c.question]);
    const changed = alternative(core, answers, 'Q11' as QuestionKey, 'w04');
    if (changed) {
      const run = runFastForward(core, h, { ...answers, Q11: changed.answer } as typeof answers, false, SHORT_WORLDS);
      expect(run.outcome.kind === 'arrival' ? run.outcome.computedWorld : run.outcome.world).toBe(changed.world);
    }
    expect(shortMode('')).toBe(true); expect(shortMode('?nouvelle')).toBe(true); expect(shortMode('?episode=court')).toBe(true); expect(shortMode('?episode=semaine')).toBe(false);
  });
});
