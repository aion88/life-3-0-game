import { describe, expect, it } from 'vitest';
import { clearDinnerObservation, dinnerGestures, dinnerObjects, freshDinner, inspectDinner, type DinnerObjectId } from '../../../src/street/episode/dinner';
import { choose, freshEpisode, story } from '../../../src/street/episode/story';

describe('dinner observation', () => {
  const orders: readonly (readonly DinnerObjectId[])[] = [
    ['plate', 'basil', 'bracelet'], ['plate', 'bracelet', 'basil'],
    ['basil', 'plate', 'bracelet'], ['basil', 'bracelet', 'plate'],
    ['bracelet', 'plate', 'basil'], ['bracelet', 'basil', 'plate'],
  ];
  it.each(orders.map(order => [order.join(' → '), order] as const))('allows observation in any order: %s', (_label, order) => {
    const initial = freshDinner();
    const state = order.reduce(inspectDinner, initial);
    expect(state.seen).toEqual(order);
    expect(state.current).toBe(order.at(-1));
    expect(initial).toEqual({ seen: [], current: null });
  });

  it('revisits without farming observations or changing the episode', () => {
    const state = inspectDinner(inspectDinner(freshDinner(), 'plate'), 'basil');
    const revisited = inspectDinner(state, 'plate');
    expect(revisited.seen).toBe(state.seen);
    expect(revisited.current).toBe('plate');
    expect(inspectDinner(revisited, 'plate')).toBe(revisited);
    expect(inspectDinner(revisited, 'not-an-object')).toBe(revisited);
    expect(clearDinnerObservation(revisited)).toEqual({ seen: ['plate', 'basil'], current: null });
    expect(revisited.current).toBe('plate');
  });

  it('can stay or leave immediately, with the existing story consequences', () => {
    const atDinner = ['help', 'accept', 'dinner'].reduce(choose, freshEpisode());
    const unobserved = freshDinner();
    expect(atDinner.scene).toBe('dinner');
    expect(unobserved.seen).toEqual([]);
    expect(dinnerGestures.map(g => g.option)).toEqual(['stay', 'leave']);
    for (const gesture of dinnerGestures) {
      expect(story.dinner!.options.some(o => o.id === gesture.option)).toBe(true);
      expect(choose(atDinner, gesture.option).scene).toBe(gesture.option === 'stay' ? 'confession' : 'departure');
    }
    const stay = choose(atDinner, dinnerGestures[0]!.option);
    const leave = choose(atDinner, dinnerGestures[1]!.option);
    expect(stay.trust).toBeGreaterThan(leave.trust);
    expect(stay.exposure).toBeGreaterThan(leave.exposure);
  });

  it('provides a short reaction and a unique target for each inspectable object', () => {
    expect(dinnerObjects.map(o => o.id)).toEqual(['plate', 'basil', 'bracelet']);
    for (const object of dinnerObjects) {
      expect(object.label.length).toBeGreaterThan(0);
      expect(object.speaker.length).toBeGreaterThan(0);
      expect(object.reaction.length).toBeLessThan(170);
    }
  });
});
