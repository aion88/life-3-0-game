import { describe, expect, it } from 'vitest';
import { loadCore } from '../../../src/data/load';
import { loadFastForwardData } from '../../../src/screens/data';
import { runFastForward } from '../../../src/fastforward/run';
import { findAlternative } from '../../../src/worlds/alternatives';
import { SHORT_WORLDS } from '../../../src/worlds/routing';
import type { Answers, WorldId } from '../../../src/shared/types';
import { ans } from '../../support/answers';
const core = loadCore();
const headlines = loadFastForwardData().headlines;
const WORLDS: WorldId[] = ['w01','w02','w03','w04','w05','w06','w07','w08','w09','w10','w11','w12'];
const outcome = (answers: Answers) => {
  const run = runFastForward(core, headlines, answers, false, SHORT_WORLDS);
  return run.outcome.kind === 'arrival' ? run.outcome.livedWorld : run.outcome.world;
};

describe('verified alternatives', () => {
  it.each(['AAAAAAAAAAA', 'ACBACBACAAD', 'CBCCBDDACCD'])('reaches all twelve worlds from %s while preserving original answers', line => {
    const original = ans(line); const before = { ...original }; Object.freeze(original);
    for (const world of WORLDS) {
      const path = findAlternative(core, original, world);
      expect(path, world).not.toBeNull();
      expect(outcome(path!.answers), world).toBe(world);
      expect(path!.targetWorld).toBe(world);
      expect(path!.simulations).toBeLessThan(170);
      expect(path!.changes).toEqual(core.questionnaire.questions.filter(q => before[q.key] !== path!.answers[q.key]).map(q => ({ question: q.key, from: before[q.key], to: path!.answers[q.key] })));
      expect(original).toEqual(before);
    }
  });
  it('returns a reproducible route and removes each individually unnecessary seed edit', () => {
    const original = ans('AAAAAAAAAAA');
    for (const world of WORLDS) {
      const first = findAlternative(core, original, world)!;
      expect(findAlternative(core, original, world)).toEqual(first);
      if (first.method !== 'seed') continue;
      for (const change of first.changes) expect(outcome({ ...first.answers, [change.question]: change.from })).not.toBe(world);
    }
  });
  it('returns no changes for the current destination', () => {
    const original = ans('ACBACBACAAD');
    const path = findAlternative(core, original, outcome(original))!;
    expect(path.method).toBe('unchanged'); expect(path.changes).toEqual([]);
    expect(path.answers).toEqual(original); expect(path.answers).not.toBe(original);
  });
  it('finds an available one-answer alternative before using a witness', () => {
    const original = ans('AAAAAAAAAAA');
    let checked = false;
    for (const q of core.questionnaire.questions) {
      const change = q.answers.find(a => outcome({ ...original, [q.key]: a.key }) !== outcome(original));
      if (!change) continue;
      const target = outcome({ ...original, [q.key]: change.key });
      const path = findAlternative(core, original, target)!;
      expect(path.method).toBe('single'); expect(path.changes).toHaveLength(1); checked = true; break;
    }
    expect(checked).toBe(true);
  });
  it('rejects incomplete answers instead of filling the missing choices', () => {
    expect(findAlternative(core, {} as Answers, 'w01')).toBeNull();
  });
  it('returns null rather than force an outcome if a changed model invalidates the witness', () => {
    const staticCore = { ...core, engine: { ...core.engine, couplings: [], steps: { ...core.engine.steps, pushSteps: [] }, extinctions: [] } };
    // No trajectory in this altered model can reach an extinction.
    expect(findAlternative(staticCore, ans('AAAAAAAAAAA'), 'w07')).toBeNull();
  });
});
