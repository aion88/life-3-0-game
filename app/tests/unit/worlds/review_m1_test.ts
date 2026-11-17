import { describe, expect, it } from 'vitest';
import { journeys } from '../../../src/worlds/catalogue';
import { reviews } from '../../../src/worlds/review';
import { narrativeScene } from '../../../src/worlds/narrative';
import { blockedReason, decide, startJourney } from '../../../src/worlds/state';
import type { JourneyWorldId } from '../../../src/worlds/types';

const WORLDS: JourneyWorldId[] = ['w01', 'w02', 'w03', 'w04', 'w05'];
const ENDINGS: Record<string, string[]> = {
  w01: ['together', 'together_data', 'together_public', 'alone', 'outside'],
  w02: ['ours', 'shared', 'perfect'],
  w03: ['useful', 'showcase', 'ranked', 'unfinished'],
  w04: ['bounded', 'waiting', 'unsafe'],
  w05: ['reopened', 'meeting', 'closed'],
};
const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Every string a review writes, with where it sits. */
const reviewStrings = (id: JourneyWorldId): [string, string][] => {
  const out: [string, string][] = [];
  for (const [sceneId, scene] of Object.entries(reviews[id])) {
    for (const key of ['title', 'text', 'speaker', 'objective'] as const) if (scene[key] !== undefined) out.push([`${sceneId}.${key}`, scene[key]!]);
    for (const [optionId, option] of Object.entries(scene.options ?? {})) {
      for (const key of ['label', 'consequence'] as const) if (option[key] !== undefined) out.push([`${sceneId}.${optionId}.${key}`, option[key]!]);
    }
  }
  return out;
};

/** Walks every reachable state; the scene shown is the one the player reads (`narrativeScene`). */
const walk = (id: JourneyWorldId): { shown: Map<string, Set<string>>; endings: Set<string> } => {
  const journey = journeys[id];
  const queue = [startJourney(journey)], seen = new Set<string>();
  const shown = new Map<string, Set<string>>(), endings = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i]!;
    const key = JSON.stringify([state.scene, state.resource, state.inventory]);
    if (seen.has(key)) continue; seen.add(key);
    const scene = journey.scenes.find(s => s.id === state.scene)!;
    const text = narrativeScene(id, scene, state).text;
    shown.set(scene.id, (shown.get(scene.id) ?? new Set<string>()).add(text));
    if (scene.ending) { endings.add(scene.id); continue; }
    for (const option of scene.options) if (blockedReason(state, option, journey) === null) queue.push(decide(journey, state, option.id));
  }
  return { shown, endings };
};

describe('review M1 (w01 à w05)', () => {
  for (const id of WORLDS) {
    describe(id, () => {
      it(`test_review_${id}_voice_noDashNoFillerNoDigit`, () => {
        for (const [where, text] of reviewStrings(id)) {
          expect(text, where).not.toContain('—');
          expect(text.toLowerCase(), where).not.toContain('du coup');
          expect(text, where).not.toMatch(/\d/);
        }
      });

      it(`test_review_${id}_consequences_moreThanFifteenCharacters`, () => {
        for (const [where, text] of reviewStrings(id)) if (where.endsWith('.consequence')) expect(text.length, where).toBeGreaterThan(15);
      });

      it(`test_review_${id}_options_noPriceInLabel`, () => {
        // Le socle affiche le prix depuis `cost` et `gain` : un libellé n'est qu'un geste.
        for (const [where, text] of reviewStrings(id)) if (where.endsWith('.label')) expect(text, where).not.toMatch(/·|crédit|créneau|énergie|bon\b/i);
      });

      it(`test_review_${id}_displayedText_atMostFortyWords_andEndingsReachable`, () => {
        const { shown, endings } = walk(id);
        for (const [sceneId, texts] of shown) for (const text of texts) expect(words(text), `${id}/${sceneId}`).toBeLessThanOrEqual(40);
        expect([...endings].sort()).toEqual([...ENDINGS[id]!].sort());
      });
    });
  }
});
