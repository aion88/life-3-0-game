import { describe, expect, it } from 'vitest';
import headlinesRaw from '../../../src/data/headlines.json';
import { loadCore } from '../../../src/data/load';
import { parseHeadlines } from '../../../src/data/schema/headlines';
import { runFastForward } from '../../../src/fastforward/run';
import { extinctionSeconds, timelineSeconds } from '../../../src/fastforward/timeline';
import { canonicalJson } from '../../../src/shared/canonical';
import { runSeed } from '../../../src/shared/seed';
import { ans } from '../../support/answers';
import { expectSameTwice } from '../../support/determinism';
import { runOf } from '../../support/run';

const core = loadCore();
const E = core.engine;
const H = parseHeadlines(headlinesRaw);

describe('runFastForward', () => {
  it('test_run_w10_line', () => {
    const r = runOf('ACBACBACAAD');
    expect(r.outcome).toMatchObject({ kind: 'arrival', computedWorld: 'w10', livedWorld: 'w10' });
    expect(r.trajectory.steps.length).toBe(49);
    expect(r.seed).toBe(runSeed(ans('ACBACBACAAD')));
  });

  it('test_run_w07_extinction', () => {
    expect(runOf('CBCCBDBACCD').outcome).toEqual({ kind: 'extinction', world: 'w07', runStartStep: 37, ruptureStep: 60 });
    expect(runOf('CBCCBDBACCD').trajectory.steps.length).toBe(61);
  });

  it('test_result_frozen_and_deterministic', () => {
    const input = ans('CBCCBDDACCD');
    const r = expectSameTwice(() => runFastForward(core, H, input, false));
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.trajectory.steps)).toBe(true);
    expect(Object.isFrozen(r.trajectory.steps[0])).toBe(true);
    expect(Object.isFrozen(r.headlines)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false); // errata T6 D16 : la copie est gelée, jamais l'objet de l'appelant
    // R-01.7 : passe canonicalJson sans perte
    expect(() => canonicalJson(r)).not.toThrow();
    expect(JSON.parse(canonicalJson(r))).toEqual(r);
  });

  it('test_softened_changes_nothing_else', () => {
    const a = runFastForward(core, H, ans('CBCCBDDACCD'), false);
    const b = runFastForward(core, H, ans('CBCCBDDACCD'), true);
    expect({ ...b, softened: false }).toEqual(a);
  });

  it('test_f16_durations', () => {
    expect(timelineSeconds(runOf('ACBACBACAAD'), E)).toBe(61); // [GDD 02 F16, §3.8, formule Task 6]
    expect(timelineSeconds(runOf('CBCCBDBACCD'), E)).toBe(78); // [GDD 02 F16, §3.8, formule Task 6]
    expect(timelineSeconds(runOf('CBCCBDDACCD'), E)).toBeCloseTo(83.8333, 4); // [GDD 02 F16, §3.8, formule Task 6]
    expect(extinctionSeconds(71, E)).toBeCloseTo(84.4167, 4); // [GDD 02 F16, §3.8, formule Task 6]
  });
});
