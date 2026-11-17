import { describe, expect, it } from 'vitest';
import { eveningLines } from '../../../src/engine/moments/evening';
import { replay } from '../../../src/engine/moments/replay';
import { reduceAct } from '../../../src/engine/moments/state';
import { buildLedger } from '../../../src/engine/moments/words';
import full from '../../e2e-street/full-week.json';
import { ctxGuided as ctx, ctxNoGuided, interleave, sceneAct, silentSceneActsJ1J2, stateAt } from '../../support/guided';
import { week0 } from '../../support/street';
import type { ActRecord } from '../../../src/shared/types/street';

const FULL_WEEK_ACTS = full as ActRecord[];

describe('moments : le verbe scene, choix narratif [plan rue guidée J1-J2, T2]', () => {
  it('test_scene_act_adds_option_words_to_spent_only', () => {
    const l = buildLedger(1, [sceneAct(1, 450, 'j1.roux', 'a')], ctx);          // option `a` : 8 mots dans la fixture
    expect(l.wordsSpent).toBe(8);
    expect(l.entries).toEqual([]);
    expect(l.glances + l.orders + l.wordsCredited + l.wordsBought).toBe(0);
  });
  it('test_scene_act_never_adds_survival_entry', () => {
    for (const o of ['a', 'b', 'c']) expect(buildLedger(1, [sceneAct(1, 450, 'j1.roux', o)], ctx).entries).toEqual([]);
  });
  it('test_zero_word_scene_acts_leave_readings_identical', () => {
    const base = replay(FULL_WEEK_ACTS, ctx);
    const withScenes = replay(interleave(FULL_WEEK_ACTS, silentSceneActsJ1J2), ctx);
    expect(withScenes.rejected).toEqual(base.rejected);
    expect(withScenes.state.acts.filter((a) => a.kind === 'scene')).toHaveLength(1);
    expect(withScenes.state.readings).toEqual(base.state.readings);
    expect(withScenes.state.survival).toEqual(base.state.survival);
  });
  it('test_scene_act_rejected_on_wrong_day_or_twice', () => {
    const s1 = stateAt(1, 430), s2 = stateAt(2, 430);
    expect(reduceAct(s1, week0, sceneAct(1, 450, 'nope', 'a'), ctx)).toMatchObject({ reason: 'unknownChoice' });
    expect(reduceAct(s1, week0, sceneAct(1, 450, 'j1.roux', 'a'), ctxNoGuided)).toMatchObject({ reason: 'unknownChoice' });
    expect(reduceAct(s1, week0, sceneAct(1, 450, 'j1.roux', 'dance'), ctx)).toMatchObject({ reason: 'unknownOption' });
    expect(reduceAct(s1, week0, sceneAct(1, 450, 'j1.wake', 'a'), ctx)).toMatchObject({ reason: 'unknownOption' });   // scène sans choix narratif
    expect(reduceAct(s2, week0, sceneAct(2, 450, 'j1.roux', 'a'), ctx)).toMatchObject({ reason: 'outOfOrder' });
    const once = replay([sceneAct(1, 450, 'j1.roux', 'a')], ctx);
    expect(once.rejected).toEqual([]);
    expect(reduceAct(once.state, once.week, sceneAct(1, 451, 'j1.roux', 'c'), ctx)).toMatchObject({ reason: 'choiceClosed' });
  });
  it('test_scene_act_ignored_by_evening_lines', () => {
    const acts = FULL_WEEK_ACTS.filter((a) => a.day === 1);
    expect(eveningLines(1, [...acts, sceneAct(1, 450, 'j1.roux', 'a')], ctx)).toEqual(eveningLines(1, acts, ctx));
  });
});
