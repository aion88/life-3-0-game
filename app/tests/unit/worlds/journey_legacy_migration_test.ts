import { describe, expect, it } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { blockedReason, decide, restoreJourney, serializeJourney, startJourney } from '../../../src/worlds/state';
import type { Journey, JourneyState } from '../../../src/worlds/types';

function toEnding(journey: Journey, state = startJourney(journey)): JourneyState {
  const scene = journey.scenes.find(item => item.id === state.scene)!;
  if (scene.ending) return state;
  for (const option of scene.options) {
    if (!blockedReason(state, option, journey)) return toEnding(journey, decide(journey, state, option.id));
  }
  throw new Error(`No valid route from ${scene.id}`);
}

describe('removed optional scenes retain their historical decisions', () => {
  for (const id of ['w02', 'w03'] as const) {
    it(`${id}: restores a pre-change opening with the exact resource, inventory and choice`, () => {
      const journey = journeys[id], first = journey.scenes.find(scene => scene.id === 'encounter_1')!;
      const initial = startJourney(journey);
      expect(first.legacyBefore).toBe(initial.scene);
      const expected = decide(journey, { ...initial, scene: first.id }, first.options[0]!.id, true);
      const oldSave = JSON.stringify({ v: 1, world: id, choices: expected.choices });
      expect(restoreJourney(journey, oldSave)).toEqual(expected);
      expect(restoreJourney(journey, serializeJourney(journey, expected))).toEqual(expected);
      expect(expected.choices).toHaveLength(1);
    });
    it(`${id}: preserves aftermath and handoff facts from completed old saves`, () => {
      const journey = journeys[id], ending = toEnding(journey);
      const aftermath = journey.scenes.find(scene => scene.id === `aftermath_${ending.scene}`)!;
      const handoff = journey.scenes.find(scene => scene.id === `handoff_${ending.scene}`)!;
      expect(aftermath.legacyBefore).toBe(ending.scene);
      let expected = decide(journey, { ...ending, scene: aftermath.id }, aftermath.options[0]!.id, true);
      expected = decide(journey, { ...expected, scene: handoff.id }, handoff.options[0]!.id, true);
      const restored = restoreJourney(journey, serializeJourney(journey, expected));
      expect(restored).toEqual(expected);
      expect(restored.choices).toHaveLength(ending.choices.length + 2);
      expect(restored.inventory).toEqual(expect.arrayContaining([...(aftermath.options[0]!.give ?? []), ...(handoff.options[0]!.give ?? [])]));
      expect(restoreJourney(journey, serializeJourney(journey, restored))).toEqual(restored);
      expect(restoreJourney(journey, serializeJourney(journey, ending))).toEqual(ending);
    });
    it(`${id}: does not use migration to jump ahead or repeat a consumed optional node`, () => {
      const journey = journeys[id], initial = startJourney(journey);
      const first = journey.scenes.find(scene => scene.id === 'encounter_1')!;
      const choice = { scene: first.id, option: first.options[0]!.id };
      expect(restoreJourney(journey, JSON.stringify({ v: 1, world: id, choices: [choice, choice] }))).toEqual(initial);
      const future = journey.scenes.find(scene => scene.id.startsWith('aftermath_'))!;
      expect(restoreJourney(journey, JSON.stringify({ v: 1, world: id, choices: [{ scene: future.id, option: future.options[0]!.id }] }))).toEqual(initial);
    });
  }
});
