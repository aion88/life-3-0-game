import { describe, expect, it } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { reviews, withReview, type WorldReview } from '../../../src/worlds/review';
import type { Journey } from '../../../src/worlds/types';

const w01 = (): Journey => journeys.w01;
const firstScene = (j: Journey) => j.scenes.find(s => s.options.length > 0)!;

describe('withReview', () => {
  it('test_review_overlay_emptyReview_returnsCatalogueIdentical', () => {
    // Arrange: chaque monde avec une revue vide explicite, indépendante du contenu que M1/M2 y mettront.
    for (const journey of Object.values(journeys)) {
      const before = structuredClone(journey);
      // Act
      const after = withReview(journey, {});
      // Assert
      expect(after).toBe(journey);
      expect(after).toEqual(before);
    }
  });

  it('test_review_overlay_allowedKeys_changeOnlyTextFields', () => {
    // Arrange
    const journey = w01(); const scene = firstScene(journey); const option = scene.options[0]!;
    const review: WorldReview = { [scene.id]: { title: 'T', text: 'X', speaker: 'S', objective: 'O', options: { [option.id]: { label: 'L', consequence: 'C', hideWhenBlocked: true } } } };
    // Act
    const after = withReview(journey, review);
    // Assert
    const changed = after.scenes.find(s => s.id === scene.id)!;
    expect(changed).toMatchObject({ title: 'T', text: 'X', speaker: 'S', objective: 'O' });
    expect(changed.options[0]).toMatchObject({ label: 'L', consequence: 'C', hideWhenBlocked: true });
    expect({ ...changed.options[0]!, label: option.label, consequence: option.consequence, hideWhenBlocked: option.hideWhenBlocked }).toEqual(option);
    expect(after.scenes.map(s => s.id)).toEqual(journey.scenes.map(s => s.id));
    expect(journey.scenes.find(s => s.id === scene.id)!.title).not.toBe('T');
  });

  it.each(['cost', 'next', 'require', 'id'])('test_review_overlay_forbiddenOptionKey_%s_isRefused', (key) => {
    const journey = w01(); const scene = firstScene(journey); const option = scene.options[0]!;
    const review = { [scene.id]: { options: { [option.id]: { [key]: 1 } } } } as unknown as WorldReview;
    expect(() => withReview(journey, review)).toThrow(/clé interdite/);
  });

  it.each(['id', 'location', 'options_x', 'ending', 'presentation'])('test_review_overlay_forbiddenSceneKey_%s_isRefused', (key) => {
    const journey = w01(); const scene = firstScene(journey);
    const review = { [scene.id]: { [key]: 'x' } } as unknown as WorldReview;
    expect(() => withReview(journey, review)).toThrow(/clé interdite/);
  });

  it('test_review_overlay_unknownSceneOrOption_isRefused', () => {
    const journey = w01(); const scene = firstScene(journey);
    expect(() => withReview(journey, { nope: { title: 'x' } })).toThrow(/scène inconnue/);
    expect(() => withReview(journey, { [scene.id]: { options: { nope: { label: 'x' } } } })).toThrow(/option inconnue/);
  });

  it('test_review_overlay_shippedReviews_coverTheNineRuntimeWorlds', () => {
    expect(Object.keys(reviews).sort()).toEqual(['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w08', 'w09', 'w11']);
  });
});
