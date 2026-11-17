import { describe, expect, it } from 'vitest';
import { blockedReason, decide, restoreJourney, serializeJourney, startJourney } from '../../../src/worlds/state';
import { journeys } from '../../../src/worlds/catalogue';
import { SHORT_WORLDS } from '../../../src/worlds/routing';

describe('distinct short journeys', () => {
  it('covers every living world except the existing 1984 episode', () => {
    expect(Object.keys(journeys).sort()).toEqual(SHORT_WORLDS.filter(w => w !== 'w10').sort());
  });
  for (const id of SHORT_WORLDS.filter(w => w !== 'w10')) {
    it(`${id}: all paths terminate; success, limitations, costs and saves remain consistent`, () => {
      const journey = journeys[id];
      expect(new Set(journey.locations.map(l => l.id)).size).toBeGreaterThanOrEqual(3);
      const endings = new Set<string>();
      const visit = (state = startJourney(journey), depth = 0): void => {
        expect(depth).toBeLessThan(25);
        const scene = journey.scenes.find(s => s.id === state.scene)!;
        expect(scene).toBeDefined(); expect(journey.locations.some(l => l.id === scene.location)).toBe(true);
        expect(restoreJourney(journey, serializeJourney(journey, state))).toEqual(state);
        expect(state.resource).toBeGreaterThanOrEqual(0);
        if (scene.ending) { endings.add(scene.ending); expect(scene.options).toHaveLength(0); return; }
        let possible = 0;
        for (const option of scene.options) {
          const next = decide(journey, state, option.id);
          if (blockedReason(state, option, journey) !== null) { expect(next).toBe(state); continue; }
          possible++; expect(option.consequence.length).toBeGreaterThan(15); visit(next, depth + 1);
        }
        expect(possible).toBeGreaterThan(0);
      };
      visit(); expect(endings.has('success')).toBe(true); expect(endings.size).toBeGreaterThanOrEqual(2);
      const initial = startJourney(journey);
      expect(decide(journey, initial, 'not-an-option')).toBe(initial);
      expect(restoreJourney(journey, '{broken')).toEqual(initial);
      expect(restoreJourney(journey, JSON.stringify({world:'w07', choices:[]}))).toEqual(initial);
    });
  }
});
